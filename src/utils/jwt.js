// src/utils/jwt.js
const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');

const {
  AuthenticationError,
} = require('../shared/errors');

const TOKEN_ISSUER = 'itsm-platform';

function signToken(
  payload,
  secret,
  expiresIn
) {
  return jwt.sign(
    payload,
    secret,
    {
      expiresIn,
      issuer: TOKEN_ISSUER,

      /*
       * jsonwebtoken timestamps have one-second precision.
       * A random jti ensures that two tokens created during
       * the same second are still different.
       */
      jwtid: randomUUID(),
    }
  );
}

function signAccessToken(payload) {
  return signToken(
    payload,
    process.env.JWT_SECRET,
    process.env.JWT_ACCESS_EXPIRES_IN
      || '15m'
  );
}

function signRefreshToken(payload) {
  return signToken(
    payload,
    process.env.JWT_REFRESH_SECRET,
    process.env.JWT_REFRESH_EXPIRES_IN
      || '7d'
  );
}

function signResetToken(payload) {
  return signToken(
    payload,
    process.env.JWT_RESET_SECRET,
    process.env.JWT_RESET_EXPIRES_IN
      || '1h'
  );
}

function signVerifyToken(payload) {
  return signToken(
    payload,
    process.env.JWT_VERIFY_SECRET,
    process.env.JWT_VERIFY_EXPIRES_IN
      || '24h'
  );
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        issuer: TOKEN_ISSUER,
      }
    );
  } catch (error) {
    if (
      error.name
      === 'TokenExpiredError'
    ) {
      throw new AuthenticationError(
        'Access token expired'
      );
    }

    throw new AuthenticationError(
      'Invalid access token'
    );
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET,
      {
        issuer: TOKEN_ISSUER,
      }
    );
  } catch (error) {
    if (
      error.name
      === 'TokenExpiredError'
    ) {
      throw new AuthenticationError(
        'Refresh token expired'
      );
    }

    throw new AuthenticationError(
      'Invalid refresh token'
    );
  }
}

function verifyResetToken(token) {
  try {
    return jwt.verify(
      token,
      process.env.JWT_RESET_SECRET,
      {
        issuer: TOKEN_ISSUER,
      }
    );
  } catch {
    throw new AuthenticationError(
      'Invalid or expired reset token'
    );
  }
}

function verifyEmailToken(token) {
  try {
    return jwt.verify(
      token,
      process.env.JWT_VERIFY_SECRET,
      {
        issuer: TOKEN_ISSUER,
      }
    );
  } catch {
    throw new AuthenticationError(
      'Invalid or expired verification token'
    );
  }
}

function extractBearerToken(
  authHeader
) {
  if (
    !authHeader
    || !authHeader.startsWith(
      'Bearer '
    )
  ) {
    return null;
  }

  return authHeader.slice(7);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  signVerifyToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,
  verifyEmailToken,
  extractBearerToken,
};