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


const router = Router();
const prisma = require('../lib/prisma');

// Accepts both full ISO strings and datetime-local format (no timezone)
const flexDatetime = z.string().transform((val) => new Date(val).toISOString());
const flexDatetimeOptional = z.string().optional().transform((val) => val ? new Date(val).toISOString() : undefined);

const VALID_RECURRENCE = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

const createEventSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(10000).optional(),
  startsAt: flexDatetime,
  endsAt: flexDatetimeOptional,
  locationType: z.enum(['physical', 'virtual']),
  locationText: z.string().max(500).optional(),
  visibility: z.enum(['public', 'private']),
  isFree: z.boolean().default(false),
  currency: z.string().length(3).default('KES'),
  maxCapacity: z.number().int().positive().optional(),
  registrationDeadline: flexDatetimeOptional,
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  minAge: z.number().int().min(0).max(120).optional(),
  maxAge: z.number().int().min(0).max(120).optional(),
  bannerUrl: z.string().url().max(2048).optional(),
  // Church / Religious fields
  serviceType: z.string().max(100).optional(),
  ministry: z.string().max(100).optional(),
  denomination: z.string().max(100).optional(),
  dressCode: z.string().max(100).optional(),
  recurrenceRule: z.enum(VALID_RECURRENCE).optional(),
  captchaToken: z.string().optional(), // retained for future use, not enforced
});

// Public — list published events
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, category, tags, search } = req.query;
  const safePage = Math.max(1, +page || 1);
  const safeLimit = Math.min(Math.max(1, +limit || 20), 100);
  const result = await listPublicEvents({ page: safePage, limit: safeLimit, category, tags, search });
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
  // Re-use createEventSchema (partial) so all field types/lengths are enforced on update too
  const body = createEventSchema.partial().parse(req.body);
  const event = await updateEvent(req.params.id, req.user.userId, body);
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

// Sanitise a CSV cell — wrap in quotes and escape existing quotes.
// Also strip leading =, +, -, @ to prevent CSV formula injection.
function csvCell(val) {
  const s = String(val ?? '').replace(/^[=+\-@]/, "'$&");
  return `"${s.replace(/"/g, '""')}"`;
}

// Organiser — list registrations for event (own events only)
router.get('/:id/registrations', ...requirePermission('registrations:view_event'), asyncHandler(async (req, res) => {
  z.string().uuid().parse(req.params.id);
  const event = await prisma.event.findFirst({ where: { id: req.params.id, organiserId: req.user.userId }, select: { id: true } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const registrations = await prisma.registration.findMany({
    where: { eventId: req.params.id },
    include: { ticketType: true, payment: true, answers: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(registrations);
}));

// Organiser — export CSV (own events only)
router.get('/:id/export', ...requirePermission('registrations:export'), asyncHandler(async (req, res) => {
  z.string().uuid().parse(req.params.id);
  const event = await prisma.event.findFirst({ where: { id: req.params.id, organiserId: req.user.userId }, select: { id: true } });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const registrations = await prisma.registration.findMany({
    where: { eventId: req.params.id, status: { in: ['confirmed', 'checked_in'] } },
    include: { ticketType: true, payment: true },
  });

  const rows = [
    'Name,Email,Phone,Ticket Type,Amount,Status,Checked In',
    ...registrations.map((r) =>
      [
        csvCell(r.attendeeName),
        csvCell(r.attendeeEmail),
        csvCell(r.attendeePhone),
        csvCell(r.ticketType?.name),
        csvCell(r.payment?.amount ?? 0),
        csvCell(r.status),
        csvCell(r.checkedInAt ? 'Yes' : 'No'),
      ].join(',')
    ),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendees-${req.params.id}.csv"`);
  res.send(rows);
}));

module.exports = router;
