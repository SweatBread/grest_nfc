# Guida al Deploy Finale - Sistema Check-In NFC Grest

Questa guida spiega passo-passo come configurare Firebase Firestore, compilare l'applicazione sul computer di sviluppo e installare/avviare il tutto sul computer finale con **Windows 7**.

---

## 📋 Indice
1. [Configurazione di Firebase (Firestore)](#1-configurazione-di-firebase-firestore)
2. [Compilazione sul PC di Sviluppo](#2-compilazione-sul-pc-di-sviluppo)
3. [Preparazione del PC Windows 7](#3-preparazione-del-pc-windows-7)
4. [Trasferimento e Primo Avvio](#4-trasferimento-e-primo-avvio)
5. [Pulizia dei Dati di Test](#5-pulizia-dei-dati-di-test)

---

## 1. Configurazione di Firebase (Firestore)

Il sistema memorizza i dati su Google Cloud Firebase. Per farlo funzionare con i tuoi dati reali, devi configurare il tuo database.

### A. Creazione del Progetto
1. Accedi alla [Firebase Console](https://console.firebase.google.com/) con un account Google.
2. Clicca su **Aggiungi progetto** e inserisci un nome (es: `Grest NFC`).
3. Disabilita Google Analytics (opzionale, velocizza la creazione) e clicca su **Crea progetto**.

### B. Creazione del Database Firestore
1. Nel menu a sinistra, clicca su **Build** ➔ **Firestore Database**.
2. Clicca su **Crea database**.
3. Seleziona la **modalità di test** (consente letture e scritture immediate) e la posizione del server più vicina (es: `europe-west3` per l'Europa).
4. Clicca su **Abilita**.

### C. Configurazione delle Regole di Sicurezza
1. Nella pagina di Firestore, seleziona la scheda **Rules** (Regole) in alto.
2. Copia e incolla il contenuto del file [firestore.rules](file:///c:/Users/Fantin%20Jacopo/Desktop/Grest/firestore.rules) che si trova nella cartella principale del progetto:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /utenti/{utenteId} {
         allow read, write: if true;
       }
       match /timbrature/{timbraturaId} {
         allow read, write: if true;
       }
     }
   }
   ```
3. Clicca su **Pubblica** per rendere attive le regole.

### D. Ottenere le Chiavi Web e configurare il file `.env`
1. Clicca sull'icona dell'ingranaggio (Impostazioni progetto) in alto a sinistra ➔ **Impostazioni progetto**.
2. Nella scheda *Generale*, scorri fino in fondo e sotto "Le mie app" clicca sull'icona **Web (`</>`)** per registrare un'applicazione.
3. Inserisci un nome (es: `Grest Dashboard`) e clicca su **Registra l'app**.
4. Firebase mostrerà un oggetto `firebaseConfig`. Copia i valori delle chiavi.
5. Nella cartella del progetto sul tuo PC di sviluppo, apri la cartella `dashboard/` e crea un file chiamato `.env` (puoi copiare ed editare `.env.example`).
6. Incolla i valori nei rispettivi campi:
   ```env
   VITE_FIREBASE_API_KEY=LaTuaApiKeyQui
   VITE_FIREBASE_AUTH_DOMAIN=NomeProgetto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=NomeProgetto
   VITE_FIREBASE_STORAGE_BUCKET=NomeProgetto.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=TuoSenderId
   VITE_FIREBASE_APP_ID=TuoAppId
   VITE_FIREBASE_MEASUREMENT_ID=TuoMeasurementId
   ```

---

## 2. Compilazione sul PC di Sviluppo

Prima di copiare il progetto sul PC Windows 7, dobbiamo compilare il frontend React in file statici pronti all'uso.

1. Apri il terminale nella cartella principale del progetto (`Grest`).
2. Esegui il build statico della dashboard:
   ```bash
   npm run build --prefix dashboard
   ```
   *Questo genererà la cartella `dashboard/dist` con i file HTML/JS/CSS definitivi.*
3. Installa le dipendenze del bridge per l'ambiente di produzione:
   ```bash
   cd nfc-bridge
   npm install --omit=dev
   ```

---

## 3. Preparazione del PC Windows 7

Sul computer del Grest (con Windows 7), esegui queste installazioni preliminari:

1. **Installazione di Node.js (v14.21.3)**:
   * Scarica l'installer per Windows 7: [Node.js v14.21.3 x64 MSI](https://nodejs.org/dist/v14.21.3/node-v14.21.3-x64.msi).
   * Esegui l'installazione standard.
2. **Browser Web**:
   * Assicurati che sia installato **Google Chrome (v109)** o **Firefox ESR (v115)**. Non avviare l'applicazione su Internet Explorer.
3. **Driver Lettore NFC**:
   * Collega il lettore ACR122U al PC.
   * Se Windows Update non installa automaticamente i driver, scarica i driver PC/SC ufficiali dal sito del produttore (ACS): [ACR122U Driver Installer](https://www.acs.com.hk/en/driver/3/acr122u-usb-nfc-reader/).

---

## 4. Trasferimento e Primo Avvio

1. Copia l'intera cartella `Grest` (inclusa la cartella `dashboard/dist` appena compilata) su una chiavetta USB.
2. Incolla la cartella sul desktop o in un percorso a scelta sul PC Windows 7 del Grest.
3. Collega il lettore NFC ACR122U a una porta USB del PC Windows 7.
4. Apri la cartella del progetto e fai doppio clic sul file:
   👉 **`avvia-grest-win7.bat`**
5. Il terminale si avvierà in modalità compatibile, caricherà il lettore NFC tramite l'eseguibile C# e aprirà automaticamente il browser all'indirizzo:
   👉 **`http://localhost:3000`**

---

## 5. Pulizia dei Dati di Test

Se durante lo sviluppo o i test preliminari hai registrato utenti fittizi o timbrature di prova, puoi ripulire completamente il database Firestore per l'avvio ufficiale:

1. Sul PC di sviluppo o direttamente sul PC Windows 7, apri il terminale nella cartella principale del progetto.
2. Esegui il comando:
   ```bash
   npm run reset-db
   ```
3. Digita `s` (o `si`) e premi **INVIO** per confermare la cancellazione.
4. Il database sarà ora vuoto e pronto per la registrazione delle anagrafiche reali degli animatori.
