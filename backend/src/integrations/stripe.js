const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function createPaymentIntent(amount, currency = 'kes', metadata = {}) {
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // smallest unit
    currency,
    metadata,
    automatic_payment_methods: { enabled: true },
  });
}

async function retrievePaymentIntent(id) {
  return stripe.paymentIntents.retrieve(id);
}

async function createRefund(paymentIntentId, amount) {
  const params = { payment_intent: paymentIntentId };
  if (amount) params.amount = Math.round(amount * 100);
  return stripe.refunds.create(params);
}

function constructWebhookEvent(rawBody, signature, secret) {
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

async function createSubscription(customerId, priceId) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });
}

module.exports = {
  stripe,
  createPaymentIntent,
  retrievePaymentIntent,
  createRefund,
  constructWebhookEvent,
  createSubscription,
};
