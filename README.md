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
   - Copia il file `.env.example` in un nuovo file chiamato `.env` (nella stessa cartella `dashboard/`):
     ```bash
     cp .env.example .env
     ```
   - Apri il file `.env` e incolla le chiavi del tuo progetto Firebase nei rispettivi campi.

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
Se non hai ancora il lettore ACR122U a disposizione, puoi testare l'intero sistema in modalità simulazione avviandolo con questo comando dalla cartella principale (`Grest`):
```bash
npm run simula
```
Questo script avvierà sia la dashboard web che il bridge hardware forzando la "Modalità Mock".
Per simulare una timbratura:
1. Clicca all'interno della finestra del terminale.
2. Digita un codice esadecimale a piacere (es. `041234567890AB`) e premi **INVIO** per far credere al sistema di aver appena letto quel braccialetto NFC sulla dashboard!

---

### 💻 Esecuzione su Windows 7 (Modalità Compatibilità)
Se devi far girare il sistema su un PC con **Windows 7** (o su macchine senza strumenti di compilazione C++), segui questa procedura:
1. Installa **Node.js v14.21.3** sul computer Windows 7 (impostando `NODE_SKIP_PLATFORM_CHECK=1` per consentire l'avvio).
2. Assicurati che sul computer sia installato un browser moderno come **Google Chrome v109** o **Firefox ESR v115** (le ultime versioni che supportano Windows 7). Non usare Internet Explorer.
3. Assicurati che il frontend sia stato compilato in precedenza sulla tua macchina di sviluppo con `npm run build --prefix dashboard`.
4. Avvia il server dalla cartella principale del progetto con il comando:
   ```bash
   npm run start:win7
   ```
   *Cosa succede:*
   * Il sistema si avvia configurando il bypass del controllo della piattaforma.
   * Rilevando l'assenza del driver nativo `nfc-pcsc`, Node.js avvierà automaticamente il bridge di compatibilità C# pre-compilato `nfc-reader-win7.exe` in background.
   * Verrà avviato un server HTTP statico che renderà la dashboard disponibile all'indirizzo: 👉 **`http://localhost:3000`**

---

## 🧹 Reset del Database (Preparazione per Dati Reali)

Quando sarai pronto per iniziare a registrare i dati reali del Grest e vorrai ripulire tutti i dati di test/simulazione accumulati sul database Firestore:
1. Apri un terminale nella cartella principale del progetto.
2. Esegui il comando:
   ```bash
   npm run reset-db
   ```
3. Il terminale mostrerà un prompt di sicurezza interattivo. Digita `s` (o `si`) e premi **INVIO** per confermare.
4. Lo script eliminerà definitivamente tutti gli utenti e tutti i log delle timbrature da Firestore.

---

## 💡 Utilizzo e Logica di Business

- **Offline-First**: La dashboard web utilizza il database interno del browser (`IndexedDB`). Se la connessione Wi-Fi dovesse interrompersi temporaneamente, puoi continuare a timbrare tranquillamente. Le timbrature verranno salvate in memoria e spinte su Firebase non appena la connessione tornerà disponibile.
- **Associazione Staff**: Entra nella sezione "Anagrafica Utenti", clicca su "Nuovo Utente" e compila i dati. Poi clicca su "Associa Tag" e avvicina un nuovo braccialetto al lettore: il sistema ne capterà l'UID e lo legherà istantaneamente all'animatore.
- **Timbratura Entrata/Uscita**: Lasciando aperta la schermata "Dashboard", chiunque appoggi il braccialetto sul lettore ACR122U verrà riconosciuto e registrato. Il sistema calcola in autonomia se si tratta di un'entrata o di un'uscita valutando lo stato precedente, e fa emettere al lettore un bip acustico in caso di successo.

---

## 📖 Specifiche Tecniche e Architettura

Per una descrizione dettagliata del database utilizzato (Firestore), dello schema delle collezioni, delle API WebSocket e del funzionamento a basso livello dell'hardware NFC, consulta il documento dedicato:
*   [Specifiche Tecniche](file:///c:/Users/Fantin%20Jacopo/Desktop/Grest/SPECIFICHE_TECNICHE.md)

