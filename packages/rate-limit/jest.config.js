const baseConfig = require('../../jest.config.base');

module.exports = {
  ...baseConfig,
  displayName: 'rate-limit',
  rootDir: '.',
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
};
