// Runs once before the entire test suite in a separate process.
// Loads .env.test and applies all migrations to the test database.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test'), override: true });

const { Pool } = require('pg');
const fs = require('fs');

module.exports = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename  VARCHAR(255) PRIMARY KEY,
      run_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const dir = path.resolve(__dirname, '../migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT filename FROM _migrations');
  const applied = new Set(rows.map(r => r.filename));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  await pool.end();
};
