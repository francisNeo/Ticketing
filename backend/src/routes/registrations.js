const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middlewares/errorHandler');
const { requireAuth, requirePermission } = require('../middlewares/auth');
const { validateVerifiedToken } = require('../services/otpService');
const { PrismaClient } = require('@prisma/client');
const QRCode = require('qrcode');
const XLSX = require('xlsx');
const multer = require('multer');
const { sendBookingConfirmation } = require('../integrations/email');
const { sendSms } = require('../integrations/sms');

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function confirmFreeRegistration(registration, event, ticketTypeId) {
  const qrUrl = `${process.env.FRONTEND_URL}/tickets/${registration.id}`;
  const qrCode = await QRCode.toDataURL(qrUrl);
  await prisma.registration.update({ where: { id: registration.id }, data: { qrCode } });
  await prisma.ticketType.update({
    where: { id: ticketTypeId },
    data: { soldCount: { increment: registration.quantity } },
  });
  sendBookingConfirmation({
    to: registration.attendeeEmail,
    name: registration.attendeeName,
    eventTitle: event.title,
    eventDate: event.startsAt.toLocaleDateString(),
    qrCodeUrl: qrUrl,
    ticketId: registration.id,
  }).catch(console.error);
  sendSms(
    registration.attendeePhone,
    `You're registered for ${event.title}! Ticket ID: ${registration.id.slice(0, 8).toUpperCase()}. View: ${qrUrl}`
  ).catch(console.error);
}

// ─── POST /registrations — single registration ────────────────────────────────

const createRegSchema = z.object({
  eventId: z.string().uuid(),
  ticketTypeId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(10).default(1),
  attendeeName: z.string().min(2).max(255),
  attendeeEmail: z.string().email(),
  attendeePhone: z.string().min(10),
  verifiedToken: z.string().min(1),
  // Named-ticket attendee names: one per ticket slot, including the primary registrant
  attendeeNames: z.array(z.string().min(2).max(255)).optional(),
  answers: z.array(z.object({ questionId: z.string().uuid(), answer: z.string() })).optional(),
});

router.post('/', asyncHandler(async (req, res) => {
  const body = createRegSchema.parse(req.body);

  // Verify phone token
  const tokenPayload = validateVerifiedToken(body.verifiedToken);
  if (!tokenPayload?.verified) return res.status(400).json({ error: 'Phone verification required' });
  if (tokenPayload.eventId !== body.eventId) return res.status(400).json({ error: 'Phone verification is for a different event' });

  // Duplicate check
  const duplicate = await prisma.registration.findFirst({
    where: { eventId: body.eventId, attendeePhone: body.attendeePhone, status: { not: 'cancelled' } },
  });
  if (duplicate) return res.status(409).json({ error: 'This phone number already has an active registration for this event' });

  const event = await prisma.event.findUnique({ where: { id: body.eventId } });
  if (!event || event.status !== 'published') return res.status(404).json({ error: 'Event not found' });

  // Resolve ticket type — use provided ID, or fall back to first available, or auto-create default for free events
  let ticketType;
  if (body.ticketTypeId) {
    ticketType = await prisma.ticketType.findFirst({ where: { id: body.ticketTypeId, eventId: body.eventId } });
    if (!ticketType) return res.status(404).json({ error: 'Ticket type not found' });
  } else {
    ticketType = await prisma.ticketType.findFirst({ where: { eventId: body.eventId } });
    if (!ticketType) {
      if (!event.isFree) return res.status(400).json({ error: 'Please select a ticket type' });
      // Auto-create a default free ticket type for free events
      ticketType = await prisma.ticketType.create({
        data: { eventId: body.eventId, name: 'General', price: 0, quantity: null },
      });
    }
  }
  body.ticketTypeId = ticketType.id;

  // Named-ticket validation
  if (ticketType.isNamed) {
    const names = body.attendeeNames || [];
    if (names.length !== body.quantity) {
      return res.status(400).json({
        error: `This is a named ticket. Please provide a name for each of the ${body.quantity} attendee(s).`,
      });
    }
    const empty = names.findIndex((n) => !n?.trim());
    if (empty !== -1) return res.status(400).json({ error: `Name for attendee ${empty + 1} is required` });
  }

  // Capacity check
  if (ticketType.quantity !== null && ticketType.soldCount + body.quantity > ticketType.quantity) {
    return res.status(400).json({ error: 'Not enough tickets available' });
  }

  const attendeeNames = ticketType.isNamed
    ? (body.attendeeNames || [body.attendeeName])
    : [];

  const registration = await prisma.registration.create({
    data: {
      eventId: body.eventId,
      ticketTypeId: body.ticketTypeId,
      quantity: body.quantity,
      attendeeName: body.attendeeName,
      attendeeEmail: body.attendeeEmail,
      attendeePhone: body.attendeePhone,
      attendeeNames,
      status: event.isFree ? 'confirmed' : 'pending',
      answers: body.answers
        ? { create: body.answers.map((a) => ({ questionId: a.questionId, answer: a.answer })) }
        : undefined,
    },
  });

  if (event.isFree) await confirmFreeRegistration(registration, event, body.ticketTypeId);

  res.status(201).json({
    registration,
    requiresPayment: !event.isFree,
    message: event.isFree ? 'Registration confirmed!' : 'Registration created. Complete payment to confirm.',
  });
}));

