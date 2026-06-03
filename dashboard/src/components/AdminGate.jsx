import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, getDocs, query, where } from '../firebase';
import { nfcService } from '../services/nfcService';
import { Lock, Smartphone, ShieldAlert, KeyRound, AlertCircle, ArrowLeft, Delete, Loader2 } from 'lucide-react';

export default function AdminGate({ onUnlock }) {
  const navigate = useNavigate();
  const [method, setMethod] = useState('nfc'); // 'nfc' o 'pin'
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const errorTimeoutRef = useRef(null);

  // Ascolto lettore NFC
  useEffect(() => {
    if (method !== 'nfc') return;

    nfcService.onNfcRead(async ({ uid }) => {
      if (isVerifying) return;
      setIsVerifying(true);
      setError(null);

      try {
        // Query per cercare il braccialetto associato
        const q = query(
          collection(db, "utenti"),
          where("nfc_uid", "==", uid),
          where("stato", "==", "attivo")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          showError("Braccialetto non registrato o utente inattivo.");
          nfcService.sendBeep('error');
          setIsVerifying(false);
          return;
        }

        const userDoc = snapshot.docs[0].data();
        if (userDoc.ruolo === 'Responsabile') {
          nfcService.sendBeep('success');
          onUnlock();
        } else {
          showError(`Accesso negato: ${userDoc.nome} ${userDoc.cognome} è registrato come ${userDoc.ruolo}.`);
          nfcService.sendBeep('error');
        }
      } catch (err) {
        console.error("Errore autenticazione NFC:", err);
        showError("Errore durante la lettura del database.");
        nfcService.sendBeep('error');
      } finally {
        setIsVerifying(false);
      }
    });

    return () => {
      nfcService.removeListeners();
    };
  }, [method, isVerifying]);

  // Gestione inserimento cifre PIN
  const handleNumberClick = (num) => {
    setError(null);
    if (pinInput.length >= 4) return;
    const newPin = pinInput + num;
    setPinInput(newPin);

    if (newPin.length === 4) {
      verifyPin(newPin);
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  const verifyPin = (pin) => {
    const savedPin = localStorage.getItem('grest_admin_pin') || '1234';
    if (pin === savedPin) {
      onUnlock();
    } else {
      showError("PIN errato. Riprova.");
      setPinInput('');
    }
  };

  const showError = (msg) => {
    setError(msg);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setError(null);
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  // Gestione tastiera fisica per la modalità PIN
  useEffect(() => {
    if (method !== 'pin') return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumberClick(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [method, pinInput]);

  return (
    <div className="fixed inset-0 z-40 bg-slate-900 flex flex-col justify-between p-8 text-white select-none">
      
      {/* Header */}
      <header className="flex justify-between items-center max-w-4xl mx-auto w-full">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Annulla e Torna Indietro</span>
        </button>
        <div className="flex items-center space-x-2 bg-slate-800 px-4 py-2 rounded-full border border-slate-700">
          <Lock className="text-blue-400" size={16} />
          <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">Area Riservata Admin</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full py-8">
        
        {method === 'nfc' ? (
          /* MODALITÀ NFC SBLOCCO */
          <div className="flex flex-col items-center text-center space-y-8 animate-fadeIn">
            <div className="relative">
              {/* Cerchi pulsanti radar */}
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping scale-150 duration-1000" />
              <div className="absolute inset-0 bg-indigo-500/10 rounded-full animate-ping scale-200 duration-1500" />
              
              <div className="relative w-28 h-28 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center border border-white/20 shadow-2xl">
                {isVerifying ? (
                  <Loader2 size={44} className="text-white animate-spin" />
                ) : (
                  <Smartphone size={44} className="text-white animate-pulse" />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight">Sblocco NFC</h2>
              <p className="text-slate-400 text-sm max-w-sm">
                Avvicina il braccialetto di un **Responsabile** al lettore per accedere alle funzioni amministrative.
              </p>
            </div>
          </div>
        ) : (
          /* MODALITÀ PIN PAD DI BACKUP */
          <div className="flex flex-col items-center text-center space-y-6 w-full animate-fadeIn">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700 shadow-lg mb-2">
              <KeyRound size={28} className="text-indigo-400" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">PIN di Backup</h2>
              <p className="text-slate-400 text-xs">Inserisci il codice di sblocco numerico</p>
            </div>

            {/* Indicatori PIN (pallini) */}
            <div className="flex space-x-4 my-2">
              {[0, 1, 2, 3].map((index) => (
                <div 
                  key={index}
                  className={`w-4.5 h-4.5 rounded-full border border-slate-600 transition-all duration-200 ${
                    pinInput.length > index ? 'bg-indigo-500 border-indigo-400 scale-110 shadow-md shadow-indigo-500/30' : 'bg-slate-850'
                  }`}
                />
              ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[280px] w-full pt-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleNumberClick(num)}
                  className="w-20 h-20 bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 active:scale-95 text-2xl font-bold rounded-full border border-slate-700/50 shadow-sm flex items-center justify-center transition-all duration-150"
                >
                  {num}
                </button>
              ))}
              <div /> {/* Spazio vuoto */}
              <button
                type="button"
                onClick={() => handleNumberClick(0)}
                className="w-20 h-20 bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 active:scale-95 text-2xl font-bold rounded-full border border-slate-700/50 shadow-sm flex items-center justify-center transition-all duration-150"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={pinInput.length === 0}
                className="w-20 h-20 bg-slate-850 hover:bg-slate-800 active:bg-slate-700 text-slate-400 disabled:opacity-40 disabled:pointer-events-none rounded-full flex items-center justify-center transition-all duration-150"
              >
                <Delete size={24} />
              </button>
            </div>
          </div>
        )}

        {/* Error Container (Altezza fissa per non far saltare il layout) */}
        <div className="h-16 flex items-center justify-center mt-6 w-full">
          {error && (
            <div className="flex items-center space-x-2 bg-red-900/40 text-red-300 px-4 py-2.5 rounded-xl border border-red-800/50 max-w-sm animate-bounce text-sm text-center">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

      </main>

      {/* Footer Toggle Switch */}
      <footer className="max-w-md mx-auto w-full flex justify-center pb-4">
        {method === 'nfc' ? (
          <button
            onClick={() => { setMethod('pin'); setError(null); }}
            className="flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-5 py-3 rounded-2xl border border-slate-700/60 shadow-md transition-all text-sm font-medium"
          >
            <KeyRound size={18} />
            <span>Sblocca con PIN di Backup</span>
          </button>
        ) : (
          <button
            onClick={() => { setMethod('nfc'); setError(null); }}
            className="flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-5 py-3 rounded-2xl border border-slate-700/60 shadow-md transition-all text-sm font-medium"
          >
            <Smartphone size={18} />
            <span>Sblocca con Braccialetto NFC</span>
          </button>
        )}
      </footer>

    </div>
  );
}
