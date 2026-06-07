const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middlewares/errorHandler');
const { authenticate } = require('../middlewares/auth');
const { register, login, refresh, logout } = require('../services/authService');

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['attendee', 'organiser']).default('attendee'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', asyncHandler(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const result = await register(body);
  res.status(201).json(result);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const result = await login(body);
  res.json(result);
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
  const result = await refresh(refreshToken);
  res.json(result);
}));

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await logout(req.user.userId);
  res.json({ message: 'Logged out' });
}));

module.exports = router;
