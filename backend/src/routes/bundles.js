const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middlewares/errorHandler');
const { requirePermission, requireAuth } = require('../middlewares/auth');

const { createPaymentIntent, constructWebhookEvent } = require('../integrations/stripe');
const { initiateStkPush } = require('../integrations/mpesa');

const router = Router();
const prisma = require('../lib/prisma');

router.get('/', asyncHandler(async (req, res) => {
  const bundles = await prisma.notificationBundle.findMany({
    where: { isActive: true },
    orderBy: [{ channel: 'asc' }, { displayOrder: 'asc' }],
  });
  res.json(bundles);
}));

router.get('/balance', ...requireAuth, asyncHandler(async (req, res) => {
  const balance = await prisma.organiserBundleBalance.findUnique({ where: { organiserId: req.user.userId } });
  res.json(balance || { smsUnits: 0, emailUnits: 0 });
}));

router.get('/purchases', ...requireAuth, asyncHandler(async (req, res) => {
  const purchases = await prisma.bundlePurchase.findMany({
    where: { organiserId: req.user.userId },
    include: { bundle: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(purchases);
}));

router.post('/:id/purchase/stripe', ...requireAuth, asyncHandler(async (req, res) => {
  z.string().uuid().parse(req.params.id);
  const bundle = await prisma.notificationBundle.findUnique({ where: { id: req.params.id, isActive: true } });
  if (!bundle) return res.status(404).json({ error: 'Bundle not found' });

  const intent = await createPaymentIntent(Number(bundle.price), 'kes', {
    bundleId: bundle.id,
    organiserId: req.user.userId,
  });

  await prisma.bundlePurchase.create({
    data: {
      organiserId: req.user.userId,
      bundleId: bundle.id,
      unitsPurchased: bundle.units,
      amountPaid: bundle.price,
      paymentMethod: 'card',
      paymentStatus: 'pending',
      stripePaymentIntentId: intent.id,
    },
  });

  res.json({ clientSecret: intent.client_secret });
}));

router.post('/:id/purchase/mpesa', ...requireAuth, asyncHandler(async (req, res) => {
  z.string().uuid().parse(req.params.id);
  const { phone } = z.object({ phone: z.string().regex(/^2547\d{8}$/, 'Phone must be in format 2547XXXXXXXX') }).parse(req.body);
  const bundle = await prisma.notificationBundle.findUnique({ where: { id: req.params.id, isActive: true } });
  if (!bundle) return res.status(404).json({ error: 'Bundle not found' });

  const stkResponse = await initiateStkPush({
    phone,
    amount: Number(bundle.price),
    accountReference: `BUNDLE-${bundle.id.slice(0, 8)}`,
    transactionDesc: `Purchase ${bundle.name}`,
  });

  if (stkResponse.ResponseCode !== '0') {
    return res.status(502).json({ error: 'M-PESA initiation failed' });
  }

  await prisma.bundlePurchase.create({
    data: {
      organiserId: req.user.userId,
      bundleId: bundle.id,
      unitsPurchased: bundle.units,
      amountPaid: bundle.price,
      paymentMethod: 'mpesa',
      paymentStatus: 'pending',
      mpesaReceiptNumber: stkResponse.CheckoutRequestID,
    },
  });

  res.json({ message: 'STK Push sent. Enter M-PESA PIN to complete.', checkoutRequestId: stkResponse.CheckoutRequestID });
}));

// Stripe webhook for bundle purchases
router.post('/stripe/webhook', asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = constructWebhookEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    if (!intent.metadata.bundleId) return res.json({ received: true });

    const purchase = await prisma.bundlePurchase.findFirst({ where: { stripePaymentIntentId: intent.id } });
    if (!purchase) return res.json({ received: true });

    await prisma.bundlePurchase.update({
      where: { id: purchase.id },
      data: { paymentStatus: 'completed', purchasedAt: new Date() },
    });

    await prisma.organiserBundleBalance.upsert({
      where: { organiserId: purchase.organiserId },
      update: {
        smsUnits: purchase.bundle?.channel === 'sms' ? { increment: purchase.unitsPurchased } : undefined,
        emailUnits: purchase.bundle?.channel === 'email' ? { increment: purchase.unitsPurchased } : undefined,
      },
      create: {
        organiserId: purchase.organiserId,
        smsUnits: purchase.bundle?.channel === 'sms' ? purchase.unitsPurchased : 0,
        emailUnits: purchase.bundle?.channel === 'email' ? purchase.unitsPurchased : 0,
        totalSmsPurchased: purchase.bundle?.channel === 'sms' ? purchase.unitsPurchased : 0,
        totalEmailPurchased: purchase.bundle?.channel === 'email' ? purchase.unitsPurchased : 0,
      },
    });
  }

  res.json({ received: true });
}));

// M-PESA callback for bundle purchases
router.post('/mpesa/callback', asyncHandler(async (req, res) => {
  const result = req.body?.Body?.stkCallback;
  if (!result) return res.json({ ResultCode: 0 });

  const { ResultCode, CheckoutRequestID, CallbackMetadata } = result;
  const purchase = await prisma.bundlePurchase.findFirst({ where: { mpesaReceiptNumber: CheckoutRequestID } });
  if (!purchase) return res.json({ ResultCode: 0 });

  if (ResultCode === 0) {
    const meta = {};
    CallbackMetadata?.Item?.forEach((item) => { meta[item.Name] = item.Value; });

    await prisma.bundlePurchase.update({
      where: { id: purchase.id },
      data: { paymentStatus: 'completed', mpesaReceiptNumber: meta.MpesaReceiptNumber, purchasedAt: new Date() },
    });

    const bundle = await prisma.notificationBundle.findUnique({ where: { id: purchase.bundleId } });
    await prisma.organiserBundleBalance.upsert({
      where: { organiserId: purchase.organiserId },
      update: {
        ...(bundle?.channel === 'sms' ? { smsUnits: { increment: purchase.unitsPurchased }, totalSmsPurchased: { increment: purchase.unitsPurchased } } : {}),
        ...(bundle?.channel === 'email' ? { emailUnits: { increment: purchase.unitsPurchased }, totalEmailPurchased: { increment: purchase.unitsPurchased } } : {}),
      },
      create: {
        organiserId: purchase.organiserId,
        smsUnits: bundle?.channel === 'sms' ? purchase.unitsPurchased : 0,
        emailUnits: bundle?.channel === 'email' ? purchase.unitsPurchased : 0,
        totalSmsPurchased: bundle?.channel === 'sms' ? purchase.unitsPurchased : 0,
        totalEmailPurchased: bundle?.channel === 'email' ? purchase.unitsPurchased : 0,
      },
    });
  } else {
    await prisma.bundlePurchase.update({ where: { id: purchase.id }, data: { paymentStatus: 'failed' } });
  }

  res.json({ ResultCode: 0 });
}));

module.exports = router;
