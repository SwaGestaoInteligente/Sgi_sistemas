# SISTEMA SWA – DOCUMENTO BASE (VERSÃO ORGANIZAÇÕES)

## 1. Visão Geral

O **Sistema SWA** é uma plataforma de **gestão organizacional** voltada para condomínios, empresas, igrejas, associações, pousadas e outros empreendimentos que precisam controlar operações, finanças e comunicação em um único lugar.

Objetivo central:

> Criar um sistema de gestão organizacional **simples de usar**, **forte em gestão**, **escalável** e **orientado por dados e IA**, adaptável a múltiplos tipos de organização.

---

## 2. Princípios do Sistema

- **Modular** – cada organização ativa apenas os módulos que utiliza.
- **Multi-organização** – um usuário pode gerenciar vários condomínios/empresas/igrejas.
- **Mobile-first + Web** – painel administrativo web + app/PWA para usuários finais.
- **Simplicidade para o usuário comum** – foco em clareza e fluxo guiado.
- **Força para o gestor** – relatórios, indicadores, auditoria.
- **Escalável** – funciona desde pequenos empreendimentos até grandes redes.
- **Transparente** – tudo auditável, com trilha de ações.

---

## 3. Público-Alvo

- Condomínios em autogestão e administradoras.
- Síndicos profissionais.
- Pequenas e médias empresas de serviços, comércio, indústria leve.
- Igrejas, associações e ONGs.
- Empreendimentos de hospedagem (pousadas, sítios, casas de temporada, coworkings).

---

## 4. Arquitetura Geral

### 4.1 Camadas

- **Core do Sistema** (Organizações, Estrutura, Pessoas, Usuários, Permissões, Logs).
- **Módulos Funcionais** (Financeiro, Comunicação, Operação, Portaria/Acessos, Documentos, Locações etc.).
- **Camada de IA** (assistentes, alertas, análises).
- **Interface Web (Admin)** – painel de gestão.
- **Interface App/PWA** – portal do morador, colaborador, cliente ou membro.

---

## 5. Módulos do Sistema

### 5.1 CORE (Obrigatório)

- Cadastro de **Organizações** (condomínio, empresa, igreja, pousada, associação etc.).
- Estrutura interna: **Unidades / Filiais / Blocos / Departamentos / Áreas**.
- Cadastro de **Pessoas**: moradores, proprietários, clientes, fornecedores, colaboradores, membros.
- **Usuários e permissões** com papéis configuráveis (síndico, gestor, diretor, administrador, atendente, morador, cliente etc.).
- Logs e histórico de ações (auditoria).

---

### 5.2 FINANCEIRO (Crítico)

Base única para todos os segmentos, com parametrização por tipo de organização.

- Contas a pagar.
- Contas a receber.
- Plano de contas e centros de custo.
- Rateio automático (por unidade, centro de custo, projeto etc.).
- Fluxo de caixa.
- Inadimplência e acordos/renegociações.
- Boletos, Pix e links de pagamento.
- Conciliação bancária.
- Prestação de contas automática (por organização, unidade, centro de custo).
- Exportação contábil.

---

### 5.3 COMUNICAÇÃO

- Avisos gerais e segmentados (por organização, unidade, grupo, perfil).
- Notificações (app, e-mail; futuramente WhatsApp e outros canais).
- Enquetes e pesquisas rápidas.
- Votações e decisões internas.
- Assembleias/reuniões (convocação, registro, atas, decisões).

---

### 5.4 OPERAÇÃO / ROTINA

Adaptável ao contexto (condomínio, empresa, igreja etc.).

- Reserva de áreas e recursos (salas, auditórios, áreas comuns, equipamentos, veículos).
- Ocorrências e chamados (manutenção, suporte, SAC, ouvidoria, TI).
- Protocolos e fluxos de atendimento (SLA, responsáveis, histórico).
- Manutenção preventiva de equipamentos e instalações.
- Cadastro de fornecedores e serviços.
- Contratos e vencimentos.

---

### 5.5 PORTARIA / ACESSOS

Mais aplicável para condomínios, empresas e empreendimentos com controle de acesso.

- Controle de visitantes.
- Prestadores de serviço.
- Autorizações de entrada.
- Encomendas e entregas.
- Histórico de entradas e saídas.

---

### 5.6 DOCUMENTOS

- Central de documentos por organização.
- Upload, versionamento e categorização.
- Pastas por exercício/ano, projeto ou centro de custo.
- Armazenamento de atas, contratos, notas fiscais, relatórios, políticas internas.

---

### 5.7 LOCAÇÕES / HOSPEDAGEM

Módulo voltado para qualquer organização que faça reservas pagas (hospedagem ou locação de espaços).

