import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { nfcService } from './services/nfcService';
import DashboardHome from './components/DashboardHome';
import UsersManager from './components/UsersManager';
import ExportData from './components/ExportData';
import StatsDashboard from './components/StatsDashboard';
import HoursReport from './components/HoursReport';
import ControlloTimbrature from './components/ControlloTimbrature';
import BackupRecovery from './components/BackupRecovery';
import AdminGate from './components/AdminGate';
import ChangePinModal from './components/ChangePinModal';
import { LayoutDashboard, Users, FileDown, BarChart2, Clock, Lock, Unlock, KeyRound, CheckCircle2, ShieldAlert, Database } from 'lucide-react';

function AdminRoute({ children, isAuthenticated, onUnlock }) {
  if (!isAuthenticated) {
    return <AdminGate onUnlock={onUnlock} />;
  }
  return children;
}

function AppContent() {
  const [readerStatus, setReaderStatus] = useState({ connected: false, name: null });
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('grest_admin_auth') === 'true');
  const [showChangePin, setShowChangePin] = useState(false);
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);
  const navigate = useNavigate();

  const setAdminAuth = (auth) => {
    setIsAdmin(auth);
    if (auth) {
      sessionStorage.setItem('grest_admin_auth', 'true');
    } else {
      sessionStorage.removeItem('grest_admin_auth');
    }
  };

  useEffect(() => {
    nfcService.connect();

    nfcService.onReaderStatus((status) => {
      setReaderStatus(status);
    });

    return () => {
      nfcService.removeListeners();
      nfcService.disconnect();
    };
  }, []);

  const handleLock = () => {
    setAdminAuth(false);
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r shadow-sm flex flex-col justify-between">
        <div className="flex flex-col flex-1">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-blue-600 tracking-tight">Grest NFC</h1>
            <p className="text-sm text-gray-500 mt-1">Gestione Presenze</p>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link to="/" className="flex items-center space-x-3 text-gray-700 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <LayoutDashboard size={20} />
              <span className="font-medium">Dashboard</span>
            </Link>
            <Link to="/users" className="flex items-center justify-between text-gray-700 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <div className="flex items-center space-x-3">
                <Users size={20} />
                <span className="font-medium">Anagrafica Utenti</span>
              </div>
              {!isAdmin && <Lock size={14} className="text-slate-400" />}
            </Link>
            <Link to="/hours" className="flex items-center justify-between text-gray-700 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <div className="flex items-center space-x-3">
                <Clock size={20} />
                <span className="font-medium">Riepilogo Ore</span>
              </div>
              {!isAdmin && <Lock size={14} className="text-slate-400" />}
            </Link>
            <Link to="/controllo-timbrature" className="flex items-center justify-between text-gray-700 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <div className="flex items-center space-x-3">
                <ShieldAlert size={20} />
                <span className="font-medium">Controllo Timbrature</span>
              </div>
              {!isAdmin && <Lock size={14} className="text-slate-400" />}
            </Link>
            <Link to="/stats" className="flex items-center justify-between text-gray-700 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <div className="flex items-center space-x-3">
                <BarChart2 size={20} />
                <span className="font-medium">Statistiche</span>
              </div>
              {!isAdmin && <Lock size={14} className="text-slate-400" />}
            </Link>
            <Link to="/export" className="flex items-center justify-between text-gray-700 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <div className="flex items-center space-x-3">
                <FileDown size={20} />
                <span className="font-medium">Esporta Dati</span>
              </div>
              {!isAdmin && <Lock size={14} className="text-slate-400" />}
            </Link>
            <Link to="/backup" className="flex items-center justify-between text-gray-700 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <div className="flex items-center space-x-3">
                <Database size={20} />
                <span className="font-medium">Backup e Ripristino</span>
              </div>
              {!isAdmin && <Lock size={14} className="text-slate-400" />}
            </Link>
          </nav>
        </div>
        
        <div className="flex flex-col">
          {/* Admin lock controls (visible only when authenticated) */}
          {isAdmin && (
            <div className="p-4 border-t bg-indigo-50/30 space-y-2">
              <button
                onClick={() => setShowChangePin(true)}
                className="w-full flex items-center space-x-2 text-indigo-700 hover:bg-indigo-50 p-2.5 rounded-lg text-xs font-semibold transition-colors"
              >
                <KeyRound size={16} />
                <span>Cambia PIN di Backup</span>
              </button>
              <button
                onClick={handleLock}
                className="w-full flex items-center space-x-2 text-red-600 hover:bg-red-50 p-2.5 rounded-lg text-xs font-semibold transition-colors border border-red-105"
              >
                <Unlock size={16} />
                <span>Blocca Area Admin</span>
              </button>
            </div>
          )}

          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${readerStatus.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div className="text-sm">
                <p className="font-semibold text-gray-800">Stato Lettore</p>
                <p className="text-xs text-gray-500 truncate" title={readerStatus.name || 'Disconnesso'}>
                  {readerStatus.connected ? readerStatus.name : 'Nessun lettore'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/users" element={<AdminRoute isAuthenticated={isAdmin} onUnlock={() => setAdminAuth(true)}><UsersManager /></AdminRoute>} />
          <Route path="/hours" element={<AdminRoute isAuthenticated={isAdmin} onUnlock={() => setAdminAuth(true)}><HoursReport /></AdminRoute>} />
          <Route path="/controllo-timbrature" element={<AdminRoute isAuthenticated={isAdmin} onUnlock={() => setAdminAuth(true)}><ControlloTimbrature /></AdminRoute>} />
          <Route path="/stats" element={<AdminRoute isAuthenticated={isAdmin} onUnlock={() => setAdminAuth(true)}><StatsDashboard /></AdminRoute>} />
          <Route path="/stats/:userId" element={<AdminRoute isAuthenticated={isAdmin} onUnlock={() => setAdminAuth(true)}><StatsDashboard /></AdminRoute>} />
          <Route path="/export" element={<AdminRoute isAuthenticated={isAdmin} onUnlock={() => setAdminAuth(true)}><ExportData /></AdminRoute>} />
          <Route path="/backup" element={<AdminRoute isAuthenticated={isAdmin} onUnlock={() => setAdminAuth(true)}><BackupRecovery /></AdminRoute>} />
        </Routes>
      </main>

      {/* Modale Cambio PIN */}
      {showChangePin && (
        <ChangePinModal 
          onClose={() => setShowChangePin(false)}
          onSuccess={() => {
            setShowChangePin(false);
            setPinChangeSuccess(true);
            setTimeout(() => setPinChangeSuccess(false), 3000);
          }}
        />
      )}

      {/* Banner Notifica Successo Cambio PIN */}
      {pinChangeSuccess && (
        <div className="fixed bottom-5 right-5 z-50 p-4 bg-green-100 text-green-800 border border-green-200 rounded-xl shadow-lg flex items-center space-x-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-sm">PIN di backup aggiornato con successo!</span>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
