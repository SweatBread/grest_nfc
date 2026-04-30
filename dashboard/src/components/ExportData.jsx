import React, { useState } from 'react';
import { db, collection, getDocs, query, orderBy, where } from '../firebase';
import * as XLSX from 'xlsx';
import { format, startOfDay, endOfDay } from 'date-fns';
import { FileDown, Calendar, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function ExportData() {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const handleExport = async () => {
    try {
      setIsLoading(true);
      setNotification(null);

      // Conversione date per Firestore
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));

      const q = query(
        collection(db, "timbrature"),
        where("timestamp", ">=", start),
        where("timestamp", "<=", end),
        orderBy("timestamp", "asc")
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        showNotification("Nessun dato trovato per il periodo selezionato.", "error");
        setIsLoading(false);
        return;
      }

      const data = [];
      const userDays = {};

      querySnapshot.forEach((doc) => {
        const row = doc.data();
        if (!row.timestamp) return;

        const jsDate = row.timestamp.toDate();
        const dateStr = format(jsDate, 'dd/MM/yyyy');
        const timeStr = format(jsDate, 'HH:mm:ss');

        data.push({
          "Nome Utente": row.nome_completo || 'Sconosciuto',
          "Ruolo": row.ruolo || 'N/D',
          "Tipo": row.tipo,
          "Data": dateStr,
          "Ora": timeStr
        });

        // Raggruppamento per calcolo ore
        const key = `${row.utente_id}_${dateStr}`;
        if (!userDays[key]) {
          userDays[key] = {
            nome: row.nome_completo || 'Sconosciuto',
            ruolo: row.ruolo || 'N/D',
            data: dateStr,
            logs: []
          };
        }
        userDays[key].logs.push({
          tipo: row.tipo,
          time: jsDate
        });
      });

      const summaryData = [];
      Object.values(userDays).forEach(dayRecord => {
        let totalMs = 0;
        let currentEntrata = null;

        // I logs sono già ordinati cronologicamente grazie a orderBy("timestamp")
        dayRecord.logs.forEach(log => {
          if (log.tipo === 'ENTRATA') {
            currentEntrata = log.time;
          } else if (log.tipo === 'USCITA' && currentEntrata) {
            totalMs += (log.time.getTime() - currentEntrata.getTime());
            currentEntrata = null;
          }
        });

        const totalHours = totalMs / (1000 * 60 * 60);
        
        // Formattiamo le ore e calcoliamo ore e minuti per comodità di lettura
        const ore = Math.floor(totalHours);
        const minuti = Math.round((totalHours - ore) * 60);
        const labelOreMinuti = `${ore}h ${minuti}m`;
        
        summaryData.push({
          "Nome Utente": dayRecord.nome,
          "Ruolo": dayRecord.ruolo,
          "Data": dayRecord.data,
          "Ore Decimali": parseFloat(totalHours.toFixed(2)),
          "Tempo Totale": labelOreMinuti
        });
      });

      // Creazione del file Excel con due fogli
      const wb = XLSX.utils.book_new();
      
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Riepilogo Ore");

      const wsRaw = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, wsRaw, "Log Timbrature");
      
      const fileName = `Report_Presenze_${format(start, 'dd-MM-yyyy')}_al_${format(end, 'dd-MM-yyyy')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      showNotification(`Report generato con successo!`, "success");
    } catch (error) {
      console.error("Errore esportazione:", error);
      showNotification("Errore durante l'esportazione dei dati.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Esporta Presenze</h2>
        <p className="text-gray-500 mt-2">Scarica i dati delle timbrature in formato Excel per analizzarli o stamparli.</p>
      </header>

      {/* Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-xl shadow-md flex items-center space-x-3 transition-all ${notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <AlertCircle className="w-6 h-6 text-red-600" />}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Data Inizio</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Data Fine</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6">
          <button
            onClick={handleExport}
            disabled={isLoading}
            className="w-full md:w-auto flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <FileDown size={20} />}
            <span>{isLoading ? 'Generazione in corso...' : 'Scarica Report Excel'}</span>
          </button>
        </div>
      </div>
      
      <div className="bg-blue-50 rounded-xl p-4 flex items-start space-x-3 text-blue-800 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>
          Il file Excel scaricato conterrà due fogli: <strong>Riepilogo Ore</strong> (con le ore di presenza totali calcolate giorno per giorno per ogni utente) e <strong>Log Timbrature</strong> (l'elenco grezzo di ogni singola entrata e uscita registrata).
        </p>
      </div>
    </div>
  );
}
