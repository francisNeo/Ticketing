const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middlewares/errorHandler');
const { requirePermission } = require('../middlewares/auth');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();

router.get('/', ...requirePermission('roles:view'), asyncHandler(async (req, res) => {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } }, _count: { select: { userRoles: true } } },
  });
  res.json(roles);
}));

router.get('/:id', ...requirePermission('roles:view'), asyncHandler(async (req, res) => {
  const role = await prisma.role.findUnique({
    where: { id: req.params.id },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) return res.status(404).json({ error: 'Role not found' });
  res.json(role);
}));

router.post('/', ...requirePermission('roles:create'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(100),
    displayName: z.string().min(1).max(255),
    description: z.string().optional(),
    permissionKeys: z.array(z.string()).optional(),
  }).parse(req.body);

  const permissions = body.permissionKeys
    ? await prisma.permission.findMany({ where: { key: { in: body.permissionKeys } } })
    : [];

  const role = await prisma.role.create({
    data: {
      name: body.name,
      displayName: body.displayName,
      description: body.description,
      createdBy: req.user.userId,
      permissions: {
        create: permissions.map((p) => ({ permissionId: p.id, grantedBy: req.user.userId })),
      },
    },
    include: { permissions: { include: { permission: true } } },
  });
  res.status(201).json(role);
}));

router.put('/:id', ...requirePermission('roles:edit'), asyncHandler(async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!role) return res.status(404).json({ error: 'Role not found' });

  const body = z.object({
    displayName: z.string().optional(),
    description: z.string().optional(),
    permissionKeys: z.array(z.string()).optional(),
  }).parse(req.body);

  if (body.permissionKeys !== undefined) {
    const permissions = await prisma.permission.findMany({ where: { key: { in: body.permissionKeys } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id, grantedBy: req.user.userId })),
    });
  }

  const updated = await prisma.role.update({
    where: { id: req.params.id },
    data: {
      ...(body.displayName && !role.isSystem && { displayName: body.displayName }),
      ...(body.description !== undefined && { description: body.description }),
    },
    include: { permissions: { include: { permission: true } } },
  });
  res.json(updated);
}));

router.delete('/:id', ...requirePermission('roles:delete'), asyncHandler(async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!role) return res.status(404).json({ error: 'Role not found' });
  if (role.isSystem) return res.status(403).json({ error: 'System roles cannot be deleted' });
  await prisma.role.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
}));

// GET /permissions — list all
router.get('/permissions', ...requirePermission('roles:view'), asyncHandler(async (req, res) => {
  const permissions = await prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
  const grouped = permissions.reduce((acc, p) => {
    if (!acc[p.group]) acc[p.group] = [];
    acc[p.group].push(p);
    return acc;
  }, {});
  res.json(grouped);
}));

// User role management
router.get('/users/:userId/roles', ...requirePermission('roles:view'), asyncHandler(async (req, res) => {
  const userRoles = await prisma.userRole.findMany({
    where: { userId: req.params.userId },
    include: { role: true },
  });
  res.json(userRoles);
}));

router.post('/users/:userId/roles', ...requirePermission('roles:assign'), asyncHandler(async (req, res) => {
  const { roleId, expiresAt } = z.object({ roleId: z.string().uuid(), expiresAt: z.string().datetime().optional() }).parse(req.body);
  const userRole = await prisma.userRole.create({
    data: { userId: req.params.userId, roleId, assignedBy: req.user.userId, expiresAt: expiresAt ? new Date(expiresAt) : null },
  });
  res.status(201).json(userRole);
}));

router.delete('/users/:userId/roles/:roleId', ...requirePermission('roles:assign'), asyncHandler(async (req, res) => {
  await prisma.userRole.delete({ where: { userId_roleId: { userId: req.params.userId, roleId: req.params.roleId } } });
  res.json({ removed: true });
}));

module.exports = router;
