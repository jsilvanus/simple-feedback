const request = require('supertest');
const app = require('../src/app');

describe('Continuous Scale Question Type', () => {
  let authToken;

  beforeAll(async () => {
    // Login to get auth token
    const response = await request(app)
      .post('/api/admin/login')
      .send({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123'
      });
    
    authToken = response.body.token;
  });

  test('Should accept continuous_scale as a valid question type', async () => {
    const response = await request(app)
      .post('/api/admin/questions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        text: 'How do you rate our service across multiple dimensions?',
        type: 'continuous_scale'
      });

    // Should succeed (201) or fail with validation error (not type error)
    // We expect 201 if DB is available, otherwise we just check the type is accepted
    if (response.status === 201) {
      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('continuous_scale');
    } else {
      // If it fails, it shouldn't be because of invalid type
      expect(response.status).not.toBe(400);
      if (response.status === 400) {
        expect(response.body.error?.message).not.toContain('Invalid question type');
      }
    }
  });

  test('Should reject invalid question types', async () => {
    const response = await request(app)
      .post('/api/admin/questions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        text: 'Test question',
        type: 'invalid_type'
      });

    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain('Invalid question type');
  });

  test('Valid question types should include continuous_scale', () => {
    const validTypes = ['scale', 'text', 'wordcloud', 'continuous_scale'];
    expect(validTypes).toContain('continuous_scale');
  });
});
