const request = require('supertest');
const app = require('../src/app');
const { createUser, getToken, truncateAll } = require('./helpers');

beforeAll(truncateAll);
afterAll(() => require('../src/db').end());

describe('POST /api/auth/register', () => {
  it('creates a user with pending status', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new@test.com', password: 'Password123', name: 'New User',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.status).toBe('pending');
  });

  it('rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new@test.com', password: 'Password123', name: 'Dupe',
    });
    expect(res.status).toBe(409);
  });

  it('rejects short password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'short@test.com', password: '123', name: 'Short',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  let approvedUser;
  beforeAll(async () => {
    approvedUser = await createUser({ email: 'approved@test.com', password: 'Password123', name: 'Approved' });
    await createUser({ email: 'pending@test.com', password: 'Password123', name: 'Pending', status: 'pending' });
  });

  it('returns token for approved user', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'approved@test.com', password: 'Password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('member');
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'approved@test.com', password: 'wrongpass',
    });
    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'ghost@test.com', password: 'Password123',
    });
    expect(res.status).toBe(401);
  });

  it('rejects pending user', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'pending@test.com', password: 'Password123',
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/auth/activity', () => {
  let user;
  beforeAll(async () => {
    user = await createUser({ email: 'activity@test.com', name: 'Activity User' });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/activity');
    expect(res.status).toBe(401);
  });

  it('returns experiment/dataset/publication arrays (no 500)', async () => {
    const res = await request(app)
      .get('/api/auth/activity')
      .set('Authorization', `Bearer ${getToken(user)}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.experiments)).toBe(true);
    expect(Array.isArray(res.body.datasets)).toBe(true);
    expect(Array.isArray(res.body.publications)).toBe(true);
  });
});
