module.exports = {
  testEnvironment: 'node',
  globalSetup: './tests/globalSetup.js',
  setupFiles: ['./tests/env.js'],
  testTimeout: 15000,
  testMatch: ['**/tests/**/*.test.js'],
};
