const { PrismaClient } = require('@prisma/client');

// Singleton — prevents connection pool exhaustion from multiple PrismaClient instances.
// In development, attach to global so hot-reload doesn't spawn new clients on every save.
const prisma = global._prismaClient ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global._prismaClient = prisma;
}

module.exports = prisma;
