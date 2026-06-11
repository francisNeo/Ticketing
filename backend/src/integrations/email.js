const nodemailer = require('nodemailer');

// Singleton transporter — avoids creating a new SMTP connection pool on every email
const transporter = process.env.SENDGRID_API_KEY
  ? nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY },
    })
  : nodemailer.createTransport({
      // Ethereal fallback for local dev — logs preview URL to console
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

// Escape user-controlled values before embedding in HTML to prevent HTML injection
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendEmail({ to, subject, html, text }) {
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  if (process.env.NODE_ENV !== 'production') {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('Email preview:', previewUrl);
  }

  return info;
}

async function sendBookingConfirmation({ to, name, eventTitle, eventDate, qrCodeUrl, ticketId }) {
  const subject = `Your ticket for ${esc(eventTitle)} — Booking Confirmed`;
  const html = `
    <h2>You're going to ${esc(eventTitle)}!</h2>
    <p>Hi ${esc(name)},</p>
    <p>Your registration is confirmed. Here are your ticket details:</p>
    <ul>
      <li><strong>Event:</strong> ${esc(eventTitle)}</li>
      <li><strong>Date:</strong> ${esc(eventDate)}</li>
      <li><strong>Ticket ID:</strong> ${esc(ticketId)}</li>
    </ul>
    ${qrCodeUrl ? `<p>Scan the QR code at the entrance:</p><img src="${esc(qrCodeUrl)}" alt="QR Code" style="width:200px"/>` : ''}
    <p>Powered by EventHub</p>
  `;
  return sendEmail({ to, subject, html });
}

async function sendPasswordResetOtp({ to, otp }) {
  const subject = 'Reset your EventHub password';
  const html = `
    <h2>Password Reset</h2>
    <p>Your one-time code is: <strong style="font-size:24px">${otp}</strong></p>
    <p>This code expires in 10 minutes. If you didn't request a reset, ignore this email.</p>
  `;
  return sendEmail({ to, subject, html });
}

async function sendRefundConfirmation({ to, name, eventTitle, amount }) {
  const subject = `Refund processed — ${esc(eventTitle)}`;
  const html = `
    <h2>Refund Confirmation</h2>
    <p>Hi ${esc(name)}, your refund of KES ${esc(amount)} for <strong>${esc(eventTitle)}</strong> has been processed.</p>
    <p>Card refunds take 3–5 business days. M-PESA refunds arrive within minutes.</p>
  `;
  return sendEmail({ to, subject, html });
}

module.exports = { sendEmail, sendBookingConfirmation, sendPasswordResetOtp, sendRefundConfirmation };
