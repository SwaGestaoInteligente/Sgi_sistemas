@echo off
cd /d %~dp0
cd src\Sgi.Api
set ASPNETCORE_ENVIRONMENT=Development
set DOTNET_ENVIRONMENT=Development
dotnet run --project Sgi.Api.csproj --urls "http://localhost:7000;http://localhost:5000"
