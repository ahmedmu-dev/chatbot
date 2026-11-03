// Global Jest setup. RNTL matchers are built in (v14); the mock API delay is 0 under NODE_ENV=test.

// expo-crypto needs the native module; use Node's uuid v4 in tests.
jest.mock('expo-crypto', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  randomUUID: () => require('node:crypto').randomUUID() as string,
}));
