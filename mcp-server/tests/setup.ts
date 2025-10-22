// Jest setup file for all test suites
// Runs before each test file

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DEFAULT_ENVIRONMENT = 'Integration';
process.env.GIT_PLATFORM = 'bitbucket';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

// Global test timeout
jest.setTimeout(10000);

// Mock external dependencies to prevent actual API calls
jest.mock('bitbucket');
jest.mock('jenkins');
jest.mock('jira.js');
jest.mock('@microsoft/microsoft-graph-client');
jest.mock('@azure/keyvault-secrets');

// Global test utilities
global.testUtils = {
  // Helper to create mock MCP tool context
  createMockToolContext: () => ({
    config: {
      environment: 'Integration',
      gitPlatform: 'bitbucket',
    },
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  }),

  // Helper to create mock timestamps
  mockTimestamp: () => new Date('2025-10-21T00:00:00Z'),
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
