// Loaded by Jest before each test file — sets DATABASE_URL to the test DB
// so db.js creates its pool pointing at step_test, not the dev database.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test'), override: true });