// ─── GET /events/:eventId/registration-template — download Excel template ─────

router.get('/events/:eventId/registration-template', asyncHandler(async (req, res) => {
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, status: 'published' },
    include: { ticketTypes: true },
  });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const wb = XLSX.utils.book_new();

  // Instructions sheet
  const instructions = [
    ['EventHub — Bulk Registration Template'],
    [`Event: ${event.title}`],
    [`Date: ${event.startsAt.toLocaleDateString()}`],
    [],
    ['INSTRUCTIONS:'],
    ['• Fill in the "Attendees" sheet — one row per attendee.'],
    ['• Name is required. Email and Phone are recommended.'],
    ['• Ticket Type must exactly match one of the values in the "Ticket Types" sheet.'],
    ['• Do not modify the column headers.'],
    ['• Save as .xlsx or .csv before uploading.'],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions');

  // Attendees sheet — header row + 2 example rows
  const hasNamed = event.ticketTypes.some((t) => t.isNamed);
  const firstTicket = event.ticketTypes[0]?.name || 'General Admission';
  const attendeeRows = [
    ['Name *', 'Email', 'Phone', 'Ticket Type *'],
    ['Jane Doe', 'jane@example.com', '+254700000001', firstTicket],
    ['John Doe', 'john@example.com', '+254700000002', firstTicket],
  ];
  const wsAttendees = XLSX.utils.aoa_to_sheet(attendeeRows);
  // Column widths
  wsAttendees['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsAttendees, 'Attendees');

  // Ticket Types reference sheet
  const ticketRows = [
    ['Ticket Type', 'Price (KES)', 'Named Ticket?', 'Available'],
    ...event.ticketTypes.map((t) => [
      t.name,
      Number(t.price),
      t.isNamed ? 'Yes — Name required per ticket' : 'No',
      t.quantity === null ? 'Unlimited' : Math.max(0, t.quantity - t.soldCount),
    ]),
  ];
  const wsTickets = XLSX.utils.aoa_to_sheet(ticketRows);
  wsTickets['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 30 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsTickets, 'Ticket Types');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `registration-template-${event.id.slice(0, 8)}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
}));

// ─── POST /events/:eventId/bulk-register — upload Excel / CSV ─────────────────

