# Configurações — Modelo Conceitual (Novo Norte)

## Visão geral
A área **Configurações** será o coração flexível do sistema. É o local onde o cliente cadastra tudo o que o SGI vai usar, define receitas, despesas, categorias e estruturas, e cria dados genéricos reutilizáveis.  
Nenhuma regra fixa. Nada engessado.

## Estrutura proposta
### 1. Configurações → Cadastros Base
Itens:
- Tipos de Receita (ex.: Condomínio, Multa, Juros, Fundo X)
- Tipos de Despesa (ex.: Manutenção, Funcionário, Portaria, Mercado, Serviço)
- Categorias Financeiras (agrupador genérico pai/filho)
- Centros de Custo (opcional, flexível)
- Formas de Pagamento
- Status Financeiros
- Tags Genéricas (uso futuro em qualquer módulo)

### 2. Configurações → Estrutura do Condomínio
Itens:
- Condomínio (já existe)
- Blocos
- Unidades (apartamentos, salas, casas)
- Tipos de Unidade
- Áreas Comuns (salão, churrasqueira, vaga, etc.)
- Regras de uso (futuro)

### 3. Configurações → Pessoas & Papéis
Itens:
- Tipos de Pessoa (morador, funcionário, fornecedor, síndico, etc.)
- Papéis/Funções
- Perfis de Acesso (ligado ao auth)
- Vínculos padrão (ex.: morador → unidade → condomínio)

### 4. Configurações → Financeiro (Base)
Itens:
- Plano de Contas (pai/filho)
- Tipos de Lançamento (fixo, variável, recorrente)
- Regras de inadimplência (futuro)
- Índices (IGPM, IPCA — opcional)

## Regras não negociáveis
- Nada fixo no código.
- Nenhum cadastro hardcoded.
- Tudo deve ser criado pelo usuário.
- Estrutura pai → filho.
- Um cadastro pode ser usado em Receita, Despesa, Relatórios e Dashboards.
- Banco de dados comunicante (nada independente).

## Relacionamentos esperados
- Cadastros base alimentam Receita, Despesa, Relatórios e Dashboards.
- Categorias, plano de contas e centros de custo seguem hierarquia pai/filho.
- Pessoas se vinculam a condomínio, unidade e papéis.
- Estruturas físicas (blocos, unidades, áreas comuns) integram-se aos cadastros financeiros e operacionais.

## Observação
Implementação será incremental, sem quebra de sistema e sem refatorações no backend neste momento.
