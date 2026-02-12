# Parte 10 - Revisoes, Documentacao e Deploy

Este documento fecha a Parte 10 com processo objetivo para publicar, validar e reverter o SGI.

## Escopo entregue

- Deploy de producao via Docker Compose:
  - `docker-compose.prod.yml`
  - `src/Sgi.Api/Dockerfile`
  - `sgi-web/Dockerfile`
  - `sgi-web/nginx.conf`
  - `.env.production.example`
  - `.dockerignore`
- Configuracao de producao da API:
  - `src/Sgi.Api/appsettings.Production.json`
- Automacao de release check local:
  - `scripts/release-check.ps1`
- Pipeline CI para build API + Web:
  - `.github/workflows/ci.yml`

## Variaveis de ambiente (producao)

Copie `.env.production.example` para `.env` na raiz e ajuste:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `JWT_KEY` (obrigatorio forte: 32+ caracteres)
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `WEB_PORT`
- `VITE_BASE_PATH`

## Subida de producao

1. Preparar ambiente:
   - Docker + Docker Compose instalados
   - `.env` preenchido
2. Build + subida:
   - `docker compose -f docker-compose.prod.yml up -d --build`
3. Ver logs:
   - `docker compose -f docker-compose.prod.yml logs -f api`
   - `docker compose -f docker-compose.prod.yml logs -f web`
4. Validar:
   - Front: `http://localhost:${WEB_PORT}` (ou dominio publicado)
   - API via proxy: `http://localhost:${WEB_PORT}/api/...`

## Checklist de release

Antes de publicar:

- `dotnet build src/Sgi.Api/Sgi.Api.csproj -c Release`
- `cd sgi-web && npm run build`
- `pwsh ./scripts/release-check.ps1`
- Conferir se `.env` nao ficou com placeholders.

## Rollback rapido

Opcao 1 (rollback de imagem/tag):

1. Voltar para commit/tag anterior
2. Subir novamente:
   - `docker compose -f docker-compose.prod.yml up -d --build`

Opcao 2 (hot rollback por git):

1. `git log --oneline`
2. `git checkout <commit_estavel>`
3. `docker compose -f docker-compose.prod.yml up -d --build`

## Observacoes de operacao

- O `web` publica SPA com fallback (`try_files ... /index.html`).
- O `web` encaminha `/api/*` para o servico `api`.
- A API em producao usa provider Postgres por variavel (`Database__Provider=postgres`).
- Uploads e backups ficam persistidos em volumes:
  - `sgi_uploads`
  - `sgi_backups`

## CI

Pipeline em `.github/workflows/ci.yml` executa:

- Build backend (`dotnet build`)
- Install + build frontend (`npm ci`, `npm run build`)

Isso trava merge com build quebrado.
