# Release Check

Data: 2026-02-12 18:15:35

- Build backend: OK
  - dotnet build src/Sgi.Api/Sgi.Api.csproj -c Release
- Build frontend: OK
  - npm run build (sgi-web)
- Smoke test: OK
  - scripts/test-smoke.ps1

Status geral: OK
