const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

function buildSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) + '-' + Date.now();
}

async function listPublicEvents({ page = 1, limit = 20, category, tags, search, location } = {}) {
  const where = {
    visibility: 'public',
    status: 'published',
    startsAt: { gt: new Date() },
  };

  if (category) where.category = { contains: category, mode: 'insensitive' };
  if (tags) where.tags = { hasSome: Array.isArray(tags) ? tags : [tags] };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { startsAt: 'asc' },
      include: { ticketTypes: true, organiser: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.event.count({ where }),
  ]);

  return { events, total, page, pages: Math.ceil(total / limit) };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getEventBySlugOrToken(slugOrToken) {
  const isUuid = UUID_RE.test(slugOrToken);
  const event = await prisma.event.findFirst({
    where: {
      OR: isUuid
        ? [{ slug: slugOrToken }, { privateToken: slugOrToken }]
        : [{ slug: slugOrToken }],
      status: { not: 'cancelled' },
    },
    include: {
      ticketTypes: true,
      organiser: { select: { id: true, name: true, avatarUrl: true } },
      sponsors: { orderBy: { displayOrder: 'asc' } },
      customQuestions: { orderBy: { displayOrder: 'asc' } },
    },
  });

  return event;
}

async function createEvent(organiserId, data) {
  const { visibility, title, isFree } = data;

  const slug = visibility === 'public' ? buildSlug(title) : null;
  const privateToken = visibility === 'private' ? uuidv4() : null;

  const event = await prisma.event.create({
    data: {
      organiserId,
      title,
      slug,
      privateToken,
      description: data.description,
      bannerUrl: data.bannerUrl,
      visibility,
      status: 'draft',
      startsAt: new Date(data.startsAt),
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      locationType: data.locationType,
      locationText: data.locationText,
      isFree: isFree === true,
      currency: data.currency || 'KES',
      maxCapacity: data.maxCapacity || null,
      registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
      category: data.category || null,
      tags: data.tags || [],
      minAge: data.minAge || null,
      maxAge: data.maxAge || null,
      serviceType: data.serviceType || null,
      ministry: data.ministry || null,
      denomination: data.denomination || null,
      dressCode: data.dressCode || null,
      recurrenceRule: data.recurrenceRule || null,
    },
    include: { ticketTypes: true },
  });

  return event;
}

async function updateEvent(eventId, organiserId, data) {
  // Verify ownership
  const event = await prisma.event.findFirst({ where: { id: eventId, organiserId } });
  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
  if (event.status === 'cancelled') throw Object.assign(new Error('Cannot edit a cancelled event'), { status: 400 });

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl }),
      ...(data.startsAt && { startsAt: new Date(data.startsAt) }),
      ...(data.endsAt !== undefined && { endsAt: data.endsAt ? new Date(data.endsAt) : null }),
      ...(data.locationType && { locationType: data.locationType }),
      ...(data.locationText !== undefined && { locationText: data.locationText }),
      ...(data.maxCapacity !== undefined && { maxCapacity: data.maxCapacity }),
      ...(data.registrationDeadline !== undefined && {
        registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
      }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.tags && { tags: data.tags }),
      ...(data.serviceType !== undefined && { serviceType: data.serviceType }),
      ...(data.ministry !== undefined && { ministry: data.ministry }),
      ...(data.denomination !== undefined && { denomination: data.denomination }),
      ...(data.dressCode !== undefined && { dressCode: data.dressCode }),
      ...(data.recurrenceRule !== undefined && { recurrenceRule: data.recurrenceRule }),
    },
  });

  return updated;
}

async function publishEvent(eventId, organiserId) {
  const event = await prisma.event.findFirst({ where: { id: eventId, organiserId } });
  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
  if (event.status !== 'draft') throw Object.assign(new Error('Only draft events can be published'), { status: 400 });

  return prisma.event.update({ where: { id: eventId }, data: { status: 'published' } });
}

async function cancelEvent(eventId, organiserId) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organiserId },
    include: { registrations: { include: { payment: true } } },
  });
  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });

  await prisma.event.update({ where: { id: eventId }, data: { status: 'cancelled' } });

  // TODO: trigger automatic refunds for paid registrations (Phase 3)

  return { cancelled: true, refundsQueued: event.registrations.filter((r) => r.payment?.status === 'completed').length };
}

module.exports = { listPublicEvents, getEventBySlugOrToken, createEvent, updateEvent, publishEvent, cancelEvent };