- Cadastro de imóveis, unidades, salas, quartos ou espaços.
- Calendário de disponibilidade por recurso.
- Reservas por período, com regras de uso.
- Valores por diária, pacote e serviços adicionais.
- Regras de contrato digital, termos de uso, caução.
- Check-in e check-out.
- Controle de pagamentos (Pix, boleto, sinal).
- Relatórios de ocupação e receita.
- Integração com comunicação (avisos e confirmações ao cliente/usuário).

---

## 6. Camada de IA (Diferencial SWA)

### 6.1 Assistente do Gestor

- Perguntas em linguagem natural (“Como está o caixa da empresa X este mês?”, “Quais unidades estão inadimplentes no condomínio Y?”).
- Resumos automáticos (fechamento do mês, assembleias/reuniões, relatórios gerenciais).
- Alertas inteligentes (caixa crítico, inadimplência alta, contratos vencendo, SLAs estourados).

### 6.2 IA Financeira

- Leitura automática de despesas (notas, boletos, extratos).
- Classificação automática em plano de contas/centro de custo.
- Detecção de anomalias e gastos fora do padrão.
- Sugestão de ajustes e cenários (redução de custos, projeções de caixa).

### 6.3 Atendimento ao Usuário (Morador/Cliente/Membro)

- Respostas automáticas a perguntas frequentes.
- Abertura de chamados/ocorrências via chat.
- Status em tempo real de pedidos, reservas e chamados.

---

## 7. Interfaces

### 7.1 Painel Administrativo (Web)

- Dashboard financeiro e operacional por organização.
- Indicadores e gráficos configuráveis (por tipo de organização).
- Relatórios exportáveis (PDF/Excel/CSV).
- Gestão de cadastros, acessos, configurações e módulos ativos.

### 7.2 App / PWA

- Avisos e notificações.
- Boletos e pagamentos.
- Reservas de áreas/recursos.
- Abertura e acompanhamento de chamados.
- Acesso a documentos relevantes.
- Perfil do usuário e das unidades/filiais/áreas às quais ele está vinculado.

---

## 8. Roadmap

### V1 (Essencial)

- Core multi-organização.
- Financeiro básico (contas a pagar/receber, fluxo de caixa simples, inadimplência).
- Comunicação (avisos).
- App/PWA com visão de avisos, boletos e chamados básicos.

### V2

- Portaria/Acessos onde aplicável.
- Assembleias/reuniões com votação.
- Prestação de contas avançada e relatórios comparativos entre organizações.

### V3

- IA completa (assistente do gestor + IA financeira + atendimento ao usuário).
- Integrações bancárias profundas.
- Marketplace de serviços e integrações com terceiros.

---

## 9. Diferencial Competitivo

- Plataforma única para condomínios, empresas, igrejas, associações e hospedagem.
- Menos burocracia e mais clareza operacional/financeira.
- IA prática, focada em produtividade, não só marketing.
- Modularidade real: paga e usa só o que precisa.
- Código e evolução controlados, com visão de longo prazo.

---

## 10. Status

📌 Documento base atualizado e aprovado para evolução do **Sistema SWA** como plataforma de gestão organizacional.

Próximos passos:

- Definir V1 técnica (stack + modelo de dados).
- Criar wireframes das principais telas (Admin + App/PWA).
- Iniciar desenvolvimento do Core multi-organização + Financeiro básico.

---

## MODELO DE DADOS NÚCLEO (V1 – CONCEITUAL)

### 1. Entidades centrais

**Organizacao**

- id
- nome_fantasia
- razao_social
- tipo (condominio, empresa, igreja, pousada, associacao, outro)
- documento (CNPJ/CPF)
- inscricao_estadual/municipal (opcional)
- data_inicio_operacao
- status (ativo, inativo, teste)

**UnidadeOrganizacional** (genérica: bloco, unidade, filial, departamento, sala etc.)

- id
- organizacao_id
- tipo (bloco, unidade, filial, departamento, area_comum, sala, quarto, recurso)
- codigo_interno (ex.: Apto 101, Filial SP, Sala Reunião 01)
- nome
- hierarquia (parent_id para permitir árvore: bloco → unidade, empresa → filial → depto)
- atributos_extras (JSON para campos específicos, ex.: metragem, fração ideal, capacidade)
- status (ativo, inativo)

**Pessoa**

- id
- nome
- tipo (fisica, juridica)
- documento (CPF/CNPJ)
- email
- telefone
- data_nascimento/abertura
- observacoes

**Usuario**

- id
- pessoa_id
- email_login
- senha_hash
- status (ativo, bloqueado, pendente)
- ultimo_acesso
- idioma / timezone (opcional)

**VinculoPessoaOrganizacao**

