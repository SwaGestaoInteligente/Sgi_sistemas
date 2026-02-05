@echo off
cd /d %~dp0

set /p PC_IP=Digite o IP do PC (ex: 192.168.100.9):

echo [1/4] Liberando portas 7000 e 5173...
for %%P in (7000 5173) do (
  for /f "tokens=5" %%A in ('netstat -aon ^| findstr :%%P ^| findstr LISTENING') do (
    taskkill /F /PID %%A >nul 2>nul
  )
)

echo [2/4] Iniciando API (0.0.0.0:7000)...
start "SGI API" cmd /k "cd /d %~dp0src\\Sgi.Api && dotnet run --urls http://0.0.0.0:7000"

echo [3/4] Iniciando WEB (0.0.0.0:5173)...
start "SGI WEB" cmd /k "cd /d %~dp0sgi-web && set VITE_API_BASE_URL=http://%PC_IP%:7000 && npm run dev -- --host 0.0.0.0 --port 5173 --strictPort"

echo [4/4] Abrindo navegador...
timeout /t 6 >nul
start "" "http://%PC_IP%:5173/"
