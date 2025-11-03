module.exports = {
  projects: [
    '<rootDir>/services/bot',
    '<rootDir>/services/api',
    '<rootDir>/services/worker',
    '<rootDir>/packages/shared',
    '<rootDir>/packages/config',
    '<rootDir>/packages/test-utils',
  ],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'services/*/src/**/*.ts',
    'packages/*/src/**/*.ts',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/index.ts',
    '!packages/test-utils/**',
  ],
};
