// src/utils/helpers.js
const xss = require('xss');
const { PAGINATION } = require('../shared/constants');

// Strip ALL HTML tags from user input rather than using xss's default
// whitelist (which permits basic formatting tags like <b>/<i>). Ticket
// descriptions, comments, and other free-text fields should be plain text —
// this closes off stored-XSS vectors more conservatively.
const strictXssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

function getPagination(query) {
  const page = Math.max(1, parseInt(query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT)
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function generateTicketNumber() {
  const prefix = 'TKT';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function generateAssetTag() {
  const prefix = 'AST';
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${timestamp}`;
}

function sanitizeInput(obj) {
  if (typeof obj === 'string') return xss(obj.trim(), strictXssOptions);
  if (Array.isArray(obj)) return obj.map(sanitizeInput);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, sanitizeInput(v)])
    );
  }
  return obj;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function minutesDiff(from, to) {
  return Math.round((to - from) / 60000);
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function buildOrderBy(sortBy, sortOrder = 'desc', allowedFields = []) {
  if (!sortBy || !allowedFields.includes(sortBy)) return { createdAt: 'desc' };
  return { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
}

function omitFields(obj, fields = []) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !fields.includes(k)));
}

function pickFields(obj, fields = []) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => fields.includes(k)));
}

function calculateHealthScore({ cpuUsage, ramAvailable, ramTotal, storageAvailable, storageTotal, batteryLevel }) {
  let score = 100;
  // Weights tuned so severe/extreme degradation on multiple fronts drives the
  // score to 0 rather than bottoming out in the 10-20 range.
  if (cpuUsage !== undefined) score -= Math.max(0, (cpuUsage - 70) * 1.5);
  if (ramAvailable !== undefined && ramTotal) {
    const usedPct = ((ramTotal - ramAvailable) / ramTotal) * 100;
    score -= Math.max(0, (usedPct - 80) * 0.8);
  }
  if (storageAvailable !== undefined && storageTotal) {
    const usedPct = ((storageTotal - storageAvailable) / storageTotal) * 100;
    score -= Math.max(0, (usedPct - 85) * 0.5);
  }
  if (batteryLevel !== undefined && batteryLevel < 20) score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = {
  getPagination, generateTicketNumber, generateAssetTag,
  sanitizeInput, addMinutes, minutesDiff, formatDuration,
  buildOrderBy, omitFields, pickFields, calculateHealthScore,
};
