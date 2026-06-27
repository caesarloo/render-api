module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1'
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        types: ['node', 'jest']
      }
    }]
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.js']
};
