// __tests__/integration/auth.test.js
const request = require('supertest');
const app = require('../../src/server');
const { prisma } = require('../../src/config/database');
const { seedTestData, cleanTestData } = require('../helpers/fixtures');

// Skip integration tests if no test DB is configured
const skipIfNoDb = process.env.SKIP_INTEGRATION_TESTS === 'true' ? describe.skip : describe;

skipIfNoDb('Auth Integration Tests', () => {
  let testData;

  beforeAll(async () => {
    await cleanTestData(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanTestData(prisma);
    await prisma.$disconnect();
  });

  // ============================================================
  describe('POST /api/v1/auth/register', () => {
    it('registers a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'Test@1234!',
          firstName: 'New',
          lastName: 'User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('newuser@test.com');
    });

    it('rejects duplicate email', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'dup@test.com', password: 'Test@1234!', firstName: 'A', lastName: 'B' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'dup@test.com', password: 'Test@1234!', firstName: 'A', lastName: 'B' });

      expect(res.status).toBe(409);
    });

    it('rejects weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'weak@test.com', password: 'weak', firstName: 'A', lastName: 'B' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'Test@1234!', firstName: 'A', lastName: 'B' });
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  describe('POST /api/v1/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'Test@1234!' });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe('admin@test.com');
      expect(res.body.data.user.role).toBe('super_admin');
    });

    it('rejects invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'WrongPass!' });
      expect(res.status).toBe(401);
    });

    it('rejects unknown email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@test.com', password: 'Test@1234!' });
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  describe('GET /api/v1/auth/me', () => {
    let accessToken;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'Test@1234!' });
      accessToken = res.body.data.accessToken;
    });

    it('returns current user with valid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('admin@test.com');
      expect(res.body.data.permissions).toBeInstanceOf(Array);
    });

    it('rejects request without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects request with bad token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer bad.token');
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  describe('POST /api/v1/auth/refresh-token', () => {
    it('refreshes tokens with valid refresh token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'Test@1234!' });
      const { refreshToken } = loginRes.body.data;

      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('rejects invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: 'bad-token' });
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  describe('POST /api/v1/auth/logout', () => {
    it('logs out and invalidates token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'user@test.com', password: 'Test@1234!' });
      const { accessToken } = loginRes.body.data;

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(logoutRes.status).toBe(200);

      // Token should now be blacklisted
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes.status).toBe(401);
    });
  });

  // ============================================================
  describe('Health endpoint', () => {
    it('returns healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });
});
