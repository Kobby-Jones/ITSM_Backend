// src/utils/jwt.js
const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('../shared/errors');

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    issuer: 'itsm-platform',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'itsm-platform',
  });
}

function signResetToken(payload) {
  return jwt.sign(payload, process.env.JWT_RESET_SECRET, {
    expiresIn: process.env.JWT_RESET_EXPIRES_IN || '1h',
    issuer: 'itsm-platform',
  });
}

function signVerifyToken(payload) {
  return jwt.sign(payload, process.env.JWT_VERIFY_SECRET, {
    expiresIn: process.env.JWT_VERIFY_EXPIRES_IN || '24h',
    issuer: 'itsm-platform',
  });
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { issuer: 'itsm-platform' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AuthenticationError('Access token expired');
    throw new AuthenticationError('Invalid access token');
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, { issuer: 'itsm-platform' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AuthenticationError('Refresh token expired');
    throw new AuthenticationError('Invalid refresh token');
  }
}

function verifyResetToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_RESET_SECRET, { issuer: 'itsm-platform' });
  } catch (err) {
    throw new AuthenticationError('Invalid or expired reset token');
  }
}

function verifyEmailToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_VERIFY_SECRET, { issuer: 'itsm-platform' });
  } catch (err) {
    throw new AuthenticationError('Invalid or expired verification token');
  }
}

function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

module.exports = {
  signAccessToken, signRefreshToken, signResetToken, signVerifyToken,
  verifyAccessToken, verifyRefreshToken, verifyResetToken, verifyEmailToken,
  extractBearerToken,
};
