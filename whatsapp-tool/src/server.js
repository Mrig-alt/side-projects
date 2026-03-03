const express = require('express');
const path = require('path');
const fs = require('fs');
const whatsapp = require('./whatsapp');

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY;

// --- Auth middleware (optional but recommended) ---
function authMiddleware(req, res, next) {
  if (!API_KEY) return next(); // No key configured → open access (local use)
  const provided = req.headers['x-api-key'] || req.query.api_key;
  if (provided !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}

app.use('/api', authMiddleware);

// ─────────────────────────────────────────────────────────────
// GET /status  — connection status + QR code (as text)
// ─────────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json(whatsapp.getStatus());
});

// ─────────────────────────────────────────────────────────────
// POST /api/send/text  — send a plain text message
//
// Body: { "to": "14155552671", "message": "Hello!" }
// ─────────────────────────────────────────────────────────────
app.post('/api/send/text', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: '`to` and `message` are required' });
  }
  try {
    const result = await whatsapp.sendText(to, message);
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/send/image  — send an image
//
// Body: { "to": "14155552671", "imagePath": "/abs/path/img.png", "caption": "optional" }
// ─────────────────────────────────────────────────────────────
app.post('/api/send/image', async (req, res) => {
  const { to, imagePath, caption } = req.body;
  if (!to || !imagePath) {
    return res.status(400).json({ error: '`to` and `imagePath` are required' });
  }
  if (!fs.existsSync(imagePath)) {
    return res.status(400).json({ error: `File not found: ${imagePath}` });
  }
  try {
    const result = await whatsapp.sendImage(to, imagePath, caption || '');
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/send/file  — send a document/file
//
// Body: { "to": "14155552671", "filePath": "/abs/path/report.pdf", "filename": "optional display name" }
// ─────────────────────────────────────────────────────────────
app.post('/api/send/file', async (req, res) => {
  const { to, filePath, filename } = req.body;
  if (!to || !filePath) {
    return res.status(400).json({ error: '`to` and `filePath` are required' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(400).json({ error: `File not found: ${filePath}` });
  }
  try {
    const result = await whatsapp.sendFile(to, filePath, filename);
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/send/group  — send a text to a group
//
// Body: { "groupJid": "1234567890-1234@g.us", "message": "Hello group!" }
// ─────────────────────────────────────────────────────────────
app.post('/api/send/group', async (req, res) => {
  const { groupJid, message } = req.body;
  if (!groupJid || !message) {
    return res.status(400).json({ error: '`groupJid` and `message` are required' });
  }
  try {
    const result = await whatsapp.sendGroupText(groupJid, message);
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/logout  — log out and clear saved session
// ─────────────────────────────────────────────────────────────
app.post('/api/logout', async (req, res) => {
  try {
    await whatsapp.logout();
    res.json({ ok: true, message: 'Logged out. Restart the server to re-authenticate.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
