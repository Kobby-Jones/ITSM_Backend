// __tests__/unit/routing.test.js
// Unit tests for routing rule evaluation (pure logic — no DB/external deps)

// ─── Replicate the core evaluation logic from routing.service.js ──────────────

const RULE_TYPES = {
  CATEGORY_BASED: 'CATEGORY_BASED',
  PRIORITY_BASED: 'PRIORITY_BASED',
  KEYWORD_BASED: 'KEYWORD_BASED',
  DEPARTMENT_BASED: 'DEPARTMENT_BASED',
  WORKLOAD_BASED: 'WORKLOAD_BASED',
};

function evaluateRule(rule, ticket) {
  const conditions = rule.conditions || {};

  switch (rule.ruleType) {
    case RULE_TYPES.CATEGORY_BASED:
      return conditions.categories?.includes(ticket.category) ?? false;

    case RULE_TYPES.PRIORITY_BASED:
      return conditions.priorities?.includes(ticket.priority) ?? false;

    case RULE_TYPES.KEYWORD_BASED: {
      if (!conditions.keywords?.length) return false;
      const text = `${ticket.title} ${ticket.description}`.toLowerCase();
      return conditions.keywords.some(kw => text.includes(kw.toLowerCase()));
    }

    case RULE_TYPES.DEPARTMENT_BASED:
      return ticket.requesterId != null &&
        conditions.departmentId != null &&
        conditions.departmentId === ticket.departmentId;

    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('routing rule evaluation', () => {
  const baseTicket = {
    title: 'My laptop screen is broken',
    description: 'The display suddenly went black and will not turn on.',
    category: 'HARDWARE_ISSUES',
    priority: 'P2_HIGH',
    requesterId: 'user-1',
    departmentId: 'dept-it',
  };

  // ── CATEGORY_BASED ────────────────────────────────────────────────────────
  describe('CATEGORY_BASED', () => {
    const rule = { ruleType: 'CATEGORY_BASED', conditions: { categories: ['HARDWARE_ISSUES', 'NETWORK_ISSUES'] } };

    it('matches when ticket category is in the list', () => {
      expect(evaluateRule(rule, baseTicket)).toBe(true);
    });

    it('does not match when ticket category is absent', () => {
      expect(evaluateRule(rule, { ...baseTicket, category: 'SOFTWARE_ISSUES' })).toBe(false);
    });

    it('returns false when conditions.categories is empty', () => {
      expect(evaluateRule({ ruleType: 'CATEGORY_BASED', conditions: { categories: [] } }, baseTicket)).toBe(false);
    });
  });

  // ── PRIORITY_BASED ────────────────────────────────────────────────────────
  describe('PRIORITY_BASED', () => {
    const rule = { ruleType: 'PRIORITY_BASED', conditions: { priorities: ['P1_CRITICAL', 'P2_HIGH'] } };

    it('matches P2_HIGH ticket', () => {
      expect(evaluateRule(rule, baseTicket)).toBe(true);
    });

    it('does not match P4_LOW ticket', () => {
      expect(evaluateRule(rule, { ...baseTicket, priority: 'P4_LOW' })).toBe(false);
    });
  });

  // ── KEYWORD_BASED ─────────────────────────────────────────────────────────
  describe('KEYWORD_BASED', () => {
    const rule = {
      ruleType: 'KEYWORD_BASED',
      conditions: { keywords: ['laptop', 'screen', 'monitor'] },
    };

    it('matches when title contains a keyword', () => {
      expect(evaluateRule(rule, baseTicket)).toBe(true);
    });

    it('matches when description contains a keyword', () => {
      const ticket = { ...baseTicket, title: 'My device is broken', description: 'The monitor suddenly went dark.' };
      expect(evaluateRule(rule, ticket)).toBe(true);
    });

    it('is case-insensitive', () => {
      const ticket = { ...baseTicket, title: 'LAPTOP BROKEN', description: '' };
      expect(evaluateRule(rule, ticket)).toBe(true);
    });

    it('does not match when no keywords present', () => {
      const ticket = { ...baseTicket, title: 'Software bug', description: 'App crashes on startup.' };
      expect(evaluateRule(rule, ticket)).toBe(false);
    });

    it('returns false when keywords list is empty', () => {
      expect(evaluateRule({ ruleType: 'KEYWORD_BASED', conditions: { keywords: [] } }, baseTicket)).toBe(false);
    });
  });

  // ── DEPARTMENT_BASED ──────────────────────────────────────────────────────
  describe('DEPARTMENT_BASED', () => {
    const rule = { ruleType: 'DEPARTMENT_BASED', conditions: { departmentId: 'dept-it' } };

    it('matches when ticket departmentId equals rule departmentId', () => {
      expect(evaluateRule(rule, baseTicket)).toBe(true);
    });

    it('does not match different department', () => {
      expect(evaluateRule(rule, { ...baseTicket, departmentId: 'dept-finance' })).toBe(false);
    });

    it('does not match when ticket has no requesterId', () => {
      expect(evaluateRule(rule, { ...baseTicket, requesterId: null })).toBe(false);
    });
  });

  // ── Unknown rule type ─────────────────────────────────────────────────────
  describe('unknown ruleType', () => {
    it('returns false', () => {
      expect(evaluateRule({ ruleType: 'MAGIC_RULE', conditions: {} }, baseTicket)).toBe(false);
    });
  });
});
