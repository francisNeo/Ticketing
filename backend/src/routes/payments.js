const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middlewares/errorHandler');
const { requirePermission, requireAuth } = require('../middlewares/auth');
const { createPaymentIntent, constructWebhookEvent, createRefund } = require('../integrations/stripe');
const { initiateStkPush } = require('../integrations/mpesa');
const { sendBookingConfirmation } = require('../integrations/email');
const { sendSms } = require('../integrations/sms');
const prisma = require('../lib/prisma');
const QRCode = require('qrcode');

const router = Router();

async function confirmRegistration(registrationId) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true, ticketType: true },
  });

  // Idempotency guard — duplicate webhooks must not double-increment soldCount
  if (!registration || registration.status === 'confirmed' || registration.status === 'checked_in') return;

  const qrUrl = `${process.env.FRONTEND_URL}/tickets/${registrationId}`;
  const qrCode = await QRCode.toDataURL(qrUrl);

  await prisma.$transaction([
    prisma.registration.update({
      where: { id: registrationId },
      data: { status: 'confirmed', qrCode },
    }),
    prisma.ticketType.update({
      where: { id: registration.ticketTypeId },
      data: { soldCount: { increment: registration.quantity } },
    }),
  ]);

  sendBookingConfirmation({
    to: registration.attendeeEmail,
    name: registration.attendeeName,
    eventTitle: registration.event.title,
    eventDate: registration.event.startsAt.toLocaleDateString(),
    qrCodeUrl: qrUrl,
    ticketId: registrationId,
  }).catch(console.error);

  sendSms(
    registration.attendeePhone,
    `Payment confirmed! You're registered for ${registration.event.title}. Ticket: ${registrationId.slice(0, 8).toUpperCase()}`
  ).catch(console.error);
}

// Create Stripe PaymentIntent — requires the requesting user to own the registration
router.post('/stripe/create-intent', ...requireAuth, asyncHandler(async (req, res) => {
  const { registrationId } = z.object({ registrationId: z.string().uuid() }).parse(req.body);

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { ticketType: true, event: true },
  });

  if (!registration) return res.status(404).json({ error: 'Registration not found' });
  // Ownership: the attendee email must match the logged-in user's email
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { email: true } });
  if (!user || registration.attendeeEmail.toLowerCase() !== user.email.toLowerCase()) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (registration.status !== 'pending') return res.status(400).json({ error: 'Registration is not pending payment' });

  const amount = Number(registration.ticketType.price) * registration.quantity;
  const intent = await createPaymentIntent(amount, 'kes', { registrationId });

  await prisma.payment.upsert({
    where: { registrationId },
    update: { stripePaymentIntentId: intent.id, amount, status: 'pending' },
    create: {
      registrationId,
      method: 'card',
      amount,
      currency: 'KES',
      status: 'pending',
      stripePaymentIntentId: intent.id,
    },
  });

  res.json({ clientSecret: intent.client_secret, amount });
}));

// Stripe webhook
router.post('/stripe/webhook', asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = constructWebhookEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const registrationId = intent.metadata.registrationId;

    await prisma.payment.updateMany({
      where: { stripePaymentIntentId: intent.id },
      data: { status: 'completed', paidAt: new Date() },
    });

    await confirmRegistration(registrationId);
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object;
    await prisma.payment.updateMany({
      where: { stripePaymentIntentId: intent.id },
      data: { status: 'failed' },
    });
  }

  res.json({ received: true });
}));

// M-PESA STK Push
router.post('/mpesa/stk-push', asyncHandler(async (req, res) => {
  const body = z.object({
    registrationId: z.string().uuid(),
    phone: z.string().regex(/^2547\d{8}$/, 'Phone must be in format 2547XXXXXXXX'),
  }).parse(req.body);

  const registration = await prisma.registration.findUnique({
    where: { id: body.registrationId },
    include: { ticketType: true, event: true },
  });

  if (!registration) return res.status(404).json({ error: 'Registration not found' });
  if (registration.status !== 'pending') return res.status(400).json({ error: 'Registration is not pending payment' });

  const amount = Number(registration.ticketType.price) * registration.quantity;

  const stkResponse = await initiateStkPush({
    phone: body.phone,
    amount,
    accountReference: registration.id.slice(0, 12),
    transactionDesc: `Ticket for ${registration.event.title}`,
  });

  if (stkResponse.ResponseCode !== '0') {
    return res.status(502).json({ error: 'Failed to initiate M-PESA payment', detail: stkResponse.ResponseDescription });
  }

  await prisma.payment.upsert({
    where: { registrationId: body.registrationId },
    update: {
      mpesaCheckoutRequestId: stkResponse.CheckoutRequestID,
      mpesaPhone: body.phone,
      amount,
      status: 'pending',
      method: 'mpesa',
    },
    create: {
      registrationId: body.registrationId,
      method: 'mpesa',
      amount,
      currency: 'KES',
      status: 'pending',
      mpesaCheckoutRequestId: stkResponse.CheckoutRequestID,
      mpesaPhone: body.phone,
    },
  });

  res.json({ message: 'STK Push sent. Enter your M-PESA PIN to complete payment.', checkoutRequestId: stkResponse.CheckoutRequestID });
}));

// M-PESA callback
router.post('/mpesa/callback', asyncHandler(async (req, res) => {
  const result = req.body?.Body?.stkCallback;
  if (!result) return res.json({ ResultCode: 0 });

  const { ResultCode, CheckoutRequestID, CallbackMetadata } = result;

  const payment = await prisma.payment.findFirst({ where: { mpesaCheckoutRequestId: CheckoutRequestID } });
  if (!payment) return res.json({ ResultCode: 0 });

  if (ResultCode === 0) {
    const meta = {};
    CallbackMetadata?.Item?.forEach((item) => { meta[item.Name] = item.Value; });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'completed',
        mpesaReceiptNumber: meta.MpesaReceiptNumber,
        paidAt: new Date(),
      },
    });

    await confirmRegistration(payment.registrationId);
  } else {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}));

// Payment status polling
router.get('/:id/status', asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findFirst({
    where: { registrationId: req.params.id },
    select: { status: true, method: true, paidAt: true },
  });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json(payment);
}));

// Refund
router.post('/:id/refund', ...requirePermission('payments:refund'), asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment || payment.status !== 'completed') return res.status(400).json({ error: 'Payment cannot be refunded' });

  if (payment.method === 'card' && payment.stripePaymentIntentId) {
    const refund = await createRefund(payment.stripePaymentIntentId);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'refunded', stripeRefundId: refund.id, refundedAt: new Date() },
    });
    return res.json({ refunded: true, method: 'card' });
  }

  // M-PESA refund via B2C is handled in bundleService — Phase 5
  res.json({ refunded: false, message: 'M-PESA refunds are processed manually. Contact support.' });
}));

module.exports = router;
