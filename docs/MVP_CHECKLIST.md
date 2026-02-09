# MVP Checklist — SGI (Condomínio)

Objetivo: estabilizar o SGI como MVP real (login → sessão → dados) com RBAC no BACKEND.

## Fase 1 — Estabilidade (API/Banco)
1. Garantir que API compila e sobe sem erro sempre.
2. Swagger acessível em Development.
3. Garantir migrations aplicando sem travar startup (estratégia segura).
4. Implementar seed mínimo para usuários de teste: ADMIN, SINDICO, AUX_ADMIN, PORTEIRO, MORADOR.
   - Cada usuário deve ter: uid, pessoaId, isPlatformAdmin (se existir), memberships com OrgId/UnidadeId/Role.
   - Seed deve criar também uma Organização DEMO + Bloco + Unidade + Pessoa + Vínculos.

## Fase 2 — Front/API (fluxo mínimo)
5. Confirmar baseURL único e correto no frontend (sem duplicar /api).
6. Login deve retornar e setar token + sessão (claims e memberships) de forma estável.
7. Sessão persistida: refresh (F5) não quebra.
8. Instrumentação simples: log claro para 401 e 403 (frontend e backend).

## Fase 3 — RBAC real no Backend (obrigatório)
9. Definir roles finais: CONDO_ADMIN, SINDICO, AUX_ADMIN, PORTEIRO, RESIDENT (ou equivalentes).
10. Exigir membership por organização em rotas sensíveis (guard central).
11. Bloquear rotas críticas por role no backend:
    - Financeiro e Contabilidade: ADMIN/SINDICO (no mínimo).
    - Cadastros estruturais: ADMIN/SINDICO/AUX (no mínimo).
    - Portaria/Correspondência: PORTEIRO/ADMIN/SINDICO.
12. Teste manual documentado: provar 401/403 funcionando.

## Fase 4 — Fluxo mínimo por perfil
13. ADMIN: fluxo atual sem regressão.
14. SINDICO: acesso direto e menu adequado.
15. PORTEIRO: menu mínimo (portaria/correspondencia/chamados).
16. MORADOR: apenas dados da própria unidade/pessoa (sem vazamento).

## Fase 5 — Módulos essenciais
17. Pessoas + Unidades: leitura estável.
18. Chamados: criar/listar/acompanhar.
19. Reservas: criar/listar.
20. Financeiro: admin/síndico (morador depois apenas visão do dele).

## Fase 6 — Auditoria mínima
21. Log básico em alterações críticas: financeiro + cadastros principais.
22. Guardar: quem/quando/o que (e antes/depois se possível).

## Fase 7 — Checklist MVP
23. Criar checklist de aceite (docs) para login/sessão/RBAC/fluxo.
24. Rodar checklist e corrigir bugs críticos.

## Entregáveis agora
A. Criar `docs/MVP_CHECKLIST.md` com as fases acima.
B. Implementar/ajustar seed e garantir startup estável.
C. Garantir 401/403 corretos em 3 rotas críticas (prova inicial).

## Commits esperados
- `docs: adicionar plano MVP e checklist`
- `feat: seed inicial para perfis (admin/sindico/porteiro/morador)`
- `feat: guard/rbac em rotas criticas (prova inicial)`
