@echo off
title Grest NFC - Modalità Standard
echo ==========================================================
echo           AVVIO SISTEMA CHECK-IN GREST NFC               
echo ==========================================================
echo.
echo Inizializzazione dei moduli in corso...
echo.

:: Avvia il browser predefinito sulla porta dello sviluppo
start "" "http://localhost:5173"

:: Esegue il comando npm start per avviare bridge e dashboard
npm start
