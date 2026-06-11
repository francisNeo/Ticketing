const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { sendSms } = require('../integrations/sms');

const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_SECONDS || '300', 10);
const MAX_ATTEMPTS = 5;

function generateCode() {
  // crypto.randomInt is a CSPRNG — safe for security-sensitive OTP generation
  return String(100000 + crypto.randomInt(900000));
}

async function sendOtp(phone, eventId) {
  // Delete any existing unverified OTP for this phone+event
  await prisma.phoneOtp.deleteMany({ where: { phone, eventId, verified: false } });

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY * 1000);

  await prisma.phoneOtp.create({ data: { phone, eventId, codeHash, expiresAt } });

  await sendSms(phone, `Your EventHub verification code is: ${code}. Valid for ${OTP_EXPIRY / 60} minutes.`);

  // Return a short-lived session token so the client can reference this OTP attempt
  const otpToken = jwt.sign({ phone, eventId }, process.env.JWT_SECRET, { expiresIn: '10m' });
  return { otpToken };
}

async function verifyOtp(otpToken, code) {
  let payload;
  try {
    payload = jwt.verify(otpToken, process.env.JWT_SECRET);
  } catch {
    throw Object.assign(new Error('OTP session expired. Request a new code.'), { status: 400 });
  }

  const { phone, eventId } = payload;

  const record = await prisma.phoneOtp.findUnique({ where: { phone_eventId: { phone, eventId } } });

  if (!record) throw Object.assign(new Error('No active OTP found. Request a new code.'), { status: 400 });
  if (record.verified) throw Object.assign(new Error('OTP already used.'), { status: 400 });
  if (new Date() > record.expiresAt) throw Object.assign(new Error('OTP expired. Request a new code.'), { status: 400 });
  if (record.attempts >= MAX_ATTEMPTS) throw Object.assign(new Error('Too many failed attempts. Request a new code.'), { status: 429 });

  const match = await bcrypt.compare(code, record.codeHash);

  if (!match) {
    await prisma.phoneOtp.update({
      where: { phone_eventId: { phone, eventId } },
      data: { attempts: { increment: 1 } },
    });
    const remaining = MAX_ATTEMPTS - record.attempts - 1;
    throw Object.assign(new Error(`Incorrect code. ${remaining} attempts remaining.`), { status: 400 });
  }

  await prisma.phoneOtp.update({
    where: { phone_eventId: { phone, eventId } },
    data: { verified: true },
  });

  // Issue a verified token — single-use proof of phone ownership
  const verifiedToken = jwt.sign({ phone, eventId, verified: true }, process.env.JWT_SECRET, { expiresIn: '15m' });
  return { verifiedToken };
}

function validateVerifiedToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Issues a verifiedToken without any SMS or code entry.
// Used when phone verification is not enforced (e.g. during development or
// when the platform has disabled the OTP requirement).
async function autoVerify(phone, eventId) {
  const verifiedToken = jwt.sign(
    { phone, eventId, verified: true },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );
  return { verifiedToken };
}

module.exports = { sendOtp, verifyOtp, validateVerifiedToken, autoVerify };
