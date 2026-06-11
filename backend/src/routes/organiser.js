const { Router } = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const { requireAuth } = require('../middlewares/auth');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();

router.get('/bundle-balance', ...requireAuth, asyncHandler(async (req, res) => {
  const balance = await prisma.organiserBundleBalance.findUnique({ where: { organiserId: req.user.userId } });
  res.json(balance || { smsUnits: 0, emailUnits: 0 });
}));

router.get('/bundle-purchases', ...requireAuth, asyncHandler(async (req, res) => {
  const purchases = await prisma.bundlePurchase.findMany({
    where: { organiserId: req.user.userId },
    include: { bundle: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(purchases);
}));

router.get('/plan', ...requireAuth, asyncHandler(async (req, res) => {
  const subscription = await prisma.organiserSubscription.findUnique({
    where: { organiserId: req.user.userId },
    include: { plan: true },
  });
  res.json(subscription || null);
}));

router.get('/events', ...requireAuth, asyncHandler(async (req, res) => {
  const events = await prisma.event.findMany({
    where: { organiserId: req.user.userId },
    select: { id: true, title: true, slug: true, privateToken: true, visibility: true, status: true, startsAt: true, isFree: true, ticketTypes: true, _count: { select: { registrations: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(events);
}));

module.exports = router;
