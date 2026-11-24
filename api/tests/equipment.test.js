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

describe('Editing equipment', () => {
  const edit = (id, token, body) =>
    request(app).patch(`/api/equipment/${id}`).set(auth(token)).send(body);

  it('admin renames equipment and changes its location, and the list shows it', async () => {
    const id = await newEquipment('Microondas');
    const res = await edit(id, adminToken, { name: 'Microondas 2', location: 'Lab Química' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, name: 'Microondas 2', location: 'Lab Química' });

    const list = await request(app).get('/api/equipment').set(auth(anaToken));
    expect(list.body.find(e => e.id === id)).toMatchObject({ name: 'Microondas 2', location: 'Lab Química' });
  });

  it('name and location are trimmed, and editing one leaves the other unchanged', async () => {
    const id = await newEquipment('Centrífuga');
    await edit(id, adminToken, { location: 'Lab A' });
    const res = await edit(id, adminToken, { name: '  Centrífuga 5430  ' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Centrífuga 5430');
    expect(res.body.location).toBe('Lab A');
  });

  it('location can be cleared with an empty string', async () => {
    const id = await newEquipment('Balanza');
    await edit(id, adminToken, { location: 'Lab B' });
    const res = await edit(id, adminToken, { location: '' });
    expect(res.status).toBe(200);
    expect(res.body.location).toBe('');
  });

  it('an empty or blank name is rejected and nothing changes', async () => {
    const id = await newEquipment('Estufa');
    expect((await edit(id, adminToken, { name: '' })).status).toBe(400);
    expect((await edit(id, adminToken, { name: '   ' })).status).toBe(400);
    const list = await request(app).get('/api/equipment').set(auth(adminToken));
    expect(list.body.find(e => e.id === id).name).toBe('Estufa');
  });

  it('a member cannot rename equipment', async () => {
    const id = await newEquipment('Vortex 2');
    const res = await edit(id, anaToken, { name: 'Hackeado' });
    expect(res.status).toBe(403);
  });

  it('editing unknown equipment returns 404', async () => {
    expect((await edit(999999, adminToken, { name: 'Nada' })).status).toBe(404);
  });

  it('bookings stay with the equipment after it is renamed', async () => {
    const id = await newEquipment('Autoclave 2');
    await book(id, anaToken, BLOCK);
    await edit(id, adminToken, { name: 'Autoclave grande' });
    const range = await request(app).get(`/api/equipment/${id}/reservations`)
      .query({ from: '2026-11-24T00:00:00Z', to: '2026-11-27T00:00:00Z' }).set(auth(betoToken));
    expect(range.body).toHaveLength(1);
    expect(range.body[0].title).toBe('Digestión');
  });
});

describe('Archiving equipment', () => {
  it('admin can list archived equipment, and it is not in the active list', async () => {
    const id = await newEquipment('Autoclave');
    await request(app).patch(`/api/equipment/${id}`).set(auth(adminToken)).send({ active: false });

    const archived = await request(app).get('/api/equipment?archived=true').set(auth(adminToken));
    expect(archived.status).toBe(200);
    expect(archived.body.map(e => e.id)).toContain(id);

    const active = await request(app).get('/api/equipment').set(auth(adminToken));
    expect(active.body.map(e => e.id)).not.toContain(id);
  });

  it('member cannot list archived equipment', async () => {
    const res = await request(app).get('/api/equipment?archived=true').set(auth(anaToken));
    expect(res.status).toBe(403);
  });

  it('member cannot archive equipment', async () => {
    const id = await newEquipment('Balanza');
    const res = await request(app).patch(`/api/equipment/${id}`).set(auth(anaToken)).send({ active: false });
    expect(res.status).toBe(403);
  });

  it('restoring archived equipment keeps its bookings and allows booking again', async () => {
    const id = await newEquipment('Vortex');
    await book(id, anaToken, BLOCK);
    await request(app).patch(`/api/equipment/${id}`).set(auth(adminToken)).send({ active: false });

    const restore = await request(app).patch(`/api/equipment/${id}`).set(auth(adminToken)).send({ active: true });
    expect(restore.status).toBe(200);

    const list = await request(app).get('/api/equipment').set(auth(betoToken));
    expect(list.body.map(e => e.id)).toContain(id);

    const kept = await request(app).get(`/api/equipment/${id}/reservations`)
      .query({ from: '2026-11-24T00:00:00Z', to: '2026-11-27T00:00:00Z' }).set(auth(betoToken));
    expect(kept.body).toHaveLength(1);
    expect(kept.body[0].title).toBe('Digestión');

    const rebook = await book(id, betoToken, {
      title: 'Después', starts_at: '2026-11-26T10:00:00Z', ends_at: '2026-11-26T11:00:00Z',
    });
    expect(rebook.status).toBe(201);
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

describe('Reservation approval', () => {
  // A booking starting 2026-12-01T00:00Z that lasts `minutes` minutes.
  const span = (minutes) => ({
    starts_at: '2026-12-01T00:00:00Z',
    ends_at: new Date(Date.UTC(2026, 11, 1) + minutes * 60000).toISOString(),
  });
  const HOURS = 60;
  const DAYS = 24 * HOURS;
  const patch = (rid, token, body) =>
    request(app).patch(`/api/equipment/reservations/${rid}`).set(auth(token)).send(body);
  const decide = (rid, action, token, body = {}) =>
    request(app).post(`/api/equipment/reservations/${rid}/${action}`).set(auth(token)).send(body);

  it('member booking of exactly 48 hours is confirmed', async () => {
    const res = await book(await newEquipment(), anaToken, { title: 'x', ...span(48 * HOURS) });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
  });

  it('member booking of 48 hours and 1 minute is pending', async () => {
    const res = await book(await newEquipment(), anaToken, { title: 'x', ...span(48 * HOURS + 1) });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });

  it('admin booking over 48 hours is confirmed', async () => {
    const res = await book(await newEquipment(), adminToken, { title: 'x', ...span(5 * DAYS) });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
  });

  it('a pending booking holds its slot', async () => {
    const id = await newEquipment();
    const pending = await book(id, anaToken, { title: 'largo', ...span(3 * DAYS) });
    expect(pending.body.status).toBe('pending');
    const res = await book(id, betoToken, {
      title: 'corto', starts_at: '2026-12-02T10:00:00Z', ends_at: '2026-12-02T11:00:00Z',
    });
    expect(res.status).toBe(409);
  });

  it('editing only the title keeps status', async () => {
    const id = await newEquipment();
    const pending = await book(id, anaToken, { title: 'largo', ...span(3 * DAYS) });
    const confirmed = await book(await newEquipment(), anaToken, { title: 'corto', ...span(24 * HOURS) });
    const p = await patch(pending.body.id, anaToken, { title: 'nuevo' });
    const c = await patch(confirmed.body.id, anaToken, { title: 'nuevo' });
    expect(p.body.status).toBe('pending');
    expect(c.body.status).toBe('confirmed');
  });

  it('lengthening a confirmed booking past 48 hours makes it pending, shortening it back confirms it', async () => {
    const created = await book(await newEquipment(), anaToken, { title: 'x', ...span(24 * HOURS) });
    const longer = await patch(created.body.id, anaToken, { ends_at: span(49 * HOURS).ends_at });
    expect(longer.status).toBe(200);
    expect(longer.body.status).toBe('pending');
    const shorter = await patch(created.body.id, anaToken, { ends_at: span(24 * HOURS).ends_at });
    expect(shorter.body.status).toBe('confirmed');
  });

  it("admin editing a pending booking's times makes it confirmed", async () => {
    const created = await book(await newEquipment(), anaToken, { title: 'x', ...span(3 * DAYS) });
    const res = await patch(created.body.id, adminToken, { ends_at: span(4 * DAYS).ends_at });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
  });

  it('member cannot approve, reject or list pending requests', async () => {
    const created = await book(await newEquipment(), anaToken, { title: 'x', ...span(3 * DAYS) });
    expect((await decide(created.body.id, 'approve', betoToken)).status).toBe(403);
    expect((await decide(created.body.id, 'reject', betoToken)).status).toBe(403);
    const list = await request(app).get('/api/equipment/reservations/pending').set(auth(anaToken));
    expect(list.status).toBe(403);
  });

  it('admin sees the pending request and approves it', async () => {
    const created = await book(await newEquipment('Microondas'), anaToken, { title: 'Digestión larga', ...span(3 * DAYS) });
    const list = await request(app).get('/api/equipment/reservations/pending').set(auth(adminToken));
    expect(list.status).toBe(200);
    const item = list.body.find(r => r.id === created.body.id);
    expect(item).toMatchObject({ equipment_name: 'Microondas', user_name: 'Ana', title: 'Digestión larga' });

    const approved = await decide(created.body.id, 'approve', adminToken);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('confirmed');

    const after = await request(app).get('/api/equipment/reservations/pending').set(auth(adminToken));
    expect(after.body.map(r => r.id)).not.toContain(created.body.id);
  });

  it('approving or rejecting a non-pending booking returns 409, an unknown id 404', async () => {
    const created = await book(await newEquipment(), anaToken, { title: 'x', ...span(24 * HOURS) }); // confirmed
    expect((await decide(created.body.id, 'approve', adminToken)).status).toBe(409);
    expect((await decide(created.body.id, 'reject', adminToken)).status).toBe(409);
    expect((await decide(999999, 'approve', adminToken)).status).toBe(404);
    expect((await decide(999999, 'reject', adminToken)).status).toBe(404);
  });

  it('rejecting frees the slot, hides the booking and blocks editing it', async () => {
    const id = await newEquipment();
    const created = await book(id, anaToken, { title: 'largo', ...span(3 * DAYS) });
    const rejected = await decide(created.body.id, 'reject', adminToken, { note: 'No disponible' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('rejected');

    const other = await book(id, betoToken, {
      title: 'ocupa', starts_at: '2026-12-02T10:00:00Z', ends_at: '2026-12-02T11:00:00Z',
    });
    expect(other.status).toBe(201);

    const range = await request(app).get(`/api/equipment/${id}/reservations`)
      .query({ from: '2026-11-30T00:00:00Z', to: '2026-12-10T00:00:00Z' }).set(auth(betoToken));
    expect(range.body.map(r => r.title)).toEqual(['ocupa']);

    const edit = await patch(created.body.id, anaToken, { title: 'otra vez' });
    expect(edit.status).toBe(409);
  });

  it("an owner's edit started before an admin's decision cannot overwrite that decision", async () => {
    const created = await book(await newEquipment(), anaToken, { title: 'largo', ...span(3 * DAYS) });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Stands in for the admin's approval, committed only after the owner's edit has begun.
      await client.query("UPDATE reservations SET status = 'confirmed' WHERE id = $1", [created.body.id]);
      const edit = patch(created.body.id, anaToken, { title: 'nuevo título' }).then(r => r);
      await new Promise(resolve => setTimeout(resolve, 400));
      await client.query('COMMIT');
      const res = await edit;
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  it('approving with outdated times returns 409 and leaves the booking pending', async () => {
    const created = await book(await newEquipment(), anaToken, { title: 'largo', ...span(3 * DAYS) });
    const stale = await decide(created.body.id, 'approve', adminToken, {
      starts_at: created.body.starts_at,
      ends_at: span(2 * DAYS + 60).ends_at, // what the admin saw before the owner changed the dates
    });
    expect(stale.status).toBe(409);

    const list = await request(app).get('/api/equipment/reservations/pending').set(auth(adminToken));
    expect(list.body.map(r => r.id)).toContain(created.body.id);

    const fresh = await decide(created.body.id, 'approve', adminToken, {
      starts_at: created.body.starts_at, ends_at: created.body.ends_at,
    });
    expect(fresh.status).toBe(200);
    expect(fresh.body.status).toBe('confirmed');
  });

  it('resending the same instants in another representation keeps status', async () => {
    const created = await book(await newEquipment(), anaToken, { title: 'largo', ...span(3 * DAYS) });
    // 2026-12-01T00:00Z to 2026-12-04T00:00Z written with a -03:00 offset
    const same = { starts_at: '2026-11-30T21:00:00-03:00', ends_at: '2026-12-03T21:00:00-03:00' };
    const pending = await patch(created.body.id, anaToken, { title: 'igual', ...same });
    expect(pending.body.status).toBe('pending');

    await decide(created.body.id, 'approve', adminToken);
    const approved = await patch(created.body.id, anaToken, { title: 'igual otra vez', ...same });
    expect(approved.body.status).toBe('confirmed');
  });

  it('an owner moving an approved long booking sends it back to pending', async () => {
    const created = await book(await newEquipment(), anaToken, { title: 'largo', ...span(3 * DAYS) });
    await decide(created.body.id, 'approve', adminToken);
    const moved = await patch(created.body.id, anaToken, { ends_at: span(3 * DAYS + 60).ends_at });
    expect(moved.status).toBe(200);
    expect(moved.body.status).toBe('pending');
  });

  it('changing only starts_at so the booking crosses 48 hours makes it pending', async () => {
    const created = await book(await newEquipment(), anaToken, { title: 'x', ...span(47 * HOURS) });
    expect(created.body.status).toBe('confirmed');
    const res = await patch(created.body.id, anaToken, { starts_at: '2026-11-30T22:00:00Z' }); // now 49 hours
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
  });

  it('approving or rejecting an already rejected booking returns 409', async () => {
    const created = await book(await newEquipment(), anaToken, { title: 'largo', ...span(3 * DAYS) });
    await decide(created.body.id, 'reject', adminToken, { note: 'No' });
    expect((await decide(created.body.id, 'approve', adminToken)).status).toBe(409);
    expect((await decide(created.body.id, 'reject', adminToken)).status).toBe(409);
  });
});
