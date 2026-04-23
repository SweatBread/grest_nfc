# NFC Bridge (Ponte Hardware)

Questo script Node.js si occupa di interfacciarsi con il lettore NFC (ACR122U) e di inviare le letture al frontend tramite WebSocket.

## Requisiti e Installazione (IMPORTANTE)

Il modulo `nfc-pcsc` utilizza librerie native C++ (tramite `pcsclite`). Pertanto, è **necessario** installare gli strumenti di compilazione prima di eseguire `npm install`.

### Su Windows (Installazione Build Tools)

Apri PowerShell **come Amministratore** ed esegui:
```powershell
npm install --global windows-build-tools
```
*(In alternativa, installa **Visual Studio Build Tools** con il workload "Desktop development with C++").*

### Su macOS
Installa gli strumenti a riga di comando di Xcode:
```bash
xcode-select --install
```

### Su Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install build-essential libpcsclite-dev
```

## Setup del Progetto

1. Assicurati di aver installato i build tools come descritto sopra.
2. Esegui `npm install` all'interno di questa cartella (`/nfc-bridge`).
3. Avvia il server con `npm start` (o `node index.js`).

## Funzionamento
- Il server WebSocket si avvia sulla porta `4000` (`ws://localhost:4000`).
- Eventi in uscita:
  - `reader_status`: `{ connected: boolean, name: string }`
  - `nfc_read`: `{ uid: string }`
- Eventi in ingresso:
  - `beep`: `{ type: 'success' | 'error' }` (fa suonare il lettore ACR122U).
