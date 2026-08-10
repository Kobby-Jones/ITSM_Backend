// __tests__/unit/helpers.test.js
const {
  getPagination, generateTicketNumber, generateAssetTag,
  sanitizeInput, addMinutes, minutesDiff, formatDuration,
  buildOrderBy, omitFields, pickFields, calculateHealthScore,
} = require('../../src/utils/helpers');

describe('helpers', () => {
  describe('getPagination', () => {
    it('returns defaults when no query', () => {
      const result = getPagination({});
      expect(result).toEqual({ page: 1, limit: 20, skip: 0 });
    });

    it('calculates skip correctly', () => {
      const result = getPagination({ page: '3', limit: '10' });
      expect(result).toEqual({ page: 3, limit: 10, skip: 20 });
    });

    it('clamps limit to MAX_LIMIT (100)', () => {
      const result = getPagination({ limit: '999' });
      expect(result.limit).toBe(100);
    });

    it('clamps page to minimum 1', () => {
      const result = getPagination({ page: '-5' });
      expect(result.page).toBe(1);
    });
  });

  describe('generateTicketNumber', () => {
    it('generates a string starting with TKT-', () => {
      expect(generateTicketNumber()).toMatch(/^TKT-/);
    });

    it('generates unique values', () => {
      const nums = new Set(Array.from({ length: 100 }, generateTicketNumber));
      expect(nums.size).toBe(100);
    });
  });

  describe('generateAssetTag', () => {
    it('generates a string starting with AST-', () => {
      expect(generateAssetTag()).toMatch(/^AST-/);
    });
  });

  describe('sanitizeInput', () => {
    it('strips XSS from strings', () => {
      const result = sanitizeInput('<script>alert(1)</script>hello');
      expect(result).not.toContain('<script>');
      expect(result).toContain('hello');
    });

    it('recurses into objects', () => {
      const result = sanitizeInput({ name: '<b>test</b>', nested: { val: '<img src=x onerror=1>' } });
      expect(result.name).not.toContain('<b>');
      expect(result.nested.val).not.toContain('onerror');
    });

    it('recurses into arrays', () => {
      const result = sanitizeInput(['<script>bad</script>', 'safe']);
      expect(result[0]).not.toContain('<script>');
      expect(result[1]).toBe('safe');
    });

    it('passes through non-string primitives', () => {
      expect(sanitizeInput(42)).toBe(42);
      expect(sanitizeInput(true)).toBe(true);
      expect(sanitizeInput(null)).toBeNull();
    });
  });

  describe('addMinutes', () => {
    it('adds minutes to a date', () => {
      const base = new Date('2024-01-01T00:00:00Z');
      const result = addMinutes(base, 60);
      expect(result.getTime()).toBe(new Date('2024-01-01T01:00:00Z').getTime());
    });
  });

  describe('minutesDiff', () => {
    it('calculates difference in minutes', () => {
      const from = new Date('2024-01-01T00:00:00Z');
      const to = new Date('2024-01-01T01:30:00Z');
      expect(minutesDiff(from, to)).toBe(90);
    });

    it('returns negative if reversed', () => {
      const from = new Date('2024-01-01T01:00:00Z');
      const to = new Date('2024-01-01T00:00:00Z');
      expect(minutesDiff(from, to)).toBe(-60);
    });
  });

  describe('formatDuration', () => {
    it('formats minutes only', () => {
      expect(formatDuration(45)).toBe('45m');
    });

    it('formats hours only', () => {
      expect(formatDuration(120)).toBe('2h');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(90)).toBe('1h 30m');
    });
  });

  describe('buildOrderBy', () => {
    it('returns default when field not allowed', () => {
      expect(buildOrderBy('invalid', 'asc', ['name'])).toEqual({ createdAt: 'desc' });
    });

    it('returns correct orderBy for valid field', () => {
      expect(buildOrderBy('name', 'asc', ['name', 'email'])).toEqual({ name: 'asc' });
    });

    it('defaults to desc order', () => {
      expect(buildOrderBy('name', undefined, ['name'])).toEqual({ name: 'desc' });
    });
  });

  describe('omitFields', () => {
    it('removes specified fields', () => {
      const result = omitFields({ a: 1, b: 2, c: 3 }, ['b', 'c']);
      expect(result).toEqual({ a: 1 });
    });
  });

  describe('pickFields', () => {
    it('keeps only specified fields', () => {
      const result = pickFields({ a: 1, b: 2, c: 3 }, ['a', 'c']);
      expect(result).toEqual({ a: 1, c: 3 });
    });
  });

  describe('calculateHealthScore', () => {
    it('returns 100 for healthy metrics', () => {
      const score = calculateHealthScore({
        cpuUsage: 20,
        ramAvailable: 8000,
        ramTotal: 16000,
        storageAvailable: 100000,
        storageTotal: 500000,
        batteryLevel: 80,
      });
      expect(score).toBe(100);
    });

    it('reduces score for high CPU', () => {
      const score = calculateHealthScore({ cpuUsage: 90 });
      expect(score).toBeLessThan(100);
    });

    it('reduces score for low battery', () => {
      const score = calculateHealthScore({ batteryLevel: 10 });
      expect(score).toBeLessThan(100);
    });

    it('clamps to 0 for extremely bad metrics', () => {
      const score = calculateHealthScore({
        cpuUsage: 200,
        batteryLevel: 0,
        ramAvailable: 0,
        ramTotal: 16000,
        storageAvailable: 0,
        storageTotal: 100000,
      });
      expect(score).toBe(0);
    });
  });
});
