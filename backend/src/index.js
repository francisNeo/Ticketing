require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middlewares/errorHandler');
const { authLimiter, apiLimiter } = require('./middlewares/rateLimiter');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const ticketTypeRoutes = require('./routes/ticketTypes');
const otpRoutes = require('./routes/otp');
const registrationRoutes = require('./routes/registrations');
const paymentRoutes = require('./routes/payments');
const bundleRoutes = require('./routes/bundles');
const notificationRoutes = require('./routes/notifications');
const roleRoutes = require('./routes/roles');
const planRoutes = require('./routes/plans');
const adminRoutes = require('./routes/admin');
const churchConfigRoutes = require('./routes/churchConfig');

const app = express();

app.use(helmet());
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Raw body needed for Stripe webhook signature verification
app.use('/api/v1/payments/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/v1/bundles/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/events', apiLimiter, eventRoutes);
app.use('/api/v1/ticket-types', apiLimiter, ticketTypeRoutes);
app.use('/api/v1/otp', apiLimiter, otpRoutes);
app.use('/api/v1/registrations', apiLimiter, registrationRoutes);
app.use('/api/v1/payments', apiLimiter, paymentRoutes);
app.use('/api/v1/bundles', apiLimiter, bundleRoutes);
app.use('/api/v1/notifications', apiLimiter, notificationRoutes);
app.use('/api/v1/roles', apiLimiter, roleRoutes);
app.use('/api/v1/permissions', apiLimiter, roleRoutes);
app.use('/api/v1/plans', apiLimiter, planRoutes);
app.use('/api/v1/admin', apiLimiter, adminRoutes);
app.use('/api/v1/church-config', apiLimiter, churchConfigRoutes);
app.use('/api/v1/organiser', apiLimiter, require('./routes/organiser'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`EventHub API running on port ${PORT}`));
