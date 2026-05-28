import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, query, orderBy, where } from '../firebase';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar, Search, Loader2, Clock, Users } from 'lucide-react';

export default function HoursReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
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
      
      const userDays = {};

      querySnapshot.forEach((doc) => {
        const row = doc.data({ serverTimestamps: 'estimate' });
        if (!row.timestamp || !row.utente_id) return;

        const jsDate = row.timestamp.toDate();
        const dateStr = format(jsDate, 'yyyy-MM-dd');

        const key = `${row.utente_id}_${dateStr}`;
        if (!userDays[key]) {
          userDays[key] = {
            userId: row.utente_id,
            nome: row.nome_completo || 'Sconosciuto',
            ruolo: row.ruolo || 'N/D',
            data: jsDate, // keep a Date object for sorting if needed
            logs: []
          };
        }
        userDays[key].logs.push({
          tipo: row.tipo,
          time: jsDate
        });
      });

      // Calcolo monte ore per utente
      const userTotals = {};
      
      Object.values(userDays).forEach(dayRecord => {
        let totalMs = 0;
        let currentEntrata = null;

        dayRecord.logs.forEach(log => {
          if (log.tipo === 'ENTRATA') {
            currentEntrata = log.time;
          } else if ((log.tipo === 'USCITA' || log.tipo === 'USCITA_AUTOMATICA') && currentEntrata) {
            totalMs += (log.time.getTime() - currentEntrata.getTime());
            currentEntrata = null;
          }
        });

        const uId = dayRecord.userId;
        if (!userTotals[uId]) {
          userTotals[uId] = {
            id: uId,
            nome: dayRecord.nome,
            ruolo: dayRecord.ruolo,
            totalMs: 0,
            giorniPresenza: 0
          };
        }
        
        userTotals[uId].totalMs += totalMs;
        if (totalMs > 0) {
          userTotals[uId].giorniPresenza += 1;
        }
      });

      // Format data for display
      const finalData = Object.values(userTotals)
        .filter(u => u.totalMs > 0) // Mostriamo solo chi ha almeno un'ora
        .map(u => {
          const totalHours = u.totalMs / (1000 * 60 * 60);
          const ore = Math.floor(totalHours);
          const minuti = Math.round((totalHours - ore) * 60);
          
          return {
            ...u,
            oreDecimali: totalHours,
            etichettaOre: `${ore}h ${minuti}m`
          };
        })
        .sort((a, b) => b.oreDecimali - a.oreDecimali);

      setReportData(finalData);
    } catch (error) {
      console.error("Errore caricamento report:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Ricarica i dati quando cambiano le date
  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const filteredData = reportData.filter(u => 
    u.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Riepilogo Ore Semplificato</h2>
        <p className="text-gray-500 mt-2">Consulta rapidamente le ore totali di presenza di ogni membro dello staff in un periodo specifico.</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Controls Bar */}
        <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-10 w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-10 w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Filtra per nome o cognome..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

        </div>

        {/* Table Content */}
        <div className="relative min-h-[300px]">
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-blue-600">
              <Loader2 className="animate-spin mb-2" size={32} />
              <span className="font-medium">Calcolo in corso...</span>
            </div>
          )}

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-gray-500 text-sm font-medium border-b">
                <th className="p-4">Nome Utente</th>
                <th className="p-4">Ruolo</th>
                <th className="p-4 text-center">Giorni di Presenza</th>
                <th className="p-4 text-right">Totale Ore</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {row.nome.substring(0, 2).toUpperCase()}
                      </div>
                      <span>{row.nome}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {row.ruolo}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center space-x-1.5 text-gray-600 bg-gray-50 px-2 py-1 rounded-md text-sm border border-gray-100">
                      <Users size={14} />
                      <span className="font-medium">{row.giorniPresenza}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100">
                      <Clock size={16} />
                      <span className="font-bold">{row.etichettaOre}</span>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoading && filteredData.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-12 text-center text-gray-500">
                    Nessun dato trovato per i criteri di ricerca selezionati.
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
