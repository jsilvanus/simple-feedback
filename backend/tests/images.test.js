/**
 * Image upload / proxy-read tests — cover the storage-adapter integration
 * (STORAGE_DRIVER defaults to "local" for these tests, driven by a real DB).
 */
const request = require('supertest');
const app = require('../src/app');
const { createAdminAgent } = require('./helpers/adminAgent');

// Smallest possible valid PNG (1x1 transparent pixel)
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

let agent;
let csrfToken;

beforeAll(async () => {
  ({ agent, csrfToken } = await createAdminAgent(app));
});

describe('POST /api/admin/images', () => {
  let createdImageId;
  let createdImageUrl;

  afterAll(async () => {
    if (createdImageId) {
      await agent
        .delete(`/api/admin/images/${createdImageId}`)
        .set('X-CSRF-Token', csrfToken)
        .catch(() => {});
    }
  });

  test('rejects unauthenticated upload', async () => {
    const res = await request(app)
      .post('/api/admin/images')
      .attach('image', PNG_BUFFER, { filename: 'test.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  test('rejects non-image file types', async () => {
    const res = await agent
      .post('/api/admin/images')
      .set('X-CSRF-Token', csrfToken)
      .attach('image', Buffer.from('not an image'), { filename: 'test.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message');
  });

  test('rejects a request with no file', async () => {
    const res = await agent
      .post('/api/admin/images')
      .set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(400);
  });

  test('uploads a valid image and stores it via the configured storage driver', async () => {
    const res = await agent
      .post('/api/admin/images')
      .set('X-CSRF-Token', csrfToken)
      .attach('image', PNG_BUFFER, { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('storage_key');
    expect(res.body.url).toBe(`/api/images/${res.body.storage_key}`);
    expect(res.body.mime_type).toBe('image/png');

    createdImageId = res.body.id;
    createdImageUrl = res.body.url;
  });

  test('uploaded image appears in the admin list', async () => {
    const res = await agent.get('/api/admin/images').set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.some((img) => img.id === createdImageId)).toBe(true);
  });

  test('public proxy-read serves the uploaded bytes without auth', async () => {
    const res = await request(app).get(createdImageUrl);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(res.body, PNG_BUFFER)).toBe(0);
  });

  test('public proxy-read 404s for an unknown filename', async () => {
    const res = await request(app).get('/api/images/does-not-exist.png');
    expect(res.status).toBe(404);
  });

  test('DELETE removes the DB row and the underlying object', async () => {
    const res = await agent
      .delete(`/api/admin/images/${createdImageId}`)
      .set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);

    const readBack = await request(app).get(createdImageUrl);
    expect(readBack.status).toBe(404);

    createdImageId = null;
    createdImageUrl = null;
  });

  test('DELETE on an unknown id returns 404', async () => {
    const res = await agent
      .delete('/api/admin/images/99999999')
      .set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(404);
  });
});
