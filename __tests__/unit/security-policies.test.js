// __tests__/unit/security-policies.test.js
jest.mock(
  '../../src/config/database',
  () => ({
    prisma: {},
  })
);

jest.mock(
  '../../src/config/redis',
  () => ({
    cacheGet: jest.fn(),
    cacheSet: jest.fn(),
  })
);

const {
  PERMISSIONS,
} = require('../../src/shared/constants');

const {
  canReadTicket,
  canUpdateTicket,
  assertCanReadTicket,
} = require('../../src/policies/ticket.policy');

const {
  canReadDevice,
  assertCanReadDevice,
} = require('../../src/policies/device.policy');

const {
  authorizeSelfOr,
} = require('../../src/middleware/auth.middleware');

describe('object-level security policies', () => {
  describe('ticket policy', () => {
    const ticket = {
      id: 'ticket-1',
      creatorId: 'owner-1',
    };

    it('allows read-own only for the creator', () => {
      const permissions = [
        PERMISSIONS.TICKET_READ_OWN,
      ];

      expect(
        canReadTicket(
          ticket,
          'owner-1',
          permissions
        )
      ).toBe(true);

      expect(
        canReadTicket(
          ticket,
          'other-1',
          permissions
        )
      ).toBe(false);
    });

    it('allows read-all for a different user', () => {
      expect(
        canReadTicket(
          ticket,
          'technician-1',
          [PERMISSIONS.TICKET_READ_ALL]
        )
      ).toBe(true);
    });

    it('allows update-own only for the creator', () => {
      const permissions = [
        PERMISSIONS.TICKET_UPDATE_OWN,
      ];

      expect(
        canUpdateTicket(
          ticket,
          'owner-1',
          permissions
        )
      ).toBe(true);

      expect(
        canUpdateTicket(
          ticket,
          'other-1',
          permissions
        )
      ).toBe(false);
    });

    it('throws 403 for cross-user ticket access', () => {
      expect(() =>
        assertCanReadTicket(
          ticket,
          'other-1',
          [PERMISSIONS.TICKET_READ_OWN]
        )
      ).toThrow(
        expect.objectContaining({
          statusCode: 403,
        })
      );
    });
  });

  describe('device policy', () => {
    const device = {
      id: 'device-1',
      userId: 'owner-1',
    };

    it('allows the registered device owner', () => {
      expect(
        canReadDevice(
          device,
          'owner-1',
          []
        )
      ).toBe(true);
    });

    it('allows users with analytics permission', () => {
      expect(
        canReadDevice(
          device,
          'manager-1',
          [PERMISSIONS.ANALYTICS_READ]
        )
      ).toBe(true);
    });

    it('denies another ordinary user', () => {
      expect(() =>
        assertCanReadDevice(
          device,
          'other-1',
          []
        )
      ).toThrow(
        expect.objectContaining({
          statusCode: 403,
        })
      );
    });
  });

  describe('self-or-permission middleware', () => {
    function createRequest(
      requestedUserId,
      authenticatedUserId,
      permissions = []
    ) {
      return {
        params: {
          id: requestedUserId,
        },

        user: {
          id: authenticatedUserId,

          role: {
            permissions: permissions.map(
              name => ({
                permission: {
                  name,
                },
              })
            ),
          },
        },
      };
    }

    it('allows users to update their own profile', () => {
      const next = jest.fn();

      authorizeSelfOr(
        PERMISSIONS.USER_UPDATE
      )(
        createRequest(
          'user-1',
          'user-1'
        ),
        {},
        next
      );

      expect(next).toHaveBeenCalledWith();
    });

    it('denies updating another user without permission', () => {
      const next = jest.fn();

      authorizeSelfOr(
        PERMISSIONS.USER_UPDATE
      )(
        createRequest(
          'user-2',
          'user-1'
        ),
        {},
        next
      );

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
        })
      );
    });

    it('allows updating another user with permission', () => {
      const next = jest.fn();

      authorizeSelfOr(
        PERMISSIONS.USER_UPDATE
      )(
        createRequest(
          'user-2',
          'admin-1',
          [PERMISSIONS.USER_UPDATE]
        ),
        {},
        next
      );

      expect(next).toHaveBeenCalledWith();
    });
  });
});