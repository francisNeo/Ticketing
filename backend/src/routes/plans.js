const { Router } = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const { requireAuth } = require('../middlewares/auth');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();

router.get('/', asyncHandler(async (req, res) => {
  const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: 'asc' } });
  res.json(plans);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json(plan);
}));

router.get('/organiser/current', ...requireAuth, asyncHandler(async (req, res) => {
  const subscription = await prisma.organiserSubscription.findUnique({
    where: { organiserId: req.user.userId },
    include: { plan: true },
  });
  res.json(subscription || null);
}));

module.exports = router;
