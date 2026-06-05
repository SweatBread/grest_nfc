import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from '../firebase';
import { nfcService } from '../services/nfcService';
import { Plus, Search, Tag, X, User as UserIcon, Edit2, Trash2, AlertCircle, BarChart2 } from 'lucide-react';

export default function UsersManager() {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({ nome: '', cognome: '', ruolo: 'Animatore', nfc_uid: '', stato: 'attivo' });
  const [isScanningNfc, setIsScanningNfc] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (isScanningNfc) {
      nfcService.onNfcRead(({ uid }) => {
        setFormData(prev => ({ ...prev, nfc_uid: uid }));
        setIsScanningNfc(false);
        nfcService.sendBeep('success');
      });
    } else {
      nfcService.removeListeners();
    }

    return () => nfcService.removeListeners();
  }, [isScanningNfc]);

  const loadUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "utenti"));
      const loadedUsers = [];
      querySnapshot.forEach((doc) => {
        loadedUsers.push({ id: doc.id, ...doc.data() });
      });
      setUsers(loadedUsers);
    } catch (err) {
      console.error("Errore caricamento:", err);
      if (err.message.includes("permissions") || err.message.includes("permission")) {
        setError("Errore di permessi: controlla le regole di sicurezza su Firestore.");
      } else {
        setError("Impossibile caricare gli utenti. Riprova più tardi.");
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      // Check if NFC UID is already assigned to active user
      if (formData.nfc_uid) {
        const duplicateCheck = query(collection(db, "utenti"), where("nfc_uid", "==", formData.nfc_uid), where("stato", "==", "attivo"));
        const dupSnap = await getDocs(duplicateCheck);
        if (!dupSnap.empty && dupSnap.docs[0].id !== formData.id) {
          setError("Questo braccialetto è già assegnato a un altro utente attivo!");
          return;
        }
      }

      let writePromise;
      if (formData.id) {
        // Aggiorna utente esistente (senza await per l'offline)
        const userRef = doc(db, "utenti", formData.id);
        const { id, ...dataToUpdate } = formData;
        writePromise = updateDoc(userRef, dataToUpdate);
      } else {
        // Crea nuovo utente (senza await per l'offline)
        writePromise = addDoc(collection(db, "utenti"), formData);
      }
      
      // Log eventuale errore di sync asincrono
      writePromise.catch(err => console.error("Errore sync in background:", err));

      // Aggiornamento interfaccia istantaneo
      setIsModalOpen(false);
      setFormData({ nome: '', cognome: '', ruolo: 'Animatore', nfc_uid: '', stato: 'attivo' });
      
      // Piccolo ritardo per permettere a Firebase di aggiornare il DB locale prima di ricaricare
      setTimeout(() => loadUsers(), 100);
    } catch (err) {
      console.error("Errore salvataggio utente:", err);
      if (err.message.includes("permissions") || err.message.includes("permission")) {
        setError("Permessi negati: aggiorna le Regole di Sicurezza su Firebase per permettere la scrittura.");
      } else {
        setError("Errore durante il salvataggio. Riprova più tardi.");
      }
    }
  };

  const handleEdit = (user) => {
    setError(null);
    setFormData(user);
    setIsModalOpen(true);
  };

  const handleDelete = async (userId) => {
    setError(null);
    if (window.confirm("Sei sicuro di voler eliminare definitivamente questo utente? Questa azione rimuoverà l'anagrafica e l'associazione NFC. Le timbrature passate rimarranno storicizzate.")) {
      try {
        await deleteDoc(doc(db, "utenti", userId));
        loadUsers();
      } catch (err) {
        console.error("Errore durante l'eliminazione:", err);
        if (err.message.includes("permissions") || err.message.includes("permission")) {
          setError("Permessi negati: aggiorna le Regole di Sicurezza su Firebase per permettere l'eliminazione.");
        } else {
          setError("Impossibile eliminare l'utente. Riprova più tardi.");
        }
      }
    }
  };

  const filteredUsers = users.filter(u => 
    `${u.nome} ${u.cognome}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Anagrafica Utenti</h2>
          <p className="text-gray-500 mt-2">Gestisci lo staff e associa i braccialetti NFC.</p>
        </div>
        <button 
          onClick={() => {
            setError(null);
            setFormData({ nome: '', cognome: '', ruolo: 'Animatore', nfc_uid: '', stato: 'attivo' });
            setIsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Nuovo Utente</span>
        </button>
      </header>

      {error && !isModalOpen && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3 text-red-700">
          <AlertCircle size={20} />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Search and Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Cerca per nome o cognome..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 text-gray-500 text-sm font-medium border-b">
              <th className="p-4">Nome e Cognome</th>
              <th className="p-4">Ruolo</th>
              <th className="p-4">UID Braccialetto</th>
              <th className="p-4">Stato</th>
              <th className="p-4 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="p-4 font-medium text-gray-900">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                      {user.nome[0]}{user.cognome[0]}
                    </div>
                    <span>{user.nome} {user.cognome}</span>
                  </div>
                </td>
                <td className="p-4 text-gray-600">{user.ruolo}</td>
                <td className="p-4">
                  {user.nfc_uid ? (
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 border">
                      {user.nfc_uid}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm italic">Nessuno</span>
                  )}
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.stato === 'attivo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.stato}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end space-x-2">
                    <Link to={`/stats/${user.id}`} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Statistiche Utente">
                      <BarChart2 size={18} />
                    </Link>
                    <button onClick={() => handleEdit(user)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifica Utente">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(user.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Elimina Utente">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nuovo Utente */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-900">{formData.id ? 'Modifica Staff' : 'Aggiungi Staff'}</h3>
              <button onClick={() => { setIsModalOpen(false); setIsScanningNfc(false); setError(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            {error && (
              <div className="mx-6 mt-5 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 text-red-700">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Nome</label>
                  <input required type="text" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Cognome</label>
                  <input required type="text" value={formData.cognome} onChange={e => setFormData({...formData, cognome: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Ruolo</label>
                <select value={formData.ruolo} onChange={e => setFormData({...formData, ruolo: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                  <option>Responsabile</option>
                  <option>Animatore</option>
                  <option>Aiuto-Animatore</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex justify-between items-center">
                  <span>Braccialetto NFC <span className="text-gray-400 font-normal ml-1">(Opzionale)</span></span>
                </label>
                
                <div className="flex space-x-3">
                  <input type="text" readOnly placeholder="Nessun tag associato" value={formData.nfc_uid} className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 font-mono text-sm" />
                  
                  {formData.nfc_uid ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, nfc_uid: '' });
                        setIsScanningNfc(false);
                      }}
                      className="px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2 transition-colors bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                    >
                      <X size={16} />
                      <span>Scollega</span>
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => setIsScanningNfc(!isScanningNfc)}
                      className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2 transition-colors ${isScanningNfc ? 'bg-blue-100 text-blue-700 border border-blue-200 animate-pulse' : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'}`}
                    >
                      <Tag size={16} />
                      <span>{isScanningNfc ? 'In ascolto...' : 'Associa Tag'}</span>
                    </button>
                  )}
                </div>
                {isScanningNfc && <p className="text-xs text-blue-600">Avvicina un braccialetto al lettore USB...</p>}
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
                <button type="button" onClick={() => { setIsModalOpen(false); setError(null); }} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-lg">Annulla</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm">Salva Utente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
