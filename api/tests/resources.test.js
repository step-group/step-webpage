const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db');
const { createUser, getToken, truncateAll } = require('./helpers');

let owner, other, ownerToken, otherToken;
let expId, resourceId;
const INITIAL_STOCK = 100;

beforeAll(async () => {
  await truncateAll();

  [owner, other] = await Promise.all([
    createUser({ email: 'resowner@test.com', name: 'Owner' }),
    createUser({ email: 'resother@test.com', name: 'Other' }),
  ]);
  ownerToken = getToken(owner);
  otherToken = getToken(other);

  // Create experiment
  const expRes = await request(app)
    .post('/api/experiments')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ title: 'Resource Test Exp', date: '2024-01-01' });
  expId = expRes.body.id;

  // Insert resource directly into DB
  const rRes = await pool.query(
    `INSERT INTO resources (name, quantity, unit, created_by)
     VALUES ('Ethanol', $1, 'mL', $2) RETURNING id`,
    [INITIAL_STOCK, owner.id]
  );
  resourceId = rRes.rows[0].id;
});

afterAll(() => pool.end());

describe('Resource link — stock deduction', () => {
  it('non-owner cannot link resource', async () => {
    const res = await request(app)
      .post(`/api/experiments/${expId}/links`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ resource_id: resourceId, quantity_used: 10 });
    expect(res.status).toBe(403);
  });

  it('linking with quantity deducts stock', async () => {
    const res = await request(app)
      .post(`/api/experiments/${expId}/links`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ resource_id: resourceId, quantity_used: 30 });
    expect(res.status).toBe(201);

    const { rows } = await pool.query('SELECT quantity FROM resources WHERE id = $1', [resourceId]);
    expect(Number(rows[0].quantity)).toBe(INITIAL_STOCK - 30);
  });

  it('duplicate link does NOT double-deduct stock', async () => {
    // Link same resource again — ON CONFLICT DO NOTHING should prevent it
    await request(app)
      .post(`/api/experiments/${expId}/links`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ resource_id: resourceId, quantity_used: 30 });

    const { rows } = await pool.query('SELECT quantity FROM resources WHERE id = $1', [resourceId]);
    // Stock should still be INITIAL_STOCK - 30, not - 60
    expect(Number(rows[0].quantity)).toBe(INITIAL_STOCK - 30);
  });

  it('insufficient stock returns 400', async () => {
    // Create a separate resource with only 5 units
    const { rows } = await pool.query(
      `INSERT INTO resources (name, quantity, unit, created_by) VALUES ('AcetoneLow', 5, 'mL', $1) RETURNING id`,
      [owner.id]
    );
    const lowId = rows[0].id;

    const res = await request(app)
      .post(`/api/experiments/${expId}/links`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ resource_id: lowId, quantity_used: 50 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insuficiente/i);
  });

  it('unlinking restores stock', async () => {
    const res = await request(app)
      .delete(`/api/experiments/${expId}/links/${resourceId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(204);

    const { rows } = await pool.query('SELECT quantity FROM resources WHERE id = $1', [resourceId]);
    expect(Number(rows[0].quantity)).toBe(INITIAL_STOCK);
  });

  it('non-owner cannot unlink resource', async () => {
    // Re-link so there is something to try to remove
    await request(app)
      .post(`/api/experiments/${expId}/links`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ resource_id: resourceId, quantity_used: 0 });

    const res = await request(app)
      .delete(`/api/experiments/${expId}/links/${resourceId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});
