module.exports = {
  // Use ts-jest to compile TypeScript and JSX down to standard JavaScript
  preset: 'ts-jest',
  
  // Simulates a browser environment for React components
  testEnvironment: 'jest-environment-jsdom',
  
  // Automatically imports the testing library matchers before each test runs
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      // Prevents ts-jest from throwing errors on minor type issues during tests
      isolatedModules: true, 
    }],
  },
};