const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../src/db');

async function createUser({ email, password = 'Password123', name, role = 'member', status = 'approved' }) {
  const hash = await bcrypt.hash(password, 4); // low cost — tests only
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [email, hash, name || email, role, status]
  );
  return result.rows[0];
}

function getToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Wipes all application data between test suites.
async function truncateAll() {
  await pool.query(`
    TRUNCATE
      users, experiment_templates, experiments, experiment_steps,
      experiment_comments, exp_resource_links, resources, resource_categories,
      datasets, dataset_rows, dataset_columns, dataset_compounds,
      publications, template_steps, template_datasets, template_columns
    CASCADE
  `);
}

module.exports = { createUser, getToken, truncateAll };
