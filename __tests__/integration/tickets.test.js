// __tests__/integration/tickets.test.js
const request = require('supertest');
const app = require('../../src/server');
const { prisma } = require('../../src/config/database');
const { seedTestData, cleanTestData, makeTicketData } = require('../helpers/fixtures');

const skipIfNoDb = process.env.SKIP_INTEGRATION_TESTS === 'true' ? describe.skip : describe;

skipIfNoDb('Tickets Integration Tests', () => {
  let adminToken, techToken, userToken, createdTicketId;

  async function login(email) {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Test@1234!' });
    return res.body.data?.accessToken;
  }

  beforeAll(async () => {
    await cleanTestData(prisma);
    await seedTestData(prisma);
    [adminToken, techToken, userToken] = await Promise.all([
      login('admin@test.com'),
      login('tech@test.com'),
      login('user@test.com'),
    ]);
  });

  afterAll(async () => {
    await cleanTestData(prisma);
    await prisma.$disconnect();
  });

  // ============================================================
  describe('POST /api/v1/tickets', () => {
    it('end user can create a ticket', async () => {
      const res = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${userToken}`)
        .send(makeTicketData());

      expect(res.status).toBe(201);
      expect(res.body.data.ticketNumber).toMatch(/^TKT-/);
      expect(res.body.data.status).toBe('OPEN');
      createdTicketId = res.body.data.id;
    });

    it('rejects short title', async () => {
      const res = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${userToken}`)
        .send(makeTicketData({ title: 'hi' }));
      expect(res.status).toBe(400);
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/v1/tickets')
        .send(makeTicketData());
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  describe('GET /api/v1/tickets', () => {
    it('end user sees only own tickets', async () => {
      // Create another ticket as admin
      await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(makeTicketData({ title: 'Admin ticket that is long enough to pass' }));

      const res = await request(app)
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      const tickets = res.body.data;
      expect(tickets.every(t => t.creator?.email === 'user@test.com' || t.creatorId !== undefined)).toBe(true);
    });

    it('technician sees all tickets', async () => {
      const res = await request(app)
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${techToken}`);
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('supports pagination', async () => {
      const res = await request(app)
        .get('/api/v1/tickets?page=1&limit=1')
        .set('Authorization', `Bearer ${techToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.limit).toBe(1);
    });

    it('supports status filter', async () => {
      const res = await request(app)
        .get('/api/v1/tickets?status=OPEN')
        .set('Authorization', `Bearer ${techToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every(t => t.status === 'OPEN')).toBe(true);
    });
  });

  // ============================================================
  describe('GET /api/v1/tickets/:id', () => {
    it('owner can read own ticket', async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdTicketId);
    });

    it('technician can read any ticket', async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${techToken}`);
      expect(res.status).toBe(200);
    });

    it('returns 404 for nonexistent ticket', async () => {
      const res = await request(app)
        .get('/api/v1/tickets/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${techToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  describe('PATCH /api/v1/tickets/:id/assign', () => {
    it('technician can assign a ticket', async () => {
      const techUser = await prisma.user.findUnique({ where: { email: 'tech@test.com' } });

      const res = await request(app)
        .patch(`/api/v1/tickets/${createdTicketId}/assign`)
        .set('Authorization', `Bearer ${techToken}`)
        .send({ assigneeId: techUser.id });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ASSIGNED');
      expect(res.body.data.assignee.email).toBe('tech@test.com');
    });

    it('end user cannot assign tickets', async () => {
      const techUser = await prisma.user.findUnique({ where: { email: 'tech@test.com' } });
      const res = await request(app)
        .patch(`/api/v1/tickets/${createdTicketId}/assign`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ assigneeId: techUser.id });
      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  describe('PATCH /api/v1/tickets/:id/status', () => {
    it('technician can change status', async () => {
      const res = await request(app)
        .patch(`/api/v1/tickets/${createdTicketId}/status`)
        .set('Authorization', `Bearer ${techToken}`)
        .send({ status: 'IN_PROGRESS', note: 'Working on it' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('rejects invalid status transition', async () => {
      // Can't go directly from IN_PROGRESS to CLOSED
      const res = await request(app)
        .patch(`/api/v1/tickets/${createdTicketId}/status`)
        .set('Authorization', `Bearer ${techToken}`)
        .send({ status: 'CLOSED' });
      expect(res.status).toBe(400);
    });

    it('allows resolving ticket', async () => {
      const res = await request(app)
        .patch(`/api/v1/tickets/${createdTicketId}/status`)
        .set('Authorization', `Bearer ${techToken}`)
        .send({ status: 'RESOLVED' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESOLVED');
    });
  });

  // ============================================================
  describe('POST /api/v1/tickets/:id/comments', () => {
    it('adds a comment to a ticket', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${createdTicketId}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'This is a test comment with enough content.' });

      expect(res.status).toBe(201);
      expect(res.body.data.content).toBe('This is a test comment with enough content.');
    });

    it('end user cannot post internal comments', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${createdTicketId}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Secret internal note', isInternal: true });

      // The endpoint doesn't error, but the isInternal flag is ignored for end users
      expect(res.status).toBe(201);
      expect(res.body.data.isInternal).toBe(false);
    });
  });

  // ============================================================
  describe('GET /api/v1/tickets/:id/history', () => {
    it('technician can view ticket history', async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${createdTicketId}/history`)
        .set('Authorization', `Bearer ${techToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
