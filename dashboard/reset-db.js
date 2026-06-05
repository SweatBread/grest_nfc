import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Carica e parsa manualmente il file .env della dashboard
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.error(`ERRORE: File .env non trovato in: ${envPath}`);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    // Rimuovi eventuali virgolette
    value = value.replace(/(^['"]|['"]$)/g, '').trim();
    env[key] = value;
  }
});

// Configura Firebase
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Funzione di eliminazione di tutti i record nelle collezioni
async function resetDatabase() {
  console.log("\n[Firestore] Avvio del reset del database...");
  
  const collections = ["utenti", "timbrature"];
  
  for (const colName of collections) {
    console.log(`\nCancellazione della collezione: "${colName}"...`);
    try {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      
      if (snapshot.empty) {
        console.log(`La collezione "${colName}" è già vuota.`);
        continue;
      }
      
      let count = 0;
      // Cancella ogni documento uno per uno
      for (const document of snapshot.docs) {
        await deleteDoc(doc(db, colName, document.id));
        count++;
      }
      console.log(`Eliminati con successo ${count} documenti dalla collezione "${colName}".`);
    } catch (err) {
      console.error(`Errore durante la cancellazione di "${colName}":`, err.message);
    }
  }
  
  console.log("\n[Firestore] Reset del database completato con successo!");
  process.exit(0);
}

// Prompt di sicurezza interattivo
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("==========================================================");
console.log("   ATTENZIONE: RIPRISTINO DEL DATABASE DI TIMBRATURA   ");
console.log("==========================================================");
rl.question("Questa azione cancellerà DEFINITIVAMENTE tutti gli utenti e tutte le timbrature su Firestore.\nSei sicuro di voler procedere? (s/N): ", (answer) => {
  const confirmation = answer.trim().toLowerCase();
  if (confirmation === 's' || confirmation === 'si') {
    resetDatabase();
  } else {
    console.log("\nOperazione annullata. Nessun dato è stato cancellato.");
    process.exit(0);
  }
});
