import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:4000";

class NfcService {
  constructor() {
    this.socket = io(SOCKET_URL, { autoConnect: false });
  }

  connect() {
    this.socket.connect();
    this.socket.on('connect', () => console.log('Connesso al bridge NFC locale'));
  }

  disconnect() {
    this.socket.disconnect();
  }

  onReaderStatus(callback) {
    this.socket.on('reader_status', callback);
  }

  onNfcRead(callback) {
    this.socket.on('nfc_read', callback);
  }

  sendBeep(type = 'success') {
    this.socket.emit('beep', { type });
  }

  removeListeners() {
    this.socket.off('reader_status');
    this.socket.off('nfc_read');
  }
}

export const nfcService = new NfcService();
