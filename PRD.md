📋 Prompt di Sviluppo: Sistema di Check-in NFC "Offline-First" per Centro Estivo
Contesto del Progetto:
Devi sviluppare un sistema gestionale "Offline-First" per registrare le presenze del personale (animatori) di un centro estivo tramite braccialetti NFC. Il sistema deve funzionare sempre, anche in assenza temporanea di connessione internet, sincronizzando i dati in cloud appena possibile. La sicurezza e la minimizzazione dei dati (GDPR) sono prioritarie.

1. Architettura e Stack Tecnologico
Il sistema è diviso in due componenti principali che comunicano in locale:

Ponte Hardware (Backend Locale): Uno script Node.js che gira in background sul PC.

Hardware supportato: Lettore NFC USB ACR122U.

Librerie richieste: nfc-pcsc (per leggere i tag NTAG213 in standard ISO 14443A) e socket.io (per esporre un server WebSocket su localhost).

Interfaccia Utente (Frontend Web App): Una Single Page Application (SPA) aperta nel browser del PC.

Framework: React (con Vite) o Vanilla JS (a discrezione dell'AI, privilegiare la velocità e pulizia del codice).

Stile: Tailwind CSS (interfaccia pulita, dashboard amministrativa).

Comunicazione: Client socket.io-client per ricevere in tempo reale l'UID del braccialetto dallo script Node.js.

Database Cloud (BaaS): Firebase (Google Cloud).

Servizio: Firestore con Offline Persistence attivata obbligatoriamente (enableIndexedDbPersistence).

2. Struttura del Database (Firestore)
Per rispettare la minimizzazione dei dati legata al GDPR, la struttura deve essere essenziale. Nessun dato medico o sensibile deve essere gestito dal sistema.

Collezione utenti (Animatori)

id (String, generato da Firestore)

nome (String)

cognome (String)

ruolo (String: enum "Responsabile", "Animatore", "Aiuto-Animatore")

nfc_uid (String, nullable: es. "04:A1:B2:C3:D4:E5:F6". Deve essere UNIVOCO)

stato (String: enum "attivo", "archiviato" - Soft delete per mantenere lo storico)

Collezione timbrature (Presenze)

id (String)

utente_id (String, riferimento all'utente)

timestamp (Timestamp, data e ora esatta)

tipo (String: enum "ENTRATA", "USCITA")

metodo (String: enum "NFC", "MANUALE")

3. Logica di Funzionamento (Flusso dei Dati)
Lettura NFC: Il lettore ACR122U legge un braccialetto. Lo script Node.js estrae l'UID esadecimale e lo invia istantaneamente all'interfaccia React tramite WebSocket.

Ricezione UI: L'interfaccia React riceve l'UID e verifica lo stato dell'app:

Se in "Modalità Associazione" (Pulsante cliccato su un utente): Salva l'UID nel documento dell'utente su Firestore.

Se in "Modalità Normale" (Check-in/out): Cerca l'UID nel database. Se lo trova, controlla l'ultima timbratura di quell'utente in quella giornata. Se non c'è, registra "ENTRATA". Se l'ultima era un'entrata, registra "USCITA".

Feedback: Al successo dell'operazione su Firestore, l'interfaccia web invia un comando WebSocket a Node.js per far emettere al lettore ACR122U un Beep acustico di conferma (tramite comando APDU).

4. Funzionalità dell'Interfaccia Utente (Dashboard React)
L'interfaccia deve avere un layout a singola pagina con le seguenti sezioni:

Pannello "Presenze Attuali": Un contatore in tempo reale che mostra il numero totale e i nomi delle persone attualmente all'interno della struttura (ultima timbratura = ENTRATA).

Gestione Anagrafica (Lista Utenti):

Form per creare un nuovo utente (Nome, Cognome, Ruolo).

Tabella/Lista degli utenti attivi con barra di ricerca e filtri per ruolo.

Accanto a ogni utente, un pulsante "Associa Braccialetto" (che mette il sistema in ascolto del prossimo tap NFC). Se l'utente ha già un braccialetto, il pulsante diventa "Scollega Braccialetto".

Pulsante per la "Timbratura Manuale" (per registrare entrata/uscita se l'animatore ha dimenticato il braccialetto).

Pulsante per archiviare l'utente (Soft Delete).

Registro Storico (Log): Una tabella visuale per vedere gli ultimi movimenti della giornata (Chi, Ora, Entrata/Uscita).

Indicatore di Stato: Un piccolo badge nella UI che mostra lo stato di connessione del WebSocket (es. "Lettore Connesso/Disconnesso") e lo stato di Firebase (es. "Online" o "Modalità Offline").

5. Istruzioni Tecniche per l'AI
Struttura del Codice: Separa chiaramente il codice in due cartelle: /nfc-bridge (il progetto Node.js) e /dashboard (il progetto frontend).

Gestione Errori: Gestisci con attenzione i log di errore nel ponte Node.js (es. lettore disconnesso brutalmente dall'USB).

Inizializzazione: Fornisci istruzioni precise nel README.md su come installare le dipendenze native di nfc-pcsc (spesso richiede strumenti di build su Windows/Mac).

Firebase Rules: Genera anche le regole di sicurezza di Firestore (Security Rules) per chiudere il database e permettere l'accesso solo in modalità autenticata o limitata.