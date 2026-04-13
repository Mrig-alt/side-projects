# whatsapp-tool

A lightweight HTTP API server that lets you send WhatsApp messages from your personal number — no business account or Meta approval needed.

Built with [Baileys](https://github.com/WhiskeySockets/Baileys), which speaks WhatsApp's native multi-device protocol directly.

---

## Quick start

```bash
# 1. Copy the env template
cp .env.example .env

# 2. (Optional) Set an API key in .env to protect the endpoints
# API_KEY=some-secret-key

# 3. Start the server
npm start
```

On first run, a **QR code** is printed in your terminal.

- Open WhatsApp on your phone
- Go to **Settings → Linked Devices → Link a Device**
- Scan the QR code

The session is saved in `.auth/` — subsequent starts reconnect automatically without rescanning.

---

## API reference

All endpoints under `/api/*` require the `x-api-key` header if `API_KEY` is set in `.env`.

### `GET /status`

Check connection state.

```json
{ "connected": true, "hasQR": false, "qr": null }
```

---

### `POST /api/send/text`

Send a plain text message.

**Body:**
```json
{
  "to": "14155552671",
  "message": "Hello from the API!"
}
```

- `to` — phone number with country code, no `+` needed
- `message` — the text to send

**Response:**
```json
{ "ok": true, "messageId": "ABCD1234..." }
```

---

### `POST /api/send/image`

Send an image (with optional caption).

**Body:**
```json
{
  "to": "14155552671",
  "imagePath": "/absolute/path/to/photo.jpg",
  "caption": "Check this out!"
}
```

---

### `POST /api/send/file`

Send any file as a document.

**Body:**
```json
{
  "to": "14155552671",
  "filePath": "/absolute/path/to/report.pdf",
  "filename": "Monthly Report.pdf"
}
```

`filename` is optional — defaults to the file's base name.

---

### `POST /api/send/group`

Send a message to a WhatsApp group.

**Body:**
```json
{
  "groupJid": "1234567890-1234567890@g.us",
  "message": "Hey everyone!"
}
```

> To find a group's JID, add a log in `src/whatsapp.js` to print incoming messages and note the `remoteJid` from a group message.

---

### `POST /api/logout`

Log out and wipe the saved session. The server must be restarted to re-authenticate.

---

## CLI helper

A minimal CLI is included to send a quick text from your terminal without writing any code:

```bash
# Make sure the server is already running (npm start)
node send.js 14155552671 "Hello from the command line!"
```

Set `WA_API_URL` and `API_KEY` env vars if the server runs on a different host:

```bash
WA_API_URL=http://myserver:3000 API_KEY=secret node send.js 14155552671 "Hi!"
```

---

## Calling from other scripts / tools

Any HTTP client works. Examples:

**curl:**
```bash
curl -X POST http://localhost:3000/api/send/text \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret" \
  -d '{"to":"14155552671","message":"Hello!"}'
```

**Python:**
```python
import requests
requests.post("http://localhost:3000/api/send/text",
    json={"to": "14155552671", "message": "Hello from Python!"},
    headers={"x-api-key": "your-secret"})
```

**Node.js:**
```js
const res = await fetch('http://localhost:3000/api/send/text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'your-secret' },
  body: JSON.stringify({ to: '14155552671', message: 'Hello from Node!' }),
});
```

---

## Project structure

```
whatsapp-tool/
├── index.js          # Entry point — starts WA client + HTTP server
├── send.js           # CLI helper
├── src/
│   ├── whatsapp.js   # WhatsApp client (Baileys wrapper)
│   └── server.js     # Express REST API
├── .auth/            # Saved session (auto-created, gitignored)
├── .env.example
└── package.json
```

---

## Notes

- **One linked device:** WhatsApp Web/Baileys counts as one of your linked devices (you can have up to 4).
- **Keep the server running:** messages are only sent while the process is alive. Use `pm2`, `screen`, or a systemd service to keep it up.
- **Session persistence:** the `.auth/` folder stores your session. Back it up if needed, or delete it to log out.
