require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function migrate() {
  // Ensure the tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename  VARCHAR(255) PRIMARY KEY,
      run_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const { rows } = await pool.query('SELECT filename FROM _migrations');
  const applied = new Set(rows.map(r => r.filename));

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skipped  ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  applied  ${file}`);
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Error en ${file}: ${err.message}`);
    } finally {
      client.release();
    }
  }

  if (ran === 0) {
    console.log('Base de datos al día, no hay migraciones pendientes.');
  } else {
    console.log(`${ran} migración(es) aplicada(s) correctamente.`);
  }

  await pool.end();
}

migrate().catch(err => { console.error(err.message); process.exit(1); });
