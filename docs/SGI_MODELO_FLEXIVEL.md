# PROJETO SGI — MODELO FLEXÍVEL ORIENTADO A CADASTROS

## 1. Visão Geral

O SGI é um sistema vivo, flexível e orgânico, orientado à dor real do cliente.
Não é um sistema de regras prontas, mas um motor de cadastros interligados.

Tudo nasce vazio.
O cliente constrói sua própria estrutura.
Nenhum dado é independente.

## 2. Princípio Fundamental

Tudo deve se comunicar. Nada é independente.

Pessoa, unidade, categoria, receita, despesa e conta financeira sempre possuem relacionamento explícito.

Não existem:
- categorias fixas
- saldos manuais
- regras escondidas no código

## 3. Estrutura em Camadas

### Camada 1 — Estrutura Organizacional
- Organização
- Blocos (opcional)
- Unidades (apartamentos, salas, lotes)

Nenhum dado financeiro existe sem essa base.

### Camada 2 — Pessoas
- Pessoa (CPF/CNPJ)
- Vínculo com organização
- Vínculo opcional com unidade
- Papel flexível (morador, funcionário, síndico, fornecedor etc.)

Pessoa é entidade única, nunca duplicada.

### Camada 3 — Cadastros Genéricos (Coração do Sistema)

Cadastros criados pelo cliente, todos iniciando vazios.

Categorias Financeiras:
- Tipo: Receita | Despesa | Acordo | Outros
- Código livre
- Nome
- Categoria pai (hierarquia infinita)

O sistema não cria categorias automaticamente.

### Camada 4 — Financeiro Vivo
- Contas financeiras
- Lançamentos
- Movimentações
- Transferências

Regras:
- Saldo não é campo editável
- Saldo = soma das movimentações
- Receita e despesa usam o mesmo motor

### Camada 5 — Amarrações e Regras
- Quem gera receita
- Quem paga
- Quem recebe
- Automatizações futuras (recorrência, multa, acordo)

Nenhuma regra é obrigatória. Tudo é configurável.

## 4. Fluxo Natural do Cliente
- Criar organização
- Criar estrutura (blocos/unidades)
- Criar categorias
- Cadastrar pessoas
- Vincular pessoas às unidades
- Criar contas financeiras
- Operar o sistema

## 5. Dor do Mercado Resolvida

Concorrentes são engessados, complexos e pouco transparentes.
O SGI resolve isso sendo:
- flexível
- relacional
- orgânico
- simples por conceito e poderoso por estrutura

## 6. Diretrizes de Implementação
- Não criar dados padrão por conveniência
- Não esconder lógica no código
- Priorizar modelos genéricos
- Priorizar relacionamentos explícitos
- Sempre validar: "isso conversa com o resto do sistema?"

## STATUS
Documento oficial de base do projeto.
Não implementar agora.
Usar como referência obrigatória para decisões futuras.
