const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const PERMISSIONS = [
  // Events
  { key: 'events:create', group: 'Events', description: 'Create new events' },
  { key: 'events:edit_own', group: 'Events', description: 'Edit events owned by the current user' },
  { key: 'events:edit_any', group: 'Events', description: 'Edit any event on the platform (admin)' },
  { key: 'events:delete_own', group: 'Events', description: 'Cancel/delete own events' },
  { key: 'events:delete_any', group: 'Events', description: 'Cancel/delete any event (admin)' },
  { key: 'events:publish', group: 'Events', description: 'Publish a draft event' },
  { key: 'events:view_private', group: 'Events', description: 'Access private events without a token' },
  // Registrations
  { key: 'registrations:view_own', group: 'Registrations', description: 'View own registrations' },
  { key: 'registrations:view_event', group: 'Registrations', description: 'View all registrations for own event' },
  { key: 'registrations:view_any', group: 'Registrations', description: 'View all registrations platform-wide' },
  { key: 'registrations:checkin', group: 'Registrations', description: 'Mark attendees as checked in' },
  { key: 'registrations:export', group: 'Registrations', description: 'Export attendee list to CSV' },
  // Payments
  { key: 'payments:view_own', group: 'Payments', description: 'View own payment history' },
  { key: 'payments:view_event', group: 'Payments', description: 'View payments for own event' },
  { key: 'payments:view_any', group: 'Payments', description: 'View all payments (admin)' },
  { key: 'payments:refund', group: 'Payments', description: 'Issue refunds' },
  // Users
  { key: 'users:view_any', group: 'Users', description: 'View all registered users' },
  { key: 'users:edit_any', group: 'Users', description: 'Edit any user profile' },
  { key: 'users:ban', group: 'Users', description: 'Suspend or ban a user account' },
  // Roles
  { key: 'roles:view', group: 'Roles', description: 'View roles list and permissions' },
  { key: 'roles:create', group: 'Roles', description: 'Create new custom roles' },
  { key: 'roles:edit', group: 'Roles', description: 'Edit existing roles and permissions' },
  { key: 'roles:delete', group: 'Roles', description: 'Delete custom roles' },
  { key: 'roles:assign', group: 'Roles', description: 'Assign roles to users' },
  // Analytics
  { key: 'analytics:view_own', group: 'Analytics', description: 'View analytics for own events' },
  { key: 'analytics:view_platform', group: 'Analytics', description: 'View platform-wide analytics' },
  // Church event configuration
  { key: 'church_config:manage', group: 'Church Config', description: 'Create, edit, and deactivate church event types and denominations' },
];

const ADMIN_PERMISSIONS = PERMISSIONS.map((p) => p.key); // admin gets everything
const ORGANISER_PERMISSIONS = [
  'events:create', 'events:edit_own', 'events:delete_own', 'events:publish',
  'registrations:view_own', 'registrations:view_event', 'registrations:checkin', 'registrations:export',
  'payments:view_own', 'payments:view_event', 'payments:refund',
  'analytics:view_own',
];
const ATTENDEE_PERMISSIONS = ['registrations:view_own', 'payments:view_own'];