- id
- pessoa_id
- organizacao_id
- unidade_organizacional_id (opcional – quando estiver ligada a uma unidade específica, ex.: apartamento, filial)
- papel (morador, proprietario, cliente, fornecedor, colaborador, membro, sindico, gestor, diretor etc.)
- data_inicio
- data_fim (opcional)

**Papel** (tabela de referência para papéis/perfis)

- id
- chave (SINDICO, GESTOR, MORADOR, CLIENTE, COLABORADOR etc.)
- descricao

**Permissao**

- id
- chave (ex.: VER_FINANCEIRO, EDITAR_USUARIOS, CRIAR_AVISO)
- descricao

**PapelPermissao**

- papel_id
- permissao_id

**UsuarioPapelOrganizacao**

- usuario_id
- organizacao_id
- papel_id

**Endereco**

- id
- organizacao_id (opcional)
- pessoa_id (opcional)
- unidade_organizacional_id (opcional)
- logradouro, numero, complemento
- bairro, cidade, estado, cep, pais
- tipo (principal, cobrança, entrega, correspondência)

**LogAuditoria**

- id
- usuario_id (opcional)
- organizacao_id (opcional)
- entidade (nome da tabela afetada)
- entidade_id
- acao (criar, atualizar, deletar, login, etc.)
- dados_antes (JSON)
- dados_depois (JSON)
- data_hora
- ip / user_agent (opcional)

---

### 2. Núcleo Financeiro (básico)

**ContaFinanceira** (contas bancárias, caixa, carteira digital)

- id
- organizacao_id
- nome
- tipo (conta_corrente, poupanca, caixa_fisico, carteira_digital, outro)
- banco, agencia, numero_conta (quando aplicável)
- saldo_inicial
- moeda
- status

**PlanoContas**

- id
- organizacao_id (permite plano de contas por organização, com templates)
- codigo (1.01.01 etc.)
- nome
- tipo (receita, despesa, ativo, passivo, patrimonio)
- nivel (para hierarquia)
- parent_id (referência para conta pai)

**CentroCusto**

- id
- organizacao_id
- codigo
- nome
- parent_id (para hierarquia de centros de custo)

**LancamentoFinanceiro**

- id
- organizacao_id
- tipo (pagar, receber, transferencia)
- situacao (previsto, realizado, cancelado)
- plano_contas_id
- centro_custo_id (opcional)
- conta_financeira_id (para realizados)
- pessoa_id (cliente, fornecedor, morador, membro etc.)
- descricao
- valor
- data_competencia
- data_vencimento (para pagar/receber)
- data_pagamento (quando realizado)
- forma_pagamento (boleto, pix, transferencia, dinheiro, cartao, outro)
- parcela_numero / parcela_total (para parcelados ou mensalidades)
- referencia (ex.: “cota condominial 05/2026”, “mensalidade plano X”)

**DocumentoCobranca** (boleto, link de pagamento, pix etc.)

- id
- organizacao_id
- lancamento_financeiro_id
- tipo (boleto, pix, link_pagamento)
- identificador_externo (id do banco/gateway)
- linha_digitavel / qr_code / url_pagamento
- status (emitido, pago, cancelado, expirado)
- data_emissao
- data_vencimento
- data_baixa

**RegraRateio** (para condomínios ou empresas que rateiam custos)

- id
- organizacao_id
- nome
- tipo_base (por unidade, por fração ideal, por centro de custo, por percentual fixo)
- configuracao (JSON – definição das proporções)

**LancamentoRateado**

- id
- lancamento_original_id
- unidade_organizacional_id ou centro_custo_id
- valor_rateado

---

### 3. Operação / Chamados / Reservas (mínimo para V1)

**Chamado**

- id
- organizacao_id
- unidade_organizacional_id (opcional)
- pessoa_solicitante_id
- categoria (manutencao, suporte, financeiro, SAC, outro)
- titulo
- descricao
- status (aberto, em_andamento, aguardando, resolvido, cancelado)
- prioridade
- responsavel_usuario_id (opcional)
- data_abertura
- data_fechamento

**RecursoReservavel** (área comum, sala, equipamento, quarto)

- id
- organizacao_id
- unidade_organizacional_id (quando o recurso é a própria unidade ou está vinculado a ela)
- nome
- tipo (area_comum, sala, quarto, veiculo, equipamento)
- capacidade
- regras (JSON – horários, restrições, exigência de aprovação, tolerâncias, etc.)
- ativo (bool)

**Reserva**

- id
- organizacao_id
- recurso_reservavel_id
- pessoa_solicitante_id
- unidade_organizacional_id (opcional – de qual unidade/filial)
- data_inicio
- data_fim
- status (pendente, aprovada, rejeitada, cancelada, concluida)
- valor_total (se pago)
- lancamento_financeiro_id (opcional, quando a reserva gera cobrança)

