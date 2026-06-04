const { Server } = require('socket.io');
const readline = require('readline');
const http = require('http');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const PORT = 4000;
const STATIC_PORT = 3000;
const io = new Server(PORT, {
  cors: { origin: '*' }
});

const isMockForced = process.argv.includes('--mock');
let mockMode = isMockForced;
let activeReader = null;
let nfc = null;
let csharpChild = null;

// --- Server HTTP per la Dashboard ---
const PUBLIC_DIR = path.join(__dirname, '../dashboard/dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const staticServer = http.createServer((req, res) => {
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Accesso negato');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.access(filePath, fs.constants.F_OK, (accessErr) => {
      if (accessErr) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Dashboard non trovata</h1><p>Compila prima il frontend con <code>npm run build</code> nella cartella dashboard.</p>');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        res.statusCode = 500;
        res.end('Errore interno del server');
      });
      stream.pipe(res);
    });
  });
});

staticServer.listen(STATIC_PORT, () => {
  console.log(`[HTTP] Dashboard del Grest disponibile su: http://localhost:${STATIC_PORT}`);
});

console.log(`[WebSocket] Server in ascolto sulla porta ${PORT}`);
if (isMockForced) {
  console.log(`[AVVISO] Avviato in modalità SOLO SIMULATORE (--mock). L'hardware NFC è stato disattivato.`);
}

const getReaderName = () => {
  if (activeReader) {
    return activeReader.isCSharp ? activeReader.name : activeReader.reader.name;
  }
  return mockMode ? "Simulatore" : null;
};

io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connesso: ${socket.id}`);

  // Invia stato iniziale
  socket.emit('reader_status', { 
    connected: activeReader !== null || mockMode, 
    name: getReaderName()
  });

  socket.on('beep', async (data) => {
    console.log('[WebSocket] Ricevuto comando BEEP');
    if (mockMode) {
      console.log(`[Mock] Beep emesso!`);
      return;
    }
    
    if (activeReader) {
      if (activeReader.isCSharp) {
        if (csharpChild && csharpChild.stdin.writable) {
          const beepType = data?.type === 'error' ? 'error' : 'success';
          csharpChild.stdin.write(`BEEP:${beepType}\n`);
          console.log(`[C# NFC] Inviato comando BEEP:${beepType}`);
        } else {
          console.warn('[C# NFC] Impossibile emettere beep: processo figlio non scrivibile.');
        }
        return;
      }
      
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

// --- Avvio Bridge C# (Fallback Windows 7) ---
function startCSharpBridge() {
  const exePath = path.join(__dirname, 'bin/nfc-reader-win7.exe');
  if (!fs.existsSync(exePath)) {
    console.error(`[C# NFC] Eseguibile non trovato in: ${exePath}. Compilalo prima!`);
    return;
  }

  console.log(`[C# NFC] Avvio eseguibile C# in background: ${exePath}`);
  csharpChild = child_process.spawn(exePath);

  const childRl = readline.createInterface({
    input: csharpChild.stdout,
    terminal: false
  });

  childRl.on('line', (line) => {
    line = line.trim();
    if (line.startsWith('READER_STATUS:connected:')) {
      const readerName = line.substring('READER_STATUS:connected:'.length);
      console.log(`[C# NFC] Lettore NFC connesso: ${readerName}`);
      activeReader = { isCSharp: true, name: readerName };
      if (!mockMode) io.emit('reader_status', { connected: true, name: readerName });
    } else if (line === 'READER_STATUS:disconnected') {
      console.log(`[C# NFC] Lettore NFC disconnesso`);
      activeReader = null;
      if (!mockMode) io.emit('reader_status', { connected: false });
    } else if (line.startsWith('CARD_DETECTED:')) {
      const uid = line.substring('CARD_DETECTED:'.length);
      console.log(`[C# NFC] Tessera letta, UID: ${uid}`);
      if (!mockMode) io.emit('nfc_read', { uid });
    } else {
      // Altri log di debug dall'eseguibile C#
      console.log(`[C# NFC Log] ${line}`);
    }
  });

  csharpChild.stderr.on('data', (data) => {
    console.error(`[C# NFC Errore] ${data.toString().trim()}`);
  });

  csharpChild.on('error', (err) => {
    console.error('[C# NFC] Errore durante l\'esecuzione del processo figlio C#:', err.message);
  });

  csharpChild.on('close', (code) => {
    console.log(`[C# NFC] Processo C# chiuso con codice ${code}.`);
    activeReader = null;
    csharpChild = null;
    if (!mockMode) io.emit('reader_status', { connected: false });
    
    // Riavvia se l'applicazione non è in fase di spegnimento
    if (!isMockForced) {
      console.log('[C# NFC] Riavvio del bridge C# in corso...');
      setTimeout(startCSharpBridge, 3000);
    }
  });
}

if (!isMockForced) {
  try {
    const { NFC } = require('nfc-pcsc');
    nfc = new NFC();

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
  } catch (err) {
    console.warn("[NFC] Errore critico inizializzazione hardware nativo (nfc-pcsc):", err.message);
    if (process.platform === 'win32') {
      console.log("[NFC] Avvio modalità compatibilità Windows 7 (Bridge C#)...");
      startCSharpBridge();
    } else {
      console.error("[NFC] La modalità di compatibilità C# è supportata solo su Windows.");
    }
  }
}

// --- Mock Mode ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Premi "m" e poi INVIO per attivare/disattivare la MODALITÀ MOCK (simulatore)');

rl.on('line', (line) => {
  const input = line.trim();
  if (input.toLowerCase() === 'm') {
    if (isMockForced) {
      console.log("Sei già in modalità Solo Simulatore fissa.");
      return;
    }
    mockMode = !mockMode;
    console.log(`\n>>> MODALITÀ MOCK: ${mockMode ? 'ATTIVA' : 'DISATTIVA'}`);
    io.emit('reader_status', { 
      connected: mockMode || activeReader !== null, 
      name: mockMode ? "Simulatore" : getReaderName()
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
