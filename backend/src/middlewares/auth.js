const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Loads full permission set from DB (or JWT cache) and attaches to req.permissions
const loadPermissions = async (req, res, next) => {
  if (!req.user) return next();

  try {
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: req.user.userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        role: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    });

    const permissions = new Set();
    userRoles.forEach((ur) =>
      ur.role.permissions.forEach((rp) => permissions.add(rp.permission.key))
    );

    req.permissions = permissions;
    req.userRoleNames = userRoles.map((ur) => ur.role.name);
    next();
  } catch (err) {
    next(err);
  }
};

const requirePermission = (permission) => [
  authenticate,
  loadPermissions,
  (req, res, next) => {
    if (!req.permissions || !req.permissions.has(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  },
];

const requireAuth = [authenticate, loadPermissions];

module.exports = { authenticate, loadPermissions, requirePermission, requireAuth };
