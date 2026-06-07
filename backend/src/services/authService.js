const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function issueAccessToken(userId, roles) {
  return jwt.sign({ userId, roles }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function issueRefreshToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function register({ name, email, password, role: requestedRole }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);

  // Always assign attendee; additionally assign organiser if requested
  const roleNames = ['attendee'];
  if (requestedRole === 'organiser') roleNames.push('organiser');

  const rolesToAssign = await prisma.role.findMany({ where: { name: { in: roleNames } } });

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      userRoles: { create: rolesToAssign.map((r) => ({ roleId: r.id })) },
    },
    include: { userRoles: { include: { role: true } } },
  });

  const roles = user.userRoles.map((ur) => ur.role.name);
  const accessToken = issueAccessToken(user.id, roles);
  const refreshToken = issueRefreshToken(user.id);

  const refreshHash = await bcrypt.hash(refreshToken, 10);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken: refreshHash } });

  return { accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, roles } };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user || !user.passwordHash) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Invalid email or password'), { status: 401 });

  const roles = user.userRoles.map((ur) => ur.role.name);
  const accessToken = issueAccessToken(user.id, roles);
  const refreshToken = issueRefreshToken(user.id);

  const refreshHash = await bcrypt.hash(refreshToken, 10);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken: refreshHash } });

  return { accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, roles } };
}

async function refresh(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user || !user.refreshToken) throw Object.assign(new Error('Session expired'), { status: 401 });

  const valid = await bcrypt.compare(token, user.refreshToken);
  if (!valid) throw Object.assign(new Error('Invalid refresh token'), { status: 401 });

  const roles = user.userRoles.map((ur) => ur.role.name);
  const accessToken = issueAccessToken(user.id, roles);
  return { accessToken };
}

async function logout(userId) {
  await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
}

module.exports = { register, login, refresh, logout };
