import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, collection, getDocs, query, where, orderBy, doc, getDoc } from '../firebase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { Loader2, ArrowLeft, Activity, Clock, CalendarDays, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function StatsDashboard() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  
  // Dati per i grafici
  const [dailyData, setDailyData] = useState([]);
  const [roleData, setRoleData] = useState([]);
  const [kpiData, setKpiData] = useState({ totalHours: 0, avgHours: 0, totalDays: 0 });
  const [individualDays, setIndividualDays] = useState({});

  useEffect(() => {
    loadStats();
  }, [userId]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const startDate = startOfDay(subDays(new Date(), 30)); // Ultimi 30 giorni
      const endDate = endOfDay(new Date());

      // Se c'è un userId, carichiamo le sue info di base
      if (userId) {
        const userSnap = await getDoc(doc(db, "utenti", userId));
        if (userSnap.exists()) {
          setUserData({ id: userSnap.id, ...userSnap.data() });
        }
      } else {
        setUserData(null);
        setIndividualDays({});
      }

      // Query delle timbrature
      let q;
      if (userId) {
        // PER UTENTE SINGOLO: interroga senza filtri data e senza orderBy per evitare requisiti di indice composito.
        // I dati verranno filtrati e ordinati direttamente in memoria in JavaScript.
        q = query(
          collection(db, "timbrature"),
          where("utente_id", "==", userId)
        );
      } else {
        q = query(
          collection(db, "timbrature"),
          where("timestamp", ">=", startDate),
          where("timestamp", "<=", endDate),
          orderBy("timestamp", "asc")
        );
      }

      const snapshot = await getDocs(q);

      if (userId) {
        processIndividualData(snapshot);
      } else {
        processGlobalData(snapshot);
      }

    } catch (error) {
      console.error("Errore caricamento statistiche:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const processIndividualData = (snapshot) => {
    const daysMap = {};
    let totalMs = 0;
    let daysCount = 0;

    // 1. Ordina cronologicamente in memoria i record
    const docs = [];
    snapshot.forEach(doc => {
      docs.push({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) });
    });
    docs.sort((a, b) => {
      const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
      const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
      return timeA - timeB;
    });

    // 2. Raggruppa per data (giornaliero) per calcolare la durata lavorata in ciascun giorno
    docs.forEach(data => {
      if (!data.timestamp) return;

      const jsDate = data.timestamp.toDate();
      const dateStr = format(jsDate, 'yyyy-MM-dd');

      if (!daysMap[dateStr]) {
        daysMap[dateStr] = { date: jsDate, logs: [], totalMs: 0 };
      }
      daysMap[dateStr].logs.push({ tipo: data.tipo, time: jsDate });
    });

    // Calcola il tempo giornaliero
    Object.values(daysMap).forEach(day => {
      let currentEntrata = null;
      day.logs.forEach(log => {
        if (log.tipo === 'ENTRATA') currentEntrata = log.time;
        else if ((log.tipo === 'USCITA' || log.tipo === 'USCITA_AUTOMATICA') && currentEntrata) {
          day.totalMs += (log.time.getTime() - currentEntrata.getTime());
          currentEntrata = null;
        }
      });
      
      day.ore = day.totalMs / (1000 * 60 * 60);
      totalMs += day.totalMs;
      if (day.ore > 0) daysCount++;
    });

    // 3. Raggruppa i risultati giornalieri per settimana lavorativa (Lunedì - Venerdì)
    const weeksMap = {};
    Object.values(daysMap).forEach(day => {
      const jsDate = day.date;
      const dayOfWeek = jsDate.getDay(); // 0 = Domenica, 1 = Lunedì, ..., 6 = Sabato

      // Filtriamo solo da lunedì (1) a venerdì (5)
      if (dayOfWeek < 1 || dayOfWeek > 5) return;

      // Calcola il Lunedì di questa settimana
      const diffToMonday = 1 - dayOfWeek;
      const monday = new Date(jsDate);
      monday.setDate(jsDate.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      // Calcola il Venerdì di questa settimana
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      friday.setHours(23, 59, 59, 999);

      const weekKey = format(monday, 'yyyy-MM-dd');
      const label = `${format(monday, 'dd/MM')} - ${format(friday, 'dd/MM')}`;

      if (!weeksMap[weekKey]) {
        weeksMap[weekKey] = {
          dateKey: weekKey,
          dateLabel: label,
          totalMs: 0
        };
      }
      weeksMap[weekKey].totalMs += day.totalMs;
    });

    // Ordina le settimane cronologicamente
    const chartData = Object.values(weeksMap)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .map(w => ({
        date: w.dateLabel,
        ore: parseFloat((w.totalMs / (1000 * 60 * 60)).toFixed(2))
      }));

    const totalHours = totalMs / (1000 * 60 * 60);

    setDailyData(chartData);
    setIndividualDays(daysMap);
    setKpiData({
      totalHours: totalHours.toFixed(1),
      avgHours: daysCount > 0 ? (totalHours / daysCount).toFixed(1) : 0,
      totalDays: daysCount
    });
  };

  const processGlobalData = (snapshot) => {
    const daysMap = {};
    const rolesMap = {};

    snapshot.forEach(doc => {
      const data = doc.data({ serverTimestamps: 'estimate' });
      if (!data.timestamp || !data.utente_id) return;

      const jsDate = data.timestamp.toDate();
      const dateStr = format(jsDate, 'dd MMM', { locale: it });
      const ruolo = data.ruolo || 'Altro';

      // Raggruppamento giornaliero per calcolare le presenze
      if (!daysMap[dateStr]) {
        daysMap[dateStr] = { date: dateStr, userSet: new Set() };
      }
      daysMap[dateStr].userSet.add(data.utente_id);

      // Raccolta log per calcolo ore per ruolo
      if (!rolesMap[ruolo]) {
        rolesMap[ruolo] = { userDays: {} };
      }
      const key = `${data.utente_id}_${dateStr}`;
      if (!rolesMap[ruolo].userDays[key]) {
        rolesMap[ruolo].userDays[key] = [];
      }
      rolesMap[ruolo].userDays[key].push({ tipo: data.tipo, time: jsDate });
    });

    // Processa grafico giornaliero (numero di presenti per giorno)
    const dailyChart = Object.values(daysMap).map(d => ({
      date: d.date,
      presenti: d.userSet.size
    }));
    setDailyData(dailyChart);

    // Processa dati ruoli (ore totali per ruolo)
    const roleChart = [];
    Object.entries(rolesMap).forEach(([ruolo, record]) => {
      let totalMs = 0;
      Object.values(record.userDays).forEach(logs => {
        let currentEntrata = null;
        logs.forEach(log => {
          if (log.tipo === 'ENTRATA') currentEntrata = log.time;
          else if ((log.tipo === 'USCITA' || log.tipo === 'USCITA_AUTOMATICA') && currentEntrata) {
            totalMs += (log.time.getTime() - currentEntrata.getTime());
            currentEntrata = null;
          }
        });
      });
      const hours = totalMs / (1000 * 60 * 60);
      if (hours > 0) {
        roleChart.push({ name: ruolo, ore: parseFloat(hours.toFixed(1)) });
      }
    });
    setRoleData(roleChart);
  };

  const getContributionData = () => {
    const weeks = [];
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = Domenica, 1 = Lunedì, ...
    
    // Trova il lunedì della settimana corrente
    const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() + diffToMonday);
    currentMonday.setHours(0, 0, 0, 0);

    // Lunedì di 15 settimane fa
    const startMonday = new Date(currentMonday);
    startMonday.setDate(currentMonday.getDate() - 15 * 7);

    let tempDate = new Date(startMonday);

    for (let w = 0; w < 16; w++) {
      const days = [];
      let monthLabel = "";
      
      for (let d = 0; d < 7; d++) {
        const dateStr = format(tempDate, 'yyyy-MM-dd');
        
        // Se è il primo giorno della colonna ed è lunedì, prendiamo l'etichetta del mese
        if (d === 0) {
          monthLabel = format(tempDate, 'MMM', { locale: it });
        }
        
        const dayRecord = individualDays[dateStr] || { ore: 0 };
        days.push({
          date: new Date(tempDate),
          ore: dayRecord.ore || 0
        });

        tempDate.setDate(tempDate.getDate() + 1);
      }
      weeks.push({ days, monthLabel });
    }
    return weeks;
  };

  const getColorClass = (ore) => {
    if (ore === 0) return 'bg-gray-100 border border-gray-200/50';
    if (ore <= 2) return 'bg-emerald-100 border border-emerald-200/20';
    if (ore <= 5) return 'bg-emerald-300';
    if (ore <= 8) return 'bg-emerald-500';
    return 'bg-emerald-700';
  };

  const weeks = userId ? getContributionData() : [];

  const getWeeklyBreakdown = () => {
    const weeksMap = {};

    Object.entries(individualDays).forEach(([dateStr, dayRecord]) => {
      const jsDate = dayRecord.date;
      const dayOfWeek = jsDate.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sab
      
      // Trova il lunedì della settimana
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(jsDate);
      monday.setDate(jsDate.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const weekKey = format(monday, 'yyyy-MM-dd');
      
      if (!weeksMap[weekKey]) {
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const label = `Settimana ${format(monday, 'dd MMM', { locale: it })} - ${format(sunday, 'dd MMM yyyy', { locale: it })}`;
        
        // Inizializza i 7 giorni (Lun-Dom)
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          return {
            name: format(d, 'eee', { locale: it }), // Lun, Mar...
            dateStr: format(d, 'yyyy-MM-dd'),
            ore: 0
          };
        });

        weeksMap[weekKey] = {
          weekKey,
          label,
          days,
          totalHours: 0
        };
      }

      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weeksMap[weekKey].days[dayIndex].ore = dayRecord.ore || 0;
      weeksMap[weekKey].totalHours += dayRecord.ore || 0;
    });

    return Object.values(weeksMap)
      .filter(w => w.totalHours > 0)
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  };

  const weeklyBreakdown = userId ? getWeeklyBreakdown() : [];

  const generatePDFReport = () => {
    if (!userData) return;
    
    const doc = new jsPDF();
    
    // Configura font ed estetica base
    doc.setFont("helvetica", "normal");
    
    // Rettangolo decorativo blu in alto (Barra di stile)
    doc.setFillColor(59, 130, 246); // bg-blue-600
    doc.rect(15, 15, 180, 4, "F");
    
    // Titolo Principale
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 41, 55); // gray-800
    doc.text(`Report Ore Presenze - GrEst ${new Date().getFullYear()}`, 15, 30);
    
    // Sottotitolo e Dettagli Utente
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Generato il: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, 37);
    
    doc.line(15, 42, 195, 42); // Linea divisoria
    
    // Informazioni Anagrafiche
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81); // gray-700
    doc.setFont("helvetica", "bold");
    doc.text("DATI UTENTE:", 15, 52);
    doc.setFont("helvetica", "normal");
    doc.text(`Nominativo: ${userData.nome} ${userData.cognome}`, 15, 58);
    doc.text(`Ruolo: ${userData.ruolo || 'N/D'}`, 15, 64);
    
    // Box KPI (Riepilogo)
    doc.setFillColor(249, 250, 251); // gray-50
    doc.roundedRect(15, 70, 180, 22, 2, 2, "F");
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.roundedRect(15, 70, 180, 22, 2, 2, "S");
    
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.setFont("helvetica", "bold");
    doc.text("ORE TOTALI", 25, 76);
    doc.text("GIORNI PRESENZA", 80, 76);
    doc.text("MEDIA ORE/GIORNO", 135, 76);
    
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text(`${kpiData.totalHours} h`, 25, 85);
    doc.text(`${kpiData.totalDays}`, 80, 85);
    doc.text(`${kpiData.avgHours} h`, 135, 85);
    
    // Tabella delle Presenze Settimanali
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text("Dettaglio Presenze Settimanali", 15, 102);
    
    let y = 110;
    
    // Intestazione Tabella
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(107, 114, 128);
    doc.text("Settimana", 17, y);
    doc.text("Dettaglio Giornaliero (Ore effettive lavorate)", 75, y);
    doc.text("Ore Totali", 175, y);
    
    doc.setDrawColor(209, 213, 219); // gray-300
    doc.line(15, y + 2, 195, y + 2);
    
    y += 8;
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 65, 81);
    
    weeklyBreakdown.forEach((week) => {
      // Controllo salto pagina
      if (y > 270) {
        doc.addPage();
        // Disegna di nuovo la barra superiore
        doc.setFillColor(59, 130, 246);
        doc.rect(15, 15, 180, 4, "F");
        y = 30;
      }
      
      doc.setFont("helvetica", "bold");
      doc.text(week.label.replace("Settimana ", ""), 17, y);
      
      doc.setFont("helvetica", "normal");
      // Dettaglio giornaliero
      const daysWithHours = week.days
        .filter(d => d.ore > 0)
        .map(d => `${d.name.toUpperCase()}: ${d.ore.toFixed(1)}h`)
        .join("  |  ");
        
      doc.text(daysWithHours || "Nessun transito registrato", 75, y, { maxWidth: 95 });
      
      doc.setFont("helvetica", "bold");
      doc.text(`${week.totalHours.toFixed(1)} h`, 175, y);
      
      // Linea sottile per riga
      doc.setDrawColor(243, 244, 246);
      doc.line(15, y + 4, 195, y + 4);
      
      y += 12;
    });
    
    // Piè di pagina
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.setFont("helvetica", "normal");
      doc.text(`Pagina ${i} di ${pageCount}`, 175, 287);
      doc.text("Grest NFC - Sistema Rilevazione Presenze Automatica", 15, 287);
    }
    
    const fileName = `Report_Presenze_${userData.nome}_${userData.cognome}.pdf`.replace(/\s+/g, '_');
    doc.save(fileName);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-blue-600 space-y-4">
        <Loader2 className="animate-spin" size={40} />
        <p className="text-gray-600 font-medium">Elaborazione statistiche...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 pb-16">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          {userId && (
            <button 
              onClick={() => navigate('/users')}
              className="flex items-center space-x-2 text-gray-500 hover:text-blue-600 transition-colors mb-4"
            >
              <ArrowLeft size={18} />
              <span>Torna ad Anagrafica</span>
            </button>
          )}
          
          <h2 className="text-3xl font-bold text-gray-900">
            {userId ? `Statistiche: ${userData?.nome} ${userData?.cognome}` : 'Statistiche Globali'}
          </h2>
          <p className="text-gray-500 mt-2">
            {userId ? 'Analisi storica delle ore di presenza individuali suddivise per settimana lavorativa (Lunedì - Venerdì)' : 'Panoramica degli accessi e distribuzione per ruolo (Ultimi 30 giorni)'}
          </p>
        </div>

        {userId && (
          <button
            onClick={generatePDFReport}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl shadow-sm border border-blue-600 hover:border-blue-700 transition-all font-medium self-end md:self-auto"
          >
            <FileDown size={20} />
            <span>Scarica Report PDF</span>
          </button>
        )}
      </header>

      {/* KPI Cards (Solo per singolo utente per ora, o se vogliamo globali le aggiungiamo) */}
      {userId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Clock size={24} /></div>
            <div>
              <p className="text-sm font-medium text-gray-500">Totale Ore Storico</p>
              <h3 className="text-2xl font-bold text-gray-900">{kpiData.totalHours}h</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CalendarDays size={24} /></div>
            <div>
              <p className="text-sm font-medium text-gray-500">Giorni di Presenza</p>
              <h3 className="text-2xl font-bold text-gray-900">{kpiData.totalDays}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Activity size={24} /></div>
            <div>
              <p className="text-sm font-medium text-gray-500">Media Ore/Giorno</p>
              <h3 className="text-2xl font-bold text-gray-900">{kpiData.avgHours}h</h3>
            </div>
          </div>
        </div>
      )}

      {/* Charts Area */}
      <div className={`grid grid-cols-1 ${!userId ? 'lg:grid-cols-3' : ''} gap-6`}>
        
        {/* Main Trend Chart */}
        <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 ${!userId ? 'lg:col-span-2' : ''}`}>
          <h3 className="text-lg font-bold text-gray-800 mb-6">
            {userId ? 'Ore di Presenza Settimanali (Lun - Ven)' : 'Trend Presenze (Utenti Unici per Giorno)'}
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {userId ? (
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#f3f4f6'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    formatter={(value) => [`${value} ore`, 'Totale']}
                  />
                  <Bar dataKey="ore" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    formatter={(value) => [`${value} staff`, 'Presenti']}
                  />
                  <Line type="monotone" dataKey="presenti" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
          {dailyData.length === 0 && (
            <div className="text-center text-gray-500 mt-4">
              {userId ? 'Nessuna timbratura registrata nei giorni lavorativi (Lun-Ven).' : 'Nessun dato registrato negli ultimi 30 giorni.'}
            </div>
          )}
        </div>

        {/* Global Only: Role Distribution Chart */}
        {!userId && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Ore Erogate per Ruolo</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="ore"
                  >
                    {roleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value} ore`, 'Totale']}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {roleData.length === 0 && (
              <div className="text-center text-gray-500 mt-4">Nessun dato ruoli disponibile.</div>
            )}
          </div>
        )}

      </div>

      {/* GitHub Calendar (Solo per singolo utente) */}
      {userId && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Calendario Presenze</h3>
          <p className="text-sm text-gray-500 mb-6">Visualizzazione giornaliera delle ore lavorate (Ultime 16 settimane)</p>
          
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-[700px] items-start space-x-2">
              {/* Day Labels Column */}
              <div className="flex flex-col gap-[4px] text-[10px] text-gray-400 font-medium">
                <div className="h-[14px] flex items-center pr-2">Lun</div>
                <div className="h-[14px]" />
                <div className="h-[14px] flex items-center pr-2">Mer</div>
                <div className="h-[14px]" />
                <div className="h-[14px] flex items-center pr-2">Ven</div>
                <div className="h-[14px]" />
                <div className="h-[14px] flex items-center pr-2">Dom</div>
              </div>
              
              {/* Weeks & Months */}
              <div className="flex-1">
                {/* Months row */}
                <div className="flex text-[10px] text-gray-400 font-medium mb-1 h-4">
                  {weeks.map((week, idx) => {
                    const showMonth = idx === 0 || (idx > 0 && weeks[idx - 1].monthLabel !== week.monthLabel);
                    return (
                      <div key={idx} className="w-[18px] text-left">
                        {showMonth ? week.monthLabel : ''}
                      </div>
                    );
                  })}
                </div>
                
                {/* Grid row */}
                <div className="flex gap-[4px]">
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-[4px]">
                      {week.days.map((day, dIdx) => (
                        <div
                          key={dIdx}
                          className={`w-[14px] h-[14px] rounded-[2px] transition-all hover:scale-110 ${getColorClass(day.ore)} cursor-pointer`}
                          title={`${format(day.date, 'eeee dd MMMM yyyy', { locale: it })}: ${day.ore.toFixed(1)} ore`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex items-center space-x-2 text-xs text-gray-400 mt-4 justify-end">
              <span>Meno</span>
              <div className="w-[10px] h-[10px] rounded-[1px] bg-gray-100 border border-gray-200/50"></div>
              <div className="w-[10px] h-[10px] rounded-[1px] bg-emerald-100"></div>
              <div className="w-[10px] h-[10px] rounded-[1px] bg-emerald-300"></div>
              <div className="w-[10px] h-[10px] rounded-[1px] bg-emerald-500"></div>
              <div className="w-[10px] h-[10px] rounded-[1px] bg-emerald-700"></div>
              <span>Più</span>
            </div>
          </div>
        </div>
      )}

      {/* Dettaglio Giornaliero per Settimana (Solo per singolo utente) */}
      {userId && weeklyBreakdown.length > 0 && (
        <div className="space-y-4 mt-6">
          <h3 className="text-lg font-bold text-gray-800">Dettaglio Giornaliero per Settimana</h3>
          <p className="text-sm text-gray-500">Distribuzione delle ore di presenza per ciascuna settimana in cui è stata registrata attività</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {weeklyBreakdown.map((week) => (
              <div key={week.weekKey} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h4 className="font-bold text-gray-800 text-sm">{week.label}</h4>
                  <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded-md border border-blue-100">
                    {week.totalHours.toFixed(1)} ore tot.
                  </span>
                </div>
                
                <div className="space-y-2.5">
                  {week.days.map((day, idx) => {
                    const maxHoursEstimate = 10;
                    const percentage = Math.min(100, (day.ore / maxHoursEstimate) * 100);
                    
                    const isWeekend = idx >= 5;
                    const barColor = isWeekend ? 'bg-gray-400' : 'bg-blue-600';
                    
                    return (
                      <div key={idx} className="flex items-center text-xs">
                        <span className="w-8 font-semibold text-gray-500 capitalize">{day.name}</span>
                        <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden mx-3">
                          {day.ore > 0 && (
                            <div 
                              className={`${barColor} h-full rounded-full`} 
                              style={{ width: `${percentage}%` }} 
                            />
                          )}
                        </div>
                        <span className={`w-12 text-right font-medium ${day.ore > 0 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
                          {day.ore > 0 ? `${day.ore.toFixed(1)}h` : '0h'}
                        </span>
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
