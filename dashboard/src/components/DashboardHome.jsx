import React, { useState, useEffect } from 'react';
import { nfcService } from '../services/nfcService';
import { db, collection, getDocs, query, where, addDoc, serverTimestamp, orderBy, limit, doc, updateDoc, Timestamp } from '../firebase';
import { LogIn, LogOut, AlertCircle, CheckCircle2, Users, Power, Edit2, X, Clock } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';

export default function DashboardHome() {
  const [recentLogs, setRecentLogs] = useState([]);
  const [presentCount, setPresentCount] = useState(0);
  const [notification, setNotification] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Nuovi stati per Uscita Automatica e Modifica
  const [isClosingDay, setIsClosingDay] = useState(false);
  const [closeDayTime, setCloseDayTime] = useState("16:30");
  const [editingLog, setEditingLog] = useState(null);
  const [editLogTime, setEditLogTime] = useState("");
  const [editLogType, setEditLogType] = useState("ENTRATA");

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
    loadPresentCount();

    return () => {
      nfcService.removeListeners();
    };
  }, [isProcessing]);

  const loadRecentLogs = async () => {
    try {
      const q = query(collection(db, "timbrature"), orderBy("timestamp", "desc"), limit(20));
      const querySnapshot = await getDocs(q);
      const logs = [];
      querySnapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) });
      });
      setRecentLogs(logs);
    } catch (error) {
      console.error("Errore nel caricamento log:", error);
    }
  };

  const loadPresentCount = async () => {
    try {
      const q = query(
        collection(db, "timbrature"),
        where("timestamp", ">=", startOfDay(new Date())),
        orderBy("timestamp", "asc")
      );
      const querySnapshot = await getDocs(q);
      const presenceMap = new Map();
      querySnapshot.forEach(doc => {
        const data = doc.data({ serverTimestamps: 'estimate' });
        if (data.utente_id) {
          presenceMap.set(data.utente_id, data.tipo);
        }
      });
      let count = 0;
      presenceMap.forEach(tipo => {
        if (tipo === 'ENTRATA') count++;
      });
      setPresentCount(count);
    } catch (error) {
      console.error("Errore calcolo presenti:", error);
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

      // 2. Trova ultima timbratura dell'utente (in memoria per evitare indici compositi)
      const logsQuery = query(collection(db, "timbrature"), where("utente_id", "==", user.id));
      const logsSnapshot = await getDocs(logsQuery);
      
      let lastLog = null;
      logsSnapshot.forEach(doc => {
        const logData = doc.data({ serverTimestamps: 'estimate' });
        const logTime = logData.timestamp ? logData.timestamp.toMillis() : 0;
        const lastLogTime = lastLog && lastLog.timestamp ? lastLog.timestamp.toMillis() : 0;
        if (!lastLog || logTime > lastLogTime) {
          lastLog = { ...logData, id: doc.id };
        }
      });
      
      let nextType = "ENTRATA";
      if (lastLog && lastLog.timestamp) {
        const lastLogDate = lastLog.timestamp.toDate();
        const todayDate = new Date();
        
        const isSameDay = 
          lastLogDate.getDate() === todayDate.getDate() &&
          lastLogDate.getMonth() === todayDate.getMonth() &&
          lastLogDate.getFullYear() === todayDate.getFullYear();
        
        // Se l'ultimo transito è avvenuto OGGI ed era un'ENTRATA, allora questo sarà un'USCITA.
        // Se l'ultimo transito è di un giorno precedente, la prima timbratura del giorno è sempre ENTRATA.
        if (isSameDay && lastLog.tipo === "ENTRATA") {
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
      if (nextType === "ENTRATA") {
        setPresentCount(prev => prev + 1);
      } else {
        setPresentCount(prev => Math.max(0, prev - 1));
      }
      setTimeout(loadPresentCount, 1000);

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

  const handleCloseDay = async () => {
    try {
      setIsProcessing(true);
      
      // Calcoliamo il timestamp per l'uscita automatica
      const today = new Date();
      const [hours, minutes] = closeDayTime.split(':');
      const exitTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes), 0);
      
      const q = query(
        collection(db, "timbrature"),
        where("timestamp", ">=", startOfDay(new Date())),
        orderBy("timestamp", "asc")
      );
      const querySnapshot = await getDocs(q);
      
      const userLastLog = new Map();
      const userDetails = new Map();

      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.utente_id) {
          userLastLog.set(data.utente_id, data.tipo);
          userDetails.set(data.utente_id, {
            nome: data.nome_completo,
            ruolo: data.ruolo
          });
        }
      });

      let countAutoExits = 0;
      
      for (const [userId, lastType] of userLastLog.entries()) {
        if (lastType === 'ENTRATA') {
          const user = userDetails.get(userId);
          await addDoc(collection(db, "timbrature"), {
            utente_id: userId,
            nome_completo: user.nome,
            ruolo: user.ruolo,
            timestamp: Timestamp.fromDate(exitTime),
            tipo: "USCITA_AUTOMATICA",
            metodo: "SISTEMA"
          });
          countAutoExits++;
        }
      }

      setIsClosingDay(false);
      showNotification(`Giornata chiusa. Aggiunte ${countAutoExits} uscite automatiche.`, "success");
      loadRecentLogs();
      loadPresentCount();
    } catch (error) {
      console.error("Errore chiusura giornata:", error);
      showNotification("Errore durante la chiusura della giornata.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditLogSave = async () => {
    if (!editingLog) return;
    try {
      const today = editingLog.timestamp ? editingLog.timestamp.toDate() : new Date();
      const [hours, minutes] = editLogTime.split(':');
      const newDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes), 0);
      
      await updateDoc(doc(db, "timbrature", editingLog.id), {
        timestamp: Timestamp.fromDate(newDate),
        tipo: editLogType
      });
      
      setEditingLog(null);
      showNotification("Timbratura modificata con successo.", "success");
      loadRecentLogs();
      loadPresentCount();
    } catch (error) {
      console.error("Errore modifica timbratura:", error);
      showNotification("Errore durante la modifica.", "error");
    }
  };

  const openEditModal = (log) => {
    setEditingLog(log);
    setEditLogType(log.tipo);
    if (log.timestamp) {
      setEditLogTime(format(log.timestamp.toDate(), "HH:mm"));
    } else {
      setEditLogTime("12:00");
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Pannello Controllo Accessi</h2>
          <p className="text-gray-500 mt-2">Avvicina il braccialetto al lettore per registrare l'entrata o l'uscita.</p>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsClosingDay(true)}
            className="flex items-center space-x-2 bg-amber-100 hover:bg-amber-200 text-amber-700 px-4 py-3 rounded-2xl shadow-sm border border-amber-200 transition-colors font-medium"
          >
            <Power size={20} />
            <span>Chiudi Giornata</span>
          </button>
          
          <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Presenti Ora</p>
              <p className="text-2xl font-bold text-gray-900">{presentCount}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-xl shadow-md flex items-center space-x-3 transition-all transform duration-300 ${notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <AlertCircle className="w-6 h-6 text-red-600" />}
          <span className="font-medium text-lg">{notification.message}</span>
        </div>
      )}

      {/* Modal Chiudi Giornata */}
      {isClosingDay && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <Power className="text-amber-500" />
                <span>Chiudi Giornata</span>
              </h3>
              <button onClick={() => setIsClosingDay(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Questa azione registrerà un'<strong>Uscita Automatica</strong> per tutti gli utenti che risultano ancora presenti oggi.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Orario Uscita Automatica</label>
                <input 
                  type="time" 
                  value={closeDayTime}
                  onChange={(e) => setCloseDayTime(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
              <button 
                onClick={() => setIsClosingDay(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button 
                onClick={handleCloseDay}
                disabled={isProcessing}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isProcessing ? 'Elaborazione...' : 'Conferma Chiusura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifica Timbratura */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <Edit2 className="text-blue-500" size={20} />
                <span>Modifica Timbratura</span>
              </h3>
              <button onClick={() => setEditingLog(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600 font-medium">{editingLog.nome_completo}</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Accesso</label>
                  <select
                    value={editLogType}
                    onChange={(e) => setEditLogType(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="ENTRATA">Entrata</option>
                    <option value="USCITA">Uscita</option>
                    <option value="USCITA_AUTOMATICA">Uscita Automatica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orario</label>
                  <input 
                    type="time" 
                    value={editLogTime}
                    onChange={(e) => setEditLogTime(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
              <button 
                onClick={() => setEditingLog(null)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button 
                onClick={handleEditLogSave}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Salva Modifiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Recenti */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Transiti Recenti</h3>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 text-sm font-medium border-b">
                <th className="p-4">Utente</th>
                <th className="p-4">Ruolo</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Orario</th>
                <th className="p-4 text-center">Azioni</th>
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
                      ) : log.tipo === 'USCITA_AUTOMATICA' ? (
                        <>
                          <Clock size={16} className="text-amber-500" />
                          <span className="text-amber-700 font-medium">Uscita Automatica</span>
                        </>
                      ) : (
                        <>
                          <LogOut size={16} className="text-orange-500" />
                          <span className="text-orange-700 font-medium">Uscita</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    {log.timestamp ? format(log.timestamp.toDate(), "HH:mm:ss - dd MMM", { locale: it }) : 'Ora in caricamento...'}
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => openEditModal(log)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-block"
                      title="Modifica Timbratura"
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
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
