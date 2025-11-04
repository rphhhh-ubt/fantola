const base = require('../../jest.config.base');

module.exports = {
  ...base,
  displayName: 'shared',
  moduleNameMapper: {
    '^@monorepo/test-utils$': '<rootDir>/../test-utils/src',
    '^@monorepo/config$': '<rootDir>/../config/src',
    '^@monorepo/shared$': '<rootDir>/src',
    '^@monorepo/database$': '<rootDir>/../database/src',
  },
};
