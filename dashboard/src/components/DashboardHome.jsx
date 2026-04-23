import React, { useState, useEffect } from 'react';
import { nfcService } from '../services/nfcService';
import { db, collection, getDocs, query, where, addDoc, serverTimestamp, orderBy, limit, doc, updateDoc } from '../firebase';
import { LogIn, LogOut, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function DashboardHome() {
  const [recentLogs, setRecentLogs] = useState([]);
  const [notification, setNotification] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Escolta gli eventi NFC
    nfcService.onNfcRead(async ({ uid }) => {
      if (isProcessing) return;
      setIsProcessing(true);
      await processNfcScan(uid);
      setIsProcessing(false);
    });

    // Carica gli ultimi log all'avvio
    loadRecentLogs();

    return () => {
      nfcService.removeListeners();
    };
  }, [isProcessing]);

  const loadRecentLogs = async () => {
    try {
      const q = query(collection(db, "timbrature"), orderBy("timestamp", "desc"), limit(10));
      const querySnapshot = await getDocs(q);
      const logs = [];
      querySnapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
      });
      setRecentLogs(logs);
    } catch (error) {
      console.error("Errore nel caricamento log:", error);
    }
  };

  const processNfcScan = async (uid) => {
    try {
      // 1. Trova l'utente per nfc_uid
      const userQuery = query(collection(db, "utenti"), where("nfc_uid", "==", uid), where("stato", "==", "attivo"));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        showNotification("Braccialetto non registrato o utente inattivo.", "error");
        nfcService.sendBeep('error');
        return;
      }

      const userDoc = userSnapshot.docs[0];
      const user = { id: userDoc.id, ...userDoc.data() };

      // 2. Trova ultima timbratura
      const logsQuery = query(collection(db, "timbrature"), where("utente_id", "==", user.id), orderBy("timestamp", "desc"), limit(1));
      const logsSnapshot = await getDocs(logsQuery);
      
      let nextType = "ENTRATA";
      if (!logsSnapshot.empty) {
        const lastLog = logsSnapshot.docs[0].data();
        if (lastLog.tipo === "ENTRATA") {
          nextType = "USCITA";
        }
      }

      // 3. Salva la nuova timbratura in background (Senza await per supportare modalità offline)
      addDoc(collection(db, "timbrature"), {
        utente_id: user.id,
        nome_completo: `${user.nome} ${user.cognome}`,
        ruolo: user.ruolo,
        timestamp: serverTimestamp(),
        tipo: nextType,
        metodo: "NFC"
      }).catch(err => console.error("Sync error:", err));

      // 4. Feedback Successo Immediato
      showNotification(`${nextType}: ${user.nome} ${user.cognome}`, "success");
      nfcService.sendBeep('success');
      
      // Aggiorna la lista (il db locale è già aggiornato da addDoc)
      loadRecentLogs();

    } catch (error) {
      console.error("Errore durante il salvataggio:", error);
      showNotification("Errore di sistema. Riprova.", "error");
      nfcService.sendBeep('error');
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Pannello Controllo Accessi</h2>
          <p className="text-gray-500 mt-2">Avvicina il braccialetto al lettore per registrare l'entrata o l'uscita.</p>
        </div>
      </header>

      {/* Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-xl shadow-md flex items-center space-x-3 transition-all transform duration-300 ${notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <AlertCircle className="w-6 h-6 text-red-600" />}
          <span className="font-medium text-lg">{notification.message}</span>
        </div>
      )}

      {/* Log Recenti */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-semibold text-gray-800">Transiti Recenti</h3>
        </div>
        <div className="p-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 text-sm font-medium border-b">
                <th className="p-4">Utente</th>
                <th className="p-4">Ruolo</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Orario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">{log.nome_completo || 'Sconosciuto'}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {log.ruolo || 'N/D'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      {log.tipo === 'ENTRATA' ? (
                        <>
                          <LogIn size={16} className="text-emerald-500" />
                          <span className="text-emerald-700 font-medium">Entrata</span>
                        </>
                      ) : (
                        <>
                          <LogOut size={16} className="text-amber-500" />
                          <span className="text-amber-700 font-medium">Uscita</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    {log.timestamp ? format(log.timestamp.toDate(), "HH:mm:ss - dd MMM", { locale: it }) : 'Ora in caricamento...'}
                  </td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-500">
                    Nessuna timbratura recente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
