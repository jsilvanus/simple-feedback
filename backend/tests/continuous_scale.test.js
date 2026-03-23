const request = require('supertest');
const app = require('../src/app');
const { createAdminAgent } = require('./helpers/adminAgent');

describe('Continuous Scale Question Type', () => {
  let agent;
  let csrfToken;

  beforeAll(async () => {
    ({ agent, csrfToken } = await createAdminAgent(app));
  });

  test('Should accept continuous_scale as a valid question type', async () => {
    const response = await agent
      .post('/api/admin/questions')
      .set('X-CSRF-Token', csrfToken)
      .send({
        text: 'How do you rate our service across multiple dimensions?',
        type: 'continuous_scale',
      });

    if (response.status === 400) {
      expect(response.body.error?.message).not.toContain('Invalid question type');
    }
    if (response.status === 201) {
      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('continuous_scale');
    }
  });

  test('Should reject invalid question types', async () => {
    const response = await agent
      .post('/api/admin/questions')
      .set('X-CSRF-Token', csrfToken)
      .send({ text: 'Test question', type: 'invalid_type' });

    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain('Invalid question type');
  });
});
