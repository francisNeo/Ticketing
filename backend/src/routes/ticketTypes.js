const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middlewares/errorHandler');
const { requirePermission } = require('../middlewares/auth');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();

const ticketTypeSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0),
  quantity: z.number().int().positive().optional(),
  isNamed: z.boolean().default(false),
  description: z.string().optional(),
  saleEndsAt: z.string().datetime().optional(),
});

router.post('/events/:eventId/ticket-types', ...requirePermission('events:edit_own'), asyncHandler(async (req, res) => {
  const body = ticketTypeSchema.parse(req.body);
  const event = await prisma.event.findFirst({ where: { id: req.params.eventId, organiserId: req.user.userId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const ticketType = await prisma.ticketType.create({
    data: { ...body, eventId: req.params.eventId, saleEndsAt: body.saleEndsAt ? new Date(body.saleEndsAt) : undefined },
  });
  res.status(201).json(ticketType);
}));

router.put('/:id', ...requirePermission('events:edit_own'), asyncHandler(async (req, res) => {
  const body = ticketTypeSchema.partial().parse(req.body);
  const ticketType = await prisma.ticketType.update({ where: { id: req.params.id }, data: body });
  res.json(ticketType);
}));

router.delete('/:id', ...requirePermission('events:edit_own'), asyncHandler(async (req, res) => {
  await prisma.ticketType.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
}));

module.exports = router;
