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
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Controllo Timbrature</h2>
        <p className="text-gray-500 mt-2">
          Rileva e correggi le mancate timbrature di uscita dello staff, organizzate per singola giornata.
        </p>
      </header>

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
                className="w-full p-2 border border-gray-350 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">Data Fine</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-gray-350 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow text-sm focus:outline-none"
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
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-850 text-sm shadow-sm">
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
                          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-250 rounded-xl p-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-shadow">
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
