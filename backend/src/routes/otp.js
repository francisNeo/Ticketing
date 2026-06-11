const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middlewares/errorHandler');
const { otpSendLimiter } = require('../middlewares/rateLimiter');
const { sendOtp, verifyOtp, autoVerify } = require('../services/otpService');

const router = Router();

const phoneEventSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number'),
  eventId: z.string().uuid(),
  captchaToken: z.string().optional(),
});

const verifySchema = z.object({
  otpToken: z.string().min(1),
  code: z.string().length(6),
});

// Default verification — issues a verifiedToken immediately, no SMS required.
// ONLY active when OTP_AUTO_VERIFY=true (development/testing only; never enable in production).
router.post('/auto-verify', asyncHandler(async (req, res) => {
  if (process.env.OTP_AUTO_VERIFY !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  const body = phoneEventSchema.parse(req.body);
  const result = await autoVerify(body.phone, body.eventId);
  res.json(result);
}));

// SMS OTP — retained for future use when stricter verification is re-enabled
router.post('/send', otpSendLimiter, asyncHandler(async (req, res) => {
  const body = phoneEventSchema.parse(req.body);
  const result = await sendOtp(body.phone, body.eventId);
  res.json(result);
}));

router.post('/verify', asyncHandler(async (req, res) => {
  const body = verifySchema.parse(req.body);
  const result = await verifyOtp(body.otpToken, body.code);
  res.json(result);
}));

module.exports = router;