async function main() {
  console.log('Seeding database...');

  // Upsert all permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: p.key }, update: p, create: p });
  }
  console.log(`✓ ${PERMISSIONS.length} permissions seeded`);

  const allPermissions = await prisma.permission.findMany();
  const permMap = Object.fromEntries(allPermissions.map((p) => [p.key, p.id]));

  // Seed system roles
  const roles = [
    { name: 'admin', displayName: 'Administrator', description: 'Full platform access', permissions: ADMIN_PERMISSIONS },
    { name: 'organiser', displayName: 'Event Admin', description: 'Create and manage own events, payments, and attendees', permissions: ORGANISER_PERMISSIONS },
    { name: 'attendee', displayName: 'Attendee', description: 'Browse events and manage own tickets', permissions: ATTENDEE_PERMISSIONS },
  ];

  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { displayName: r.displayName, description: r.description, isSystem: true },
      create: { name: r.name, displayName: r.displayName, description: r.description, isSystem: true },
    });

    // Sync permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: r.permissions.filter((k) => permMap[k]).map((k) => ({ roleId: role.id, permissionId: permMap[k] })),
    });
    console.log(`✓ Role '${r.name}' seeded with ${r.permissions.length} permissions`);
  }

  // Seed default plans
  const plans = [
    { name: 'free', displayName: 'Free', monthlyPrice: 0, maxAttendeesPerEvent: 50, maxActiveEvents: 1, commissionRate: 0.05, maxCustomQuestions: 0, maxCoOrganisers: 0, canPurchaseBundles: false, hasAnalytics: false, canRecurring: false, removeBranding: false, hasCustomDomain: false, hasApiAccess: false },
    { name: 'starter', displayName: 'Starter', monthlyPrice: 1500, annualPrice: 15000, maxAttendeesPerEvent: 300, maxActiveEvents: 5, commissionRate: 0.03, maxCustomQuestions: 5, maxCoOrganisers: 1, canPurchaseBundles: true, hasAnalytics: true, canRecurring: false, removeBranding: true, hasCustomDomain: false, hasApiAccess: false },
    { name: 'growth', displayName: 'Growth', monthlyPrice: 4500, annualPrice: 45000, commissionRate: 0.02, maxCustomQuestions: 20, maxCoOrganisers: 5, canPurchaseBundles: true, hasAnalytics: true, canRecurring: true, removeBranding: true, hasCustomDomain: false, hasApiAccess: false },
    { name: 'enterprise', displayName: 'Enterprise', monthlyPrice: 0, commissionRate: 0.01, maxCustomQuestions: -1, maxCoOrganisers: -1, canPurchaseBundles: true, hasAnalytics: true, canRecurring: true, removeBranding: true, hasCustomDomain: true, hasApiAccess: true },
    // Pay-per-event tiers
    { name: 'ppe_small', displayName: 'Pay Per Event (≤50)', monthlyPrice: 0, maxAttendeesPerEvent: 50, maxActiveEvents: 1, commissionRate: 0.05, isPayPerEvent: true, payPerEventFee: 0 },
    { name: 'ppe_medium', displayName: 'Pay Per Event (51–300)', monthlyPrice: 0, maxAttendeesPerEvent: 300, maxActiveEvents: 1, commissionRate: 0.03, isPayPerEvent: true, payPerEventFee: 800 },
    { name: 'ppe_large', displayName: 'Pay Per Event (301–1000)', monthlyPrice: 0, maxAttendeesPerEvent: 1000, maxActiveEvents: 1, commissionRate: 0.025, isPayPerEvent: true, payPerEventFee: 2500 },
    { name: 'ppe_xlarge', displayName: 'Pay Per Event (1001–3000)', monthlyPrice: 0, maxAttendeesPerEvent: 3000, maxActiveEvents: 1, commissionRate: 0.02, isPayPerEvent: true, payPerEventFee: 6000 },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({ where: { name: plan.name }, update: plan, create: plan });
  }
  console.log(`✓ ${plans.length} plans seeded`);

  // Seed notification bundles
  const bundles = [
    { name: 'Starter SMS', channel: 'sms', units: 100, price: 500, displayOrder: 1 },
    { name: 'Standard SMS', channel: 'sms', units: 500, price: 2000, displayOrder: 2 },
    { name: 'Pro SMS', channel: 'sms', units: 2000, price: 6000, displayOrder: 3 },
    { name: 'Starter Email', channel: 'email', units: 500, price: 300, displayOrder: 1 },
    { name: 'Standard Email', channel: 'email', units: 2000, price: 800, displayOrder: 2 },
    { name: 'Pro Email', channel: 'email', units: 10000, price: 2500, displayOrder: 3 },
  ];

  for (const b of bundles) {
    await prisma.notificationBundle.upsert({ where: { id: (await prisma.notificationBundle.findFirst({ where: { name: b.name } }))?.id || '00000000-0000-0000-0000-000000000000' }, update: b, create: b });
  }
  console.log(`✓ ${bundles.length} notification bundles seeded`);

  // Create default admin user
  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  const adminEmail = 'admin@eventhub.ke';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('Admin@1234', 12);
    const admin = await prisma.user.create({
      data: { name: 'Platform Admin', email: adminEmail, passwordHash, emailVerified: true },
    });
    if (adminRole) {
      await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });
    }
    console.log(`✓ Admin user created: ${adminEmail} / Admin@1234`);
  } else {
    console.log(`✓ Admin user already exists: ${adminEmail}`);
  }

  // Seed church event configuration defaults
  const churchDefaults = [
    // Service Types
    ...['Sunday Service', 'Midweek Service', 'Bible Study', 'Prayer Meeting',
       'Youth Service', "Children's Church", "Women's Fellowship", "Men's Fellowship",
       'Choir / Worship Night', 'Revival / Crusade', 'Retreat', 'Conference',
       'Funeral Service', 'Wedding', 'Dedication', 'Baptism', 'Communion Service',
       'Outreach', 'Fundraiser'].map((value, i) => ({ kind: 'service_type', value, displayOrder: i })),
    // Denominations
    ...['Non-Denominational', 'Catholic', 'Anglican', 'Pentecostal', 'Baptist',
       'Methodist', 'Presbyterian', 'Seventh-day Adventist', 'Lutheran',
       'Reformed', 'Charismatic', 'Evangelical', 'Other'].map((value, i) => ({ kind: 'denomination', value, displayOrder: i })),
    // Dress Codes
    ...['Smart Casual', 'Sunday Best', 'Formal', 'Casual', 'No Dress Code'].map((value, i) => ({ kind: 'dress_code', value, displayOrder: i })),
  ];

  for (const cfg of churchDefaults) {
    await prisma.churchEventConfig.upsert({
      where: { kind_value: { kind: cfg.kind, value: cfg.value } },
      update: { displayOrder: cfg.displayOrder },
      create: cfg,
    });
  }
  console.log(`✓ ${churchDefaults.length} church event config items seeded`);

  console.log('\nSeeding complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
