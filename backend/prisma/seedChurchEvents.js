/**
 * Seed sample church events across several realistic Kenyan churches.
 * Run: node prisma/seedChurchEvents.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80) + '-' + Date.now();
}

function future(days, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function end(startDate, durationHours = 2) {
  return new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
}

// ─── Church organisers ────────────────────────────────────────────────────────

const CHURCHES = [
  {
    name: 'Nairobi Chapel',
    email: 'events@nairobichapel.org',
    denomination: 'Non-Denominational',
    location: 'Nairobi Chapel, Off Ngong Road, Nairobi',
  },
  {
    name: 'Mavuno Church',
    email: 'events@mavunochurch.org',
    denomination: 'Pentecostal',
    location: 'Mavuno Nairobi, Mulolongo Road, Nairobi',
  },
  {
    name: 'All Saints Cathedral',
    email: 'office@allsaintsnairobi.org',
    denomination: 'Anglican',
    location: 'All Saints Cathedral, Kenyatta Avenue, Nairobi CBD',
  },
  {
    name: 'Citam Valley Road',
    email: 'events@citam.org',
    denomination: 'Evangelical',
    location: 'CITAM Valley Road, Nairobi',
  },
  {
    name: 'Holy Family Basilica',
    email: 'admin@holyfamilybasilicanbi.org',
    denomination: 'Catholic',
    location: 'Holy Family Basilica, City Hall Way, Nairobi CBD',
  },
];

// ─── Event templates ──────────────────────────────────────────────────────────

const EVENT_TEMPLATES = [
  // ── Nairobi Chapel ──
  {
    church: 0,
    title: 'Sunday Morning Service',
    description: 'Join us every Sunday for an uplifting time of worship, prayer, and an inspiring message from the Word. All are welcome — bring a friend!',
    serviceType: 'Sunday Service',
    dressCode: 'Smart Casual',
    isFree: true,
    visibility: 'public',
    daysFromNow: 5,
    hour: 9,
    duration: 2,
    ministry: 'Main Congregation',
    recurrenceRule: 'WEEKLY:SUNDAY',
    tags: ['worship', 'sunday-service', 'family'],
    maxCapacity: 800,
  },
  {
    church: 0,
    title: 'Women of Purpose Conference 2026',
    description: 'A powerful two-day conference for women ready to walk in their God-given purpose. Featuring keynote speakers, breakout sessions, worship, and networking. Early bird tickets available until 30th June.',
    serviceType: 'Conference',
    dressCode: 'Sunday Best',
    isFree: false,
    visibility: 'public',
    daysFromNow: 21,
    hour: 8,
    duration: 9,
    ministry: "Women's Ministry",
    tags: ['women', 'conference', 'empowerment', 'faith'],
    maxCapacity: 500,
    tickets: [
      { name: 'Early Bird', price: 1500, quantity: 150 },
      { name: 'Standard', price: 2500, quantity: 300 },
      { name: 'VIP (includes dinner)', price: 5000, quantity: 50 },
    ],
  },
  {
    church: 0,
    title: 'Youth Midweek Bible Study',
    description: 'An interactive mid-week Bible study session for young adults (18–35). We dig deep into Scripture, ask hard questions, and grow together.',
    serviceType: 'Bible Study',
    dressCode: 'Casual',
    isFree: true,
    visibility: 'public',
    daysFromNow: 3,
    hour: 18,
    duration: 1.5,
    ministry: 'Youth Ministry',
    recurrenceRule: 'WEEKLY:WEDNESDAY',
    tags: ['youth', 'bible-study', '18-35'],
    maxCapacity: 200,
  },

  // ── Mavuno Church ──
  {
    church: 1,
    title: 'Mizizi Course — Cohort 12',
    description: "Mavuno's signature 8-week discipleship course covering faith foundations, relationships, finances, and purpose. Register to secure your spot in this cohort.",
    serviceType: 'Bible Study',
    dressCode: 'Casual',
    isFree: false,
    visibility: 'public',
    daysFromNow: 10,
    hour: 16,
    duration: 2.5,
    ministry: 'Discipleship',
    tags: ['discipleship', 'foundations', 'mizizi', 'growth'],
    maxCapacity: 120,
    tickets: [
      { name: 'Course Registration', price: 800, quantity: 120 },
    ],
  },
  {
    church: 1,
    title: 'Good Friday Crossover Service',
    description: 'A solemn and reflective Good Friday service commemorating the crucifixion of our Lord Jesus Christ. Come prepared for a powerful time of worship and communion.',
    serviceType: 'Communion Service',
    dressCode: 'Smart Casual',
    isFree: true,
    visibility: 'public',
    daysFromNow: 14,
    hour: 18,
    duration: 2,
    ministry: 'Main Congregation',
    tags: ['good-friday', 'easter', 'communion', 'worship'],
    maxCapacity: 1000,
  },
  {
    church: 1,
    title: 'Men\'s Breakfast Forum — Leading with Integrity',
    description: "A monthly breakfast forum for men. This month's theme: Leading with Integrity in the Workplace and Home. Facilitated discussion, buffet breakfast included. Space is limited.",
    serviceType: "Men's Fellowship",
    dressCode: 'Smart Casual',
    isFree: false,
    visibility: 'public',
    daysFromNow: 12,
    hour: 7,
    duration: 3,
    ministry: "Men's Ministry",
    recurrenceRule: 'MONTHLY:FIRST_SUNDAY',
    tags: ['men', 'breakfast', 'leadership', 'integrity'],
    maxCapacity: 80,
    tickets: [
      { name: 'Breakfast Ticket', price: 1200, quantity: 80 },
    ],
  },

  // ── All Saints Cathedral ──
  {
    church: 2,
    title: 'Sung Eucharist — Holy Trinity Sunday',
    description: 'A choral celebration of Holy Trinity Sunday featuring the Cathedral Choir. The service includes Holy Communion, anthem, and a sermon by the Dean.',
    serviceType: 'Sunday Service',
    dressCode: 'Sunday Best',
    isFree: true,
    visibility: 'public',
    daysFromNow: 6,
    hour: 9,
    duration: 1.5,
    ministry: 'Cathedral Choir',
    tags: ['eucharist', 'choir', 'cathedral', 'anglican'],
    maxCapacity: 600,
  },
  {
    church: 2,
    title: 'Confirmation Retreat 2026',
    description: 'A residential weekend retreat for candidates preparing for Confirmation in the Anglican Church. Sessions on faith, baptism, the Holy Spirit, and church membership. Accommodation and meals included.',
    serviceType: 'Retreat',
    dressCode: 'Casual',
    isFree: false,
    visibility: 'private',
    daysFromNow: 30,
    hour: 14,
    duration: 48,
    ministry: 'Youth & Young Adults',
    tags: ['confirmation', 'retreat', 'anglicanism', 'youth'],
    maxCapacity: 60,
    tickets: [
      { name: 'Retreat Package (accommodation + meals)', price: 4500, quantity: 60 },
    ],
  },
  {
    church: 2,
    title: 'Easter Vigil & First Eucharist',
    description: 'The holiest night of the Christian year. The Easter Vigil begins in darkness, moves through readings and Psalms, and culminates in the joyful celebration of the Resurrection and first Eucharist of Easter.',
    serviceType: 'Communion Service',
    dressCode: 'Sunday Best',
    isFree: true,
    visibility: 'public',
    daysFromNow: 18,
    hour: 20,
    duration: 2.5,
    ministry: 'Main Congregation',
    tags: ['easter', 'vigil', 'resurrection', 'eucharist'],
    maxCapacity: 600,
  },

  // ── CITAM Valley Road ──
  {
    church: 3,
    title: 'Sunday Family Service',
    description: "A family-friendly Sunday service with children's church running simultaneously. Experience vibrant praise and worship, and a practical message applicable to everyday life.",
    serviceType: 'Sunday Service',
    dressCode: 'Smart Casual',
    isFree: true,
    visibility: 'public',
    daysFromNow: 5,
    hour: 10,
    duration: 2,
    ministry: 'Main Congregation',
    recurrenceRule: 'WEEKLY:SUNDAY',
    tags: ['family', 'sunday', 'children-church', 'worship'],
    maxCapacity: 1200,
  },
  {
    church: 3,
    title: 'Prayer & Fasting Week — Breakthrough',
    description: 'Seven days of corporate prayer and fasting as we seek God for personal and national breakthrough. Daily prayer sessions at 6 AM and 6 PM. Join any session or commit to the full week.',
    serviceType: 'Prayer Meeting',
    dressCode: 'Casual',
    isFree: true,
    visibility: 'public',
    daysFromNow: 8,
    hour: 6,
    duration: 1,
    ministry: 'Intercessory Ministry',
    tags: ['prayer', 'fasting', 'breakthrough', 'revival'],
    maxCapacity: 400,
  },
  {
    church: 3,
    title: 'Financial Freedom Seminar — Stewardship & Wealth',
    description: 'A one-day practical seminar on biblical principles of money management, debt freedom, saving, and investing. Led by certified financial planners and grounded in Scripture.',
    serviceType: 'Conference',
    dressCode: 'Smart Casual',
    isFree: false,
    visibility: 'public',
    daysFromNow: 25,
    hour: 8,
    duration: 8,
    ministry: 'Marketplace Ministry',
    tags: ['finance', 'stewardship', 'wealth', 'practical'],
    maxCapacity: 250,
    tickets: [
      { name: 'Standard', price: 2000, quantity: 200 },
      { name: 'Couple', price: 3500, quantity: 50 },
    ],
  },

  // ── Holy Family Basilica ──
  {
    church: 4,
    title: 'Corpus Christi Procession & Mass',
    description: 'Celebrate the Solemnity of the Most Holy Body and Blood of Christ with a solemn outdoor procession through Nairobi CBD followed by Holy Mass at the Basilica.',
    serviceType: 'Sunday Service',
    dressCode: 'Sunday Best',
    isFree: true,
    visibility: 'public',
    daysFromNow: 9,
    hour: 9,
    duration: 2,
    ministry: 'Main Parish',
    tags: ['corpus-christi', 'mass', 'catholic', 'procession'],
    maxCapacity: 2000,
  },
  {
    church: 4,
    title: 'Youth Camp 2026 — Rooted',
    description: 'An exciting 3-day overnight camp for Catholic youth (13–25 years). Activities include Eucharist, Adoration, small groups, sports, and team building — all centered on growing roots deep in Christ.',
    serviceType: 'Retreat',
    dressCode: 'Casual',
    isFree: false,
    visibility: 'public',
    daysFromNow: 35,
    hour: 10,
    duration: 72,
    ministry: 'Catholic Youth Organisation',
    tags: ['youth', 'camp', 'catholic', 'rooted'],
    minAge: 13,
    maxAge: 25,
    maxCapacity: 150,
    tickets: [
      { name: 'Camp Package', price: 5000, quantity: 130 },
      { name: 'Day Visitor (no accommodation)', price: 1500, quantity: 20 },
    ],
  },
  {
    church: 4,
    title: 'Marriage Enrichment Weekend',
    description: 'A private retreat weekend for married couples looking to deepen their bond and renew their vows. Facilitated by Father Joseph Kamau and a team of marriage counselors.',
    serviceType: 'Retreat',
    dressCode: 'Smart Casual',
    isFree: false,
    visibility: 'private',
    daysFromNow: 28,
    hour: 15,
    duration: 44,
    ministry: 'Family Life Ministry',
    tags: ['marriage', 'couples', 'enrichment', 'retreat'],
    maxCapacity: 40,
    tickets: [
      { name: 'Couple Package (accommodation + meals)', price: 12000, quantity: 20 },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Seeding sample church events...\n');

  // 1. Get / create organiser users for each church
  const organiserRole = await prisma.role.findUnique({ where: { name: 'organiser' } });
  const attendeeRole  = await prisma.role.findUnique({ where: { name: 'attendee' } });
  if (!organiserRole) throw new Error('organiser role not found — run the main seed first');

  const organisers = [];
  for (const church of CHURCHES) {
    let user = await prisma.user.findUnique({ where: { email: church.email } });
    if (!user) {
      const passwordHash = await bcrypt.hash('Church@1234', 12);
      user = await prisma.user.create({
        data: {
          name: church.name,
          email: church.email,
          passwordHash,
          emailVerified: true,
          userRoles: {
            create: [
              { roleId: organiserRole.id },
              { roleId: attendeeRole.id },
            ],
          },
        },
      });
      console.log(`  ✓ Created organiser: ${church.name} <${church.email}>`);
    } else {
      console.log(`  · Organiser exists: ${church.name}`);
    }
    organisers.push({ ...church, userId: user.id });
  }

  // 2. Create events
  let created = 0;
  for (const tmpl of EVENT_TEMPLATES) {
    const church = organisers[tmpl.church];
    const startsAt = future(tmpl.daysFromNow, tmpl.hour);
    const endsAt   = end(startsAt, tmpl.duration);
    const isPrivate = tmpl.visibility === 'private';

    // Skip if an event with same title + organiser already exists
    const existing = await prisma.event.findFirst({
      where: { organiserId: church.userId, title: tmpl.title },
    });
    if (existing) {
      console.log(`  · Skipped (already exists): ${tmpl.title}`);
      continue;
    }

    const event = await prisma.event.create({
      data: {
        organiserId:      church.userId,
        title:            tmpl.title,
        slug:             isPrivate ? null : slug(tmpl.title),
        privateToken:     isPrivate ? require('crypto').randomUUID() : null,
        description:      tmpl.description,
        visibility:       tmpl.visibility,
        status:           'published',
        startsAt,
        endsAt,
        locationType:     'physical',
        locationText:     church.location,
        isFree:           tmpl.isFree,
        currency:         'KES',
        maxCapacity:      tmpl.maxCapacity || null,
        category:         'Church & Religious',
        tags:             tmpl.tags || [],
        serviceType:      tmpl.serviceType || null,
        ministry:         tmpl.ministry || null,
        denomination:     church.denomination,
        dressCode:        tmpl.dressCode || null,
        recurrenceRule:   tmpl.recurrenceRule || null,
        minAge:           tmpl.minAge || null,
        maxAge:           tmpl.maxAge || null,
      },
    });

    // 3. Create ticket types
    if (!tmpl.isFree && tmpl.tickets?.length) {
      await prisma.ticketType.createMany({
        data: tmpl.tickets.map((t) => ({
          eventId:  event.id,
          name:     t.name,
          price:    t.price,
          quantity: t.quantity || null,
        })),
      });
    } else {
      // Free events still get a default "General Admission" ticket type
      await prisma.ticketType.create({
        data: {
          eventId:  event.id,
          name:     'General Admission',
          price:    0,
          quantity: tmpl.maxCapacity || null,
        },
      });
    }

    const privFlag = isPrivate ? ' [PRIVATE]' : '';
    console.log(`  ✓ ${church.name}: ${tmpl.title}${privFlag}`);
    created++;
  }

  console.log(`\n✅  Done — ${created} events created across ${CHURCHES.length} churches.`);
  console.log('\nChurch organiser accounts (password: Church@1234):');
  for (const c of CHURCHES) {
    console.log(`  ${c.email}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
