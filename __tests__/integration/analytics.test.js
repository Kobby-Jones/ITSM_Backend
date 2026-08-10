// __tests__/integration/analytics.test.js
const request = require('supertest');
const app = require('../../src/server');
const { prisma } = require('../../src/config/database');
const { seedTestData, cleanTestData, makeTicketData } = require('../helpers/fixtures');

const skipIfNoDb = process.env.SKIP_INTEGRATION_TESTS === 'true' ? describe.skip : describe;

skipIfNoDb('Analytics & SLA Integration Tests', () => {
  let adminToken, userToken;

  async function login(email) {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Test@1234!' });
    return res.body.data?.accessToken;
  }

  beforeAll(async () => {
    await cleanTestData(prisma);
    await seedTestData(prisma);
    [adminToken, userToken] = await Promise.all([
      login('admin@test.com'),
      login('user@test.com'),
    ]);

    // Create some tickets for analytics
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${userToken}`)
        .send(makeTicketData({ title: `Analytics test ticket number ${i + 1} long enough`, priority: i < 2 ? 'P1_CRITICAL' : 'P3_MEDIUM' }));
    }
  });

  afterAll(async () => {
    await cleanTestData(prisma);
    await prisma.$disconnect();
  });

  describe('GET /api/v1/analytics/dashboard', () => {
    it('admin gets full dashboard KPIs', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets).toBeDefined();
      expect(res.body.data.tickets.total).toBeGreaterThanOrEqual(5);
      expect(res.body.data.sla).toBeDefined();
      expect(res.body.data.totalUsers).toBeDefined();
    });

    it('end user gets limited dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets).toBeDefined();
      // End user should not see totalUsers
      expect(res.body.data.totalUsers).toBeUndefined();
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/analytics/dashboard');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/analytics/ticket-trends', () => {
    it('admin can get ticket trends', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/ticket-trends')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('supports groupBy=month', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/ticket-trends?groupBy=month')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('end user is denied analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/ticket-trends')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/analytics/category-breakdown', () => {
    it('admin can get category breakdown', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/category-breakdown')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const hw = res.body.data.find(c => c.category === 'HARDWARE_ISSUES');
      expect(hw).toBeDefined();
      expect(hw.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('SLA routes', () => {
    it('GET /api/v1/sla/configurations returns SLA configs', async () => {
      const res = await request(app)
        .get('/api/v1/sla/configurations')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(4);
    });

    it('GET /api/v1/sla/report returns report', async () => {
      const res = await request(app)
        .get('/api/v1/sla/report')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.byPriority).toBeDefined();
    });
  });
});
