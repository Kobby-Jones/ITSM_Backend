// src/modules/assets/assets.service.js
const { prisma } = require('../../config/database');
const { NotFoundError, ConflictError, AppError } = require('../../shared/errors');
const { getPagination, buildOrderBy, generateAssetTag } = require('../../utils/helpers');

const ASSET_SELECT = {
  id: true, assetTag: true, name: true, description: true, category: true, status: true,
  make: true, model: true, serialNumber: true, purchaseDate: true, purchasePrice: true,
  warrantyExpiry: true, location: true, specifications: true, notes: true, createdAt: true, updatedAt: true,
  department: { select: { id: true, name: true, code: true } },
  _count: { select: { assignments: true } },
};

async function getAssets(query) {
  const { page, limit, skip } = getPagination(query);
  const { search, status, category, departmentId, sortBy, sortOrder, warrantyExpiring } = query;

  const where = { deletedAt: null };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { assetTag: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
      { make: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status) where.status = status;
  if (category) where.category = category;
  if (departmentId) where.departmentId = departmentId;
  if (warrantyExpiring === 'true') {
    const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    where.warrantyExpiry = { lte: thirtyDaysOut, gte: new Date() };
  }

  const orderBy = buildOrderBy(sortBy, sortOrder, ['name', 'assetTag', 'createdAt', 'category', 'status', 'warrantyExpiry']);

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({ where, select: ASSET_SELECT, skip, take: limit, orderBy }),
    prisma.asset.count({ where }),
  ]);

  return { assets, total, page, limit };
}

async function getAssetById(id) {
  const asset = await prisma.asset.findUnique({
    where: { id, deletedAt: null },
    include: {
      department: { select: { id: true, name: true, code: true } },
      assignments: {
        where: { isActive: true },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { assignedAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!asset) throw new NotFoundError('Asset not found');
  return asset;
}

async function createAsset(data) {
  const assetTag = data.assetTag || generateAssetTag();

  if (data.serialNumber) {
    const existing = await prisma.asset.findUnique({ where: { serialNumber: data.serialNumber } });
    if (existing) throw new ConflictError('Asset with this serial number already exists');
  }

  return prisma.asset.create({
    data: { ...data, assetTag },
    select: ASSET_SELECT,
  });
}

async function updateAsset(id, data) {
  const asset = await prisma.asset.findUnique({ where: { id, deletedAt: null } });
  if (!asset) throw new NotFoundError('Asset not found');

  if (data.serialNumber && data.serialNumber !== asset.serialNumber) {
    const existing = await prisma.asset.findUnique({ where: { serialNumber: data.serialNumber } });
    if (existing) throw new ConflictError('Serial number already in use');
  }

  return prisma.asset.update({ where: { id }, data, select: ASSET_SELECT });
}

async function deleteAsset(id) {
  const asset = await prisma.asset.findUnique({ where: { id, deletedAt: null } });
  if (!asset) throw new NotFoundError('Asset not found');

  const activeAssignment = await prisma.assetAssignment.findFirst({ where: { assetId: id, isActive: true } });
  if (activeAssignment) throw new AppError('Cannot delete asset with active assignment', 400);

  await prisma.asset.update({ where: { id }, data: { deletedAt: new Date(), status: 'DISPOSED' } });
}

async function assignAsset(assetId, userId, assignedById, notes) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId, deletedAt: null } });
  if (!asset) throw new NotFoundError('Asset not found');
  if (asset.status !== 'ACTIVE') throw new AppError('Asset is not available for assignment', 400);

  const user = await prisma.user.findUnique({ where: { id: userId, status: 'ACTIVE' } });
  if (!user) throw new NotFoundError('User not found');

  // End any existing active assignment
  await prisma.assetAssignment.updateMany({
    where: { assetId, isActive: true },
    data: { isActive: false, returnedAt: new Date() },
  });

  const assignment = await prisma.assetAssignment.create({
    data: { assetId, userId, assignedById, notes, isActive: true },
    include: {
      asset: { select: { id: true, name: true, assetTag: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return assignment;
}

async function returnAsset(assetId, notes) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId, deletedAt: null } });
  if (!asset) throw new NotFoundError('Asset not found');

  const assignment = await prisma.assetAssignment.findFirst({ where: { assetId, isActive: true } });
  if (!assignment) throw new AppError('No active assignment found', 400);

  await prisma.assetAssignment.update({
    where: { id: assignment.id },
    data: { isActive: false, returnedAt: new Date(), notes: notes || assignment.notes },
  });

  return { message: 'Asset returned successfully' };
}

async function getAssetAssignmentHistory(assetId) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new NotFoundError('Asset not found');

  return prisma.assetAssignment.findMany({
    where: { assetId },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { assignedAt: 'desc' },
  });
}

async function getAssetStats() {
  const [total, byStatus, byCategory, warrantyExpiring] = await Promise.all([
    prisma.asset.count({ where: { deletedAt: null } }),
    prisma.asset.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { id: true } }),
    prisma.asset.groupBy({ by: ['category'], where: { deletedAt: null }, _count: { id: true } }),
    prisma.asset.count({
      where: {
        deletedAt: null,
        warrantyExpiry: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), gte: new Date() },
      },
    }),
  ]);

  return {
    total,
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count.id])),
    byCategory: Object.fromEntries(byCategory.map(c => [c.category, c._count.id])),
    warrantyExpiringSoon: warrantyExpiring,
  };
}

module.exports = { getAssets, getAssetById, createAsset, updateAsset, deleteAsset, assignAsset, returnAsset, getAssetAssignmentHistory, getAssetStats };
