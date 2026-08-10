// __tests__/setup/jest.setup.js
// Runs after Jest test framework is installed in the environment.
// Use this for global matchers, mock defaults, and per-test cleanup.

// ─── Silence noisy Winston/morgan output during tests ───────────────────────
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
}));

// ─── Mock nodemailer so no real emails are sent during tests ─────────────────
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
    verify: jest.fn().mockResolvedValue(true),
  }),
}));

// ─── Mock firebase-admin so no real push notifications fire ──────────────────
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  messaging: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue('mock-message-id'),
    sendEachForMulticast: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    }),
  }),
  apps: [],
}));

// ─── Custom matchers ─────────────────────────────────────────────────────────
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () => `expected ${received} to be within [${floor}, ${ceiling}]`,
      pass,
    };
  },
  toBeISODateString(received) {
    const pass = typeof received === 'string' && !isNaN(Date.parse(received));
    return {
      message: () => `expected "${received}" to be a valid ISO date string`,
      pass,
    };
  },
});

// ─── Global timeout for async expectations ───────────────────────────────────
jest.setTimeout(30000);
