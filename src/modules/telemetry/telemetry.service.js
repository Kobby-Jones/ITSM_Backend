// src/modules/telemetry/telemetry.service.js
const { prisma } = require('../../config/database');

const {
  calculateHealthScore,
  getPagination,
} = require('../../utils/helpers');

const {
  AuthorizationError,
  NotFoundError,
} = require('../../shared/errors');

const {
  assertCanReadDevice,
} = require('../../policies/device.policy');

function serializeTelemetryLog(log) {
  if (!log) {
    return null;
  }

  return {
    ...log,

    ramTotal:
      log.ramTotal != null
        ? Number(log.ramTotal)
        : null,

    ramAvailable:
      log.ramAvailable != null
        ? Number(log.ramAvailable)
        : null,

    storageTotal:
      log.storageTotal != null
        ? Number(log.storageTotal)
        : null,

    storageAvailable:
      log.storageAvailable != null
        ? Number(log.storageAvailable)
        : null,
  };
}

async function ingestTelemetry(data, userId) {
  const {
    deviceId,
    deviceModel,
    osVersion,
    appVersion,
    ramTotal,
    ramAvailable,
    cpuUsage,
    batteryLevel,
    storageTotal,
    storageAvailable,
    networkStatus,
    networkType,
    crashLogs,
    errorLogs,
    metadata,
    recordedAt,
  } = data;

  const healthScore = calculateHealthScore({
    cpuUsage,
    ramAvailable,
    ramTotal,
    storageAvailable,
    storageTotal,
    batteryLevel,
  });

  return prisma.$transaction(
    async transaction => {
      let device = null;

      if (deviceId) {
        const existingDevice =
          await transaction.device.findUnique({
            where: {
              deviceId,
            },

            select: {
              id: true,
              userId: true,
            },
          });

        /*
         * A client-supplied identifier must never transfer an existing
         * device from one user account to another.
         */
        if (
          existingDevice?.userId
          && existingDevice.userId !== userId
        ) {
          throw new AuthorizationError(
            'This device is already registered to another user'
          );
        }

        if (existingDevice) {
          device =
            await transaction.device.update({
              where: {
                id: existingDevice.id,
              },

              data: {
                platform:
                  data.platform || 'unknown',

                model: deviceModel,
                osVersion,
                appVersion,
                lastSeenAt: new Date(),

                userId:
                  existingDevice.userId
                  || userId,
              },
            });
        } else {
          device =
            await transaction.device.create({
              data: {
                deviceId,

                platform:
                  data.platform || 'unknown',

                model: deviceModel,
                osVersion,
                appVersion,
                userId,
              },
            });
        }
      }

      const log =
        await transaction.telemetryLog.create({
          data: {
            deviceModel,
            osVersion,
            appVersion,

            ramTotal:
              ramTotal != null
                ? BigInt(ramTotal)
                : null,

            ramAvailable:
              ramAvailable != null
                ? BigInt(ramAvailable)
                : null,

            cpuUsage,
            batteryLevel,

            storageTotal:
              storageTotal != null
                ? BigInt(storageTotal)
                : null,

            storageAvailable:
              storageAvailable != null
                ? BigInt(storageAvailable)
                : null,

            networkStatus,
            networkType,
            crashLogs: crashLogs || null,
            errorLogs: errorLogs || null,
            healthScore,
            metadata: metadata || null,

            recordedAt: recordedAt
              ? new Date(recordedAt)
              : new Date(),

            deviceId: device?.id,
            userId,
          },
        });

      return {
        id: log.id,
        healthScore,
        deviceId: device?.id,
      };
    }
  );
}

async function getDeviceTelemetry(
  deviceId,
  query,
  userId,
  userPermissions
) {
  const device = await prisma.device.findUnique({
    where: {
      deviceId,
    },
  });

  if (!device) {
    throw new NotFoundError('Device not found');
  }

  assertCanReadDevice(
    device,
    userId,
    userPermissions
  );

  const {
    page,
    limit,
    skip,
  } = getPagination(query);

  const {
    from,
    to,
  } = query;

  const where = {
    deviceId: device.id,
  };

  if (from || to) {
    where.recordedAt = {};

    if (from) {
      where.recordedAt.gte = new Date(from);
    }

    if (to) {
      where.recordedAt.lte = new Date(to);
    }
  }

  const [logs, total] = await Promise.all([
    prisma.telemetryLog.findMany({
      where,

      orderBy: {
        recordedAt: 'desc',
      },

      skip,
      take: limit,

      select: {
        id: true,
        healthScore: true,
        cpuUsage: true,
        batteryLevel: true,
        networkStatus: true,
        networkType: true,
        recordedAt: true,
        deviceModel: true,
        osVersion: true,
        appVersion: true,
      },
    }),

    prisma.telemetryLog.count({
      where,
    }),
  ]);

  return {
    logs,
    total,
    page,
    limit,
  };
}

async function getDeviceHealth(
  deviceId,
  userId,
  userPermissions
) {
  const device = await prisma.device.findUnique({
    where: {
      deviceId,
    },

    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!device) {
    return null;
  }

  assertCanReadDevice(
    device,
    userId,
    userPermissions
  );

  const recentLog =
    await prisma.telemetryLog.findFirst({
      where: {
        deviceId: device.id,
      },

      orderBy: {
        recordedAt: 'desc',
      },
    });

  const yesterday = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  );

  const averageResult =
    await prisma.telemetryLog.aggregate({
      where: {
        deviceId: device.id,

        recordedAt: {
          gte: yesterday,
        },
      },

      _avg: {
        healthScore: true,
        cpuUsage: true,
        batteryLevel: true,
      },

      _count: {
        id: true,
      },
    });

  return {
    device,
    latestLog: serializeTelemetryLog(recentLog),

    last24h: {
      avgHealthScore:
        averageResult._avg.healthScore,

      avgCpuUsage:
        averageResult._avg.cpuUsage,

      avgBatteryLevel:
        averageResult._avg.batteryLevel,

      logCount:
        averageResult._count.id,
    },
  };
}

async function getUserDevices(userId) {
  return prisma.device.findMany({
    where: {
      userId,
      isActive: true,
    },

    orderBy: {
      lastSeenAt: 'desc',
    },
  });
}

async function getTelemetryAnalytics(query) {
  const {
    from,
    to,
    userId,
  } = query;

  const where = {};

  if (userId) {
    where.userId = userId;
  }

  if (from || to) {
    where.recordedAt = {};

    if (from) {
      where.recordedAt.gte =
        new Date(from);
    }

    if (to) {
      where.recordedAt.lte =
        new Date(to);
    }
  }

  const [
    averageMetrics,
    crashCount,
    deviceCount,
  ] = await Promise.all([
    prisma.telemetryLog.aggregate({
      where,

      _avg: {
        healthScore: true,
        cpuUsage: true,
        batteryLevel: true,
      },

      _count: {
        id: true,
      },
    }),

    prisma.telemetryLog.count({
      where: {
        ...where,

        crashLogs: {
          not: null,
        },
      },
    }),

    prisma.device.count({
      where: {
        isActive: true,
      },
    }),
  ]);

  return {
    avgHealthScore:
      averageMetrics._avg.healthScore,

    avgCpuUsage:
      averageMetrics._avg.cpuUsage,

    avgBatteryLevel:
      averageMetrics._avg.batteryLevel,

    totalLogs:
      averageMetrics._count.id,

    crashReports: crashCount,
    activeDevices: deviceCount,
  };
}

module.exports = {
  ingestTelemetry,
  getDeviceTelemetry,
  getDeviceHealth,
  getUserDevices,
  getTelemetryAnalytics,
};