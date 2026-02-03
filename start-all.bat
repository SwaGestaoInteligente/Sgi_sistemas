@echo off
cd /d %~dp0

start "SGI API" cmd /k "cd /d %~dp0src\\Sgi.Api && dotnet run --urls http://localhost:7000"
start "SGI WEB" cmd /k "cd /d %~dp0sgi-web && npm run dev -- --port 5173"

timeout /t 3 >nul
start "" "http://localhost:5173/Sgi_sistemas/"
