const request = require('supertest');
const app = require('../src/app');

describe('API Health Check', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
  });
});

describe('API 404 Handler', () => {
  test('Unknown route should return 404', async () => {
    const response = await request(app).get('/api/unknown-route');
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  });
});
