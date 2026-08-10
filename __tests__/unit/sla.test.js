// __tests__/unit/sla.test.js
// Unit tests for SLA time calculations (pure logic, no DB)

const { addMinutes, minutesDiff } = require('../../src/utils/helpers');

// ─── Replicate the core SLA deadline logic ────────────────────────────────────
function computeSLADeadlines(createdAt, responseMinutes, resolutionMinutes) {
  return {
    responseDeadline: addMinutes(createdAt, responseMinutes),
    resolutionDeadline: addMinutes(createdAt, resolutionMinutes),
  };
}

function isSLABreached(deadline, now = new Date()) {
  return now > deadline;
}

function getSLAPercentElapsed(createdAt, deadline, now = new Date()) {
  const total = minutesDiff(createdAt, deadline);
  const elapsed = minutesDiff(createdAt, now);
  if (total <= 0) return 100;
  return Math.min(100, Math.round((elapsed / total) * 100));
}

// ─────────────────────────────────────────────────────────────────────────────

describe('SLA calculation logic', () => {
  const BASE = new Date('2024-01-15T08:00:00.000Z');

  describe('computeSLADeadlines', () => {
    it('P1_CRITICAL — 15min response, 240min resolution', () => {
      const { responseDeadline, resolutionDeadline } = computeSLADeadlines(BASE, 15, 240);
      expect(responseDeadline.getTime()).toBe(addMinutes(BASE, 15).getTime());
      expect(resolutionDeadline.getTime()).toBe(addMinutes(BASE, 240).getTime());
    });

    it('P4_LOW — 480min response, 2880min resolution', () => {
      const { responseDeadline, resolutionDeadline } = computeSLADeadlines(BASE, 480, 2880);
      const expectedResponse = new Date(BASE.getTime() + 480 * 60 * 1000);
      const expectedResolution = new Date(BASE.getTime() + 2880 * 60 * 1000);
      expect(responseDeadline.getTime()).toBe(expectedResponse.getTime());
      expect(resolutionDeadline.getTime()).toBe(expectedResolution.getTime());
    });
  });

  describe('isSLABreached', () => {
    it('returns false when deadline is in the future', () => {
      const futureDeadline = addMinutes(new Date(), 60);
      expect(isSLABreached(futureDeadline)).toBe(false);
    });

    it('returns true when deadline has passed', () => {
      const pastDeadline = addMinutes(new Date(), -5);
      expect(isSLABreached(pastDeadline)).toBe(true);
    });
  });

  describe('getSLAPercentElapsed', () => {
    it('returns 0% at creation time', () => {
      const deadline = addMinutes(BASE, 100);
      const pct = getSLAPercentElapsed(BASE, deadline, BASE);
      expect(pct).toBe(0);
    });

    it('returns 50% at halfway point', () => {
      const deadline = addMinutes(BASE, 100);
      const halfway = addMinutes(BASE, 50);
      const pct = getSLAPercentElapsed(BASE, deadline, halfway);
      expect(pct).toBe(50);
    });

    it('caps at 100% when past deadline', () => {
      const deadline = addMinutes(BASE, 60);
      const overdue = addMinutes(BASE, 200);
      const pct = getSLAPercentElapsed(BASE, deadline, overdue);
      expect(pct).toBe(100);
    });

    it('returns 80% at warning threshold', () => {
      const deadline = addMinutes(BASE, 100);
      const warningPoint = addMinutes(BASE, 80);
      const pct = getSLAPercentElapsed(BASE, deadline, warningPoint);
      expect(pct).toBe(80);
    });
  });
});
