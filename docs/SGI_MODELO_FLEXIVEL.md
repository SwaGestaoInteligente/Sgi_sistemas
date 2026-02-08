# PROJETO SGI — MODELO FLEXÍVEL ORIENTADO A CADASTROS

## 1. Visão Geral

O SGI é um sistema vivo, flexível e orgânico, orientado à dor real do cliente.
Não é um sistema de regras prontas, mas um motor de cadastros interligados.

Tudo nasce vazio.
O cliente constrói sua própria estrutura.
Nenhum dado é independente.

## 2. Fundamento do Sistema (O Coração)

Tudo precisa se comunicar.
Nada pode ser independente.
Tudo precisa herdar algo.

Pessoa, unidade, categoria, receita, despesa e conta financeira sempre possuem relacionamento explícito.

Não existem:
- categorias fixas
- saldos manuais
- regras escondidas no código

## 3. Camadas Definitivas do SGI

### 3.1 Cadastros Base (Genéricos e Flexíveis)
O cliente cria o vocabulário do sistema.

Exemplos criados pelo cliente:
- Tipo de Receita
- Tipo de Despesa
- Tipo de Acordo
- Tipo de Inadimplência
- Tipo de Documento
- Tipo de Aviso
- Tipo de Campanha
- Tipo de Cobrança
- Tipo de Notificação

Regras:
- Nada gera dinheiro aqui
- Nada movimenta saldo
- Só define o que pode existir

Uso:
- Financeiro
- Pessoas
- Condomínio
- Relatórios

### 3.2 Estrutura do Condomínio (Hierarquia Física)
Ordem fixa e herança clara:
```text
Organização
  Condomínio
    Bloco
      Unidade
        Pessoa
```

Cadastros:
- Condomínios
- Blocos
- Unidades
- Garagens
- Dependências
- Áreas comuns

Regras:
- Tudo que gera valor financeiro aponta para Unidade ou Condomínio
- Nada flutua

### 3.3 Pessoas & Papéis (Quem é Quem)
Pessoa é única, papel é múltiplo.

Pessoa:
- Nome
- Documento
- Contato
- Endereço

Papéis:
- Morador
- Funcionário
- Síndico
- Porteiro
- Prestador
- Administrador
- Inquilino
- Outros (cliente cria)

Regras:
- Pessoa ≠ Papel
- Uma pessoa pode ter vários papéis
- Financeiro sempre aponta para Pessoa + Papel
- Histórico não se perde

### 3.4 Financeiro (Núcleo Vivo)
Tudo se conecta, nada nasce solto.

Toda movimentação financeira tem:
- Tipo (vem do Cadastro Base)
- Origem (Pessoa / Unidade / Condomínio)
- Destino
- Competência
- Status
- Histórico

Regra de ouro:
Se não estiver ligado a Pessoa + Estrutura, não entra no financeiro.

Exemplo:
João (Pessoa)
→ Unidade 102
→ Receita: Condomínio
→ Tipo: Mensal
→ Status: Aberto / Pago / Acordado

## 4. Por que é Diferente do Mercado

Concorrentes engessam receita, despesa, fundo e regras.
O SGI resolve isso sendo:
- flexível
- relacional
- orgânico
- simples por conceito e poderoso por estrutura

Cliente cria o conceito.
Sistema só organiza, amarra e executa.

## 5. O que Já Temos Criado (E Fica)
- Pessoas
- Organizações
- Unidades
- Vínculos
- Financeiro base
- UI funcional

Nada disso será descartado.
Só reposicionado dentro desse modelo.

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
