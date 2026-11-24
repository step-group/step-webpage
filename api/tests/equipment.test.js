const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db');
const { createUser, getToken, truncateAll } = require('./helpers');

let admin, ana, beto, adminToken, anaToken, betoToken;

beforeAll(async () => {
  await truncateAll();
  [admin, ana, beto] = await Promise.all([
    createUser({ email: 'eqadmin@test.com', name: 'Admin', role: 'admin' }),
    createUser({ email: 'eqana@test.com',   name: 'Ana' }),
    createUser({ email: 'eqbeto@test.com',  name: 'Beto' }),
  ]);
  adminToken = getToken(admin);
  anaToken   = getToken(ana);
  betoToken  = getToken(beto);
});

afterAll(() => pool.end());

// Each test group gets its own equipment so bookings never leak between groups.
async function newEquipment(name = 'Microondas') {
  const { rows } = await pool.query(
    'INSERT INTO equipment (name, created_by) VALUES ($1, $2) RETURNING id',
    [name, admin.id]
  );
  return rows[0].id;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const book = (equipId, token, body) =>
  request(app).post(`/api/equipment/${equipId}/reservations`).set(auth(token)).send(body);

// Ana's reference block: 24/11/2026 20:00Z to 25/11/2026 23:00Z (multi-day).
const BLOCK = { title: 'Digestión', starts_at: '2026-11-24T20:00:00Z', ends_at: '2026-11-25T23:00:00Z' };

describe('Equipment management', () => {
  it('member cannot create equipment', async () => {
    const res = await request(app).post('/api/equipment').set(auth(anaToken)).send({ name: 'Centrífuga' });
    expect(res.status).toBe(403);
  });

  it('creating equipment without a name is rejected', async () => {
    const res = await request(app).post('/api/equipment').set(auth(adminToken)).send({ description: 'sin nombre' });
    expect(res.status).toBe(400);
  });

  it('creating equipment with a non-string name is rejected with 400', async () => {
    const res = await request(app).post('/api/equipment').set(auth(adminToken)).send({ name: 123 });
    expect(res.status).toBe(400);
  });

  it('admin creates equipment', async () => {
    const res = await request(app).post('/api/equipment').set(auth(adminToken))
      .send({ name: 'Centrífuga', location: 'Lab STEP' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Centrífuga', location: 'Lab STEP', active: true });
  });

  it('archived equipment is hidden and cannot be booked', async () => {
    const id = await newEquipment('Estufa');
    const archive = await request(app).patch(`/api/equipment/${id}`).set(auth(adminToken)).send({ active: false });
    expect(archive.status).toBe(200);

    const list = await request(app).get('/api/equipment').set(auth(anaToken));
    expect(list.status).toBe(200);
    expect(list.body.map(e => e.id)).not.toContain(id);

    const res = await book(id, anaToken, BLOCK);
    expect(res.status).toBe(404);
  });
});

describe('Reservations', () => {
  it('books a multi-day block (2026-11-24T20:00Z to 2026-11-25T23:00Z)', async () => {
    const id = await newEquipment();
    const res = await book(id, anaToken, BLOCK);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ equipment_id: id, user_id: ana.id, title: 'Digestión' });
    expect(new Date(res.body.starts_at).toISOString()).toBe('2026-11-24T20:00:00.000Z');
    expect(new Date(res.body.ends_at).toISOString()).toBe('2026-11-25T23:00:00.000Z');
  });

  it('overlap is rejected with 409 naming the holder', async () => {
    const id = await newEquipment();
    await book(id, anaToken, BLOCK);
    const res = await book(id, betoToken, {
      title: 'Mi muestra', starts_at: '2026-11-25T10:00:00Z', ends_at: '2026-11-25T12:00:00Z',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Ana');
  });

  it('back-to-back booking is allowed', async () => {
    const id = await newEquipment();
    await book(id, anaToken, BLOCK);
    const after = await book(id, betoToken, {
      title: 'Después', starts_at: '2026-11-25T23:00:00Z', ends_at: '2026-11-26T01:00:00Z',
    });
    const before = await book(id, betoToken, {
      title: 'Antes', starts_at: '2026-11-24T18:00:00Z', ends_at: '2026-11-24T20:00:00Z',
    });
    expect(after.status).toBe(201);
    expect(before.status).toBe(201);
  });

  it('rejects end <= start', async () => {
    const id = await newEquipment();
    const equal = await book(id, anaToken, { title: 'x', starts_at: '2026-11-24T10:00:00Z', ends_at: '2026-11-24T10:00:00Z' });
    const earlier = await book(id, anaToken, { title: 'x', starts_at: '2026-11-24T10:00:00Z', ends_at: '2026-11-24T09:00:00Z' });
    expect(equal.status).toBe(400);
    expect(earlier.status).toBe(400);
  });

  it('rejects a non-string title with 400 instead of crashing the request', async () => {
    const id = await newEquipment();
    const res = await book(id, anaToken, { title: 123, starts_at: '2026-11-24T10:00:00Z', ends_at: '2026-11-24T11:00:00Z' });
    expect(res.status).toBe(400);
  });

  it('two simultaneous overlapping bookings: exactly one wins, the other gets 409', async () => {
    const id = await newEquipment();
    const [a, b] = await Promise.all([
      book(id, anaToken,  { title: 'Ana',  starts_at: '2026-11-24T10:00:00Z', ends_at: '2026-11-24T12:00:00Z' }),
      book(id, betoToken, { title: 'Beto', starts_at: '2026-11-24T11:00:00Z', ends_at: '2026-11-24T13:00:00Z' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM reservations WHERE equipment_id = $1', [id]);
    expect(rows[0].n).toBe(1);
  });

  it('rejects missing or invalid dates', async () => {
    const id = await newEquipment();
    const empty = await book(id, anaToken, {});
    const banana = await book(id, anaToken, { title: 'x', starts_at: 'banana', ends_at: '2026-11-25T10:00:00Z' });
    expect(empty.status).toBe(400);
    expect(banana.status).toBe(400);
  });

  it('editing a booking within its own slot does not conflict with itself', async () => {
    const id = await newEquipment();
    const mine = await book(id, anaToken, BLOCK);
    await book(id, betoToken, { title: 'Beto', starts_at: '2026-11-25T23:00:00Z', ends_at: '2026-11-26T01:00:00Z' });

    const shrink = await request(app).patch(`/api/equipment/reservations/${mine.body.id}`)
      .set(auth(anaToken)).send({ ends_at: '2026-11-25T22:00:00Z' });
    expect(shrink.status).toBe(200);

    const collide = await request(app).patch(`/api/equipment/reservations/${mine.body.id}`)
      .set(auth(anaToken)).send({ ends_at: '2026-11-26T00:00:00Z' });
    expect(collide.status).toBe(409);
  });

  it('only owner or admin can edit or delete', async () => {
    const id = await newEquipment();
    const first = await book(id, anaToken, BLOCK);
    const url = `/api/equipment/reservations/${first.body.id}`;

    const patchOther = await request(app).patch(url).set(auth(betoToken)).send({ title: 'robado' });
    const deleteOther = await request(app).delete(url).set(auth(betoToken));
    expect(patchOther.status).toBe(403);
    expect(deleteOther.status).toBe(403);

    const patchOwner = await request(app).patch(url).set(auth(anaToken)).send({ title: 'Nuevo título' });
    expect(patchOwner.status).toBe(200);
    expect(patchOwner.body.title).toBe('Nuevo título');

    const deleteAdmin = await request(app).delete(url).set(auth(adminToken));
    expect(deleteAdmin.status).toBe(204);

    const second = await book(id, anaToken, BLOCK);
    const deleteOwner = await request(app).delete(`/api/equipment/reservations/${second.body.id}`).set(auth(anaToken));
    expect(deleteOwner.status).toBe(204);
  });

  it('range query includes a booking that started before from but ends inside the range, and excludes one entirely outside it', async () => {
    const id = await newEquipment();
    await book(id, anaToken, BLOCK);
    const query = (from, to) =>
      request(app).get(`/api/equipment/${id}/reservations`).query({ from, to }).set(auth(betoToken));

    const inside = await query('2026-11-25T12:00:00Z', '2026-11-25T18:00:00Z');
    expect(inside.status).toBe(200);
    expect(inside.body).toHaveLength(1);
    expect(inside.body[0]).toMatchObject({ user_name: 'Ana', title: 'Digestión' });

    const outside = await query('2026-11-26T00:00:00Z', '2026-11-27T00:00:00Z');
    expect(outside.status).toBe(200);
    expect(outside.body).toHaveLength(0);
  });
});
