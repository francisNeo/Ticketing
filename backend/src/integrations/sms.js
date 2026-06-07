const axios = require('axios');

async function sendSms(to, message) {
  const provider = process.env.SMS_PROVIDER || 'africastalking';

  if (provider === 'africastalking') {
    return sendViaAfricasTalking(to, message);
  }
  if (provider === 'twilio') {
    return sendViaTwilio(to, message);
  }
  throw new Error(`Unknown SMS_PROVIDER: ${provider}`);
}

async function sendViaAfricasTalking(to, message) {
  const username = process.env.SMS_USERNAME || 'sandbox';
  const apiKey = process.env.SMS_API_KEY;
  const from = process.env.SMS_SENDER_ID;

  // Sandbox uses sandbox.africastalking.com
  const baseUrl =
    username === 'sandbox'
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';

  const params = new URLSearchParams({ username, to, message });
  if (from) params.append('from', from);

  const { data } = await axios.post(baseUrl, params.toString(), {
    headers: {
      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
  });

  return data;
}

async function sendViaTwilio(to, message) {
  const accountSid = process.env.SMS_USERNAME;
  const authToken = process.env.SMS_API_KEY;
  const from = process.env.SMS_SENDER_ID;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: from, Body: message });

  const { data } = await axios.post(url, params.toString(), {
    auth: { username: accountSid, password: authToken },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return data;
}

module.exports = { sendSms };
