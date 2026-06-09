const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middlewares/errorHandler');
const { requireAuth, requirePermission } = require('../middlewares/auth');
const {
  listPublicEvents,
  getEventBySlugOrToken,
  createEvent,
  updateEvent,
  publishEvent,
  cancelEvent,
} = require('../services/eventService');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();

// Accepts both full ISO strings and datetime-local format (no timezone)
const flexDatetime = z.string().transform((val) => new Date(val).toISOString());
const flexDatetimeOptional = z.string().optional().transform((val) => val ? new Date(val).toISOString() : undefined);

const createEventSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  startsAt: flexDatetime,
  endsAt: flexDatetimeOptional,
  locationType: z.enum(['physical', 'virtual']),
  locationText: z.string().optional(),
  visibility: z.enum(['public', 'private']),
  isFree: z.boolean().default(false),
  currency: z.string().length(3).default('KES'),
  maxCapacity: z.number().int().positive().optional(),
  registrationDeadline: flexDatetimeOptional,
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  minAge: z.number().int().optional(),
  maxAge: z.number().int().optional(),
  // Church / Religious fields
  serviceType: z.string().optional(),
  ministry: z.string().optional(),
  denomination: z.string().optional(),
  dressCode: z.string().optional(),
  recurrenceRule: z.string().optional(),
  captchaToken: z.string().optional(), // retained for future use, not enforced
});

// Public — list published events
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, category, tags, search } = req.query;
  const result = await listPublicEvents({ page: +page || 1, limit: +limit || 20, category, tags, search });
  res.json(result);
}));

// Public — get event detail
router.get('/:slugOrToken', asyncHandler(async (req, res) => {
  const event = await getEventBySlugOrToken(req.params.slugOrToken);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event);
}));

// Organiser — create event
router.post('/', ...requirePermission('events:create'), asyncHandler(async (req, res) => {
  const body = createEventSchema.parse(req.body);

  const event = await createEvent(req.user.userId, body);
  res.status(201).json(event);
}));

// Organiser — update event
router.put('/:id', ...requirePermission('events:edit_own'), asyncHandler(async (req, res) => {
  const event = await updateEvent(req.params.id, req.user.userId, req.body);
  res.json(event);
}));

// Organiser — publish event
router.post('/:id/publish', ...requirePermission('events:publish'), asyncHandler(async (req, res) => {
  const event = await publishEvent(req.params.id, req.user.userId);
  res.json(event);
}));

// Organiser — cancel event
router.delete('/:id', ...requirePermission('events:delete_own'), asyncHandler(async (req, res) => {
  const result = await cancelEvent(req.params.id, req.user.userId);
  res.json(result);
}));

// Organiser — list registrations for event
router.get('/:id/registrations', ...requirePermission('registrations:view_event'), asyncHandler(async (req, res) => {
  const registrations = await prisma.registration.findMany({
    where: { eventId: req.params.id },
    include: { ticketType: true, payment: true, answers: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(registrations);
}));

// Organiser — export CSV
router.get('/:id/export', ...requirePermission('registrations:export'), asyncHandler(async (req, res) => {
  const registrations = await prisma.registration.findMany({
    where: { eventId: req.params.id, status: { in: ['confirmed', 'checked_in'] } },
    include: { ticketType: true, payment: true },
  });

  const rows = [
    'Name,Email,Phone,Ticket Type,Amount,Status,Checked In',
    ...registrations.map((r) =>
      [
        `"${r.attendeeName}"`,
        r.attendeeEmail,
        r.attendeePhone,
        `"${r.ticketType.name}"`,
        r.payment?.amount ?? 0,
        r.status,
        r.checkedInAt ? 'Yes' : 'No',
      ].join(',')
    ),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendees-${req.params.id}.csv"`);
  res.send(rows);
}));

module.exports = router;
