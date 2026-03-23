const request = require('supertest');
const app = require('../src/app');
const { createAdminAgent } = require('./helpers/adminAgent');

let agent;
let csrfToken;

beforeAll(async () => {
  ({ agent, csrfToken } = await createAdminAgent(app));
});

describe('Location Groups API', () => {
  let createdGroupId;
  let createdLocationId;

  describe('POST /api/admin/location-groups', () => {
    test('should create a new location group', async () => {
      const response = await agent
        .post('/api/admin/location-groups')
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Test Group',
          description: 'A test location group',
          active: true,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Group');
      expect(response.body.description).toBe('A test location group');
      expect(response.body.active).toBe(true);

      createdGroupId = response.body.id;
    });

    test('should require name field', async () => {
      const response = await agent
        .post('/api/admin/location-groups')
        .set('X-CSRF-Token', csrfToken)
        .send({ description: 'No name provided' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/location-groups', () => {
    test('should retrieve all location groups', async () => {
      const response = await agent.get('/api/admin/location-groups');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const group = response.body.find(g => g.id === createdGroupId);
      expect(group).toBeDefined();
      expect(group.name).toBe('Test Group');
    });
  });

  describe('PUT /api/admin/location-groups/:id', () => {
    test('should update a location group', async () => {
      const response = await agent
        .put(`/api/admin/location-groups/${createdGroupId}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Updated Test Group',
          description: 'Updated description',
          active: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Test Group');
      expect(response.body.description).toBe('Updated description');
      expect(response.body.active).toBe(false);
    });
  });

  describe('Location to Group Assignment', () => {
    test('should create a location and assign it to a group', async () => {
      const locationResponse = await agent
        .post('/api/admin/locations')
        .set('X-CSRF-Token', csrfToken)
        .send({
          slug: 'test-location-group',
          name: 'Test Location for Group',
          active: true,
          groupId: createdGroupId,
        });

      expect(locationResponse.status).toBe(201);
      expect(locationResponse.body).toHaveProperty('id');
      createdLocationId = locationResponse.body.id;

      const locationsResponse = await agent.get('/api/admin/locations');
      const location = locationsResponse.body.find(l => l.id === createdLocationId);
      expect(location).toBeDefined();
      expect(location.group_id).toBe(createdGroupId);
    });
  });

  describe('Group-Level Schedules', () => {
    let questionnaireId;

    beforeAll(async () => {
      const questionnaireResponse = await agent
        .post('/api/admin/questionnaires')
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Test Questionnaire for Groups',
          description: 'For testing group-level schedules',
        });
      questionnaireId = questionnaireResponse.body.id;
    });

    test('should create a schedule for a location group', async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000);

      const response = await agent
        .post('/api/admin/schedules')
        .set('X-CSRF-Token', csrfToken)
        .send({
          locationTargets: [{ locationGroupId: createdGroupId }],
          questionnaireIds: [questionnaireId],
          scheduleType: 'date_based',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          showOnlyOne: false,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });
  });

  describe('DELETE /api/admin/location-groups/:id', () => {
    test('should delete a location group', async () => {
      if (createdLocationId) {
        await agent
          .delete(`/api/admin/locations/${createdLocationId}`)
          .set('X-CSRF-Token', csrfToken);
      }

      const response = await agent
        .delete(`/api/admin/location-groups/${createdGroupId}`)
        .set('X-CSRF-Token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    test('should return 404 for non-existent group', async () => {
      const response = await agent
        .delete('/api/admin/location-groups/99999')
        .set('X-CSRF-Token', csrfToken);

      expect(response.status).toBe(404);
    });
  });
});
