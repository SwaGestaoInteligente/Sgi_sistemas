# Checklist de Permissoes (Bloco 5)

## PLATFORM_ADMIN (Admin da plataforma)
- [ ] Login com perfil PLATFORM_ADMIN.
- [ ] Menus: Cadastros, Financeiro, Operacao, Anexos visiveis.
- [ ] Acessar Cadastros (Organizacoes, Pessoas, Unidades) e executar CRUD completo.
- [ ] Acessar Financeiro completo (contas, lancamentos, cobrancas, pagamentos, conciliacao).
- [ ] Acessar Operacao completo (chamados, reservas, recursos).
- [ ] Acessar Anexos (upload, download, remover) em qualquer entidade.
- [ ] Acesso direto por URL a qualquer rota nao exibe "Acesso restrito".

## CONDO_ADMIN (Sindico)
- [ ] Login com perfil CONDO_ADMIN em uma organizacao.
- [ ] Menus: Cadastros, Financeiro, Operacao, Anexos visiveis.
- [ ] Cadastros: criar/editar/remover dentro da propria organizacao.
- [ ] Financeiro: criar/editar/aprovar/pagar/conciliar dentro da propria organizacao.
- [ ] Operacao: criar chamados/reservas, alterar status, atribuir responsaveis.
- [ ] Anexos: upload/download/remover dentro da propria organizacao.
- [ ] Acesso direto por URL fora da organizacao retorna 403.

## CONDO_STAFF (Staff)
- [ ] Login com perfil CONDO_STAFF em uma organizacao.
- [ ] Menus: Cadastros (somente leitura), Financeiro (somente leitura), Operacao, Anexos visiveis.
- [ ] Cadastros: listas carregam, botoes de criar/editar/remover ausentes e API retorna 403.
- [ ] Financeiro: listas carregam, botoes de criar/editar/pagar/conciliar ausentes e API retorna 403.
- [ ] Operacao: pode criar chamados/reservas e alterar status conforme permitido.
- [ ] Anexos: upload/download/remover em entidades permitidas.
- [ ] Acesso direto por URL a telas proibidas exibe "Acesso restrito".

## RESIDENT (Morador)
- [ ] Login com perfil RESIDENT (com unidade vinculada).
- [ ] Menus: Minha Unidade, Operacao e Anexos visiveis; Cadastros e Financeiro geral ocultos.
- [ ] Minha Unidade: visualizar dados e cobrancas/pagamentos da propria unidade apenas.
- [ ] Operacao: criar chamados/reservas e ver apenas os da propria unidade/pessoa.
- [ ] Operacao: nao consegue alterar status/aprovar/atribuir responsaveis (API 403).
- [ ] Anexos: upload/download/remover apenas de entidades vinculadas a propria unidade/pessoa.
- [ ] Acesso direto por URL a Financeiro geral e Cadastros exibe "Acesso restrito" e API retorna 403.
