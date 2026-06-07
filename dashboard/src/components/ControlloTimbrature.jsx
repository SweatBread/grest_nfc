import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, query, orderBy, where, addDoc, Timestamp } from '../firebase';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar, AlertCircle, CheckCircle2, Loader2, Clock, AlertTriangle, ChevronRight, Check } from 'lucide-react';

export default function ControlloTimbrature() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [anomaliesByDay, setAnomaliesByDay] = useState([]);
  const [exitTimes, setExitTimes] = useState({});

  // Stati per la registrazione manuale
  const [usersList, setUsersList] = useState([]);
  const [showManualForm, setShowManualForm] = useState(false);
  
  // Campi del form
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [manualType, setManualType] = useState('ENTRATA');
  const [manualDate, setManualDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [manualTime, setManualTime] = useState(format(new Date(), 'HH:mm'));
  
  // Timbrature esistenti per l'utente selezionato nella data selezionata
  const [existingLogs, setExistingLogs] = useState([]);
  const [isLoadingExistingLogs, setIsLoadingExistingLogs] = useState(false);

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadAnomalies = async () => {
    try {
      setIsLoading(true);
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));

      const q = query(
        collection(db, "timbrature"),
        where("timestamp", ">=", start),
        where("timestamp", "<=", end),
        orderBy("timestamp", "asc")
      );

      const querySnapshot = await getDocs(q);
      
      // Raggruppamento dei log per data (YYYY-MM-DD) e utente_id
      const dayUserLogs = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.timestamp || !data.utente_id) return;

        const jsDate = data.timestamp.toDate();
        const dateKey = format(jsDate, 'yyyy-MM-dd');
        
        if (!dayUserLogs[dateKey]) {
          dayUserLogs[dateKey] = {};
        }

        if (!dayUserLogs[dateKey][data.utente_id]) {
          dayUserLogs[dateKey][data.utente_id] = [];
        }

        dayUserLogs[dateKey][data.utente_id].push({
          id: doc.id,
          ...data,
          jsDate
        });
      });

      const processedDays = [];
      const newExitTimes = { ...exitTimes };

      // Analizziamo ogni giorno e utente per trovare cicli incompleti
      Object.keys(dayUserLogs).forEach((dateKey) => {
        const usersInDay = dayUserLogs[dateKey];
        const dayAnomalies = [];

        Object.keys(usersInDay).forEach((userId) => {
          const logs = usersInDay[userId];
          // I log sono già ordinati cronologicamente grazie alla query orderBy("timestamp", "asc")
          const lastLog = logs[logs.length - 1];

          if (lastLog.tipo === 'ENTRATA') {
            dayAnomalies.push({
              userId,
              nomeCompleto: lastLog.nome_completo || 'Sconosciuto',
              ruolo: lastLog.ruolo || 'Animatore',
              entrataTime: lastLog.jsDate,
              dateKey
            });

            // Inizializza l'orario di uscita se non già impostato
            const uniqueKey = `${dateKey}_${userId}`;
            if (!newExitTimes[uniqueKey]) {
              newExitTimes[uniqueKey] = '16:30';
            }
          }
        });

        if (dayAnomalies.length > 0) {
          const parsedDate = new Date(dateKey);
          const prettyDate = format(parsedDate, 'EEEE d MMMM yyyy', { locale: it });
          // Mettiamo in maiuscolo la prima lettera del giorno
          const formattedPrettyDate = prettyDate.charAt(0).toUpperCase() + prettyDate.slice(1);

          processedDays.push({
            dateKey,
            prettyDate: formattedPrettyDate,
            anomalies: dayAnomalies
          });
        }
      });

      // Ordina i giorni dal più recente al più vecchio
      processedDays.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

      setAnomaliesByDay(processedDays);
      setExitTimes(newExitTimes);
    } catch (error) {
      console.error("Errore caricamento anomalie:", error);
      showNotification("Errore nel caricamento delle timbrature.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnomalies();
  }, [startDate, endDate]);

  const loadUsers = async () => {
    try {
      const q = query(collection(db, "utenti"), where("stato", "==", "attivo"));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        nome: docSnap.data().nome,
        cognome: docSnap.data().cognome,
        nomeCompleto: `${docSnap.data().nome} ${docSnap.data().cognome}`,
        ruolo: docSnap.data().ruolo
      }));
      list.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto));
      setUsersList(list);
    } catch (error) {
      console.error("Errore caricamento utenti:", error);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const checkExistingLogs = async () => {
      if (!selectedUser) {
        setExistingLogs([]);
        return;
      }

      // Se non specificata, usa la data odierna come default
      const targetDateStr = manualDate || format(new Date(), 'yyyy-MM-dd');
      const parsedDate = new Date(targetDateStr);
      if (isNaN(parsedDate.getTime())) {
        setExistingLogs([]);
        return;
      }

      try {
        setIsLoadingExistingLogs(true);
        const start = startOfDay(parsedDate);
        const end = endOfDay(parsedDate);

        const q = query(
          collection(db, "timbrature"),
          where("utente_id", "==", selectedUser.id),
          where("timestamp", ">=", start),
          where("timestamp", "<=", end),
          orderBy("timestamp", "asc")
        );

        const querySnapshot = await getDocs(q);
        const logs = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setExistingLogs(logs);
      } catch (err) {
        console.error("Errore caricamento timbrature esistenti:", err);
      } finally {
        setIsLoadingExistingLogs(false);
      }
    };

    checkExistingLogs();
  }, [selectedUser, manualDate]);

  const handleSaveManualLog = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      showNotification("Seleziona prima un utente dallo staff!", "error");
      return;
    }

    try {
      setIsProcessing(true);
      
      const dateToUse = manualDate || format(new Date(), 'yyyy-MM-dd');
      const timeToUse = manualTime || format(new Date(), 'HH:mm');

      const [year, month, day] = dateToUse.split('-').map(Number);
      const [hours, minutes] = timeToUse.split(':').map(Number);
      const targetTimestamp = new Date(year, month - 1, day, hours, minutes, 0);

      if (isNaN(targetTimestamp.getTime())) {
        showNotification("La data o l'orario inserito non sono validi.", "error");
        setIsProcessing(false);
        return;
      }

      await addDoc(collection(db, "timbrature"), {
        utente_id: selectedUser.id,
        nome_completo: selectedUser.nomeCompleto,
        ruolo: selectedUser.ruolo,
        timestamp: Timestamp.fromDate(targetTimestamp),
        tipo: manualType,
        metodo: "MANUALE"
      });

      showNotification(`Timbratura manuale di ${manualType.toLowerCase()} registrata per ${selectedUser.nomeCompleto}.`, "success");
      
      // Resetta il form
      setSelectedUser(null);
      setSearchQuery('');
      setManualType('ENTRATA');
      setManualDate(format(new Date(), 'yyyy-MM-dd'));
      setManualTime(format(new Date(), 'HH:mm'));
      setExistingLogs([]);

      // Ricarica le anomalie
      await loadAnomalies();
    } catch (error) {
      console.error("Errore salvataggio timbratura manuale:", error);
      showNotification("Errore durante il salvataggio della timbratura.", "error");
    } finally {
      setIsProcessing(false);
    }
  };


  const handleTimeChange = (dateKey, userId, value) => {
    setExitTimes(prev => ({
      ...prev,
      [`${dateKey}_${userId}`]: value
    }));
  };

  const handleRegisterExit = async (anomaly) => {
    const { dateKey, userId, nomeCompleto, ruolo } = anomaly;
    const timeVal = exitTimes[`${dateKey}_${userId}`] || '16:30';

    try {
      setIsProcessing(true);
      
      // Costruiamo la data e ora corretta per l'uscita manuale
      const [year, month, day] = dateKey.split('-').map(Number);
      const [hours, minutes] = timeVal.split(':').map(Number);
      
      // Creazione della data con l'orario impostato (mese 0-indexed)
      const exitTime = new Date(year, month - 1, day, hours, minutes, 0);

      // Verifichiamo che l'uscita non sia antecedente all'entrata
      if (exitTime.getTime() <= anomaly.entrataTime.getTime()) {
        showNotification("L'orario di uscita non può essere precedente o uguale a quello di entrata!", "error");
        setIsProcessing(false);
        return;
      }

      await addDoc(collection(db, "timbrature"), {
        utente_id: userId,
        nome_completo: nomeCompleto,
        ruolo: ruolo,
        timestamp: Timestamp.fromDate(exitTime),
        tipo: "USCITA",
        metodo: "MANUALE"
      });

      showNotification(`Uscita registrata con successo per ${nomeCompleto}.`, "success");
      
      // Ricarica i dati per aggiornare la lista delle anomalie
      await loadAnomalies();
    } catch (error) {
      console.error("Errore registrazione uscita:", error);
      showNotification("Impossibile salvare la timbratura.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const getRoleBadgeClass = (ruolo) => {
    switch (ruolo) {
      case 'Responsabile':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Animatore':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'Aiuto-Animatore':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fadeIn">
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Controllo Timbrature</h2>
          <p className="text-gray-500 mt-2">
            Rileva e correggi le mancate timbrature di uscita dello staff, organizzate per singola giornata.
          </p>
        </div>
        <button
          onClick={() => setShowManualForm(!showManualForm)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl shadow-sm transition-colors font-medium text-sm"
        >
          <Clock size={18} />
          <span>{showManualForm ? 'Nascondi Inserimento' : 'Registra Timbratura Manuale'}</span>
        </button>
      </header>

      {/* Form di Timbratura Manuale (Dimenticanze braccialetto) */}
      {showManualForm && (
        <form onSubmit={handleSaveManualLog} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6 shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-2 text-gray-800 font-bold text-base pb-3 border-b border-gray-100">
            <Clock size={20} className="text-blue-500" />
            <span>Inserisci Nuova Timbratura Manuale</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cerca Utente Autocomplete */}
            <div className="space-y-1 relative">
              <label className="block text-xs font-bold text-gray-700">Utente dello Staff</label>
              
              {selectedUser ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl mt-1">
                  <div>
                    <p className="font-bold text-sm text-blue-900 leading-tight">{selectedUser.nomeCompleto}</p>
                    <p className="text-xs text-blue-500 mt-0.5">{selectedUser.ruolo}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedUser(null); setSearchQuery(''); setExistingLogs([]); }}
                    className="text-blue-600 hover:text-blue-800 text-xs font-semibold px-2 py-1 bg-white border border-blue-200 rounded-lg transition-colors"
                  >
                    Modifica
                  </button>
                </div>
              ) : (
                <div className="mt-1">
                  <input 
                    type="text"
                    placeholder="Scrivi il nome per cercare..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setIsDropdownOpen(true); }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white"
                  />
                  
                  {isDropdownOpen && searchQuery.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50 divide-y divide-gray-50">
                      {usersList.filter(u => u.nomeCompleto.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                        <div className="p-3 text-gray-400 text-xs italic">Nessun utente trovato</div>
                      ) : (
                        usersList
                          .filter(u => u.nomeCompleto.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(u => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedUser(u);
                                setIsDropdownOpen(false);
                              }}
                              className="w-full text-left p-3 hover:bg-blue-50/50 flex flex-col transition-colors"
                            >
                              <span className="font-semibold text-sm text-gray-800">{u.nomeCompleto}</span>
                              <span className="text-xs text-gray-400">{u.ruolo}</span>
                            </button>
                          ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tipo Transito */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">Tipo Accesso</label>
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200 mt-1">
                <button
                  type="button"
                  onClick={() => setManualType('ENTRATA')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    manualType === 'ENTRATA' 
                      ? 'bg-white text-emerald-700 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Entrata
                </button>
                <button
                  type="button"
                  onClick={() => setManualType('USCITA')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    manualType === 'USCITA' 
                      ? 'bg-white text-orange-700 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Uscita
                </button>
              </div>
            </div>

            {/* Data e Ora */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-gray-700">Data</label>
                  <span className="text-[10px] text-gray-400">Default: oggi</span>
                </div>
                <input 
                  type="date" 
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white mt-1"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-gray-700">Ora</label>
                  <span className="text-[10px] text-gray-400">Default: ora corr.</span>
                </div>
                <input 
                  type="time" 
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white mt-1"
                />
              </div>
            </div>
          </div>

          {/* SEZIONE RIVELAZIONE TIMBRATURE ESISTENTI (Disaster prevention) */}
          {selectedUser && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 animate-fadeIn">
              <p className="text-xs font-bold text-gray-700 flex items-center space-x-1.5">
                <Clock size={14} className="text-blue-500" />
                <span>
                  Transiti registrati per {selectedUser.nomeCompleto} il {(() => {
                    const targetDateStr = manualDate || format(new Date(), 'yyyy-MM-dd');
                    const parsedDate = new Date(targetDateStr);
                    return isNaN(parsedDate.getTime()) ? '' : format(parsedDate, 'dd/MM/yyyy');
                  })()}:
                </span>
              </p>
              
              {isLoadingExistingLogs ? (
                <p className="text-xs text-gray-400 italic">Verifica in corso...</p>
              ) : existingLogs.length === 0 ? (
                <p className="text-xs text-emerald-600 font-semibold flex items-center space-x-1">
                  <span>✓ Nessun transito registrato in questa data. Operazione sicura.</span>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {existingLogs.map((log) => (
                    <span 
                      key={log.id} 
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        log.tipo === 'ENTRATA' 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                          : log.tipo === 'USCITA_AUTOMATICA' || log.metodo === 'AUTOMATICA'
                            ? 'bg-amber-50 text-amber-800 border-amber-100'
                            : 'bg-orange-50 text-orange-800 border-orange-100'
                      }`}
                    >
                      <span className="font-bold">
                        {log.tipo === 'ENTRATA' ? 'Entrata' : log.metodo === 'AUTOMATICA' || log.tipo === 'USCITA_AUTOMATICA' ? 'Auto Uscita' : 'Uscita'}
                      </span>
                      <span>alle {format(log.timestamp.toDate(), 'HH:mm')} ({log.metodo || 'NFC'})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={!selectedUser || isProcessing}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 text-sm"
            >
              {isProcessing ? 'Registrazione...' : 'Salva Timbratura Manuale'}
            </button>
          </div>
        </form>
      )}

      {/* Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-xl shadow-md flex items-center space-x-3 transition-all transform duration-300 ${
          notification.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {notification.type === 'success' 
            ? <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" /> 
            : <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />}
          <span className="font-medium text-lg">{notification.message}</span>
        </div>
      )}

      {/* Date Filters Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center space-x-2 text-gray-700 font-semibold flex-shrink-0">
            <Calendar size={20} className="text-blue-500" />
            <span>Intervallo di Analisi:</span>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">Data Inizio</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">Data Fine</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <p className="text-gray-500 font-medium">Analisi delle timbrature in corso...</p>
        </div>
      ) : anomaliesByDay.length === 0 ? (
        <div className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-8 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl">
            🎉
          </div>
          <h3 className="text-lg font-bold text-emerald-900">Tutto in regola!</h3>
          <p className="text-emerald-700 max-w-md mx-auto text-sm">
            Nessun ciclo incompleto o mancata uscita rilevata nell'intervallo temporale selezionato.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-800 text-sm shadow-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">Rilevate mancate timbrature di uscita</p>
              <p className="mt-1">
                Gli utenti elencati di seguito risultano entrati in una determinata giornata senza aver registrato la corrispondente uscita. Specifica l'orario di fine turno corretto e premi <strong>"Registra Uscita"</strong> per completare il loro ciclo giornaliero.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {anomaliesByDay.map((day) => (
              <div key={day.dateKey} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 flex items-center space-x-2">
                    <Calendar size={18} className="text-gray-500" />
                    <span>{day.prettyDate}</span>
                  </h3>
                  <span className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {day.anomalies.length} {day.anomalies.length === 1 ? 'mancata uscita' : 'mancate uscite'}
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {day.anomalies.map((anomaly) => {
                    const uniqueKey = `${anomaly.dateKey}_${anomaly.userId}`;
                    const currentTimeVal = exitTimes[uniqueKey] || '16:30';

                    return (
                      <div key={anomaly.userId} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-3">
                            <span className="font-bold text-gray-900 text-base">{anomaly.nomeCompleto}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeClass(anomaly.ruolo)}`}>
                              {anomaly.ruolo}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <Clock size={16} className="text-gray-400" />
                            <span>Entrata registrata alle:</span>
                            <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                              {format(anomaly.entrataTime, 'HH:mm')}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 rounded-xl p-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-shadow">
                            <label className="text-xs font-medium text-gray-500 pl-1">Ora Uscita:</label>
                            <input 
                              type="time" 
                              value={currentTimeVal}
                              onChange={(e) => handleTimeChange(anomaly.dateKey, anomaly.userId, e.target.value)}
                              className="bg-transparent font-semibold text-gray-800 focus:outline-none text-sm w-16"
                            />
                          </div>

                          <button
                            onClick={() => handleRegisterExit(anomaly)}
                            disabled={isProcessing}
                            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all hover:shadow-md disabled:opacity-50 text-sm"
                          >
                            {isProcessing ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Check size={16} />
                            )}
                            <span>Registra Uscita</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
