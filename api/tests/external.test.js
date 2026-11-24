const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db');
const { createUser, getToken, truncateAll } = require('./helpers');

let admin, member, external, adminToken, memberToken, externalToken, equipId;

const as = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await truncateAll();
  [admin, member, external] = await Promise.all([
    createUser({ email: 'xadmin@test.com',  name: 'Admin', role: 'admin' }),
    createUser({ email: 'xmember@test.com', name: 'Marta' }),
    createUser({ email: 'xext@test.com',    name: 'Externa', role: 'external' }),
  ]);
  adminToken = getToken(admin);
  memberToken = getToken(member);
  externalToken = getToken(external);
  const { rows } = await pool.query("INSERT INTO equipment (name, created_by) VALUES ('Microondas', $1) RETURNING id", [admin.id]);
  equipId = rows[0].id;
});

afterAll(() => pool.end());

const book = (token, body) =>
  request(app).post(`/api/equipment/${equipId}/reservations`).set(as(token)).send(body);

describe('External users', () => {
  it('external can list equipment, book it and see it on the calendar', async () => {
    const list = await request(app).get('/api/equipment').set(as(externalToken));
    expect(list.status).toBe(200);
    expect(list.body.map(e => e.id)).toContain(equipId);

    const res = await book(externalToken, { title: 'Mi corrida', starts_at: '2026-12-05T10:00:00Z', ends_at: '2026-12-05T12:00:00Z' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');

    const range = await request(app).get(`/api/equipment/${equipId}/reservations`)
      .query({ from: '2026-12-05T00:00:00Z', to: '2026-12-06T00:00:00Z' }).set(as(externalToken));
    expect(range.status).toBe(200);
    expect(range.body.map(r => r.title)).toContain('Mi corrida');
  });

  it('external is refused everywhere outside the calendar', async () => {
    for (const path of ['/api/resources', '/api/experiments', '/api/templates', '/api/publications', '/api/datasets/1', '/api/admin/users']) {
      const res = await request(app).get(path).set(as(externalToken));
      expect([path, res.status]).toEqual([path, 403]);
    }
  });

  it('look-alike prefixes are refused', async () => {
    for (const path of ['/api/equipmentx', '/api/authx']) {
      const res = await request(app).get(path).set(as(externalToken));
      expect([path, res.status]).toEqual([path, 403]);
    }
  });

  it('external can still read their own profile', async () => {
    const res = await request(app).get('/api/auth/me').set(as(externalToken));
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('external');
  });

  it('external booking over 48 hours is pending', async () => {
    const res = await book(externalToken, { title: 'Larga', starts_at: '2026-12-10T00:00:00Z', ends_at: '2026-12-13T00:00:00Z' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });

  it('external cannot create or archive equipment or list pending approvals', async () => {
    const create = await request(app).post('/api/equipment').set(as(externalToken)).send({ name: 'Intruso' });
    const archive = await request(app).patch(`/api/equipment/${equipId}`).set(as(externalToken)).send({ active: false });
    const pending = await request(app).get('/api/equipment/reservations/pending').set(as(externalToken));
    expect([create.status, archive.status, pending.status]).toEqual([403, 403, 403]);
  });

  it('member and admin are unaffected', async () => {
    expect((await request(app).get('/api/resources').set(as(memberToken))).status).toBe(200);
    expect((await request(app).get('/api/resources').set(as(adminToken))).status).toBe(200);
  });

  it('unauthenticated requests still get 401, and a garbage token does not crash', async () => {
    expect((await request(app).get('/api/resources')).status).toBe(401);
    expect((await request(app).get('/api/resources').set(as('garbage'))).status).toBe(401);
  });

  it('a member demoted to external is blocked immediately with the old token', async () => {
    const victim = await createUser({ email: 'xdemoted@test.com', name: 'Demotada' });
    const oldToken = getToken(victim);
    expect((await request(app).get('/api/resources').set(as(oldToken))).status).toBe(200);

    const change = await request(app).patch(`/api/admin/users/${victim.id}/role`).set(as(adminToken)).send({ role: 'external' });
    expect(change.status).toBe(200);
    expect(change.body.role).toBe('external');

    expect((await request(app).get('/api/resources').set(as(oldToken))).status).toBe(403);
  });

  it('an invalid role is rejected', async () => {
    const res = await request(app).patch(`/api/admin/users/${member.id}/role`).set(as(adminToken)).send({ role: 'banana' });
    expect(res.status).toBe(400);
  });

  it('external sees only their own notes', async () => {
    await book(memberToken, { title: 'De Marta', notes: 'secreto', starts_at: '2026-12-01T10:00:00Z', ends_at: '2026-12-01T11:00:00Z' });
    await book(externalToken, { title: 'De Externa', notes: 'mío', starts_at: '2026-12-01T12:00:00Z', ends_at: '2026-12-01T13:00:00Z' });
    const query = (token) => request(app).get(`/api/equipment/${equipId}/reservations`)
      .query({ from: '2026-12-01T00:00:00Z', to: '2026-12-02T00:00:00Z' }).set(as(token));
    const byTitle = (res, t) => res.body.find(r => r.title === t);

    const seenByExternal = await query(externalToken);
    expect(byTitle(seenByExternal, 'De Marta').notes).toBe('');
    expect(byTitle(seenByExternal, 'De Externa').notes).toBe('mío');

    const seenByMember = await query(memberToken);
    expect(byTitle(seenByMember, 'De Marta').notes).toBe('secreto');
  });
});
