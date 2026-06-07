const axios = require('axios');

const SANDBOX_BASE = 'https://sandbox.safaricom.co.ke';
const PROD_BASE = 'https://api.safaricom.co.ke';

function getBase() {
  return process.env.MPESA_ENV === 'production' ? PROD_BASE : SANDBOX_BASE;
}

async function getAccessToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');

  const { data } = await axios.get(
    `${getBase()}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );

  return data.access_token;
}

function getTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14);
}

function getPassword(timestamp) {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

async function initiateStkPush({ phone, amount, accountReference, transactionDesc }) {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const shortcode = process.env.MPESA_SHORTCODE;

  const payload = {
    BusinessShortCode: shortcode,
    Password: getPassword(timestamp),
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  const { data } = await axios.post(
    `${getBase()}/mpesa/stkpush/v1/processrequest`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return data; // { CheckoutRequestID, ResponseCode, CustomerMessage, ... }
}

// B2C — used for refunds to organiser's M-PESA
async function initiateB2c({ phone, amount, occasion, remarks }) {
  const token = await getAccessToken();

  const payload = {
    InitiatorName: process.env.MPESA_INITIATOR_NAME,
    SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
    CommandID: 'BusinessPayment',
    Amount: Math.round(amount),
    PartyA: process.env.MPESA_SHORTCODE,
    PartyB: phone,
    Remarks: remarks || 'Bundle refund',
    QueueTimeOutURL: process.env.MPESA_CALLBACK_URL.replace('/callback', '/b2c/timeout'),
    ResultURL: process.env.MPESA_CALLBACK_URL.replace('/callback', '/b2c/result'),
    Occasion: occasion || '',
  };

  const { data } = await axios.post(
    `${getBase()}/mpesa/b2c/v1/paymentrequest`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return data;
}

module.exports = { initiateStkPush, initiateB2c, getAccessToken };
