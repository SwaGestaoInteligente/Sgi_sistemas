@echo off
cd /d %~dp0
cd src\Sgi.Api
dotnet run --project Sgi.Api.csproj --urls "http://localhost:7000;http://localhost:5000"
