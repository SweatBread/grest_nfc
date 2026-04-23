import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { nfcService } from './services/nfcService';
import DashboardHome from './components/DashboardHome';
import UsersManager from './components/UsersManager';
import { LayoutDashboard, Users, Activity } from 'lucide-react';

function App() {
  const [readerStatus, setReaderStatus] = useState({ connected: false, name: null });

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

  return (
    <Router>
      <div className="flex h-screen bg-gray-100 font-sans">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r shadow-sm flex flex-col">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-blue-600 tracking-tight">Grest NFC</h1>
            <p className="text-sm text-gray-500 mt-1">Gestione Presenze</p>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link to="/" className="flex items-center space-x-3 text-gray-700 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <LayoutDashboard size={20} />
              <span className="font-medium">Dashboard</span>
            </Link>
            <Link to="/users" className="flex items-center space-x-3 text-gray-700 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <Users size={20} />
              <span className="font-medium">Anagrafica Utenti</span>
            </Link>
          </nav>
          
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
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/users" element={<UsersManager />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
