// __tests__/unit/telemetry-authorization.test.js
jest.mock(
  '../../src/config/database',
  () => {
    const transaction = {
      device: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },

      telemetryLog: {
        create: jest.fn(),
      },
    };

    return {
      prisma: {
        device: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
        },

        telemetryLog: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
          count: jest.fn(),
          aggregate: jest.fn(),
        },

        $transaction: jest.fn(
          callback => callback(transaction)
        ),

        __transaction: transaction,
      },
    };
  }
);

const {
  prisma,
} = require('../../src/config/database');

const telemetryService =
  require('../../src/modules/telemetry/telemetry.service');

const {
  PERMISSIONS,
} = require('../../src/shared/constants');

describe('telemetry object authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    prisma.$transaction.mockImplementation(
      callback =>
        callback(prisma.__transaction)
    );
  });

  it('does not transfer a device to a different user', async () => {
    prisma.__transaction.device
      .findUnique
      .mockResolvedValue({
        id: 'device-db-1',
        userId: 'owner-1',
      });

    await expect(
      telemetryService.ingestTelemetry(
        {
          deviceId: 'public-device-id',
          platform: 'android',
        },
        'attacker-1'
      )
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      prisma.__transaction.device.update
    ).not.toHaveBeenCalled();

    expect(
      prisma.__transaction.telemetryLog.create
    ).not.toHaveBeenCalled();
  });

  it('blocks another user from device health', async () => {
    prisma.device.findUnique.mockResolvedValue({
      id: 'device-db-1',
      deviceId: 'public-device-id',
      userId: 'owner-1',
    });

    await expect(
      telemetryService.getDeviceHealth(
        'public-device-id',
        'attacker-1',
        []
      )
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      prisma.telemetryLog.findFirst
    ).not.toHaveBeenCalled();
  });

  it('allows analytics users and serializes BigInt values', async () => {
    prisma.device.findUnique.mockResolvedValue({
      id: 'device-db-1',
      deviceId: 'public-device-id',
      userId: 'owner-1',
    });

    prisma.telemetryLog.findFirst.mockResolvedValue({
      id: 'log-1',
      ramTotal: BigInt(16000000000),
      ramAvailable: BigInt(8000000000),
      storageTotal: BigInt(512000000000),
      storageAvailable: BigInt(256000000000),
    });

    prisma.telemetryLog.aggregate.mockResolvedValue({
      _avg: {
        healthScore: 90,
        cpuUsage: 20,
        batteryLevel: 80,
      },

      _count: {
        id: 1,
      },
    });

    const result =
      await telemetryService.getDeviceHealth(
        'public-device-id',
        'manager-1',
        [PERMISSIONS.ANALYTICS_READ]
      );

    expect(
      result.latestLog.ramTotal
    ).toBe(16000000000);

    expect(() =>
      JSON.stringify(result)
    ).not.toThrow();
  });
});