const https = require('https');

const NTFY_HOST = 'ntfy.sh';

async function sendNotification(topic, title, message, tags = [], priority = 'default', click = null) {
  if (!topic || typeof topic !== 'string') {
    throw new Error('Topic is required and must be a string');
  }

  // Validate topic: alphanumeric, dash, underscore only
  if (!/^[a-zA-Z0-9_-]+$/.test(topic)) {
    throw new Error(`Invalid topic format: ${topic}. Must contain only alphanumeric characters, dashes, and underscores.`);
  }

  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (title) headers['X-Title'] = title;
    if (priority && priority !== 'default') headers['X-Priority'] = priority;
    if (tags && tags.length > 0) headers['X-Tags'] = tags.join(',');
    if (click) headers['X-Click'] = click;

    const payload = JSON.stringify({ message });

    const options = {
      hostname: NTFY_HOST,
      path: `/${topic}`,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            success: true,
            statusCode: res.statusCode,
            topic: topic,
          });
        } else {
          reject(new Error(`ntfy.sh returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('ntfy.sh request timed out'));
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  sendNotification,
};
