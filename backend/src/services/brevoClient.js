const https = require('https');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_HOST = 'api.brevo.com';
const BREVO_API_VERSION = 'v3';

if (!BREVO_API_KEY) {
  console.warn('[WARNING] BREVO_API_KEY is not set. Email and SMS notifications will not be sent.');
}

async function makeBrevoRequest(method, endpoint, payload) {
  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY not configured');
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: BREVO_API_HOST,
      path: `/${BREVO_API_VERSION}${endpoint}`,
      method: method,
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`Brevo API error: ${res.statusCode} ${response.message || 'Unknown error'}`));
          } else {
            resolve({ statusCode: res.statusCode, data: response });
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (payload) {
      req.write(JSON.stringify(payload));
    }

    req.end();
  });
}

async function sendEmail(to, subject, htmlContent, textContent, senderEmail = null, senderName = null) {
  const payload = {
    to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
    subject: subject,
    htmlContent: htmlContent,
    textContent: textContent,
  };

  if (senderEmail) {
    payload.sender = {
      email: senderEmail,
      name: senderName || 'Simple Feedback',
    };
  }

  try {
    const result = await makeBrevoRequest('POST', '/smtp/email', payload);
    return {
      success: true,
      messageId: result.data.messageId,
      statusCode: result.statusCode,
    };
  } catch (error) {
    throw new Error(`Failed to send email via Brevo: ${error.message}`);
  }
}

async function sendSMS(phoneNumber, message) {
  const payload = {
    to: phoneNumber,
    content: message,
    type: 'marketing', // or 'transactional' for important notifications
  };

  try {
    const result = await makeBrevoRequest('POST', '/transactionalSMS/sms/send', payload);
    return {
      success: true,
      reference: result.data.reference,
      statusCode: result.statusCode,
    };
  } catch (error) {
    throw new Error(`Failed to send SMS via Brevo: ${error.message}`);
  }
}

module.exports = {
  sendEmail,
  sendSMS,
};
