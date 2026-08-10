// src/modules/telemetry/telemetry.service.js
const { prisma } = require('../../config/database');
const { calculateHealthScore, getPagination } = require('../../utils/helpers');

async function ingestTelemetry(data, userId) {
  const { deviceId, deviceModel, osVersion, appVersion, ramTotal, ramAvailable, cpuUsage,
    batteryLevel, storageTotal, storageAvailable, networkStatus, networkType,
    crashLogs, errorLogs, metadata, recordedAt } = data;

  // Upsert device record
  let device = null;
  if (deviceId) {
    device = await prisma.device.upsert({
      where: { deviceId },
      update: {
        platform: data.platform || 'unknown',
        model: deviceModel,
        osVersion,
        appVersion,
        lastSeenAt: new Date(),
        userId,
      },
      create: {
        deviceId,
        platform: data.platform || 'unknown',
        model: deviceModel,
        osVersion,
        appVersion,
        userId,
      },
    });
  }

  const healthScore = calculateHealthScore({ cpuUsage, ramAvailable, ramTotal, storageAvailable, storageTotal, batteryLevel });

  const log = await prisma.telemetryLog.create({
    data: {
      deviceModel, osVersion, appVersion,
      ramTotal: ramTotal ? BigInt(ramTotal) : null,
      ramAvailable: ramAvailable ? BigInt(ramAvailable) : null,
      cpuUsage, batteryLevel,
      storageTotal: storageTotal ? BigInt(storageTotal) : null,
      storageAvailable: storageAvailable ? BigInt(storageAvailable) : null,
      networkStatus, networkType,
      crashLogs: crashLogs || null,
      errorLogs: errorLogs || null,
      healthScore,
      metadata: metadata || null,
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      deviceId: device?.id,
      userId,
    },
  });

  return { id: log.id, healthScore, deviceId: device?.id };
}

async function getDeviceTelemetry(deviceId, query) {
  const { page, limit, skip } = getPagination(query);
  const { from, to } = query;

  const where = {};
  if (deviceId) where.deviceId = deviceId;
  if (from || to) {
    where.recordedAt = {};
    if (from) where.recordedAt.gte = new Date(from);
    if (to) where.recordedAt.lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    prisma.telemetryLog.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, healthScore: true, cpuUsage: true, batteryLevel: true,
        networkStatus: true, networkType: true, recordedAt: true, deviceModel: true,
        osVersion: true, appVersion: true,
      },
    }),
    prisma.telemetryLog.count({ where }),
  ]);

  return { logs, total, page, limit };
}

async function getDeviceHealth(deviceId) {
  const device = await prisma.device.findUnique({
    where: { deviceId },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  if (!device) return null;

  const recentLog = await prisma.telemetryLog.findFirst({
    where: { deviceId: device.id },
    orderBy: { recordedAt: 'desc' },
  });

  // Last 24h average health
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const avgResult = await prisma.telemetryLog.aggregate({
    where: { deviceId: device.id, recordedAt: { gte: yesterday } },
    _avg: { healthScore: true, cpuUsage: true, batteryLevel: true },
    _count: { id: true },
  });

  return {
    device,
    latestLog: recentLog,
    last24h: {
      avgHealthScore: avgResult._avg.healthScore,
      avgCpuUsage: avgResult._avg.cpuUsage,
      avgBatteryLevel: avgResult._avg.batteryLevel,
      logCount: avgResult._count.id,
    },
  };
}

async function getUserDevices(userId) {
  return prisma.device.findMany({
    where: { userId, isActive: true },
    orderBy: { lastSeenAt: 'desc' },
  });
}

async function getTelemetryAnalytics(query) {
  const { from, to, userId } = query;
  const where = {};
  if (userId) where.userId = userId;
  if (from || to) {
    where.recordedAt = {};
    if (from) where.recordedAt.gte = new Date(from);
    if (to) where.recordedAt.lte = new Date(to);
  }

  const [avgMetrics, crashCount, deviceCount] = await Promise.all([
    prisma.telemetryLog.aggregate({
      where,
      _avg: { healthScore: true, cpuUsage: true, batteryLevel: true },
      _count: { id: true },
    }),
    prisma.telemetryLog.count({ where: { ...where, crashLogs: { not: null } } }),
    prisma.device.count({ where: { isActive: true } }),
  ]);

  return {
    avgHealthScore: avgMetrics._avg.healthScore,
    avgCpuUsage: avgMetrics._avg.cpuUsage,
    avgBatteryLevel: avgMetrics._avg.batteryLevel,
    totalLogs: avgMetrics._count.id,
    crashReports: crashCount,
    activeDevices: deviceCount,
  };
}

module.exports = { ingestTelemetry, getDeviceTelemetry, getDeviceHealth, getUserDevices, getTelemetryAnalytics };
