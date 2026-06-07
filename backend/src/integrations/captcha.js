const axios = require('axios');

const VERIFY_URLS = {
  hcaptcha: 'https://api.hcaptcha.com/siteverify',
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
};

async function verifyCaptcha(token, remoteip) {
  const provider = process.env.CAPTCHA_PROVIDER || 'hcaptcha';
  const secret = process.env.CAPTCHA_SECRET_KEY;
  const url = VERIFY_URLS[provider];

  if (!url) throw new Error(`Unknown CAPTCHA_PROVIDER: ${provider}`);

  const params = new URLSearchParams({ secret, response: token });
  if (remoteip) params.append('remoteip', remoteip);

  const { data } = await axios.post(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  // reCAPTCHA v3 uses score; hCaptcha and Turnstile use success boolean
  if (provider === 'recaptcha' && data.success) {
    return { success: data.score >= 0.5, score: data.score };
  }

  return { success: !!data.success };
}

module.exports = { verifyCaptcha };
