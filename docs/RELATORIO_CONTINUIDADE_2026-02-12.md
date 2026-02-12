# Relatorio de Continuidade - 2026-02-12

## Contexto
Implementacao do modulo **Cartao de ponto** no SGI, com foco nas Partes 1, 2 e 3 solicitadas:

1. Ajustes com aprovacao e trilha de auditoria
2. Exportacoes AFD e AEJ
3. Fechamento de competencia com bloqueio de alteracoes retroativas

## O que foi concluido hoje

### Backend
- Criado controller `src/Sgi.Api/Controllers/PontoController.cs` com endpoints:
  - `GET /api/ponto/marcacoes`
  - `POST /api/ponto/marcacoes`
  - `GET /api/ponto/comprovante/{id}`
  - `GET /api/ponto/espelho`
  - `GET /api/ponto/ajustes`
  - `POST /api/ponto/ajustes`
  - `PATCH /api/ponto/ajustes/{id}/decisao`
  - `POST /api/ponto/fechamentos`
  - `GET /api/ponto/fechamentos`
  - `GET /api/ponto/export/afd`
  - `GET /api/ponto/export/aej`
- Regras implementadas:
  - Ajuste nao edita marcacao original: ajuste aprovado gera nova marcacao.
  - Bloqueio por competencia fechada para marcacao e ajuste retroativo.
  - Controle por papel (`CONDO_ADMIN` e `CONDO_STAFF`) com escopo de pessoa.
  - Registro de auditoria nas acoes criticas.

### Dominio e Infra
- Criadas entidades:
  - `src/Sgi.Domain/Operacao/PontoMarcacao.cs`
  - `src/Sgi.Domain/Operacao/PontoAjuste.cs`
  - `src/Sgi.Domain/Operacao/PontoFechamentoCompetencia.cs`
- Atualizado DbContext:
  - `src/Sgi.Infrastructure/Data/SgiDbContext.cs`
- Migrations adicionadas:
  - `src/Sgi.Infrastructure/Migrations/20260212153853_AddCartaoPonto.cs`
  - `src/Sgi.Infrastructure/Migrations/20260212162914_AddPontoAjustesFechamentos.cs`
- Banco atualizado com `dotnet ef database update`.

### Frontend
- Nova tela:
  - `sgi-web/src/views/CartaoPontoView.tsx`
- Integracao API:
  - `sgi-web/src/api.ts`
- Integracao no menu/rotas:
  - `sgi-web/src/pages/App.tsx`
- Estilos do modulo:
  - `sgi-web/src/styles.css`

## Validacoes executadas
- `dotnet build src/Sgi.Api/Sgi.Api.csproj` -> OK
- `npm run build` em `sgi-web` -> OK
- Fluxo ponta a ponta testado na API:
  - Marcacao criada
  - Ajuste solicitado e aprovado
  - Exportacao AFD/AEJ gerada
  - Competencia fechada
  - Nova marcacao apos fechamento bloqueada (HTTP 400) -> OK

## Pendencias para continuar amanha
1. Melhorar layout visual da tela de cartao de ponto (refino UX).
2. Adicionar filtros de periodo mais detalhados no frontend.
3. Incluir exportacao em PDF (alem de CSV) para espelho e comprovante.
4. Criar testes automatizados para regras de fechamento e aprovacao.
5. Revisar chunk grande do frontend (warning de build > 500 kB).

## Comandos uteis para subir local

### API
```powershell
dotnet run --project src/Sgi.Api/Sgi.Api.csproj --urls http://localhost:7000
```

### Frontend
```powershell
cd sgi-web
npm run dev -- --host 0.0.0.0 --port 5173
```

### Build rapido
```powershell
dotnet build src/Sgi.Api/Sgi.Api.csproj
cd sgi-web
npm run build
```

