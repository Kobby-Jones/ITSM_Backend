// __tests__/integration/assets.test.js
const request = require('supertest');
const app = require('../../src/server');
const { prisma } = require('../../src/config/database');
const { seedTestData, cleanTestData } = require('../helpers/fixtures');

const skipIfNoDb = process.env.SKIP_INTEGRATION_TESTS === 'true' ? describe.skip : describe;

skipIfNoDb('Assets Integration Tests', () => {
  let adminToken;
  let techToken;
  let userToken;
  let testData;
  let createdAssetId;

  beforeAll(async () => {
    await cleanTestData(prisma);
    testData = await seedTestData(prisma);

    // Login admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Test@1234!' });
    adminToken = adminLogin.body.data?.tokens?.accessToken;

    // Login tech
    const techLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tech@test.com', password: 'Test@1234!' });
    techToken = techLogin.body.data?.tokens?.accessToken;

    // Login end user
    const userLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@test.com', password: 'Test@1234!' });
    userToken = userLogin.body.data?.tokens?.accessToken;
  });

  afterAll(async () => {
    await cleanTestData(prisma);
    await prisma.$disconnect();
  });

  // ── POST /api/v1/assets ──────────────────────────────────────────────────
  describe('POST /api/v1/assets', () => {
    it('admin can create an asset', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dell Latitude 5420',
          assetType: 'LAPTOP',
          manufacturer: 'Dell',
          model: 'Latitude 5420',
          serialNumber: 'SN-TEST-001',
          status: 'AVAILABLE',
          purchaseDate: '2023-01-15',
          purchaseCost: 1500.00,
          warrantyExpiry: '2026-01-15',
          location: 'Accra Office',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Dell Latitude 5420');
      expect(res.body.data.assetTag).toMatch(/^AST-/);
      createdAssetId = res.body.data.id;
    });

    it('end user cannot create an asset', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Unauthorized Asset',
          assetType: 'LAPTOP',
          status: 'AVAILABLE',
        });

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/api/v1/assets').send({ name: 'X', assetType: 'LAPTOP' });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/v1/assets ───────────────────────────────────────────────────
  describe('GET /api/v1/assets', () => {
    it('admin can list all assets', async () => {
      const res = await request(app)
        .get('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
    });

    it('technician can list assets', async () => {
      const res = await request(app)
        .get('/api/v1/assets')
        .set('Authorization', `Bearer ${techToken}`);
      expect(res.status).toBe(200);
    });

    it('can filter by assetType', async () => {
      const res = await request(app)
        .get('/api/v1/assets?assetType=LAPTOP')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach(asset => {
        expect(asset.assetType).toBe('LAPTOP');
      });
    });
  });

  // ── GET /api/v1/assets/:id ───────────────────────────────────────────────
  describe('GET /api/v1/assets/:id', () => {
    it('returns a single asset by id', async () => {
      const res = await request(app)
        .get(`/api/v1/assets/${createdAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdAssetId);
      expect(res.body.data.name).toBe('Dell Latitude 5420');
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app)
        .get('/api/v1/assets/non-existent-uuid-12345')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ── PUT /api/v1/assets/:id ───────────────────────────────────────────────
  describe('PUT /api/v1/assets/:id', () => {
    it('admin can update an asset', async () => {
      const res = await request(app)
        .put(`/api/v1/assets/${createdAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ location: 'Kumasi Office', status: 'IN_USE' });

      expect(res.status).toBe(200);
      expect(res.body.data.location).toBe('Kumasi Office');
    });
  });

  // ── POST /api/v1/assets/:id/assign ──────────────────────────────────────
  describe('POST /api/v1/assets/:id/assign', () => {
    it('admin can assign an asset to a user', async () => {
      const res = await request(app)
        .post(`/api/v1/assets/${createdAssetId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: testData.endUser.id, notes: 'Assigned for testing purposes' });

      expect(res.status).toBe(200);
      expect(res.body.data.assignment).toBeDefined();
      expect(res.body.data.assignment.userId).toBe(testData.endUser.id);
    });

    it('can view assignment history', async () => {
      const res = await request(app)
        .get(`/api/v1/assets/${createdAssetId}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  // ── POST /api/v1/assets/:id/return ──────────────────────────────────────
  describe('POST /api/v1/assets/:id/return', () => {
    it('admin can return an assigned asset', async () => {
      const res = await request(app)
        .post(`/api/v1/assets/${createdAssetId}/return`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Returned in good condition' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('AVAILABLE');
    });
  });

  // ── GET /api/v1/assets/stats ─────────────────────────────────────────────
  describe('GET /api/v1/assets/stats', () => {
    it('admin can get asset statistics', async () => {
      const res = await request(app)
        .get('/api/v1/assets/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('byStatus');
      expect(res.body.data).toHaveProperty('byType');
    });
  });

  // ── DELETE /api/v1/assets/:id ────────────────────────────────────────────
  describe('DELETE /api/v1/assets/:id', () => {
    it('admin can soft-delete an unassigned asset', async () => {
      const res = await request(app)
        .delete(`/api/v1/assets/${createdAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });
  });
});