router.post('/events/:eventId/bulk-register', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, status: 'published' },
    include: { ticketTypes: true },
  });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  // Parse workbook
  let wb;
  try {
    wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch {
    return res.status(400).json({ error: 'Could not parse file. Upload a valid .xlsx or .csv file.' });
  }

  // Try "Attendees" sheet first, fall back to first sheet
  const sheetName = wb.SheetNames.includes('Attendees') ? 'Attendees' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  if (rows.length === 0) return res.status(400).json({ error: 'The file contains no attendee rows.' });
  if (rows.length > 500) return res.status(400).json({ error: 'Maximum 500 attendees per upload.' });

  const ticketMap = Object.fromEntries(event.ticketTypes.map((t) => [t.name.toLowerCase().trim(), t]));

  // Validate all rows first before creating anything
  const errors = [];
  const parsed = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is header
    const name = String(row['Name *'] || row['Name'] || '').trim();
    const email = String(row['Email'] || '').trim();
    const phone = String(row['Phone'] || '').trim();
    const ticketTypeName = String(row['Ticket Type *'] || row['Ticket Type'] || '').trim();

    if (!name) { errors.push(`Row ${rowNum}: Name is required`); continue; }

    const ticketType = ticketMap[ticketTypeName.toLowerCase()];
    if (!ticketTypeName) {
      errors.push(`Row ${rowNum}: Ticket Type is required`);
    } else if (!ticketType) {
      errors.push(`Row ${rowNum}: Unknown ticket type "${ticketTypeName}". Valid types: ${Object.values(ticketMap).map((t) => t.name).join(', ')}`);
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Row ${rowNum}: Invalid email "${email}"`);
    }

    parsed.push({ name, email, phone, ticketType });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      error: `${errors.length} validation error(s) found. Fix them and re-upload.`,
      errors,
    });
  }

  // Check capacity per ticket type
  const ticketCounts = {};
  for (const p of parsed) {
    if (!p.ticketType) continue;
    ticketCounts[p.ticketType.id] = (ticketCounts[p.ticketType.id] || 0) + 1;
  }
  for (const [ttId, count] of Object.entries(ticketCounts)) {
    const tt = event.ticketTypes.find((t) => t.id === ttId);
    if (tt?.quantity !== null && tt.soldCount + count > tt.quantity) {
      return res.status(400).json({
        error: `Not enough "${tt.name}" tickets. Available: ${tt.quantity - tt.soldCount}, requested: ${count}`,
      });
    }
  }

  // Create registrations
  const created = [];
  const skipped = [];
  const registrantPhone = req.body.registrantPhone || '+254000000000';
  const registrantEmail = req.body.registrantEmail || 'bulk@eventhub.ke';

  // Group by ticket type for efficiency
  const groups = {};
  for (const p of parsed) {
    if (!p.ticketType) continue;
    if (!groups[p.ticketType.id]) groups[p.ticketType.id] = { ticketType: p.ticketType, attendees: [] };
    groups[p.ticketType.id].attendees.push(p);
  }

  for (const { ticketType, attendees } of Object.values(groups)) {
    // Create one registration per attendee (qty=1 each, named individually)
    for (const attendee of attendees) {
      try {
        const registration = await prisma.registration.create({
          data: {
            eventId: event.id,
            ticketTypeId: ticketType.id,
            quantity: 1,
            attendeeName: attendee.name,
            attendeeEmail: attendee.email || registrantEmail,
            attendeePhone: attendee.phone || registrantPhone,
            attendeeNames: ticketType.isNamed ? [attendee.name] : [],
            status: event.isFree ? 'confirmed' : 'pending',
          },
        });
        if (event.isFree) await confirmFreeRegistration(registration, event, ticketType.id);
        created.push({ name: attendee.name, ticketType: ticketType.name, registrationId: registration.id });
      } catch (err) {
        if (err.code === 'P2002') {
          skipped.push({ name: attendee.name, reason: 'Duplicate registration' });
        } else {
          skipped.push({ name: attendee.name, reason: err.message });
        }
      }
    }
  }

  res.status(201).json({
    summary: { total: parsed.length, created: created.length, skipped: skipped.length },
    created,
    skipped,
  });
}));

// ─── GET /registrations/:id ────────────────────────────────────────────────────

router.get('/:id', asyncHandler(async (req, res) => {
  const registration = await prisma.registration.findUnique({
    where: { id: req.params.id },
    include: { event: true, ticketType: true, payment: true, answers: { include: { question: true } } },
  });
  if (!registration) return res.status(404).json({ error: 'Registration not found' });
  res.json(registration);
}));

// ─── POST /registrations/:id/checkin ─────────────────────────────────────────

router.post('/:id/checkin', ...requirePermission('registrations:checkin'), asyncHandler(async (req, res) => {
  const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
  if (!registration) return res.status(404).json({ error: 'Registration not found' });
  if (registration.status !== 'confirmed') return res.status(400).json({ error: 'Ticket is not in confirmed state' });
  const updated = await prisma.registration.update({
    where: { id: req.params.id },
    data: { status: 'checked_in', checkedInAt: new Date() },
  });
  res.json(updated);
}));

module.exports = router;
