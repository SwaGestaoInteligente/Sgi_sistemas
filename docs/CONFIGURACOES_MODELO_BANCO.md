# Configuracoes — Modelo de Banco (Conceitual)

## Objetivo
Documentar um modelo conceitual de dados para a area de Configuracoes, alinhado ao principio de flexibilidade e sem hardcode.

## Principios
- Multi-tenant: tudo referencia `organizacao_id`.
- Estruturas pai → filho para classificacoes e categorias.
- Dados genericos e reutilizaveis.
- Nada fixo no codigo.
- Soft delete via `ativo` ou `status`.

## Padrao geral de campos
Campos recomendados em cadastros de configuracao:
- `id` (UUID)
- `organizacao_id` (FK)
- `codigo` (string, opcional)
- `nome` (string)
- `descricao` (string, opcional)
- `parent_id` (FK, opcional)
- `status` ou `ativo`
- `ordem` (int, opcional)
- `created_at`, `updated_at`

## Cadastros base (conceituais)
Tabela sugerida: `config_cadastro`

Colunas chave:
- `organizacao_id`
- `dominio` (ex.: `cadastros_base`, `financeiro_base`, `pessoas_papeis`)
- `tipo` (ex.: `tipo_receita`, `tipo_despesa`, `categoria_financeira`, `centro_custo`, `forma_pagamento`, `status_financeiro`, `tag_generica`)
- `codigo`, `nome`, `descricao`
- `parent_id` (hierarquia)
- `ativo`

Relacoes:
- Outros modulos referenciam `config_cadastro.id`.

## Estrutura do condominio
Tabelas conceituais:
- `estrutura_bloco`
- `estrutura_unidade`
- `estrutura_tipo_unidade`
- `estrutura_area_comum`
- `estrutura_garagem`

Relacoes esperadas:
- `estrutura_unidade` referencia `estrutura_bloco` (opcional).
- `estrutura_unidade` referencia `estrutura_tipo_unidade` (opcional).
- `estrutura_area_comum` referencia `organizacao_id`.
- `estrutura_garagem` referencia `organizacao_id` e pode referenciar `estrutura_unidade` (opcional).

## Pessoas & papeis
Tabelas conceituais:
- `pessoa`
- `config_tipo_pessoa` (ou via `config_cadastro` com `tipo = tipo_pessoa`)
- `config_papel` (ou via `config_cadastro` com `tipo = papel`)
- `pessoa_vinculo`

Relacoes esperadas:
- `pessoa_vinculo` liga `pessoa` ↔ `organizacao` ↔ `estrutura_unidade` (opcional).
- Perfis de acesso continuam no auth, com referencia a `pessoa` quando aplicavel.

## Financeiro (base)
Tabelas conceituais:
- `financeiro_plano_contas`
- `financeiro_tipo_lancamento`
- `financeiro_indice`
- `financeiro_regra_inadimplencia` (futuro)

Relacoes esperadas:
- `financeiro_plano_contas` com `parent_id` para hierarquia.
- `financeiro_tipo_lancamento` ligado a `config_cadastro` se necessario.

## Regras de integridade
- `codigo` unico por `organizacao_id + tipo` quando usado.
- `nome` unico por `organizacao_id + tipo` para evitar duplicidade.
- `parent_id` nao pode criar ciclo.
- `status` ou `ativo` sempre presente.

## Uso em modulos
- Receitas e despesas referenciam `config_cadastro` e `financeiro_plano_contas`.
- Relatorios e dashboards usam as mesmas referencias.
- Estrutura fisica (blocos/unidades/areas) alimenta operacao e financeiro.

## Observacao
Este modelo e conceitual. Implementacao sera incremental e sem quebra.
