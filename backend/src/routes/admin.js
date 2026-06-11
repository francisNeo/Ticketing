const { Router } = require('express');
const { z } = require('zod');
const bcrypt = require('bcrypt');
const { asyncHandler } = require('../middlewares/errorHandler');
const { requirePermission } = require('../middlewares/auth');
const prisma = require('../lib/prisma');

const router = Router();

// Users management
router.get('/users', ...requirePermission('users:view_any'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const safePage = Math.max(1, +page);
  const safeLimit = Math.min(Math.max(1, +limit), 100);
  const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip: (safePage - 1) * safeLimit, take: safeLimit, select: { id: true, name: true, email: true, emailVerified: true, createdAt: true, userRoles: { include: { role: true } } } }),
    prisma.user.count({ where }),
  ]);
  res.json({ users, total, page: safePage, pages: Math.ceil(total / safeLimit) });
}));

// Admin: create a portal user and assign roles
router.post('/users', ...requirePermission('users:edit_any'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(2).max(255),
    email: z.string().email(),
    password: z.string().min(8),
    roleNames: z.array(z.string()).min(1),
  }).parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(body.password, 12);
  const roles = await prisma.role.findMany({ where: { name: { in: body.roleNames } } });
  if (roles.length === 0) return res.status(400).json({ error: 'No valid roles found' });

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      emailVerified: true, // admin-created users are pre-verified
      userRoles: { create: roles.map((r) => ({ roleId: r.id, assignedBy: req.user.userId })) },
    },
    select: { id: true, name: true, email: true, emailVerified: true, createdAt: true, userRoles: { include: { role: true } } },
  });

  res.status(201).json(user);
}));

// Admin: update user roles
router.put('/users/:id/roles', ...requirePermission('roles:assign'), asyncHandler(async (req, res) => {
  z.string().uuid().parse(req.params.id);
  const { roleNames } = z.object({ roleNames: z.array(z.string()) }).parse(req.body);
  const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });

  await prisma.userRole.deleteMany({ where: { userId: req.params.id } });
  if (roles.length > 0) {
    await prisma.userRole.createMany({
      data: roles.map((r) => ({ userId: req.params.id, roleId: r.id, assignedBy: req.user.userId })),
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, userRoles: { include: { role: true } } },
  });
  res.json(user);
}));

// Bundle management
const bundleSchema = z.object({
  name: z.string().min(1).max(100),
  channel: z.enum(['sms', 'email']),
  units: z.number().int().positive(),
  price: z.number().positive(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

router.get('/bundles', ...requirePermission('bundles:view'), asyncHandler(async (req, res) => {
  const bundles = await prisma.notificationBundle.findMany({ orderBy: [{ channel: 'asc' }, { displayOrder: 'asc' }] });
  res.json(bundles);
}));

router.post('/bundles', ...requirePermission('bundles:create'), asyncHandler(async (req, res) => {
  const body = bundleSchema.parse(req.body);
  const bundle = await prisma.notificationBundle.create({ data: body });
  res.status(201).json(bundle);
}));

router.put('/bundles/:id', ...requirePermission('bundles:edit'), asyncHandler(async (req, res) => {
  const body = bundleSchema.partial().parse(req.body);
  const bundle = await prisma.notificationBundle.update({ where: { id: req.params.id }, data: body });
  res.json(bundle);
}));

// Plan management
const planSchema = z.object({
  name: z.string().min(1).max(100),
  monthlyPrice: z.number().nonnegative(),
  annualPrice: z.number().nonnegative().optional(),
  maxEvents: z.number().int().positive().optional().nullable(),
  maxAttendeesPerEvent: z.number().int().positive().optional().nullable(),
  commissionRate: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
});

router.get('/plans', ...requirePermission('bundles:view'), asyncHandler(async (req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: { monthlyPrice: 'asc' } });
  res.json(plans);
}));

router.post('/plans', ...requirePermission('bundles:create'), asyncHandler(async (req, res) => {
  const body = planSchema.parse(req.body);
  const plan = await prisma.plan.create({ data: body });
  res.status(201).json(plan);
}));

router.put('/plans/:id', ...requirePermission('bundles:edit'), asyncHandler(async (req, res) => {
  const body = planSchema.partial().parse(req.body);
  const plan = await prisma.plan.update({ where: { id: req.params.id }, data: body });
  res.json(plan);
}));

// Commission overrides
router.get('/commission-overrides', ...requirePermission('roles:view'), asyncHandler(async (req, res) => {
  const overrides = await prisma.commissionOverride.findMany({ include: { organiser: { select: { name: true, email: true } }, event: { select: { title: true } } } });
  res.json(overrides);
}));

router.post('/commission-overrides', ...requirePermission('roles:edit'), asyncHandler(async (req, res) => {
  const body = z.object({
    organiserId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),
    commissionRate: z.number().min(0).max(1),
    reason: z.string().optional(),
    validUntil: z.string().datetime().optional(),
  }).parse(req.body);
  const override = await prisma.commissionOverride.create({ data: { ...body, setBy: req.user.userId } });
  res.status(201).json(override);
}));

module.exports = router;
