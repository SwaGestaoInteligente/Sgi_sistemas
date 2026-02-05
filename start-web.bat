@echo off
cd /d %~dp0
cd sgi-web
set VITE_API_BASE_URL=http://localhost:7000
npm install
npm.cmd run dev -- --port 5173 --strictPort

