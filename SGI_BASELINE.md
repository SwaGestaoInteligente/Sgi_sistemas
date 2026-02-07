# SGI - Base Congelada (v1)

Data: 2026-02-07
Commit base: d3e5241 (main)

Escopo congelado. Nao iniciar novos modulos sem decisao de eixo.

## 1. Objetivo e principios
- Plataforma modular, multi-organizacao e auditavel.
- Simplicidade para o usuario final e forca para o gestor.
- Crescimento por modulos com base solida.

## 2. Stack e arquitetura
- Frontend: React + TypeScript (Vite).
- Backend: ASP.NET Core + EF Core + SQLite.
- Separacao por camadas (Views, API, Dominio).

## 3. Escopo incluido (ativo hoje)
Core:
- Organizacoes (multi-organizacao, segmentacao).
- Pessoas (CRUD completo).
- Unidades organizacionais (CRUD completo).
- Autenticacao e papeis (PLATFORM_ADMIN, CONDO_ADMIN, CONDO_STAFF, RESIDENT).

Cadastros:
- Veiculos (CRUD).
- Pets (CRUD).
- Fornecedores/Prestadores (via Pessoas).

Financeiro (nucleo):
- Contas financeiras.
- Contas a pagar/receber.
- Transferencias.
- Plano de contas.
- Itens cobrados e faturas.
- Inadimplentes.
- Conciliacao bancaria (importacao OFX/CSV, vinculacao, confirmacao).
- Auditoria financeira.
- Cobrancas por unidade + pagamentos.

Operacao:
- Chamados (SLA, historico, comentarios, anexos).
- Reservas + recursos (regras, janela, limites, aprovacao).

Suporte:
- Anexos (upload/lista/download).
- Relatorios basicos (chamados, reservas, veiculos, pets).
- Notificacoes (config + eventos + job).

## 4. Fluxo principal (estavel)
1. Login.
2. Selecao de segmento (admin).
3. Selecao/criacao de organizacao.
4. Dashboard.
5. Acesso aos modulos conforme perfil.

## 5. Fluxo financeiro (status)
ABERTO -> APROVADO -> PAGO -> CONCILIADO -> FECHADO
Regra: FECHADO e read-only.

## 6. Em breve (nao implementado)
Financeiro:
- Consumos.
- Previsao orcamentaria.
- Abonos.
- Grupos de rateio.
- Livro de prestacao de contas.

App/UI:
- Tela de perfil do usuario.

## 7. Fora do escopo (congelado)
- Comunicacao completa (avisos, enquetes, votacoes, assembleias).
- Portaria/Acessos.
- Documentos com versionamento.
- Locacoes/Hospedagem.
- IA (assistentes e automacoes avancadas).
- App/PWA para usuarios finais.

## 8. Como rodar
- start-all.bat
- Web: http://localhost:5173
- API: http://localhost:7000

## 9. Reset DEV e migrations
- O alvo do SQLite fica no appsettings: `ConnectionStrings:DefaultConnection = Data Source=sgi.db`.
- Para resetar DEV, apague o arquivo `sgi.db` (normalmente em `src/Sgi.Api/`).
- Aplique migrations: `dotnet ef database update` (rodar em `src/Sgi.Api/`).
- Em Development, a API aplica migrations automaticamente no startup.

## 10. Rodar API em Development
- Defina `ASPNETCORE_ENVIRONMENT=Development`.
- Rode a API com `dotnet run` em `src/Sgi.Api/`.

## 11. Seeds (dev)
- /api/dev/seed-admin
  - admin@teste.com / Admin@123
  - sindico@teste.com / Sindico@123
  - porteiro@teste.com / Porteiro@123
  - morador@teste.com / Morador@123
- /api/dev/seed-demo-full

## 12. Jobs
- NotificacoesJob roda a cada 3 min e gera eventos de alerta.

## 13. Migrations base
- 20260206222521_AdvancedFeatures

## 14. Regra de expansao
Qualquer expansao exige decisao de um eixo unico antes de implementar.
