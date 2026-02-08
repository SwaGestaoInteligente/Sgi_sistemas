# Fluxo Real de Uso do Condominio (Mapa Definitivo)

Este documento define a ordem natural de uso do sistema no dia a dia.
Objetivo: garantir fluxo simples, logico e escalavel, sem travar perfis agora.

## 1. Configuracoes base
Aqui o cliente cria o vocabulário do sistema.

- Cadastros base (receita, despesa, status, formas, tags, categorias)
- Estrutura do condominio (condominio -> blocos -> unidades)
- Pessoas & papeis (pessoa unica, papeis multiplos)
- Financeiro - configuracoes (plano de contas, tipos, indices)

## 2. Operacao (uso diario)
Uso prático e recorrente do condominio.

- Pessoas, funcionarios, fornecedores
- Veiculos e pets
- Chamados
- Reservas
- Avisos / comunicados (quando existir)

## 3. Financeiro (operacao + controle)
Fluxo completo de dinheiro e controles.

- Contas a pagar / receber
- Cobrancas
- Acordos / inadimplencia
- Transferencias e baixas
- Contabilidade
  - Integracao financeira
  - Lancamentos
  - Periodos
  - Demonstrativos (balancete, DRE, balanco)

## 4. Regras oficiais para agora
- Nao travar perfis nem esconder telas.
- Sistema deve existir completo primeiro.
- Perfis entram depois para filtrar o que cada um ve.

## 5. Core vs Flexivel vs Opcional

### Core (todo condominio sempre tem)
- Organizacao
- Condominio
- Unidades
- Pessoas
- Financeiro base (contas, lancamentos, status)

### Flexivel (criado pelo cliente)
- Cadastros base (tipos, categorias, tags, status)
- Papeis e vinculos
- Plano de contas detalhado

### Opcional (depende do cliente)
- Blocos e dependencias
- Veiculos e pets
- Chamados e reservas
- Indices e regras especificas

## Frase-guia
"Sistema completo primeiro. Restricoes de perfil depois."
