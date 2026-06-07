import React, { useState, useRef } from 'react';
import { db, collection, getDocs, doc, setDoc, deleteDoc, Timestamp } from '../firebase';
import { format } from 'date-fns';
import { Download, Upload, AlertCircle, CheckCircle2, Loader2, Database, FileJson, AlertTriangle, X } from 'lucide-react';

export default function BackupRecovery() {
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [notification, setNotification] = useState(null);
  
  // File caricato
  const [parsedData, setParsedData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  // Opzioni di ripristino
  const [confirmText, setConfirmText] = useState('');
  const [wipeFirst, setWipeFirst] = useState(false);

  // Cancellazione database e reset
  const [deleteTarget, setDeleteTarget] = useState(null); // 'timbrature' o 'all'
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  
  const fileInputRef = useRef(null);

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // 1. ESPORTAZIONE BACKUP
  const handleExportBackup = async () => {
    try {
      setIsLoading(true);
      setProgress('Esportazione dati in corso...');
      
      const [utentiSnapshot, timbratureSnapshot] = await Promise.all([
        getDocs(collection(db, "utenti")),
        getDocs(collection(db, "timbrature"))
      ]);

      const utenti = utentiSnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      const timbrature = timbratureSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          // Serializziamo correttamente il Timestamp per il restore fedele
          timestamp: data.timestamp ? {
            _type: 'Timestamp',
            seconds: data.timestamp.seconds,
            nanoseconds: data.timestamp.nanoseconds
          } : null
        };
      });

      const backupData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        metadata: {
          totalUsers: utenti.length,
          totalLogs: timbrature.length
        },
        utenti,
        timbrature
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backupData, null, 2)
      )}`;
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      
      const dateStr = format(new Date(), 'yyyy-MM-dd_HH-mm');
      downloadAnchor.setAttribute('download', `grest_backup_${dateStr}.json`);
      
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showNotification("Backup scaricato con successo!", "success");
    } catch (error) {
      console.error("Errore esportazione backup:", error);
      showNotification("Errore durante la creazione del backup.", "error");
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  // 2. GESTIONE CARICAMENTO FILE (UPLOAD)
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file) => {
    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      showNotification("Carica solo file in formato JSON (.json)", "error");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!json.utenti || !json.timbrature) {
          showNotification("Formato backup non valido. Mancano le collezioni utenti o timbrature.", "error");
          setParsedData(null);
          return;
        }
        setParsedData(json);
        showNotification("File di backup caricato e validato con successo!", "success");
      } catch (err) {
        showNotification("Errore di lettura del file JSON. Il file potrebbe essere corrotto.", "error");
        setParsedData(null);
      }
    };

    reader.readAsText(file);
  };

  // 3. RIPRISTINO DEL BACKUP
  const handleRestoreBackup = async () => {
    if (!parsedData) return;
    
    // Se è attiva la pulizia del db, chiedi la conferma scritta
    if (wipeFirst && confirmText.trim().toUpperCase() !== 'CONFERMA') {
      showNotification("Digita 'CONFERMA' nel campo di testo per procedere con la pulizia.", "error");
      return;
    }

    try {
      setIsProcessing(true);
      
      // FASE A: Cancellazione se richiesto
      if (wipeFirst) {
        setProgress('Fase 1: Cancellazione utenti attuali...');
        const utentiSnap = await getDocs(collection(db, "utenti"));
        for (const docSnap of utentiSnap.docs) {
          await deleteDoc(doc(db, "utenti", docSnap.id));
        }

        setProgress('Fase 2: Cancellazione timbrature attuali...');
        const timbratureSnap = await getDocs(collection(db, "timbrature"));
        for (const docSnap of timbratureSnap.docs) {
          await deleteDoc(doc(db, "timbrature", docSnap.id));
        }
      }

      // FASE B: Ripristino Utenti
      setProgress('Fase 3: Ripristino anagrafica utenti...');
      const utentiList = parsedData.utenti || [];
      for (const user of utentiList) {
        const { id, ...userData } = user;
        // setDoc ricrea l'utente con l'ID originale per mantenere le relazioni loggato/scansioni
        await setDoc(doc(db, "utenti", id), userData);
      }

      // FASE C: Ripristino Timbrature
      setProgress('Fase 4: Ripristino timbrature...');
      const timbratureList = parsedData.timbrature || [];
      for (const log of timbratureList) {
        const { id, ...logData } = log;
        
        // Ricostruiamo il Timestamp
        if (logData.timestamp) {
          if (logData.timestamp._type === 'Timestamp') {
            logData.timestamp = new Timestamp(logData.timestamp.seconds, logData.timestamp.nanoseconds);
          } else {
            logData.timestamp = Timestamp.fromDate(new Date(logData.timestamp));
          }
        }

        await setDoc(doc(db, "timbrature", id), logData);
      }

      showNotification(`Ripristino completato con successo! Importati ${utentiList.length} utenti e ${timbratureList.length} timbrature.`, "success");
      setParsedData(null);
      setFileName('');
      setConfirmText('');
      setWipeFirst(false);
    } catch (error) {
      console.error("Errore durante il ripristino:", error);
      showNotification("Errore critico durante il ripristino del database.", "error");
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const openDeleteModal = (target) => {
    setDeleteTarget(target);
    setDeleteConfirmText('');
    setBackupDownloaded(false);
  };

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsProcessing(true);
      
      if (deleteTarget === 'timbrature') {
        setProgress('Eliminazione timbrature in corso...');
        const timbratureSnap = await getDocs(collection(db, "timbrature"));
        for (const docSnap of timbratureSnap.docs) {
          await deleteDoc(doc(db, "timbrature", docSnap.id));
        }
        showNotification("Storico timbrature svuotato con successo!", "success");
      } else if (deleteTarget === 'all') {
        setProgress('Reset completo: eliminazione utenti...');
        const utentiSnap = await getDocs(collection(db, "utenti"));
        for (const docSnap of utentiSnap.docs) {
          await deleteDoc(doc(db, "utenti", docSnap.id));
        }

        setProgress('Reset completo: eliminazione timbrature...');
        const timbratureSnap = await getDocs(collection(db, "timbrature"));
        for (const docSnap of timbratureSnap.docs) {
          await deleteDoc(doc(db, "timbrature", docSnap.id));
        }
        showNotification("Database resettato con successo!", "success");
      }

      setDeleteTarget(null);
      setDeleteConfirmText('');
      setBackupDownloaded(false);
    } catch (error) {
      console.error("Errore durante la cancellazione:", error);
      showNotification("Impossibile completare la cancellazione dei dati.", "error");
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fadeIn">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-2.5">
          <Database className="text-indigo-600" />
          <span>Disaster Recovery & Backup</span>
        </h2>
        <p className="text-gray-500 mt-2">
          Salva l'intero database in locale per metterlo in sicurezza o ripristinalo su questo o su un nuovo database Firebase.
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

      {/* Progress Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
            <Loader2 className="animate-spin text-indigo-600 mx-auto" size={48} />
            <h3 className="text-xl font-bold text-gray-950">Ripristino in corso</h3>
            <p className="text-gray-600 text-sm font-medium bg-gray-50 p-3 rounded-lg border border-gray-100">
              {progress}
            </p>
            <p className="text-xs text-red-500 font-semibold animate-pulse">
              Non chiudere la finestra e attendi il completamento.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* EXPORT CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4 flex-1">
            <div className="flex items-center space-x-3 text-gray-900 font-bold text-xl">
              <Download size={24} className="text-emerald-600" />
              <span>Esporta Backup</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Crea un file di backup JSON contenente tutti i membri dello staff registrati (compresi i codici NFC associati) e lo storico di tutte le timbrature di ingresso ed uscita.
            </p>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-emerald-800 text-xs flex items-start space-x-2">
              <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                Il backup scaricato può essere conservato su una chiavetta USB ed è utilizzabile per migrare i dati o ripristinare il sistema in caso di incidenti nel cloud.
              </span>
            </div>
          </div>

          <button
            onClick={handleExportBackup}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-6 rounded-xl font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Generazione...</span>
              </>
            ) : (
              <>
                <Download size={20} />
                <span>Scarica Backup (.JSON)</span>
              </>
            )}
          </button>
        </div>

        {/* IMPORT CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4 flex-1">
            <div className="flex items-center space-x-3 text-gray-900 font-bold text-xl">
              <Upload size={24} className="text-indigo-600" />
              <span>Importa / Ripristina</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Carica un file di backup precedentemente scaricato per ripristinare o importare i dati del Grest.
            </p>

            {/* Drag and Drop Area */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/50' 
                  : fileName 
                    ? 'border-emerald-300 bg-emerald-50/20' 
                    : 'border-gray-200 hover:border-indigo-400 hover:bg-gray-50/50'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".json"
                onChange={handleFileChange}
                className="hidden" 
              />
              
              <div className="flex flex-col items-center space-y-2">
                {fileName ? (
                  <>
                    <FileJson className="text-emerald-500 hover:scale-105 transition-transform" size={36} />
                    <span className="text-sm font-semibold text-emerald-800 truncate max-w-xs">{fileName}</span>
                    <span className="text-xs text-gray-400">Clicca per cambiare file</span>
                  </>
                ) : (
                  <>
                    <Upload className="text-gray-400" size={32} />
                    <span className="text-sm font-medium text-gray-700">Trascina il file qui oppure clicca</span>
                    <span className="text-xs text-gray-400">Accetta solo file .json di backup validi</span>
                  </>
                )}
              </div>
            </div>

            {/* Summary of Parsed Data */}
            {parsedData && (
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-950 space-y-2 animate-fadeIn">
                <div className="font-bold text-sm text-indigo-900 mb-1 flex items-center space-x-1.5">
                  <Database size={14} />
                  <span>Dettaglio File Caricato:</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <p>Esportato il: <span className="font-semibold">{format(new Date(parsedData.exportedAt), 'dd/MM/yyyy HH:mm')}</span></p>
                  <p>Versione: <span className="font-semibold">{parsedData.version}</span></p>
                  <p>Membri Staff: <span className="font-semibold text-indigo-700">{parsedData.utenti?.length || 0}</span></p>
                  <p>Timbrature: <span className="font-semibold text-indigo-700">{parsedData.timbrature?.length || 0}</span></p>
                </div>
              </div>
            )}
          </div>

          {/* Action Restore Button */}
          {parsedData && (
            <div className="space-y-4 pt-4 border-t border-gray-100 animate-fadeIn">
              {/* Wipe Checkbox */}
              <div className="flex items-start space-x-3 bg-red-50 border border-red-100 rounded-xl p-4">
                <input 
                  type="checkbox" 
                  id="wipe" 
                  checked={wipeFirst}
                  onChange={(e) => setWipeFirst(e.target.checked)}
                  className="mt-1.5 h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <div className="text-xs text-red-800">
                  <label htmlFor="wipe" className="font-bold cursor-pointer">Svuota database prima del ripristino</label>
                  <p className="mt-1 text-red-600 font-medium">
                    Se selezionato, tutti gli utenti e le timbrature presenti nel database attuale verranno eliminati definitivamente prima di caricare il file.
                  </p>
                </div>
              </div>

              {/* Confirm text field for wipe */}
              {wipeFirst && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="block text-xs font-semibold text-red-700 flex items-center space-x-1">
                    <AlertTriangle size={14} />
                    <span>Conferma distruttiva richiesta:</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Digita CONFERMA per abilitare la pulizia"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full p-2.5 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-xs placeholder-red-300 font-semibold"
                  />
                </div>
              )}

              <button
                onClick={handleRestoreBackup}
                disabled={isProcessing || (wipeFirst && confirmText.trim().toUpperCase() !== 'CONFERMA')}
                className={`w-full flex items-center justify-center space-x-2 text-white py-3 px-6 rounded-xl font-semibold transition-all shadow-sm ${
                  wipeFirst 
                    ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300' 
                    : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300'
                }`}
              >
                <Database size={20} />
                <span>
                  {wipeFirst ? 'Ripristina Svuotando il Database' : 'Ripristina e Unisca Dati'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="bg-red-50/50 border border-red-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center space-x-3 text-red-700 font-bold text-xl">
          <AlertTriangle size={24} />
          <span>Zona di Pericolo (Cancellazione Dati)</span>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed">
          Le seguenti azioni sono <strong>irreversibili</strong> e comportano la perdita definitiva dei dati. Usale con estrema cautela.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="border border-red-100 rounded-xl p-4 flex flex-col justify-between space-y-4 bg-white/50">
            <div>
              <h4 className="font-bold text-red-950 text-sm">Svuota lo storico delle timbrature</h4>
              <p className="text-xs text-gray-500 mt-1">
                Cancella tutti i log di ingresso e uscita registrati nel database. L'anagrafica degli utenti rimarrà intatta.
              </p>
            </div>
            <button
              onClick={() => openDeleteModal('timbrature')}
              className="bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs py-2.5 px-4 rounded-xl border border-red-200 transition-colors w-full text-center"
            >
              Svuota Storico Timbrature
            </button>
          </div>

          <div className="border border-red-100 rounded-xl p-4 flex flex-col justify-between space-y-4 bg-white/50">
            <div>
              <h4 className="font-bold text-red-950 text-sm">Resetta l'intero database</h4>
              <p className="text-xs text-gray-500 mt-1">
                Cancella completamente sia l'anagrafica degli utenti sia tutti i log delle timbrature. Ritorna a uno stato iniziale vuoto.
              </p>
            </div>
            <button
              onClick={() => openDeleteModal('all')}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-colors w-full text-center"
            >
              Cancella Utenti e Timbrature (Reset Totale)
            </button>
          </div>
        </div>
      </div>

      {/* Modal Cancellazione Sicura */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50/20">
              <h3 className="text-xl font-bold text-red-900 flex items-center space-x-2">
                <AlertTriangle className="text-red-600" />
                <span>Cancellazione Sicura</span>
              </h3>
              <button 
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); setBackupDownloaded(false); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-xs space-y-2">
                <div className="font-bold text-sm text-amber-900 flex items-center space-x-1.5">
                  <span>💡 Raccomandazione importante:</span>
                </div>
                <p>
                  Ti consigliamo caldamente di scaricare un backup locale prima di procedere. Se qualcosa va storto o hai bisogno di recuperare i dati in futuro, potrai caricarli nuovamente da qui.
                </p>
                <button
                  onClick={() => {
                    handleExportBackup();
                    setBackupDownloaded(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 mt-1"
                >
                  <Download size={14} />
                  <span>Scarica Backup Adesso</span>
                </button>
              </div>

              <p className="text-gray-600 text-sm leading-relaxed">
                {deleteTarget === 'timbrature' ? (
                  <>Stai per eliminare <strong>definitivamente tutte le timbrature</strong>. I membri dello staff rimarranno registrati, ma le loro ore verranno azzerate.</>
                ) : (
                  <>Stai per eseguire un <strong>reset completo del database</strong>, cancellando tutti i membri dello staff e lo storico di ogni transito.</>
                )}
              </p>

              <div className="space-y-3 pt-2">
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={backupDownloaded}
                    onChange={(e) => setBackupDownloaded(e.target.checked)}
                    className="mt-1 h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <span className="text-xs text-gray-500 font-medium">
                    Confermo di aver salvato un backup o di non averne bisogno
                  </span>
                </label>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Digita <span className="font-bold text-red-600">{deleteTarget === 'timbrature' ? 'ELIMINA LOG' : 'RESETTA TUTTO'}</span> per confermare:
                  </label>
                  <input 
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={deleteTarget === 'timbrature' ? 'ELIMINA LOG' : 'RESETTA TUTTO'}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
              <button 
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); setBackupDownloaded(false); }}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors text-sm"
              >
                Annulla
              </button>
              <button 
                onClick={handleExecuteDelete}
                disabled={!backupDownloaded || deleteConfirmText.trim() !== (deleteTarget === 'timbrature' ? 'ELIMINA LOG' : 'RESETTA TUTTO') || isProcessing}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 text-sm"
              >
                {isProcessing ? 'Cancellazione...' : 'Conferma ed Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
