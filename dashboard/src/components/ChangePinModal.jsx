import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ChangePinModal({ onClose, onSuccess }) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    // Validazioni base
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError("Il nuovo PIN deve contenere esattamente 4 cifre numeriche.");
      return;
    }

    if (newPin !== confirmPin) {
      setError("Il nuovo PIN e la conferma non coincidono.");
      return;
    }

    // Verifica PIN attuale
    const savedPin = localStorage.getItem('grest_admin_pin') || '1234';
    if (currentPin !== savedPin) {
      setError("Il PIN attuale inserito non è corretto.");
      return;
    }

    // Salvataggio nuovo PIN
    localStorage.setItem('grest_admin_pin', newPin);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-fadeIn">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <Lock className="text-indigo-600" size={20} />
            <span>Modifica PIN Amministratore</span>
          </h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-red-700 text-sm">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* PIN Attuale */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              PIN Attuale
            </label>
            <div className="relative">
              <input
                required
                type={showCurrent ? 'text' : 'password'}
                maxLength={4}
                pattern="\d{4}"
                placeholder="Inserisci PIN attuale"
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-3.5 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-center tracking-widest text-lg"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Nuovo PIN */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Nuovo PIN (4 cifre)
            </label>
            <div className="relative">
              <input
                required
                type={showNew ? 'text' : 'password'}
                maxLength={4}
                pattern="\d{4}"
                placeholder="Nuovo codice a 4 cifre"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-3.5 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-center tracking-widest text-lg"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Conferma Nuovo PIN */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Conferma Nuovo PIN
            </label>
            <div className="relative">
              <input
                required
                type={showConfirm ? 'text' : 'password'}
                maxLength={4}
                pattern="\d{4}"
                placeholder="Ripeti nuovo codice"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-3.5 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-center tracking-widest text-lg"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 transition-colors"
            >
              Salva Nuovo PIN
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
