const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  jidNormalizedUser,
  proto,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

const AUTH_DIR = path.join(__dirname, '..', '.auth');
const logger = pino({ level: 'silent' });

class WhatsAppClient extends EventEmitter {
  constructor() {
    super();
    this.sock = null;
    this.isReady = false;
    this.qrCode = null;
    this.store = makeInMemoryStore({ logger });
  }

  async connect() {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: true,
      browser: ['WhatsApp Tool', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: false,
    });

    this.store.bind(this.sock.ev);

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCode = qr;
        this.isReady = false;
        this.emit('qr', qr);
      }

      if (connection === 'open') {
        this.isReady = true;
        this.qrCode = null;
        this.emit('ready');
        console.log('WhatsApp connected successfully');
      }

      if (connection === 'close') {
        this.isReady = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log('Connection closed, reconnecting...');
          this.connect();
        } else {
          console.log('Logged out. Delete .auth folder and restart to re-authenticate.');
          this.emit('logout');
        }
      }
    });

    this.sock.ev.on('messages.upsert', (m) => {
      this.emit('message', m);
    });
  }

  /**
   * Send a text message.
   * @param {string} to  Phone number with country code, e.g. "14155552671"
   * @param {string} text  The message body
   */
  async sendText(to, text) {
    this._assertReady();
    const jid = this._toJid(to);
    const result = await this.sock.sendMessage(jid, { text });
    return result;
  }

  /**
   * Send an image message.
   * @param {string} to  Phone number with country code
   * @param {string} imagePath  Absolute or relative path to the image file
   * @param {string} [caption]  Optional caption
   */
  async sendImage(to, imagePath, caption = '') {
    this._assertReady();
    const jid = this._toJid(to);
    const buffer = fs.readFileSync(imagePath);
    const result = await this.sock.sendMessage(jid, {
      image: buffer,
      caption,
    });
    return result;
  }

  /**
   * Send a file/document message.
   * @param {string} to  Phone number with country code
   * @param {string} filePath  Absolute or relative path to the file
   * @param {string} [filename]  Display filename shown in WhatsApp
   */
  async sendFile(to, filePath, filename) {
    this._assertReady();
    const jid = this._toJid(to);
    const buffer = fs.readFileSync(filePath);
    const displayName = filename || path.basename(filePath);
    const result = await this.sock.sendMessage(jid, {
      document: buffer,
      fileName: displayName,
      mimetype: 'application/octet-stream',
    });
    return result;
  }

  /**
   * Send a message to a WhatsApp group by group JID.
   * @param {string} groupJid  e.g. "1234567890-1234@g.us"
   * @param {string} text
   */
  async sendGroupText(groupJid, text) {
    this._assertReady();
    const result = await this.sock.sendMessage(groupJid, { text });
    return result;
  }

  getStatus() {
    return {
      connected: this.isReady,
      hasQR: !!this.qrCode,
      qr: this.qrCode,
    };
  }

  async logout() {
    if (this.sock) {
      await this.sock.logout();
    }
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
    this.isReady = false;
    this.qrCode = null;
  }

  _assertReady() {
    if (!this.isReady) {
      throw new Error('WhatsApp is not connected. Scan the QR code first.');
    }
  }

  _toJid(phone) {
    // Strip any non-digit characters and append @s.whatsapp.net
    const digits = phone.replace(/\D/g, '');
    return `${digits}@s.whatsapp.net`;
  }
}

module.exports = new WhatsAppClient();
