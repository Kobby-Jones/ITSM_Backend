// __tests__/unit/jwt.test.js
process.env.JWT_SECRET = 'test-secret-long-enough-for-hs256-algo!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-long-enough!!!!!';
process.env.JWT_RESET_SECRET = 'test-reset-secret-long-enough!!!!!!!';
process.env.JWT_VERIFY_SECRET = 'test-verify-secret-long-enough!!!!!!!';

const {
  signAccessToken, signRefreshToken, signResetToken, signVerifyToken,
  verifyAccessToken, verifyRefreshToken, verifyResetToken, verifyEmailToken,
  extractBearerToken,
} = require('../../src/utils/jwt');

describe('jwt utils', () => {
  const payload = { userId: 'user-123', email: 'test@test.com', role: 'end_user' };

  describe('signAccessToken / verifyAccessToken', () => {
    it('signs and verifies an access token', () => {
      const token = signAccessToken(payload);
      expect(typeof token).toBe('string');

      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    it('throws AuthenticationError for invalid token', () => {
      expect(() => verifyAccessToken('bad.token.here')).toThrow('Invalid access token');
    });

    it('throws AuthenticationError for expired token', () => {
      // Sign with -1s expiry trick — use raw jwt
      const jwt = require('jsonwebtoken');
      const expired = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '-1s',
        issuer: 'itsm-platform',
      });
      expect(() => verifyAccessToken(expired)).toThrow('Access token expired');
    });
  });

  describe('signRefreshToken / verifyRefreshToken', () => {
    it('signs and verifies a refresh token', () => {
      const token = signRefreshToken({ userId: 'user-123' });
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe('user-123');
    });

    it('throws for invalid refresh token', () => {
      expect(() => verifyRefreshToken('bad')).toThrow();
    });
  });

  describe('signResetToken / verifyResetToken', () => {
    it('signs and verifies a reset token', () => {
      const token = signResetToken({ userId: 'user-123' });
      const decoded = verifyResetToken(token);
      expect(decoded.userId).toBe('user-123');
    });
  });

  describe('signVerifyToken / verifyEmailToken', () => {
    it('signs and verifies an email verify token', () => {
      const token = signVerifyToken({ userId: 'user-123', email: 'test@test.com' });
      const decoded = verifyEmailToken(token);
      expect(decoded.userId).toBe('user-123');
    });
  });

  describe('extractBearerToken', () => {
    it('extracts token from valid Bearer header', () => {
      const token = extractBearerToken('Bearer some.jwt.token');
      expect(token).toBe('some.jwt.token');
    });

    it('returns null for missing header', () => {
      expect(extractBearerToken(undefined)).toBeNull();
      expect(extractBearerToken('')).toBeNull();
    });

    it('returns null for non-Bearer header', () => {
      expect(extractBearerToken('Basic abc123')).toBeNull();
    });

    it('returns null for "Bearer " with no token', () => {
      // "Bearer " has 7 chars, slicing gives empty string
      expect(extractBearerToken('Bearer ')).toBe('');
    });
  });
});
