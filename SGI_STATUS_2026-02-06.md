# SGI / sgi-web — Status do Projeto (snapshot)

Data: 2026-02-06

## 1) Estado atual (resumo curto)
- Front (React + Vite + TS) esta rodando e build ok.
- Backend (.NET) build ok e API ativa em 7000.
- Financeiro recebeu fluxo completo de status e auditoria.
- Layout principal agora controla scroll do conteudo e sempre abre no topo.
- Header foi simplificado: acoes rapidas viraram menu unico.

## 2) Como rodar rapido
Local (PC):
1. `start-all.bat`
2. Abrir: `http://localhost:5173/`

Mobile na rede:
1. `start-all-mobile.bat`
2. Informe o IP do PC (ex: 192.168.100.9)
3. Abrir no celular: `http://SEU_IP:5173/`

## 3) Logins seed (dev)
Se precisar recriar usuarios: `http://localhost:7000/api/dev/seed-admin`

Credenciais:
- `admin@teste.com` / `Admin@123`
- `sindico@teste.com` / `Sindico@123`
- `porteiro@teste.com` / `Porteiro@123`
- `morador@teste.com` / `Morador@123`

## 4) Financeiro — o que foi implementado
Fluxo de status:
`ABERTO -> APROVADO -> PAGO -> CONCILIADO -> FECHADO`

Regras:
- Fechado vira readOnly.
- Somente PLATFORM_ADMIN pode reabrir.
- Auditoria gravada em `FinanceAudit`.

Endpoints principais:
- `POST /api/financeiro/lancamentos/{id}/aprovar`
- `POST /api/financeiro/lancamentos/{id}/pagar`
- `POST /api/financeiro/lancamentos/{id}/conciliar`
- `POST /api/financeiro/lancamentos/{id}/fechar`
- `POST /api/financeiro/lancamentos/{id}/reabrir`
- Uploads + conciliacao:
  - `POST /api/financeiro/uploads`
  - `POST /api/financeiro/conciliacao/importar`
  - `POST /api/financeiro/conciliacao/{id}/confirmar`

## 5) Layout / UX
- Scroll reset global por troca de view/submenu.
- `main-content` agora tem scroll proprio (e o sidebar tambem).
- Header: botoes de acoes agrupados em menu `Acoes`.

## 6) Arquivos chave alterados recentemente
Frontend:
- `sgi-web/src/pages/App.tsx`
- `sgi-web/src/styles.css`
- `sgi-web/src/views/FinanceiroView.tsx`
- `sgi-web/src/api.ts`

Backend:
- `src/Sgi.Api/Controllers/FinanceiroController.cs`
- `src/Sgi.Api/Auth/FinanceiroAccessFilter.cs`
- `src/Sgi.Api/Program.cs`
- `src/Sgi.Infrastructure/Data/SgiDbContext.cs`
- `src/Sgi.Domain/Financeiro/FinanceAudit.cs`

## 7) Commits recentes
- `62604a0` style: simplifica header com menu de acoes
- `21df9d5` feat: melhorias de scroll global e fluxo financeiro

## 8) Se algo der ruim
Checklist rapido:
- API no ar: `http://localhost:7000` (ou `SEU_IP:7000`)
- WEB no ar: `http://localhost:5173`
- Se 401 no front: fazer login novamente
