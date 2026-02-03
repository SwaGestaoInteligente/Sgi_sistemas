# Condo Fullstack

Aplicação para administração de condomínios (API + app mobile).

## Setup rápido

- Backend: `cd condo-api && npm install && npm run env:copy` e edite `.env` (DATABASE_URL, JWT_SECRET, PORT).
- Mobile: `cd condo-mobile && npm install && npm run env:copy` e edite `.env` (EXPO_PUBLIC_API_BASE_URL apontando para o backend, ex: `http://seu-ip:3333/api`).

## Executar

- API: `cd condo-api && npm run build && npm start` (ou `npm run dev` para hot reload).
- Mobile (Expo): `cd condo-mobile && npm start` e abra no dispositivo/emulador.

## Notas

- Status de reservas: `PENDENTE`, `APROVADA`, `CANCELADA` (a API ainda trata `RESERVA CANCELADA` como cancelada para dados antigos).
- Seeds de exemplo estão em `condo-api/prisma/seed.ts` (ajuste usuários/areas/avisos conforme necessário).
