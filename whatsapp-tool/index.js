require('dotenv').config();
const app = require('./src/server');
const whatsapp = require('./src/whatsapp');

const PORT = process.env.PORT || 3000;

async function main() {
  console.log('Starting WhatsApp tool...');
  console.log('Connecting to WhatsApp — scan the QR code in your terminal...\n');

  whatsapp.on('qr', () => {
    console.log('\nScan the QR code above with WhatsApp on your phone:');
    console.log('  Phone → Linked Devices → Link a Device\n');
  });

  whatsapp.on('ready', () => {
    console.log('\nWhatsApp is connected and ready!');
    console.log(`API server listening on http://localhost:${PORT}`);
    console.log('\nEndpoints:');
    console.log('  GET  /status              — connection status');
    console.log('  POST /api/send/text       — send a text message');
    console.log('  POST /api/send/image      — send an image');
    console.log('  POST /api/send/file       — send a file/document');
    console.log('  POST /api/send/group      — send a message to a group');
    console.log('  POST /api/logout          — log out & clear session\n');
  });

  whatsapp.on('logout', () => {
    console.log('Session ended. Restart the server to re-authenticate.');
    process.exit(0);
  });

  await whatsapp.connect();

  app.listen(PORT, () => {
    // Server starts immediately; WhatsApp connection is async
    if (!whatsapp.isReady) {
      console.log(`API server listening on http://localhost:${PORT} (waiting for WhatsApp auth...)`);
    }
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
