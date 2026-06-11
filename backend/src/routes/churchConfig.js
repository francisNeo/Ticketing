const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middlewares/errorHandler');
const { requirePermission } = require('../middlewares/auth');


const router = Router();
const prisma = require('../lib/prisma');

const VALID_KINDS = ['service_type', 'denomination', 'dress_code'];

// ── Public: fetch active config grouped by kind ───────────────────────────────
// Used by the event creation form — no auth required
router.get('/', asyncHandler(async (req, res) => {
  const items = await prisma.churchEventConfig.findMany({
    where: { isActive: true },
    orderBy: [{ kind: 'asc' }, { displayOrder: 'asc' }, { value: 'asc' }],
    select: { id: true, kind: true, value: true, displayOrder: true },
  });

  // Group by kind for easy consumption
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.kind]) acc[item.kind] = [];
    acc[item.kind].push(item);
    return acc;
  }, {});

  res.json(grouped);
}));

// ── Admin: list all (including inactive) ─────────────────────────────────────
router.get('/all', ...requirePermission('church_config:manage'), asyncHandler(async (req, res) => {
  const { kind } = req.query;
  const where = kind ? { kind } : {};
  const items = await prisma.churchEventConfig.findMany({
    where,
    orderBy: [{ kind: 'asc' }, { displayOrder: 'asc' }, { value: 'asc' }],
    include: { creator: { select: { name: true } } },
  });
  res.json(items);
}));

// ── Admin: create a new config item ──────────────────────────────────────────
router.post('/', ...requirePermission('church_config:manage'), asyncHandler(async (req, res) => {
  const body = z.object({
    kind: z.enum(VALID_KINDS),
    value: z.string().min(1).max(255).trim(),
    displayOrder: z.number().int().optional().default(0),
  }).parse(req.body);

  const existing = await prisma.churchEventConfig.findUnique({
    where: { kind_value: { kind: body.kind, value: body.value } },
  });
  if (existing) return res.status(409).json({ error: 'This value already exists for this type' });

  const item = await prisma.churchEventConfig.create({
    data: { ...body, createdBy: req.user.userId },
  });
  res.status(201).json(item);
}));

// ── Admin: update (rename or reorder) ────────────────────────────────────────
router.put('/:id', ...requirePermission('church_config:manage'), asyncHandler(async (req, res) => {
  const body = z.object({
    value: z.string().min(1).max(255).trim().optional(),
    displayOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }).parse(req.body);

  const item = await prisma.churchEventConfig.update({
    where: { id: req.params.id },
    data: body,
  });
  res.json(item);
}));

// ── Admin: delete permanently ─────────────────────────────────────────────────
router.delete('/:id', ...requirePermission('church_config:manage'), asyncHandler(async (req, res) => {
  await prisma.churchEventConfig.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

module.exports = router;
