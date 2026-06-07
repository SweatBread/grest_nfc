import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  ShieldAlert, 
  BarChart2, 
  Database, 
  HelpCircle, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  FileDown,
  Lock
} from 'lucide-react';

export default function HelpGuide() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'Pannello Accessi', icon: LayoutDashboard, color: 'text-blue-500' },
    { id: 'users', label: 'Anagrafica Utenti', icon: Users, color: 'text-pink-500' },
    { id: 'hours', label: 'Riepilogo Ore', icon: Clock, color: 'text-emerald-500' },
    { id: 'control', label: 'Controllo Timbrature', icon: ShieldAlert, color: 'text-orange-500' },
    { id: 'stats', label: 'Statistiche & Grafici', icon: BarChart2, color: 'text-indigo-500' },
    { id: 'backup', label: 'Backup & Recovery', icon: Database, color: 'text-purple-500' },
    { id: 'faq', label: 'FAQ & Risoluzione Problemi', icon: HelpCircle, color: 'text-teal-500' }
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fadeIn">
      <header className="mb-8">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2.5 rounded-2xl text-blue-600">
            <HelpCircle size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Guida & Supporto</h2>
            <p className="text-gray-500 mt-1">
              Manuale d'uso completo per la gestione delle presenze e delle timbrature NFC del Grest.
            </p>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {/* Sidebar Nav interna alla pagina */}
        <aside className="w-full md:w-64 bg-gray-50 border-r border-gray-100 p-4 space-y-1 flex-shrink-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-3">Sezioni della Guida</p>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive 
                      ? 'bg-white text-blue-600 shadow-sm border border-gray-100/50' 
                      : 'text-gray-650 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={18} className={item.color} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Area Contenuto */}
        <main className="flex-1 p-8 overflow-y-auto">
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-2 pb-3 border-b border-gray-100">
                <LayoutDashboard className="text-blue-500" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Pannello Controllo Accessi (Dashboard)</h3>
              </div>
              <p className="text-gray-650 text-sm leading-relaxed">
                È la pagina principale del sistema, pensata per essere lasciata a schermo sul computer principale all'ingresso del Grest. Consente l'auto-timbratura autonoma da parte dello staff tramite i braccialetti NFC.
              </p>

              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 space-y-3">
                <h4 className="font-bold text-blue-900 text-sm flex items-center space-x-1.5">
                  <Clock size={16} />
                  <span>Come effettuare una Scansione:</span>
                </h4>
                <ol className="list-decimal pl-5 text-gray-700 text-xs space-y-2">
                  <li>L'animatore avvicina il proprio braccialetto NFC alla parte superiore del lettore USB (ACR122U).</li>
                  <li>Il lettore emette un <strong>Beep</strong> acuto per indicare la corretta lettura.</li>
                  <li>Il browser mostrerà un <strong>messaggio a tutto schermo</strong>: di colore <strong>Blu/Verde</strong> per dare il benvenuto (Entrata) o <strong>Arancione/Rosso</strong> per salutare (Uscita).</li>
                  <li>Per evitare letture duplicate accidentali, il lettore si mette in pausa per 5 secondi prima della timbratura successiva.</li>
                </ol>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-gray-800 text-sm">Regole di Rilevamento automatico (Entrata vs Uscita)</h4>
                <p className="text-gray-650 text-xs leading-relaxed">
                  Il sistema determina automaticamente il tipo di accesso senza richiedere all'utente di premere pulsanti:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="border border-gray-150 rounded-xl p-4 bg-gray-50/30">
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Prima scansione del giorno</span>
                    <p className="text-gray-700 font-semibold text-xs mt-2">Registrata come ENTRATA</p>
                    <p className="text-gray-500 text-xs mt-1">Avviene ad esempio la mattina all'inizio delle attività.</p>
                  </div>
                  <div className="border border-gray-150 rounded-xl p-4 bg-gray-50/30">
                    <span className="bg-orange-100 text-orange-800 border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Seconda scansione del giorno</span>
                    <p className="text-gray-700 font-semibold text-xs mt-2">Registrata come USCITA</p>
                    <p className="text-gray-500 text-xs mt-1">Avviene quando l'animatore lascia la struttura per tornare a casa.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-gray-800 text-sm flex items-center space-x-1.5">
                  <Lock size={16} className="text-indigo-500" />
                  <span>Protezione Modifiche ed Eliminazioni:</span>
                </h4>
                <p className="text-gray-650 text-xs leading-relaxed">
                  In basso alla Dashboard è visibile una tabella con i <strong>Transiti Recenti</strong>. Se un operatore commette un errore, è possibile modificare o eliminare la timbratura:
                </p>
                <ul className="list-disc pl-5 text-gray-650 text-xs space-y-2">
                  <li><strong>Verifica Autorizzazione</strong>: Cliccando su <strong className="text-blue-600">Modifica (matita)</strong> o <strong className="text-red-600">Elimina (cestino)</strong>, verrà mostrato un pop-up di blocco.</li>
                  <li><strong>Sblocco Rapido</strong>: Il Responsabile può avvicinare il proprio braccialetto NFC abilitato oppure digitare il PIN di sblocco amministratore (default: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">1234</code>) per autorizzare l'operazione.</li>
                  <li><strong>Sicurezza</strong>: Il controllo dell'autorizzazione viene richiesto per ogni singola modifica o cancellazione.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-2 pb-3 border-b border-gray-100">
                <Users className="text-pink-500" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Anagrafica Utenti</h3>
              </div>
              <p className="text-gray-650 text-sm leading-relaxed">
                Questa sezione (protetta da PIN) permette di gestire l'anagrafica di tutto il personale del Grest (Responsabili, Animatori, Aiuto-Animatori) e di associare a ciascuno di essi i braccialetti NFC fisici.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm bg-white">
                  <h4 className="font-bold text-gray-800 text-sm">1. Aggiungere un nuovo utente</h4>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Compila il form inserendo Nome, Cognome e seleziona il Ruolo. Il ruolo determina il colore delle bolle nelle statistiche e l'autorizzazione di sblocco (solo i <strong>Responsabili</strong> possono sbloccare le modifiche tramite NFC).
                  </p>
                </div>

                <div className="border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm bg-white">
                  <h4 className="font-bold text-gray-800 text-sm">2. Associare un braccialetto NFC</h4>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Clicca sul pulsante <strong>"Associa Braccialetto"</strong> in corrispondenza dell'utente desiderato. Avvicina un braccialetto NFC vergine o libero al lettore: il sistema catturerà l'UID e lo collegherà all'anagrafica in tempo reale.
                  </p>
                </div>
              </div>

              <div className="bg-pink-50/50 border border-pink-100 rounded-2xl p-5 space-y-2">
                <h4 className="font-bold text-pink-900 text-sm flex items-center space-x-1.5">
                  <AlertCircle size={16} />
                  <span>Esempio Concreto di Gestione Animatori:</span>
                </h4>
                <p className="text-gray-700 text-xs leading-relaxed">
                  Se un animatore smarrisce il proprio braccialetto, non è necessario cancellare l'utente. È sufficiente cliccare su <strong>"Associa Braccialetto"</strong> e passare sul lettore un nuovo braccialetto. Il vecchio codice NFC verrà sovrascritto e disattivato automaticamente, mentre tutto lo storico delle ore lavorate rimarrà intatto!
                </p>
              </div>
            </div>
          )}

          {/* TAB: HOURS */}
          {activeTab === 'hours' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-2 pb-3 border-b border-gray-100">
                <Clock className="text-emerald-500" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Riepilogo Ore</h3>
              </div>
              <p className="text-gray-650 text-sm leading-relaxed">
                Fornisce una tabella riassuntiva delle ore accumulate da ciascun utente dello staff in un determinato intervallo di date, utile per elaborare i conteggi finali o rilasciare attestati di ore di volontariato.
              </p>

              <div className="space-y-3">
                <h4 className="font-bold text-gray-800 text-sm">Come vengono calcolate le ore lavorate?</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2 text-xs text-gray-700">
                  <p>
                    Il sistema calcola la differenza in ore e minuti tra ciascun transito di <strong>ENTRATA</strong> e la successiva <strong>USCITA</strong> avvenuti nella stessa giornata.
                  </p>
                  <div className="flex items-center space-x-2 text-blue-700 font-semibold bg-white p-2.5 rounded-xl border border-gray-150 w-fit">
                    <span>Formula:</span>
                    <span className="font-mono text-gray-800">Ore totali = (Uscita_1 - Entrata_1) + (Uscita_2 - Entrata_2) ...</span>
                  </div>
                  <p className="text-gray-500">
                    Se in un giorno viene registrata solo un'entrata senza uscita (ciclo aperto), questa giornata genererà un'<strong>anomalia</strong> e non verrà conteggiata nel riepilogo ore finché non viene sanata.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-gray-800 text-sm flex items-center space-x-1">
                  <FileDown size={16} className="text-emerald-600" />
                  <span>Esportazione dei Report:</span>
                </h4>
                <p className="text-gray-650 text-xs leading-relaxed">
                  In cima alla pagina è presente un selettore di date e il pulsante per esportare i dati. Puoi scaricare l'intero tabellone in formato <strong>Excel (.xlsx)</strong> o generare un report **PDF** formattato e pronto da stampare.
                </p>
              </div>
            </div>
          )}

          {/* TAB: CONTROL */}
          {activeTab === 'control' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-2 pb-3 border-b border-gray-100">
                <ShieldAlert className="text-orange-500" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Controllo Timbrature</h3>
              </div>
              <p className="text-gray-650 text-sm leading-relaxed">
                Questa è la sezione di diagnostica e correzione del database. Permette di trovare rapidamente i cicli aperti (ingressi senza uscita) e risolverli, oltre ad inserire timbrature per chi ha dimenticato il braccialetto.
              </p>

              <div className="space-y-4">
                <div className="border border-gray-150 rounded-2xl p-5 space-y-2 bg-white">
                  <h4 className="font-bold text-gray-800 text-sm flex items-center space-x-2">
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-mono">1</span>
                    <span>Correzione Uscite Mancate</span>
                  </h4>
                  <p className="text-gray-650 text-xs leading-relaxed">
                    Il sistema scansiona le timbrature del periodo e mostra gli utenti rimasti con un ciclo aperto (es. entrata alle 08:00 senza uscita). Per sanarlo, imposta l'ora corretta (di default preimpostata a 16:30) e clicca su <strong>"Registra Uscita"</strong>.
                  </p>
                </div>

                <div className="border border-gray-150 rounded-2xl p-5 space-y-2 bg-white">
                  <h4 className="font-bold text-gray-800 text-sm flex items-center space-x-2">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-mono">2</span>
                    <span>Inserimento Manuale (Dimenticanze braccialetto)</span>
                  </h4>
                  <p className="text-gray-650 text-xs leading-relaxed">
                    Se un animatore si presenta senza braccialetto, un Responsabile può inserire la timbratura cliccando su <strong>"Registra Timbratura Manuale"</strong> in alto a destra. Seleziona l'utente, inserisci il tipo (Entrata/Uscita), la data e l'ora.
                  </p>
                </div>

                <div className="border border-gray-150 rounded-2xl p-5 space-y-2 bg-white">
                  <h4 className="font-bold text-gray-800 text-sm flex items-center space-x-2">
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-mono">3</span>
                    <span>Verifica Preventiva Transiti Esistenti</span>
                  </h4>
                  <p className="text-gray-650 text-xs leading-relaxed">
                    Per evitare registrazioni anomale (es. inserire una seconda entrata quando ne esiste già una), compilando la data il sistema **interroga Firestore e mostra a schermo** tutti i transiti già registrati per quell'utente in quel determinato giorno. Questo assicura che l'inserimento sia congruo con la linea temporale dell'utente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: STATS */}
          {activeTab === 'stats' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-2 pb-3 border-b border-gray-100">
                <BarChart2 className="text-indigo-500" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Statistiche (Grafico a Bolle)</h3>
              </div>
              <p className="text-gray-650 text-sm leading-relaxed">
                Rappresenta in modo dinamico e interattivo la distribuzione delle ore totali accumulate da ciascun membro dello staff negli ultimi 30 giorni.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
                <h4 className="font-bold text-gray-850 text-sm">Caratteristiche Interattive:</h4>
                <ul className="list-disc pl-5 text-gray-650 text-xs space-y-2">
                  <li><strong>Dimensione delle bolle</strong>: Più ore ha lavorato un utente, più grande sarà la sua bolla a schermo.</li>
                  <li><strong>Colori per ruolo</strong>: Le bolle sono gialle per i Responsabili, rosa per gli Animatori e azzurre per gli Aiuto-Animatori.</li>
                  <li><strong>Interazione al passaggio del mouse (Hover)</strong>: Evidenzia la bolla e apre un tooltip dettagliato con il nome completo, ruolo e ore precise dell'utente.</li>
                  <li><strong>Fisica dei fluidi (Drag & Drop)</strong>: È possibile fare clic e trascinare le bolle con il mouse. Rilasciandole, queste fluttueranno e rimbalzeranno contro le pareti o contro le altre bolle in modo naturale e senza sovrapporsi.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB: BACKUP */}
          {activeTab === 'backup' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-2 pb-3 border-b border-gray-100">
                <Database className="text-purple-500" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Backup & Disaster Recovery</h3>
              </div>
              <p className="text-gray-650 text-sm leading-relaxed">
                Una delle parti più critiche del sistema: consente il salvataggio dei dati in formato JSON per l'archiviazione locale o per migrare l'applicazione su un nuovo computer senza perdere utenti e timbrature.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-gray-100 rounded-2xl p-5 space-y-3 bg-white shadow-sm">
                  <h4 className="font-bold text-gray-800 text-sm">Esportazione (Salvataggio locale)</h4>
                  <p className="text-gray-650 text-xs leading-relaxed">
                    Estrae tutte le informazioni da Firestore e scarica un file `.json`. Il file contiene gli ID univoci delle collezioni, garantendo che le relazioni utenti/timbrature rimangano intatte in futuro.
                  </p>
                </div>

                <div className="border border-gray-100 rounded-2xl p-5 space-y-3 bg-white shadow-sm">
                  <h4 className="font-bold text-gray-800 text-sm">Importazione (Ripristino)</h4>
                  <p className="text-gray-650 text-xs leading-relaxed">
                    Carica un file di backup. È possibile scegliere tra <strong>Unione</strong> (aggiunge solo i nuovi transiti) e <strong>Svuota e Ripristina</strong> (ripulisce il database e lo sostituisce interamente con i dati del file, richiedendo la parola di conferma per sicurezza).
                  </p>
                </div>
              </div>

              <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-5 space-y-2">
                <h4 className="font-bold text-purple-900 text-sm flex items-center space-x-1.5">
                  <AlertCircle size={16} />
                  <span>Audit Trail (Log Immuta su Disco):</span>
                </h4>
                <p className="text-gray-700 text-xs leading-relaxed">
                  In aggiunta al backup cloud su Firestore, il software di backend del PC (NFC Bridge) salva localmente in tempo reale ogni singola scansione NFC all'interno del file <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">backups/timbrature_nfc_raw.log</code>. In caso di totale blackout di internet o del cloud, questo file di testo garantisce che nessuna timbratura venga smarrita.
                </p>
              </div>
            </div>
          )}

          {/* TAB: FAQ */}
          {activeTab === 'faq' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-2 pb-3 border-b border-gray-100">
                <HelpCircle className="text-teal-500" size={24} />
                <h3 className="text-xl font-bold text-gray-900">FAQ & Risoluzione Problemi</h3>
              </div>

              <div className="space-y-4 divide-y divide-gray-100">
                <div className="pt-4 first:pt-0 space-y-2">
                  <h4 className="font-bold text-gray-800 text-sm">Q: Il lettore NFC è collegato ma non timbra. Cosa faccio?</h4>
                  <p className="text-gray-650 text-xs leading-relaxed">
                    Controlla l'indicatore <strong>"Stato Lettore"</strong> nell'angolo in basso a sinistra del menu. Se è rosso, scollega il cavo USB del lettore ACR122U e ricollegalo. Se l'indicatore rimane rosso, assicurati che il programma di bridge locale Node.js sul computer sia in esecuzione.
                  </p>
                </div>

                <div className="pt-4 space-y-2">
                  <h4 className="font-bold text-gray-800 text-sm">Q: Cosa succede se salta la connessione Internet durante il Grest?</h4>
                  <p className="text-gray-650 text-xs leading-relaxed">
                    Il database locale di Firestore continuerà a salvare le timbrature in memoria locale e le sincronizzerà automaticamente non appena internet torna disponibile. Inoltre, il bridge scrive in parallelo i transiti sul file log raw locale per una sicurezza totale dei dati.
                  </p>
                </div>

                <div className="pt-4 space-y-2">
                  <h4 className="font-bold text-gray-800 text-sm">Q: Come recupero il PIN amministratore se dimenticato?</h4>
                  <p className="text-gray-650 text-xs leading-relaxed">
                    Il PIN di sblocco è memorizzato nel browser locale (`localStorage`). Se non riesci ad accedere all'area admin, puoi sbloccarla avvicinando al lettore NFC il braccialetto di un utente con ruolo **Responsabile** per resettarlo o configurarne uno nuovo.
                  </p>
                </div>

                <div className="pt-4 space-y-2">
                  <h4 className="font-bold text-gray-800 text-sm">Q: Ho un errore TransmitError in console. Cosa significa?</h4>
                  <p className="text-gray-650 text-xs leading-relaxed">
                    Questo errore indica che la connessione fisica del lettore ACR122U è stata interrotta a metà della transazione (es. se l'utente ritira il braccialetto troppo in fretta). Il sistema è strutturato per ignorare e sopprimere questi messaggi non bloccanti, senza interrompere le scansioni successive.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
