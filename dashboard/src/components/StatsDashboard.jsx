import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, collection, getDocs, query, where, orderBy, doc, getDoc } from '../firebase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { Loader2, ArrowLeft, Activity, Clock, CalendarDays } from 'lucide-react';

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
      }

      // Query delle timbrature
      let q;
      if (userId) {
        q = query(
          collection(db, "timbrature"),
          where("utente_id", "==", userId),
          where("timestamp", ">=", startDate),
          where("timestamp", "<=", endDate),
          orderBy("timestamp", "asc")
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

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.timestamp) return;

      const jsDate = data.timestamp.toDate();
      const dateStr = format(jsDate, 'dd MMM', { locale: it });

      if (!daysMap[dateStr]) {
        daysMap[dateStr] = { date: dateStr, logs: [], totalMs: 0 };
      }
      daysMap[dateStr].logs.push({ tipo: data.tipo, time: jsDate });
    });

    Object.values(daysMap).forEach(day => {
      let currentEntrata = null;
      day.logs.forEach(log => {
        if (log.tipo === 'ENTRATA') currentEntrata = log.time;
        else if (log.tipo === 'USCITA' && currentEntrata) {
          day.totalMs += (log.time.getTime() - currentEntrata.getTime());
          currentEntrata = null;
        }
      });
      
      const hours = day.totalMs / (1000 * 60 * 60);
      day.ore = parseFloat(hours.toFixed(2));
      totalMs += day.totalMs;
      if (hours > 0) daysCount++;
    });

    const chartData = Object.values(daysMap).filter(d => d.ore > 0);
    const totalHours = totalMs / (1000 * 60 * 60);

    setDailyData(chartData);
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
      const data = doc.data();
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
          else if (log.tipo === 'USCITA' && currentEntrata) {
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
      <header className="mb-8">
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
          {userId ? 'Analisi delle ore di presenza individuali (Ultimi 30 giorni)' : 'Panoramica degli accessi e distribuzione per ruolo (Ultimi 30 giorni)'}
        </p>
      </header>

      {/* KPI Cards (Solo per singolo utente per ora, o se vogliamo globali le aggiungiamo) */}
      {userId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Clock size={24} /></div>
            <div>
              <p className="text-sm font-medium text-gray-500">Totale Ore</p>
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
            {userId ? 'Ore di Presenza Giornaliere' : 'Trend Presenze (Utenti Unici per Giorno)'}
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
            <div className="text-center text-gray-500 mt-4">Nessun dato registrato negli ultimi 30 giorni.</div>
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
    </div>
  );
}
