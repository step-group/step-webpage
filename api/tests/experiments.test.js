const request = require('supertest');
const app = require('../src/app');
const { createUser, getToken, truncateAll } = require('./helpers');

let owner, other, admin;
let ownerToken, otherToken, adminToken;
let expId, stepId;

beforeAll(async () => {
  await truncateAll();

  [owner, other, admin] = await Promise.all([
    createUser({ email: 'owner@exp.test', name: 'Owner' }),
    createUser({ email: 'other@exp.test', name: 'Other' }),
    createUser({ email: 'admin@exp.test', name: 'Admin', role: 'admin' }),
  ]);
  ownerToken = getToken(owner);
  otherToken = getToken(other);
  adminToken = getToken(admin);

  // Create one experiment per user
  const [e1] = await Promise.all([
    request(app).post('/api/experiments').set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Exp Owner', date: '2024-01-01' }),
    request(app).post('/api/experiments').set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Exp Other', date: '2024-01-02' }),
  ]);
  expId = e1.body.id;

  // Add a step to expId
  const stepRes = await request(app)
    .post(`/api/experiments/${expId}/steps`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ body: 'Step 1', ordering: 0 });
  stepId = stepRes.body.id;
});

afterAll(() => require('../src/db').end());

describe('GET /api/experiments', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/experiments');
    expect(res.status).toBe(401);
  });

  it('member sees only their own experiments', async () => {
    const res = await request(app)
      .get('/api/experiments')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every(e => e.created_by_name === 'Owner')).toBe(true);
    expect(res.body.some(e => e.title === 'Exp Other')).toBe(false);
  });

  it('admin sees all experiments', async () => {
    const res = await request(app)
      .get('/api/experiments')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('POST /api/experiments', () => {
  it('creates experiment owned by requester', async () => {
    const res = await request(app)
      .post('/api/experiments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'New Exp', date: '2024-06-01' });
    expect(res.status).toBe(201);
    expect(res.body.created_by).toBe(owner.id);
  });
});

describe('PATCH /api/experiments/:id', () => {
  it('owner can update', async () => {
    const res = await request(app)
      .patch(`/api/experiments/${expId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Updated Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

  it('non-owner gets 403', async () => {
    const res = await request(app)
      .patch(`/api/experiments/${expId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('admin can update any experiment', async () => {
    const res = await request(app)
      .patch(`/api/experiments/${expId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'success' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/experiments/:id', () => {
  let tempExpId;
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/experiments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'To Delete', date: '2024-01-01' });
    tempExpId = res.body.id;
  });

  it('non-owner gets 403', async () => {
    const res = await request(app)
      .delete(`/api/experiments/${tempExpId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('owner can delete', async () => {
    const res = await request(app)
      .delete(`/api/experiments/${tempExpId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(204);
  });
});

describe('Steps ownership', () => {
  it('non-owner cannot add step', async () => {
    const res = await request(app)
      .post(`/api/experiments/${expId}/steps`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ body: 'Intruder step', ordering: 99 });
    expect(res.status).toBe(403);
  });

  it('non-owner cannot toggle step', async () => {
    const res = await request(app)
      .patch(`/api/experiments/${expId}/steps/${stepId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ finished: true });
    expect(res.status).toBe(403);
  });

  it('owner can toggle step', async () => {
    const res = await request(app)
      .patch(`/api/experiments/${expId}/steps/${stepId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ finished: true });
    expect(res.status).toBe(200);
    expect(res.body.finished).toBe(true);
    expect(res.body.finished_at).not.toBeNull();
  });

  it('non-owner cannot delete step', async () => {
    const res = await request(app)
      .delete(`/api/experiments/${expId}/steps/${stepId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});
