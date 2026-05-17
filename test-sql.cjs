const https = require('https');

const data = JSON.stringify({ sql: "SELECT current_database(), current_user, version()" });

const options = {
  hostname: 'promessometro-brasil.vercel.app',
  path: '/api/sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-cron-secret': '4c216a3a6929424a458062eb1cb03dc3823923d4d9e5580770d5237ba6ff2d59',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();