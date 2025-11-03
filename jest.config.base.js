module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageDirectory: '<rootDir>/coverage',
  moduleNameMapper: {
    '^@monorepo/shared$': '<rootDir>/../../packages/shared/src',
    '^@monorepo/config$': '<rootDir>/../../packages/config/src',
    '^@monorepo/test-utils$': '<rootDir>/../../packages/test-utils/src',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },
};
