// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/config/**', '!src/jobs/**'],
  coverageThreshold: {
    global: { branches: 60, functions: 70, lines: 70, statements: 70 },
  },
  globalSetup: './__tests__/setup/globalSetup.js',
  globalTeardown: './__tests__/setup/globalTeardown.js',
  setupFilesAfterEnv: ['./__tests__/setup/jest.setup.js'],
  testTimeout: 30000,
  verbose: true,
  // Isolate tests from each other
  resetMocks: true,
  clearMocks: true,
};
