// __tests__/integration/assets.test.js
const request = require('supertest');

const app = require('../../src/server');
const { prisma } = require(
  '../../src/config/database'
);

const {
  seedTestData,
  cleanTestData,
} = require('../helpers/fixtures');

const describeWithDatabase =
  process.env.SKIP_INTEGRATION_TESTS === 'true'
    ? describe.skip
    : describe;

const VALID_MISSING_ASSET_ID =
  '11111111-1111-4111-8111-111111111111';

describeWithDatabase(
  'Assets Integration Tests',
  () => {
    let adminToken;
    let techToken;
    let userToken;
    let testData;
    let createdAssetId;
    let createdAssetTag;

    async function login(email) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'Test@1234!',
        });

      if (
        response.status !== 200
        || !response.body.data?.accessToken
      ) {
        throw new Error(
          `Login failed for ${email}: `
          + `${response.status} `
          + JSON.stringify(response.body)
        );
      }

      return response.body.data.accessToken;
    }

    function validAsset(overrides = {}) {
      return {
        name: 'Dell Latitude 5420',
        category: 'LAPTOP',
        make: 'Dell',
        model: 'Latitude 5420',
        serialNumber: 'SN-TEST-001',
        purchaseDate: '2025-01-15',
        purchasePrice: 1500,
        warrantyExpiry: '2027-01-15',
        location: 'Accra Office',

        specifications: {
          cpu: 'Intel Core i7',
          ramGb: 16,
        },

        notes: 'Integration-test asset',
        ...overrides,
      };
    }

    beforeAll(async () => {
      await cleanTestData(prisma);
      testData = await seedTestData(prisma);

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

    describe('POST /api/v1/assets', () => {
      it(
        'admin can create a real in-stock asset',
        async () => {
          const response = await request(app)
            .post('/api/v1/assets')
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send(validAsset());

          expect(response.status).toBe(201);
          expect(response.body.success).toBe(true);

          expect(response.body.data.name)
            .toBe('Dell Latitude 5420');

          expect(response.body.data.category)
            .toBe('LAPTOP');

          expect(response.body.data.make)
            .toBe('Dell');

          expect(
            Number(response.body.data.purchasePrice)
          ).toBe(1500);

          expect(response.body.data.status)
            .toBe('INACTIVE');

          expect(response.body.data.assetTag)
            .toMatch(/^AST-/);

          expect(response.body.data.assignments)
            .toEqual([]);

          createdAssetId =
            response.body.data.id;

          createdAssetTag =
            response.body.data.assetTag;
        }
      );

      it(
        'rejects a duplicate serial number',
        async () => {
          const response = await request(app)
            .post('/api/v1/assets')
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send(
              validAsset({
                name: 'Duplicate serial asset',
              })
            );

          expect(response.status).toBe(409);
        }
      );

      it(
        'rejects a duplicate asset tag',
        async () => {
          const response = await request(app)
            .post('/api/v1/assets')
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send(
              validAsset({
                name: 'Duplicate tag asset',
                assetTag: createdAssetTag,

                serialNumber:
                  'SN-DUPLICATE-TAG-001',
              })
            );

          expect(response.status).toBe(409);
        }
      );

      it(
        'cannot create an in-use asset without an assignment',
        async () => {
          const response = await request(app)
            .post('/api/v1/assets')
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send(
              validAsset({
                name: 'Invalid in-use asset',

                serialNumber:
                  'SN-ACTIVE-WITHOUT-USER',

                status: 'ACTIVE',
              })
            );

          expect(response.status).toBe(400);
        }
      );

      it(
        'end user cannot create an asset',
        async () => {
          const response = await request(app)
            .post('/api/v1/assets')
            .set(
              'Authorization',
              `Bearer ${userToken}`
            )
            .send(
              validAsset({
                name: 'Unauthorized Asset',

                serialNumber:
                  'SN-UNAUTHORIZED-001',
              })
            );

          expect(response.status).toBe(403);
        }
      );

      it(
        'returns 401 without an access token',
        async () => {
          const response = await request(app)
            .post('/api/v1/assets')
            .send(
              validAsset({
                name: 'Unauthenticated Asset',

                serialNumber:
                  'SN-UNAUTHENTICATED-001',
              })
            );

          expect(response.status).toBe(401);
        }
      );
    });

    describe('GET /api/v1/assets', () => {
      it(
        'admin can list assets with pagination',
        async () => {
          const response = await request(app)
            .get('/api/v1/assets')
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

          expect(response.status).toBe(200);

          expect(
            Array.isArray(response.body.data)
          ).toBe(true);

          expect(response.body.pagination)
            .toEqual(
              expect.objectContaining({
                page: 1,
                total: 1,
              })
            );

          expect(
            response.body.data.some(
              asset =>
                asset.id === createdAssetId
            )
          ).toBe(true);
        }
      );

      it(
        'technician can list assets',
        async () => {
          const response = await request(app)
            .get('/api/v1/assets')
            .set(
              'Authorization',
              `Bearer ${techToken}`
            );

          expect(response.status).toBe(200);
        }
      );

      it(
        'end user cannot list the organization asset inventory',
        async () => {
          const response = await request(app)
            .get('/api/v1/assets')
            .set(
              'Authorization',
              `Bearer ${userToken}`
            );

          expect(response.status).toBe(403);
        }
      );

      it(
        'can filter by category',
        async () => {
          const response = await request(app)
            .get(
              '/api/v1/assets?category=LAPTOP'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

          expect(response.status).toBe(200);

          expect(response.body.data.length)
            .toBeGreaterThan(0);

          response.body.data.forEach(asset => {
            expect(asset.category)
              .toBe('LAPTOP');
          });
        }
      );

      it(
        'can filter by status',
        async () => {
          const response = await request(app)
            .get(
              '/api/v1/assets?status=INACTIVE'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

          expect(response.status).toBe(200);

          expect(response.body.data.length)
            .toBeGreaterThan(0);

          response.body.data.forEach(asset => {
            expect(asset.status)
              .toBe('INACTIVE');
          });
        }
      );

      it(
        'safely clamps an oversized page limit',
        async () => {
          const response = await request(app)
            .get('/api/v1/assets?limit=200')
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

          expect(response.status).toBe(200);

          expect(
            response.body.pagination.limit
          ).toBe(100);
        }
      );
    });

    describe(
      'GET /api/v1/assets/:id',
      () => {
        it(
          'returns an asset and its assignment history',
          async () => {
            const response = await request(app)
              .get(
                `/api/v1/assets/${createdAssetId}`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              );

            expect(response.status).toBe(200);

            expect(response.body.data.id)
              .toBe(createdAssetId);

            expect(
              response.body.data.assignments
            ).toEqual([]);
          }
        );

        it(
          'returns 404 for a valid but missing asset id',
          async () => {
            const response = await request(app)
              .get(
                `/api/v1/assets/${VALID_MISSING_ASSET_ID}`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              );

            expect(response.status).toBe(404);
          }
        );

        it(
          'returns 400 for a malformed asset id',
          async () => {
            const response = await request(app)
              .get(
                '/api/v1/assets/not-a-uuid'
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              );

            expect(response.status).toBe(400);
          }
        );
      }
    );

    describe(
      'PATCH /api/v1/assets/:id',
      () => {
        it(
          'admin can update an asset',
          async () => {
            const response = await request(app)
              .patch(
                `/api/v1/assets/${createdAssetId}`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              )
              .send({
                location: 'Kumasi Office',

                notes:
                  'Moved to the Kumasi equipment store',
              });

            expect(response.status).toBe(200);

            expect(
              response.body.data.location
            ).toBe('Kumasi Office');

            expect(response.body.data.notes)
              .toBe(
                'Moved to the Kumasi equipment store'
              );
          }
        );

        it(
          'rejects an empty update',
          async () => {
            const response = await request(app)
              .patch(
                `/api/v1/assets/${createdAssetId}`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              )
              .send({});

            expect(response.status).toBe(400);
          }
        );

        it(
          'cannot mark an unassigned asset as in use directly',
          async () => {
            const response = await request(app)
              .patch(
                `/api/v1/assets/${createdAssetId}`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              )
              .send({
                status: 'ACTIVE',
              });

            expect(response.status).toBe(409);
          }
        );
      }
    );

    describe(
      'POST /api/v1/assets/:id/assign',
      () => {
        it(
          'read-only technician cannot assign an asset',
          async () => {
            const response = await request(app)
              .post(
                `/api/v1/assets/${createdAssetId}/assign`
              )
              .set(
                'Authorization',
                `Bearer ${techToken}`
              )
              .send({
                userId: testData.endUser.id,
              });

            expect(response.status).toBe(403);
          }
        );

        it(
          'admin can assign an in-stock asset to an active user',
          async () => {
            const response = await request(app)
              .post(
                `/api/v1/assets/${createdAssetId}/assign`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              )
              .send({
                userId: testData.endUser.id,
                notes: 'Issued for remote work',
              });

            expect(response.status).toBe(200);

            expect(
              response.body.data.asset.status
            ).toBe('ACTIVE');

            expect(
              response.body.data.assignment.userId
            ).toBe(testData.endUser.id);

            expect(
              response.body.data.assignment.isActive
            ).toBe(true);

            expect(
              response.body.data.assignment.user
                .email
            ).toBe('user@test.com');

            const notification =
              await prisma.notification.findFirst({
                where: {
                  userId: testData.endUser.id,
                  type: 'ASSET_ASSIGNED',
                },

                orderBy: {
                  createdAt: 'desc',
                },
              });

            expect(notification).not.toBeNull();

            expect(notification.data.assetId)
              .toBe(createdAssetId);
          }
        );

        it(
          'list response includes the current assignee',
          async () => {
            const response = await request(app)
              .get(
                '/api/v1/assets?status=ACTIVE'
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              );

            expect(response.status).toBe(200);

            const asset =
              response.body.data.find(
                item =>
                  item.id === createdAssetId
              );

            expect(asset).toBeDefined();

            expect(asset.assignments)
              .toHaveLength(1);

            expect(
              asset.assignments[0].user.email
            ).toBe('user@test.com');
          }
        );

        it(
          'does not silently reassign an already assigned asset',
          async () => {
            const response = await request(app)
              .post(
                `/api/v1/assets/${createdAssetId}/assign`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              )
              .send({
                userId: testData.techUser.id,
              });

            expect(response.status).toBe(409);
          }
        );

        it(
          'returns the active assignment in history',
          async () => {
            const response = await request(app)
              .get(
                `/api/v1/assets/${createdAssetId}/history`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              );

            expect(response.status).toBe(200);

            expect(response.body.data)
              .toHaveLength(1);

            expect(
              response.body.data[0].isActive
            ).toBe(true);

            expect(
              response.body.data[0].returnedAt
            ).toBeNull();
          }
        );

        it(
          'cannot delete an asset while it is assigned',
          async () => {
            const response = await request(app)
              .delete(
                `/api/v1/assets/${createdAssetId}`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              );

            expect(response.status).toBe(409);
          }
        );
      }
    );

    describe(
      'POST /api/v1/assets/:id/return',
      () => {
        it(
          'admin can return an assigned asset to stock',
          async () => {
            const response = await request(app)
              .post(
                `/api/v1/assets/${createdAssetId}/return`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              )
              .send({
                notes:
                  'Returned in good condition',
              });

            expect(response.status).toBe(200);

            expect(
              response.body.data.asset.status
            ).toBe('INACTIVE');

            expect(
              response.body.data.assignment.isActive
            ).toBe(false);

            expect(
              response.body.data.assignment.returnedAt
            ).toBeTruthy();

            expect(
              response.body.data.assignment.notes
            ).toBe(
              'Returned in good condition'
            );
          }
        );

        it(
          'rejects returning an asset twice',
          async () => {
            const response = await request(app)
              .post(
                `/api/v1/assets/${createdAssetId}/return`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              )
              .send({});

            expect(response.status).toBe(409);
          }
        );

        it(
          'history records the completed return',
          async () => {
            const response = await request(app)
              .get(
                `/api/v1/assets/${createdAssetId}/history`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              );

            expect(response.status).toBe(200);

            expect(response.body.data)
              .toHaveLength(1);

            expect(
              response.body.data[0].isActive
            ).toBe(false);

            expect(
              response.body.data[0].returnedAt
            ).toBeTruthy();
          }
        );
      }
    );

    describe(
      'GET /api/v1/assets/stats',
      () => {
        it(
          'returns production asset statistics',
          async () => {
            const response = await request(app)
              .get('/api/v1/assets/stats')
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              );

            expect(response.status).toBe(200);

            expect(response.body.data)
              .toEqual(
                expect.objectContaining({
                  total: 1,
                  assigned: 0,
                  unassigned: 1,

                  warrantyExpiringSoon:
                    expect.any(Number),

                  byStatus:
                    expect.objectContaining({
                      INACTIVE: 1,
                    }),

                  byCategory:
                    expect.objectContaining({
                      LAPTOP: 1,
                    }),
                })
              );
          }
        );
      }
    );

    describe(
      'DELETE /api/v1/assets/:id',
      () => {
        it(
          'admin can soft-delete an unassigned asset',
          async () => {
            const response = await request(app)
              .delete(
                `/api/v1/assets/${createdAssetId}`
              )
              .set(
                'Authorization',
                `Bearer ${adminToken}`
              );

            expect(response.status).toBe(200);

            expect(response.body.message)
              .toMatch(/deleted/i);
          }
        );

        it(
          'deleted asset is no longer readable or listed',
          async () => {
            const [
              detailResponse,
              listResponse,
            ] = await Promise.all([
              request(app)
                .get(
                  `/api/v1/assets/${createdAssetId}`
                )
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                ),

              request(app)
                .get('/api/v1/assets')
                .set(
                  'Authorization',
                  `Bearer ${adminToken}`
                ),
            ]);

            expect(detailResponse.status)
              .toBe(404);

            expect(listResponse.status)
              .toBe(200);

            expect(
              listResponse.body.data.some(
                asset =>
                  asset.id === createdAssetId
              )
            ).toBe(false);
          }
        );
      }
    );
  }
);