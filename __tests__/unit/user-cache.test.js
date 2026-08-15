// __tests__/unit/user-cache.test.js
const {
  AUTHENTICATED_USER_SELECT,
  toAuthenticatedUser,
} = require('../../src/modules/users/user-cache');

describe('authenticated user cache safety', () => {
  const databaseUser = {
    id: 'user-1',
    email: 'user@example.com',
    password: 'bcrypt-password-hash',
    failedLoginAttempts: 4,
    lockedUntil: new Date(),
    fcmToken: 'private-push-token',
    firstName: 'Juliet',
    lastName: 'Mensah',
    status: 'ACTIVE',
    emailVerified: true,
    roleId: 'role-1',
    departmentId: 'department-1',

    role: {
      id: 'role-1',
      name: 'end_user',
      displayName: 'End User',

      permissions: [
        {
          permission: {
            id: 'permission-1',
            name: 'ticket:read:own',
            resource: 'ticket',
            action: 'read:own',
            description:
              'This field is not needed in cache',
          },
        },
      ],
    },

    department: {
      id: 'department-1',
      name: 'Operations',
      code: 'OPS',
      description:
        'This field is not needed in cache',
    },
  };

  it('uses a Prisma select without sensitive fields', () => {
    expect(
      AUTHENTICATED_USER_SELECT.password
    ).toBeUndefined();

    expect(
      AUTHENTICATED_USER_SELECT.failedLoginAttempts
    ).toBeUndefined();

    expect(
      AUTHENTICATED_USER_SELECT.lockedUntil
    ).toBeUndefined();

    expect(
      AUTHENTICATED_USER_SELECT.fcmToken
    ).toBeUndefined();
  });

  it('creates an allow-listed cache object without secrets', () => {
    const cachedUser =
      toAuthenticatedUser(databaseUser);

    const serialized =
      JSON.stringify(cachedUser);

    expect(cachedUser)
      .not.toHaveProperty('password');

    expect(cachedUser)
      .not.toHaveProperty(
        'failedLoginAttempts'
      );

    expect(cachedUser)
      .not.toHaveProperty('lockedUntil');

    expect(cachedUser)
      .not.toHaveProperty('fcmToken');

    expect(serialized)
      .not.toContain('bcrypt-password-hash');

    expect(serialized)
      .not.toContain('private-push-token');

    expect(
      cachedUser
        .role
        .permissions[0]
        .permission
    ).toEqual({
      id: 'permission-1',
      name: 'ticket:read:own',
      resource: 'ticket',
      action: 'read:own',
    });
  });
});