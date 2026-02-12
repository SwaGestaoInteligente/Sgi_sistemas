# Relatorio Completo de Entrega

Data: 12/02/2026  
Projeto: SGI Sistemas (web + api)  
Branch: `main`

## 1) Resumo do que foi concluido

### Parte 6 - Relatorios estruturados
- Criada tela nova de relatorios no front: `sgi-web/src/views/RelatoriosView.tsx`.
- Integracao no app principal para abrir tela real de relatorios (retirado de "em breve"):
  - `sgi-web/src/pages/App.tsx`.
- Filtros implementados por modulo:
  - Chamados: periodo + status + CSV/PDF.
  - Reservas: periodo + recurso + CSV/PDF.
  - Veiculos: CSV.
  - Pets: CSV.
- Historico de exportacoes geradas na sessao.
- Estilos dedicados da tela:
  - `sgi-web/src/styles.css`.

### Parte 7 - Perfis e permissoes
- Permissoes reais ativadas no front (`IGNORAR_PERFIS = false`):
  - `sgi-web/src/pages/App.tsx`.
- Regras de acesso melhoradas para relatorios.
- Utilitarios de perfis/permissoes adicionados:
  - `sgi-web/src/authz.ts`.
- Menu de usuario mostrando perfil ativo + permissoes vigentes:
  - `sgi-web/src/pages/App.tsx`
  - `sgi-web/src/styles.css`.
- Login com atalhos de perfil demo (Admin, Admin condominio, Operacao, Morador):
  - `sgi-web/src/pages/LoginPage.tsx`
  - `sgi-web/src/styles.css`.

### Parte 8 - Automatizacoes e alertas
- Processamento de notificacoes extraido para servico dedicado:
  - `src/Sgi.Api/Services/NotificacoesProcessor.cs`.
- Job agendado passou a usar o processor:
  - `src/Sgi.Api/Services/NotificacoesJob.cs`.
- DI registrada no backend:
  - `src/Sgi.Api/Program.cs`.
- Endpoint novo para executar varredura imediata:
  - `POST /api/config/notificacoes/processar-agora`
  - `src/Sgi.Api/Controllers/NotificacoesController.cs`.
- Front consumindo processamento manual:
  - `sgi-web/src/api.ts`.
- Painel de notificacoes com:
  - botao "Executar varredura agora"
  - KPIs (ativas, nao lidas, ultimas 24h, ultima varredura)
  - lista de eventos com "Marcar lido" e "Marcar tudo como lido"
  - `sgi-web/src/views/ConfiguracoesView.tsx`
  - `sgi-web/src/styles.css`.

## 2) Pacotes e setup visual (ja no projeto)

Front configurado com:
- Tailwind CSS 4
- `@tailwindcss/vite`
- `@tailwindcss/postcss`
- `postcss`
- `autoprefixer`
- `lucide-react`

Arquivos de configuracao adicionados:
- `sgi-web/tailwind.config.js`
- `sgi-web/postcss.config.cjs`
- ajuste de vite/config e estilos globais.

## 3) Arquivos principais alterados nesta entrega

### Frontend
- `sgi-web/index.html`
- `sgi-web/package.json`
- `sgi-web/package-lock.json`
- `sgi-web/vite.config.ts`
- `sgi-web/postcss.config.cjs`
- `sgi-web/tailwind.config.js`
- `sgi-web/src/styles.css`
- `sgi-web/src/api.ts`
- `sgi-web/src/authz.ts`
- `sgi-web/src/pages/App.tsx`
- `sgi-web/src/pages/LoginPage.tsx`
- `sgi-web/src/views/RelatoriosView.tsx`
- `sgi-web/src/views/ConfiguracoesView.tsx`
- `sgi-web/src/views/FinanceiroView.tsx`
- `sgi-web/src/views/PessoasView.tsx`
- `sgi-web/src/views/UnidadesView.tsx`
- `sgi-web/src/components/ui/` (Button, Card, Container, Header, Sidebar, Table, Typography, cn, index)

### Backend
- `src/Sgi.Api/Program.cs`
- `src/Sgi.Api/Controllers/FinanceiroController.cs`
- `src/Sgi.Api/Controllers/NotificacoesController.cs`
- `src/Sgi.Api/Services/NotificacoesJob.cs`
- `src/Sgi.Api/Services/NotificacoesProcessor.cs`

## 4) Validacao tecnica executada

- Frontend: `npm run build` (OK).
- Backend: `dotnet build src\\Sgi.Api -o C:\\projetos\\Sgi_sistemas\\tmp-build-check` (OK).

## 5) Como ficar igual no outro PC (amanha, 13/02/2026)

No outro PC:

1. Abrir pasta do projeto.
2. Atualizar codigo:
   - `git pull origin main`
3. Instalar dependencias do web:
   - `cd sgi-web`
   - `npm install`
4. Voltar para raiz e validar backend:
   - `cd ..`
   - `dotnet build src\\Sgi.Api`
5. Rodar sistema:
   - `start-all.bat`

Se necessario aplicar banco:
- `dotnet ef database update` (em `src/Sgi.Api`).

## 6) Perfis de teste (demo)

- Plataforma: `admin@teste.com` / `Admin@123`
- Admin condominio: `sindico@teste.com` / `Sindico@123`
- Operacao: `porteiro@teste.com` / `Porteiro@123`
- Morador: `morador@teste.com` / `Morador@123`

## 7) Observacoes

- O modulo de notificacoes agora gera eventos automaticos e permite disparo manual.
- Envio SMTP real de e-mail ainda nao foi ligado; fluxo atual registra eventos por canal configurado.
