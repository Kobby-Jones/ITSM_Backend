// __tests__/integration/knowledge-base.test.js
const request = require('supertest');
const app = require('../../src/server');
const { prisma } = require('../../src/config/database');
const { seedTestData, cleanTestData } = require('../helpers/fixtures');

const skipIfNoDb = process.env.SKIP_INTEGRATION_TESTS === 'true' ? describe.skip : describe;

skipIfNoDb('Knowledge Base Integration Tests', () => {
  let adminToken;
  let techToken;
  let userToken;
  let createdArticleId;

  beforeAll(async () => {
    await cleanTestData(prisma);
    await seedTestData(prisma);

    const [adminLogin, techLogin, userLogin] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'Test@1234!' }),
      request(app).post('/api/v1/auth/login').send({ email: 'tech@test.com', password: 'Test@1234!' }),
      request(app).post('/api/v1/auth/login').send({ email: 'user@test.com', password: 'Test@1234!' }),
    ]);

    adminToken = adminLogin.body.data?.tokens?.accessToken;
    techToken = techLogin.body.data?.tokens?.accessToken;
    userToken = userLogin.body.data?.tokens?.accessToken;
  });

  afterAll(async () => {
    await cleanTestData(prisma);
    await prisma.$disconnect();
  });

  // ── POST /api/v1/knowledge-base ──────────────────────────────────────────
  describe('POST /api/v1/knowledge-base', () => {
    it('admin can create a draft article', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'How to reset your password',
          content: 'Step 1: Go to the login page. Step 2: Click "Forgot password". Step 3: Enter your email address. Step 4: Check your inbox and follow the link provided.',
          category: 'SECURITY',
          tags: ['password', 'security', 'account'],
          isPublished: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('How to reset your password');
      expect(res.body.data.isPublished).toBe(false);
      createdArticleId = res.body.data.id;
    });

    it('technician can create an article', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          title: 'Troubleshooting VPN connectivity',
          content: 'Common VPN issues and solutions. First, ensure you have the correct credentials. Then verify the VPN server address is correct. Try disconnecting and reconnecting.',
          category: 'NETWORK',
          tags: ['vpn', 'network', 'connectivity'],
          isPublished: true,
        });

      expect(res.status).toBe(201);
    });

    it('end user cannot create an article', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Unauthorized Article',
          content: 'This should not be allowed.',
          category: 'OTHER',
        });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/v1/knowledge-base ───────────────────────────────────────────
  describe('GET /api/v1/knowledge-base', () => {
    it('admin sees all articles including drafts', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('end user only sees published articles', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach(article => {
        expect(article.isPublished).toBe(true);
      });
    });

    it('can search articles by keyword', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge-base?search=VPN')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some(a => a.title.toLowerCase().includes('vpn'))).toBe(true);
    });
  });

  // ── GET /api/v1/knowledge-base/:id ──────────────────────────────────────
  describe('GET /api/v1/knowledge-base/:id', () => {
    it('returns article by id and increments view count', async () => {
      const res1 = await request(app)
        .get(`/api/v1/knowledge-base/${createdArticleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res1.status).toBe(200);
      const firstViewCount = res1.body.data.viewCount;

      const res2 = await request(app)
        .get(`/api/v1/knowledge-base/${createdArticleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res2.body.data.viewCount).toBeGreaterThan(firstViewCount);
    });

    it('returns 404 for non-existent article', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge-base/does-not-exist-abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ── PUT /api/v1/knowledge-base/:id ──────────────────────────────────────
  describe('PUT /api/v1/knowledge-base/:id', () => {
    it('admin can update and publish an article', async () => {
      const res = await request(app)
        .put(`/api/v1/knowledge-base/${createdArticleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPublished: true, tags: ['password', 'security', 'account', 'self-service'] });

      expect(res.status).toBe(200);
      expect(res.body.data.isPublished).toBe(true);
    });
  });

  // ── POST /api/v1/knowledge-base/:id/rate ────────────────────────────────
  describe('POST /api/v1/knowledge-base/:id/rate', () => {
    it('user can rate an article', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge-base/${createdArticleId}/rate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5, feedback: 'Very helpful article!' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('averageRating');
    });

    it('returns validation error for out-of-range rating', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge-base/${createdArticleId}/rate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 10 });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/v1/knowledge-base/categories ───────────────────────────────
  describe('GET /api/v1/knowledge-base/categories', () => {
    it('returns list of categories with article counts', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge-base/categories')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── DELETE /api/v1/knowledge-base/:id ───────────────────────────────────
  describe('DELETE /api/v1/knowledge-base/:id', () => {
    it('admin can delete (soft-delete) an article', async () => {
      const res = await request(app)
        .delete(`/api/v1/knowledge-base/${createdArticleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('deleted article no longer appears in list', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${adminToken}`);

      const ids = res.body.data.map(a => a.id);
      expect(ids).not.toContain(createdArticleId);
    });
  });
});
