require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

const ADMIN = {
  name:     'Maria Luisa',
  email:    'admin@step-lab.com',
  password: 'CambiaEsto123!',
  role:     'admin',
  status:   'approved',
};

async function seed() {
  const hash = await bcrypt.hash(ADMIN.password, 12);
  await pool.query(`
    INSERT INTO users (name, email, password_hash, role, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email) DO NOTHING
  `, [ADMIN.name, ADMIN.email, hash, ADMIN.role, ADMIN.status]);

  console.log(`Admin creado: ${ADMIN.email} / ${ADMIN.password}`);
  console.log('Cambia la contraseña después de tu primer login.');
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
