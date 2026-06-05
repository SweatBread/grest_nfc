@echo off
title Grest NFC - Modalità Compatibilità Windows 7
echo ==========================================================
echo       AVVIO GREST NFC - COMPATIBILITA WINDOWS 7           
echo ==========================================================
echo.
echo Avvio in corso con bypass del controllo di piattaforma...
echo.

:: Avvia il browser predefinito sulla porta del server integrato (3000)
start "" "http://localhost:3000"

:: Esegue il comando npm run start:win7
npm run start:win7
