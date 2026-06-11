const { ZodError } = require('zod');

const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  // Zod validation errors — turn field errors into a readable sentence
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => {
      const field = e.path.join('.');
      switch (field) {
        case 'phone': return 'Please enter a valid phone number (e.g. +254712345678 or 0712345678)';
        case 'email': return 'Please enter a valid email address';
        case 'password': return e.message;
        case 'name': return 'Name is required';
        case 'quantity': return 'Please select a valid quantity';
        case 'ticketTypeId': return 'Please select a ticket type';
        case 'eventId': return 'Invalid event';
        default: return e.message.charAt(0).toUpperCase() + e.message.slice(1);
      }
    });
    return res.status(400).json({ error: messages[0], errors: messages });
  }

  const status = err.status || err.statusCode || 500;
  const isClientError = status >= 400 && status < 500;
  const message = isClientError
    ? (err.message || 'Bad request')
    : (process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : err.message || 'Internal server error');
  res.status(status).json({ error: message });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler };
