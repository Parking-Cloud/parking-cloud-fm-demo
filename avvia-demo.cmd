@echo off
REM ===========================================================
REM  Parking Cloud - Demo SaaS
REM  Doppio click su questo file per avviare la demo.
REM  Chiudi questa finestra nera per spegnere il server.
REM ===========================================================
cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Python non trovato.
  echo  In alternativa apri direttamente src\index.html nel browser.
  echo.
  pause
  exit /b 1
)

echo.
echo  Parking Cloud - demo in avvio su http://localhost:8777
echo  Lascia aperta questa finestra durante la presentazione.
echo.
start "" http://localhost:8777/index.html
python -m http.server 8777 --directory src
