@echo off
cd /d %~dp0

echo [1/4] Liberando portas 7000 e 5173...
for %%P in (7000 5173) do (
  for /f "tokens=5" %%A in ('netstat -aon ^| findstr :%%P ^| findstr LISTENING') do (
    taskkill /F /PID %%A >nul 2>nul
  )
)

echo [2/4] Iniciando API...
start "SGI API" cmd /k "cd /d %~dp0src\\Sgi.Api && dotnet run --urls http://localhost:7000 --environment Development"

echo [3/4] Iniciando WEB...
start "SGI WEB" cmd /k "cd /d %~dp0sgi-web && set \"VITE_API_BASE_URL=http://localhost:7000/api\" && npm run dev -- --port 5173 --strictPort"

echo [4/4] Abrindo navegador...
timeout /t 6 >nul
start "" "http://localhost:5173/"
