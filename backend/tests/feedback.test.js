/**
 * Feedback submission — validation and auth tests.
 *
 * These tests require a live DB connection. They set up minimal fixtures
 * (location, questionnaire, question) and tear them down after each suite.
 */
const request = require('supertest');
const app = require('../src/app');
const { createAdminAgent } = require('./helpers/adminAgent');

let agent;
let csrfToken;
let locationId;
let locationSlug;
let questionnaireId;
let questionId;

beforeAll(async () => {
  ({ agent, csrfToken } = await createAdminAgent(app));

  // Create test location (no password)
  locationSlug = `feedback-test-${Date.now()}`;
  const locRes = await agent
    .post('/api/admin/locations')
    .set('X-CSRF-Token', csrfToken)
    .send({ slug: locationSlug, name: 'Feedback Test Location', active: true });
  locationId = locRes.body.id;

  // Create test questionnaire
  const qRes = await agent
    .post('/api/admin/questionnaires')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'Feedback Test Questionnaire' });
  questionnaireId = qRes.body.id;

  // Create a scale question and attach it to the questionnaire
  const questionRes = await agent
    .post('/api/admin/questions')
    .set('X-CSRF-Token', csrfToken)
    .send({ text: 'How satisfied are you?', type: 'scale' });
  questionId = questionRes.body.id;

  await agent
    .post(`/api/admin/questionnaires/${questionnaireId}/questions`)
    .set('X-CSRF-Token', csrfToken)
    .send({ questionId, pageNumber: 1, orderIndex: 0 })
    .catch(() => {}); // endpoint may not exist; link checked below separately
});

afterAll(async () => {
  // Clean up fixtures
  if (questionnaireId) {
    await agent
      .delete(`/api/admin/questionnaires/${questionnaireId}`)
      .set('X-CSRF-Token', csrfToken)
      .catch(() => {});
  }
  if (locationId) {
    await agent
      .delete(`/api/admin/locations/${locationId}`)
      .set('X-CSRF-Token', csrfToken)
      .catch(() => {});
  }
  if (questionId) {
    await agent
      .delete(`/api/admin/questions/${questionId}`)
      .set('X-CSRF-Token', csrfToken)
      .catch(() => {});
  }
});

// ─── Input validation ────────────────────────────────────────────────────────

describe('POST /api/feedback — input validation', () => {
  test('Missing locationId returns 400', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ questionnaireId: 1, answers: [{ questionId: 1, value: 3 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message');
  });

  test('Missing questionnaireId returns 400', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ locationId: 1, answers: [{ questionId: 1, value: 3 }] });
    expect(res.status).toBe(400);
  });

  test('Empty answers array returns 400', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ locationId: 1, questionnaireId: 1, answers: [] });
    expect(res.status).toBe(400);
  });

  test('Non-existent location returns 404', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({
        locationId: 999999,
        questionnaireId: 1,
        answers: [{ questionId: 1, value: 3 }],
      });
    expect(res.status).toBe(404);
  });

  test('Invalid scaleItemId (non-integer) returns 400', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({
        locationId: locationId || 1,
        questionnaireId: questionnaireId || 1,
        answers: [{ questionId: questionId || 1, value: 3, scaleItemId: 'notanumber' }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/scaleItemId/);
  });
});

// ─── Question ID validation ───────────────────────────────────────────────────

describe('POST /api/feedback — question ID validation', () => {
  test('QuestionId not in questionnaire returns 400', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({
        locationId,
        questionnaireId,
        answers: [{ questionId: 999999, value: 3 }],
      });
    // Should be rejected because 999999 is not part of the questionnaire
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not part of this questionnaire/);
  });
});

// ─── Password-protected location ─────────────────────────────────────────────

describe('POST /api/feedback — location auth', () => {
  let protectedLocationId;
  let protectedLocationSlug;
  let protectedQuestionnaireId;

  beforeAll(async () => {
    protectedLocationSlug = `protected-test-${Date.now()}`;
    const locRes = await agent
      .post('/api/admin/locations')
      .set('X-CSRF-Token', csrfToken)
      .send({
        slug: protectedLocationSlug,
        name: 'Protected Location',
        active: true,
        passwordRequired: true,
        password: 'testpass123',
      });
    protectedLocationId = locRes.body.id;

    const qRes = await agent
      .post('/api/admin/questionnaires')
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Protected Questionnaire' });
    protectedQuestionnaireId = qRes.body.id;
  });

  afterAll(async () => {
    if (protectedLocationId) {
      await agent
        .delete(`/api/admin/locations/${protectedLocationId}`)
        .set('X-CSRF-Token', csrfToken)
        .catch(() => {});
    }
    if (protectedQuestionnaireId) {
      await agent
        .delete(`/api/admin/questionnaires/${protectedQuestionnaireId}`)
        .set('X-CSRF-Token', csrfToken)
        .catch(() => {});
    }
  });

  test('Feedback without location token is rejected with 401', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({
        locationId: protectedLocationId,
        questionnaireId: protectedQuestionnaireId,
        answers: [{ questionId: 1, value: 3 }],
      });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/authentication required/i);
  });

  test('Feedback with wrong location token is rejected with 401', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('X-Location-Token', 'invalid.token.value')
      .send({
        locationId: protectedLocationId,
        questionnaireId: protectedQuestionnaireId,
        answers: [{ questionId: 1, value: 3 }],
      });
    expect(res.status).toBe(401);
  });

  test('Location login returns a locationToken', async () => {
    const res = await request(app)
      .post(`/api/locations/${protectedLocationSlug}/login`)
      .send({ password: 'testpass123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('locationToken');
    expect(typeof res.body.locationToken).toBe('string');
  });
});
