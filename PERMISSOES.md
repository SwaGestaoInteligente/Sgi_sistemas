# PERMISSOES

Matriz de permissao por modulo e perfil (Bloco 5).

Legenda:
- ✅ = acesso completo (criar/editar/remover)
- leitura = somente leitura
- somente unidade = acesso restrito a propria unidade
- ❌ = sem acesso

| Modulo       | PLATFORM_ADMIN | CONDO_ADMIN | CONDO_STAFF | RESIDENT       |
|--------------|----------------|-------------|-------------|----------------|
| Cadastros    | ✅             | ✅          | leitura     | somente unidade|
| Financeiro   | ✅             | ✅          | leitura     | somente unidade|
| Operacao     | ✅             | ✅          | ✅          | somente unidade|
| Anexos       | ✅             | ✅          | ✅          | somente unidade|

Observacoes:
- "somente unidade" cobre Minha Unidade, cobrancas/pagamentos e anexos relacionados.
- Acesso sempre limitado a organizacao ativa (exceto PLATFORM_ADMIN).
