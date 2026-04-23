const { NFC } = require('nfc-pcsc');
const { Server } = require('socket.io');
const readline = require('readline');

const PORT = 4000;
const io = new Server(PORT, {
  cors: { origin: '*' }
});

const nfc = new NFC(); 
let activeReader = null;
let mockMode = false;

console.log(`WebSocket server in ascolto sulla porta ${PORT}`);

io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connesso: ${socket.id}`);

  // Invia stato iniziale
  socket.emit('reader_status', { 
    connected: activeReader !== null || mockMode, 
    name: activeReader ? activeReader.reader.name : (mockMode ? "Simulatore" : null) 
  });

  socket.on('beep', async (data) => {
    console.log('[WebSocket] Ricevuto comando BEEP');
    if (mockMode) {
      console.log(`[Mock] Beep emesso!`);
      return;
    }
    if (activeReader) {
      try {
        let reps = data?.type === 'error' ? 0x03 : 0x01;
        const apdu = Buffer.from([0xFF, 0x00, 0x40, 0x00, 0x04, 0x02, 0x01, 0x01, reps]);
        await activeReader.transmit(apdu, 40);
        console.log(`[NFC] Beep emesso (${reps} volte)`);
      } catch (err) {
        console.error('[NFC] Errore emissione beep:', err);
      }
    } else {
      console.log('[NFC] Nessun lettore connesso per il beep.');
    }
  });

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnesso: ${socket.id}`);
  });
});

nfc.on('reader', reader => {
  console.log(`[NFC] Lettore rilevato: ${reader.reader.name}`);
  activeReader = reader;
  if (!mockMode) io.emit('reader_status', { connected: true, name: reader.reader.name });

  reader.on('card', card => {
    console.log(`[NFC] Carta rilevata, UID: ${card.uid}`);
    if (!mockMode) io.emit('nfc_read', { uid: card.uid });
  });

  reader.on('card.off', card => {
    console.log(`[NFC] Carta rimossa: ${card.uid}`);
  });

  reader.on('error', err => {
    console.error(`[NFC] Errore lettore:`, err);
  });

  reader.on('end', () => {
    console.log(`[NFC] Lettore disconnesso: ${reader.reader.name}`);
    if (activeReader && activeReader.reader.name === reader.reader.name) {
      activeReader = null;
    }
    if (!mockMode) io.emit('reader_status', { connected: false });
  });
});

nfc.on('error', err => {
  console.error('[NFC] Errore generale NFC:', err.message);
});

// --- Mock Mode ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Premi "m" e poi INVIO per attivare/disattivare la MODALITÀ MOCK (simulatore)');

rl.on('line', (line) => {
  const input = line.trim();
  if (input.toLowerCase() === 'm') {
    mockMode = !mockMode;
    console.log(`\n>>> MODALITÀ MOCK: ${mockMode ? 'ATTIVA' : 'DISATTIVA'}`);
    io.emit('reader_status', { 
      connected: mockMode || activeReader !== null, 
      name: mockMode ? "Simulatore" : (activeReader?.reader.name || null) 
    });
    if (mockMode) {
      console.log('In modalità MOCK, scrivi un UID (es. 04b2c3d4e5f6g7) e premi INVIO per simulare una lettura.');
    }
    return;
  }

  if (mockMode && input.length > 0) {
    console.log(`[Mock] Simulo lettura carta con UID: ${input}`);
    io.emit('nfc_read', { uid: input });
  }
});
