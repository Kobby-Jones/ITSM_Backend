// __tests__/integration/knowledge-base.test.js
const request = require('supertest');

const app = require('../../src/server');

const {
  prisma,
} = require('../../src/config/database');

const {
  seedTestData,
  cleanTestData,
} = require('../helpers/fixtures');

const skipIfNoDb =
  process.env.SKIP_INTEGRATION_TESTS
    === 'true'
    ? describe.skip
    : describe;

skipIfNoDb(
  'Knowledge Base Integration Tests',
  () => {
    let adminToken;
    let techToken;
    let userToken;
    let draftArticleId;
    let publishedArticleId;

    async function login(email) {
      const response =
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email,
            password: 'Test@1234!',
          });

      if (
        response.status !== 200
        || !response.body.data
          ?.accessToken
      ) {
        throw new Error(
          `Test login failed for ${email}: `
          + `${response.status} `
          + JSON.stringify(
            response.body
          )
        );
      }

      return response
        .body
        .data
        .accessToken;
    }

    beforeAll(async () => {
      await cleanTestData(prisma);
      await seedTestData(prisma);

      [
        adminToken,
        techToken,
        userToken,
      ] = await Promise.all([
        login('admin@test.com'),
        login('tech@test.com'),
        login('user@test.com'),
      ]);
    });

    afterAll(async () => {
      await cleanTestData(prisma);
      await prisma.$disconnect();
    });

    describe(
      'POST /api/v1/knowledge-base',
      () => {
        it(
          'admin can create a draft article',
          async () => {
            const response =
              await request(app)
                .post(
                  '/api/v1/knowledge-base'
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                )
                .send({
                  title:
                    'How to reset your password',

                  content:
                    'Step 1: Go to the login page. '
                    + 'Step 2: Click Forgot password. '
                    + 'Step 3: Enter your email address. '
                    + 'Step 4: Follow the secure reset link.',

                  summary:
                    'A secure guide for resetting an account password.',

                  category: 'SECURITY',

                  tags: [
                    'password',
                    'security',
                    'account',
                  ],

                  status: 'DRAFT',
                  isPublic: true,
                });

            expect(
              response.status
            ).toBe(201);

            expect(
              response.body.data.title
            ).toBe(
              'How to reset your password'
            );

            expect(
              response.body.data.status
            ).toBe('DRAFT');

            draftArticleId =
              response.body.data.id;
          }
        );

        it(
          'admin with publish permission can create a published article',
          async () => {
            const response =
              await request(app)
                .post(
                  '/api/v1/knowledge-base'
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                )
                .send({
                  title:
                    'Connecting to the corporate wireless network',

                  content:
                    'Open your wireless settings, select the corporate network, '
                    + 'enter your assigned credentials, and verify the certificate prompt.',

                  summary:
                    'Instructions for connecting to the corporate wireless network.',

                  category: 'NETWORK',

                  tags: [
                    'wifi',
                    'network',
                    'connectivity',
                  ],

                  status: 'PUBLISHED',
                  isPublic: true,
                });

            expect(
              response.status
            ).toBe(201);

            expect(
              response.body.data.status
            ).toBe('PUBLISHED');

            publishedArticleId =
              response.body.data.id;
          }
        );

        it(
          'technician can create a draft article',
          async () => {
            const response =
              await request(app)
                .post(
                  '/api/v1/knowledge-base'
                )
                .set(
                  'Authorization',
                  `Bearer ${techToken}`
                )
                .send({
                  title:
                    'Troubleshooting VPN connectivity',

                  content:
                    'Confirm the VPN credentials and server address. '
                    + 'Then restart the VPN client and reconnect to the approved gateway.',

                  summary:
                    'Common checks for VPN connection failures.',

                  category: 'NETWORK',

                  tags: [
                    'vpn',
                    'network',
                    'connectivity',
                  ],

                  status: 'DRAFT',
                });

            expect(
              response.status
            ).toBe(201);

            expect(
              response.body.data.status
            ).toBe('DRAFT');
          }
        );

        it(
          'technician without publish permission cannot publish',
          async () => {
            const response =
              await request(app)
                .post(
                  '/api/v1/knowledge-base'
                )
                .set(
                  'Authorization',
                  `Bearer ${techToken}`
                )
                .send({
                  title:
                    'Unapproved published guide',

                  content:
                    'This content is long enough for validation but must not be '
                    + 'published without the dedicated publishing permission.',

                  category: 'SECURITY',
                  status: 'PUBLISHED',
                });

            expect(
              response.status
            ).toBe(403);
          }
        );

        it(
          'end user cannot create an article',
          async () => {
            const response =
              await request(app)
                .post(
                  '/api/v1/knowledge-base'
                )
                .set(
                  'Authorization',
                  `Bearer ${userToken}`
                )
                .send({
                  title:
                    'Unauthorized Article',

                  content:
                    'This article must not be created by an ordinary end user.',

                  category: 'OTHER',
                });

            expect(
              response.status
            ).toBe(403);
          }
        );
      }
    );

    describe(
      'GET /api/v1/knowledge-base',
      () => {
        it(
          'admin sees published articles and drafts',
          async () => {
            const response =
              await request(app)
                .get(
                  '/api/v1/knowledge-base'
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                );

            expect(
              response.status
            ).toBe(200);

            expect(
              Array.isArray(
                response.body.data
              )
            ).toBe(true);

            expect(
              response.body.data.length
            ).toBeGreaterThanOrEqual(3);

            expect(
              response.body.data.some(
                article =>
                  article.status
                  === 'DRAFT'
              )
            ).toBe(true);

            expect(
              response.body.data.some(
                article =>
                  article.status
                  === 'PUBLISHED'
              )
            ).toBe(true);
          }
        );

        it(
          'end user sees only public published articles',
          async () => {
            const response =
              await request(app)
                .get(
                  '/api/v1/knowledge-base'
                )
                .set(
                  'Authorization',
                  `Bearer ${userToken}`
                );

            expect(
              response.status
            ).toBe(200);

            expect(
              response.body.data.length
            ).toBeGreaterThan(0);

            response.body.data.forEach(
              article => {
                expect(
                  article.status
                ).toBe('PUBLISHED');

                expect(
                  article.isPublic
                ).toBe(true);
              }
            );
          }
        );

        it(
          'can search articles by keyword',
          async () => {
            const response =
              await request(app)
                .get(
                  '/api/v1/knowledge-base?search=VPN'
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                );

            expect(
              response.status
            ).toBe(200);

            expect(
              response.body.data.some(
                article =>
                  article.title
                    .toLowerCase()
                    .includes('vpn')
              )
            ).toBe(true);
          }
        );
      }
    );

    describe(
      'GET /api/v1/knowledge-base/:id',
      () => {
        it(
          'returns article content and increments view count',
          async () => {
            const firstResponse =
              await request(app)
                .get(
                  `/api/v1/knowledge-base/${draftArticleId}`
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                );

            expect(
              firstResponse.status
            ).toBe(200);

            expect(
              firstResponse
                .body
                .data
                .content
            ).toContain('login page');

            const firstViewCount =
              firstResponse
                .body
                .data
                .viewCount;

            const secondResponse =
              await request(app)
                .get(
                  `/api/v1/knowledge-base/${draftArticleId}`
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                );

            expect(
              secondResponse.status
            ).toBe(200);

            expect(
              secondResponse
                .body
                .data
                .viewCount
            ).toBe(
              firstViewCount + 1
            );
          }
        );

        it(
          'does not expose a draft article to an end user',
          async () => {
            const response =
              await request(app)
                .get(
                  `/api/v1/knowledge-base/${draftArticleId}`
                )
                .set(
                  'Authorization',
                  `Bearer ${userToken}`
                );

            expect(
              response.status
            ).toBe(404);
          }
        );

        it(
          'returns 404 for a well-formed but non-existent id',
          async () => {
            const response =
              await request(app)
                .get(
                  '/api/v1/knowledge-base/11111111-1111-4111-8111-111111111111'
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                );

            expect(
              response.status
            ).toBe(404);
          }
        );

        it(
          'returns 400 for a malformed article id',
          async () => {
            const response =
              await request(app)
                .get(
                  '/api/v1/knowledge-base/not-a-valid-uuid'
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                );

            expect(
              response.status
            ).toBe(400);
          }
        );
      }
    );

    describe(
      'PATCH /api/v1/knowledge-base/:id',
      () => {
        it(
          'admin can update and publish a draft article',
          async () => {
            const response =
              await request(app)
                .patch(
                  `/api/v1/knowledge-base/${draftArticleId}`
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                )
                .send({
                  status: 'PUBLISHED',

                  tags: [
                    'password',
                    'security',
                    'account',
                    'self-service',
                  ],
                });

            expect(
              response.status
            ).toBe(200);

            expect(
              response.body.data.status
            ).toBe('PUBLISHED');
          }
        );

        it(
          'rejects an empty update',
          async () => {
            const response =
              await request(app)
                .patch(
                  `/api/v1/knowledge-base/${draftArticleId}`
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                )
                .send({});

            expect(
              response.status
            ).toBe(400);
          }
        );
      }
    );

    describe(
      'POST /api/v1/knowledge-base/:id/rate',
      () => {
        it(
          'user can rate a published article',
          async () => {
            const response =
              await request(app)
                .post(
                  `/api/v1/knowledge-base/${publishedArticleId}/rate`
                )
                .set(
                  'Authorization',
                  `Bearer ${userToken}`
                )
                .send({
                  rating: 5,
                  feedback:
                    'Very helpful article!',
                });

            expect(
              response.status
            ).toBe(200);

            expect(
              response
                .body
                .data
                .averageRating
            ).toBe(5);

            expect(
              response
                .body
                .data
                .totalRatings
            ).toBe(1);

            expect(
              response
                .body
                .data
                .helpfulCount
            ).toBe(1);
          }
        );

        it(
          'updates an existing user rating instead of duplicating it',
          async () => {
            const response =
              await request(app)
                .post(
                  `/api/v1/knowledge-base/${publishedArticleId}/rate`
                )
                .set(
                  'Authorization',
                  `Bearer ${userToken}`
                )
                .send({
                  rating: 2,
                  feedback:
                    'This needs more detail.',
                });

            expect(
              response.status
            ).toBe(200);

            expect(
              response
                .body
                .data
                .averageRating
            ).toBe(2);

            expect(
              response
                .body
                .data
                .totalRatings
            ).toBe(1);

            expect(
              response
                .body
                .data
                .notHelpfulCount
            ).toBe(1);
          }
        );

        it(
          'returns validation error for an out-of-range rating',
          async () => {
            const response =
              await request(app)
                .post(
                  `/api/v1/knowledge-base/${publishedArticleId}/rate`
                )
                .set(
                  'Authorization',
                  `Bearer ${userToken}`
                )
                .send({
                  rating: 10,
                });

            expect(
              response.status
            ).toBe(400);
          }
        );
      }
    );

    describe(
      'GET /api/v1/knowledge-base/categories',
      () => {
        it(
          'returns public published categories with article counts',
          async () => {
            const response =
              await request(app)
                .get(
                  '/api/v1/knowledge-base/categories'
                );

            expect(
              response.status
            ).toBe(200);

            expect(
              Array.isArray(
                response.body.data
              )
            ).toBe(true);

            expect(
              response.body.data.length
            ).toBeGreaterThan(0);

            response.body.data.forEach(
              category => {
                expect(category).toEqual(
                  expect.objectContaining({
                    category:
                      expect.any(String),

                    count:
                      expect.any(Number),
                  })
                );
              }
            );
          }
        );
      }
    );

    describe(
      'DELETE /api/v1/knowledge-base/:id',
      () => {
        it(
          'admin can soft-delete an article',
          async () => {
            const response =
              await request(app)
                .delete(
                  `/api/v1/knowledge-base/${draftArticleId}`
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                );

            expect(
              response.status
            ).toBe(200);

            expect(
              response.body.message
            ).toMatch(/deleted/i);
          }
        );

        it(
          'deleted article no longer appears in the list',
          async () => {
            const response =
              await request(app)
                .get(
                  '/api/v1/knowledge-base'
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                );

            expect(
              response.status
            ).toBe(200);

            const ids =
              response.body.data.map(
                article => article.id
              );

            expect(
              ids
            ).not.toContain(
              draftArticleId
            );
          }
        );
      }
    );
  }
);