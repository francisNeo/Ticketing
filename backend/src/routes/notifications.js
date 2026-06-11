const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middlewares/errorHandler');
const { requirePermission } = require('../middlewares/auth');
const prisma = require('../lib/prisma');
const { sendSms } = require('../integrations/sms');
const { sendEmail } = require('../integrations/email');

const router = Router();

const sendSchema = z.object({
  channel: z.enum(['sms', 'email', 'both']),
  message: z.string().min(1).max(1000),
  audienceFilter: z.object({
    ticketTypeId: z.string().uuid().optional(),
    status: z.enum(['confirmed', 'checked_in']).optional(),
  }).optional(),
});

async function assertEventOwnership(eventId, userId, res) {
  const event = await prisma.event.findFirst({ where: { id: eventId, organiserId: userId }, select: { id: true } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return false;
  }
  return true;
}

async function getAudience(eventId, filter = {}) {
  const where = { eventId, status: { in: ['confirmed', 'checked_in'] } };
  if (filter.ticketTypeId) where.ticketTypeId = filter.ticketTypeId;
  if (filter.status) where.status = filter.status;
  return prisma.registration.findMany({ where, select: { attendeeEmail: true, attendeePhone: true, attendeeName: true } });
}

router.get('/events/:eventId/notifications', ...requirePermission('events:edit_own'), asyncHandler(async (req, res) => {
  if (!await assertEventOwnership(req.params.eventId, req.user.userId, res)) return;
  const sends = await prisma.notificationSend.findMany({
    where: { eventId: req.params.eventId, organiserId: req.user.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(sends);
}));

router.post('/events/:eventId/notifications/preview', ...requirePermission('events:edit_own'), asyncHandler(async (req, res) => {
  if (!await assertEventOwnership(req.params.eventId, req.user.userId, res)) return;
  const body = sendSchema.parse(req.body);
  const audience = await getAudience(req.params.eventId, body.audienceFilter);
  const unitsPerRecipient = body.channel === 'both' ? 2 : 1;
  res.json({ recipientCount: audience.length, estimatedUnits: audience.length * unitsPerRecipient });
}));

router.post('/events/:eventId/notifications/send', ...requirePermission('events:edit_own'), asyncHandler(async (req, res) => {
  if (!await assertEventOwnership(req.params.eventId, req.user.userId, res)) return;
  const body = sendSchema.parse(req.body);
  const audience = await getAudience(req.params.eventId, body.audienceFilter);
  if (audience.length === 0) return res.status(400).json({ error: 'No recipients found' });

  const unitsNeeded = audience.length * (body.channel === 'both' ? 2 : 1);
  const balance = await prisma.organiserBundleBalance.findUnique({ where: { organiserId: req.user.userId } });

  const hasSms = !['sms', 'both'].includes(body.channel) || (balance?.smsUnits ?? 0) >= audience.length;
  const hasEmail = !['email', 'both'].includes(body.channel) || (balance?.emailUnits ?? 0) >= audience.length;

  if (!hasSms || !hasEmail) {
    return res.status(402).json({ error: 'Insufficient bundle balance. Please purchase more units.', balance });
  }

  const send = await prisma.notificationSend.create({
    data: {
      eventId: req.params.eventId,
      organiserId: req.user.userId,
      channel: body.channel,
      message: body.message,
      recipientCount: audience.length,
      unitsDeducted: unitsNeeded,
      status: 'queued',
    },
  });

  // Deduct balance
  const balanceUpdate = {};
  if (['sms', 'both'].includes(body.channel)) balanceUpdate.smsUnits = { decrement: audience.length };
  if (['email', 'both'].includes(body.channel)) balanceUpdate.emailUnits = { decrement: audience.length };
  await prisma.organiserBundleBalance.update({ where: { organiserId: req.user.userId }, data: balanceUpdate });

  // Fire sends in background
  let delivered = 0;
  let failed = 0;

  Promise.all(
    audience.map(async (recipient) => {
      try {
        if (['sms', 'both'].includes(body.channel)) await sendSms(recipient.attendeePhone, body.message);
        if (['email', 'both'].includes(body.channel)) {
          await sendEmail({ to: recipient.attendeeEmail, subject: 'Event Update', html: `<p>${body.message}</p>` });
        }
        delivered++;
      } catch {
        failed++;
      }
    })
  ).then(() =>
    prisma.notificationSend.update({
      where: { id: send.id },
      data: { status: failed === audience.length ? 'partial_failure' : 'completed', deliveredCount: delivered, failedCount: failed, sentAt: new Date() },
    })
  ).catch(console.error);

  res.json({ sendId: send.id, recipientCount: audience.length, status: 'queued' });
}));

router.get('/events/:eventId/notifications/:sendId', ...requirePermission('events:edit_own'), asyncHandler(async (req, res) => {
  const send = await prisma.notificationSend.findUnique({ where: { id: req.params.sendId } });
  if (!send) return res.status(404).json({ error: 'Send not found' });
  res.json(send);
}));

module.exports = router;
