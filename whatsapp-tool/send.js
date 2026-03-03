#!/usr/bin/env node
/**
 * CLI helper — send a WhatsApp message by calling the running API server.
 *
 * Usage:
 *   node send.js <phone> <message>
 *   node send.js 14155552671 "Hello from CLI!"
 *
 * Environment variables:
 *   WA_API_URL   — server URL  (default: http://localhost:3000)
 *   API_KEY      — API key if configured on the server
 */

const http = require('http');
const https = require('https');
const url = require('url');

const [,, to, ...msgParts] = process.argv;
const message = msgParts.join(' ');

if (!to || !message) {
  console.error('Usage: node send.js <phone> <message>');
  console.error('Example: node send.js 14155552671 "Hello!"');
  process.exit(1);
}

const baseUrl = process.env.WA_API_URL || 'http://localhost:3000';
const apiKey = process.env.API_KEY || '';

const parsed = url.parse(`${baseUrl}/api/send/text`);
const body = JSON.stringify({ to, message });

const options = {
  hostname: parsed.hostname,
  port: parsed.port,
  path: parsed.path,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
  },
};

const transport = parsed.protocol === 'https:' ? https : http;

const req = transport.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.ok) {
        console.log(`Message sent! ID: ${json.messageId}`);
      } else {
        console.error('Error:', json.error);
        process.exit(1);
      }
    } catch {
      console.error('Unexpected response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('Request failed:', err.message);
  console.error('Is the server running? Start it with: node index.js');
  process.exit(1);
});

req.write(body);
req.end();
