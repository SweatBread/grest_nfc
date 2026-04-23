# Sistema Check-In/Out NFC Grest

Sistema gestionale "Offline-First" per registrare le presenze del personale di un centro estivo tramite braccialetti NFC. 
L'architettura è divisa in due moduli:
1. **nfc-bridge**: Servizio locale (Node.js) che si interfaccia con il lettore NFC hardware.
2. **dashboard**: Interfaccia Web SPA (React + Vite) per la gestione e la visualizzazione in real-time.

---

## 🛠️ Requisiti di Sistema

- **Node.js** (versione 18+ raccomandata)
- Lettore NFC **ACR122U** collegato via USB.
- Braccialetti NFC (NTAG213 o standard ISO 14443A).
- Strumenti di compilazione C++ (necessari per compilare i driver del lettore NFC in Node.js).

### Installazione dei Build Tools C++ (Solo Windows)
Prima di procedere all'installazione delle dipendenze, devi assicurarti di possedere gli strumenti nativi di compilazione.
Apri PowerShell **come Amministratore** ed esegui:
```powershell
npm install --global windows-build-tools
```
*(In alternativa, puoi scaricare e installare le **Visual Studio Build Tools** dal sito Microsoft, selezionando il pacchetto "Sviluppo di applicazioni desktop con C++").*

---

## 🚀 Setup del Progetto

Il progetto è diviso in due cartelle distinte. Segui i passaggi per configurarle entrambe.

### 1. Configurazione del Ponte Hardware (`/nfc-bridge`)

Questo modulo comunica fisicamente con il lettore ACR122U e trasmette i dati all'interfaccia web tramite WebSocket.

1. Apri un terminale e naviga nella cartella:
   ```bash
   cd nfc-bridge
   ```
2. Installa le dipendenze:
   ```bash
   npm install
   ```
   *(Nota: l'installazione potrebbe richiedere qualche minuto a causa della compilazione dei moduli C++ di `pcsclite`)*.

### 2. Configurazione della Dashboard (`/dashboard`)

Questo modulo è l'interfaccia utente web con persistenza offline.

1. Apri un **nuovo** terminale e naviga nella cartella:
   ```bash
   cd dashboard
   ```
2. Installa le dipendenze:
   ```bash
   npm install
   ```
3. **Configura Firebase:** 
   - Vai sul sito di [Firebase Console](https://console.firebase.google.com/) e crea un progetto.
   - Crea un database **Firestore**.
   - Ottieni le chiavi di configurazione web andando nelle impostazioni del progetto.
   - Apri il file `dashboard/src/firebase.js` e incolla le tue chiavi all'interno dell'oggetto `firebaseConfig`.

---

## 🏃‍♂️ Come Avviare il Sistema

Per far funzionare il tutto, non hai più bisogno di due terminali separati! Grazie allo script centralizzato, ti basta un solo comando.

Apri un terminale nella cartella principale (`Grest`) ed esegui:
```bash
npm start
```

*Cosa succede ora:*
1. Il terminale avvierà sia il **Bridge NFC** (con etichetta blu) che l'**Interfaccia Web** (con etichetta verde) contemporaneamente nello stesso pannello.
2. L'interfaccia si aprirà nel browser (di solito all'indirizzo `http://localhost:5173`). 
3. Il pallino "Stato Lettore" nella barra laterale diventerà **verde** per confermare la connessione avvenuta con successo.

### 🧪 Modalità Simulatore (Test Senza Hardware)
Se non hai ancora il lettore ACR122U a disposizione, puoi simulare le timbrature via terminale:
1. Con l'`nfc-bridge` in esecuzione (Terminale 1), clicca all'interno della finestra del terminale.
2. Digita la lettera `m` e premi **INVIO**. Questo attiverà la "Modalità Mock", e sulla dashboard lo stato passerà a "Simulatore".
3. Digita un codice esadecimale a piacere (es. `041234567890AB`) e premi **INVIO** per far credere al sistema di aver appena letto quel braccialetto NFC.

---

## 💡 Utilizzo e Logica di Business

- **Offline-First**: La dashboard web utilizza il database interno del browser (`IndexedDB`). Se la connessione Wi-Fi dovesse interrompersi temporaneamente, puoi continuare a timbrare tranquillamente. Le timbrature verranno salvate in memoria e spinte su Firebase non appena la connessione tornerà disponibile.
- **Associazione Staff**: Entra nella sezione "Anagrafica Utenti", clicca su "Nuovo Utente" e compila i dati. Poi clicca su "Associa Tag" e avvicina un nuovo braccialetto al lettore: il sistema ne capterà l'UID e lo legherà istantaneamente all'animatore.
- **Timbratura Entrata/Uscita**: Lasciando aperta la schermata "Dashboard", chiunque appoggi il braccialetto sul lettore ACR122U verrà riconosciuto e registrato. Il sistema calcola in autonomia se si tratta di un'entrata o di un'uscita valutando lo stato precedente, e fa emettere al lettore un bip acustico in caso di successo.
