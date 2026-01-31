@echo off
cd /d %~dp0
cd sgi-web
npm install
npm.cmd run dev -- --port 5173

