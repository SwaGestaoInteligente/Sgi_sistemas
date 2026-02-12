# Sgi_sistemas

SGI Sistemas e um sistema integrado de gestao para centralizar e automatizar processos administrativos, operacionais e financeiros de condominio.

## Ambiente local

- API: `http://localhost:7000`
- Web: `http://localhost:5173`

Subir tudo:

- `start-all.bat`

## Build rapido

- Backend: `dotnet build src/Sgi.Api/Sgi.Api.csproj -c Release`
- Frontend: `cd sgi-web && npm run build`

## Parte 10 (deploy e release)

Documentacao completa:

- `docs/PARTE_10_RELEASE_DEPLOY.md`
