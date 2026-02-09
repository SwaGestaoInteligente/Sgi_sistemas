# SGI — Roteiro Oficial do Condomínio (espinha dorsal + ordem)

## 0) Regra de ouro (o que faz o sistema ser “de verdade”)
- Nada pode existir solto.
- Tudo precisa se comunicar.
- Tudo precisa estar amarrado para cobrança, relatórios e consultas funcionarem.
Exemplo:
João (Pessoa) é Morador (Vínculo) da Unidade 101 (Unidade) do Bloco A (Bloco) do Condomínio X (Condomínio).
→ Isso gera contas a receber, histórico e relatórios.

## 1) Estrutura física (primeiro pilar)
Hierarquia obrigatória:
Condomínio → Blocos → Unidades

Também faz parte:
- Dependências (salão, churrasqueira etc.) pertencem ao Condomínio
- Garagens/Vagas pertencem ao Condomínio e podem vincular a Unidade (ou ser comum)

Regras:
- Toda Unidade pertence a um Bloco e um Condomínio
- Toda Dependência pertence ao Condomínio
- Toda Vaga pertence ao Condomínio (e opcionalmente a uma Unidade)

## 2) Pessoas e Vínculos (segundo pilar — o mais importante)
- Pessoa é cadastro único (nome, documento, contatos)
- Pessoa vira “morador/funcionário/fornecedor/síndico/porteiro” através do VÍNCULO
- Vínculo é o que conecta: Pessoa ↔ Unidade ↔ Condomínio

Regras:
- Cobrança e acesso nascem do vínculo (não da pessoa solta)
- Um mesmo CPF pode ter múltiplos vínculos (ex.: morador e conselheiro)

## 3) Cadastros Base (terceiro pilar — flexível)
Objetivo:
- O cliente cria os próprios “tipos” e o sistema usa isso em tudo.

Cadastros Base (lista padrão do SGI):
- Tipos de Receita
- Tipos de Despesa
- Tipos de Inadimplência
- Tipos de Acordo
- Categorias Financeiras
- Centros de Custo
- Formas de Pagamento
- Status Financeiros
- Tags genéricas

Regra:
- Cadastro criado 1 vez precisa servir para:
Financeiro → Contabilidade → Relatórios → Gráficos

## 4) Financeiro (quarto pilar — movimento real e rastreável)
Princípio:
- Toda entrada e saída deve ter origem, destino, tipo e vínculo.

Componentes:
- Contas a Receber (sempre ligadas a Unidade + Pessoa + TipoReceita)
- Contas a Pagar (ligadas a Fornecedor/Funcionário + TipoDespesa)
- Transferências (entre contas do condomínio)
- Rateios/lançamentos recorrentes (usando Cadastros Base)
- Plano/estrutura financeira (categorias, centros, formas, status)

Meta:
- Consultar rápido: “quem pagou”, “quem deve”, “por quê”, “de onde veio”, “para onde foi”.

## 5) Contabilidade (quinto pilar — espelho do financeiro)
Princípio:
- Financeiro gera movimento → Contabilidade organiza e comprova → Demonstrativos mostram a saúde.

Componentes:
- Plano de Contas
- Períodos contábeis (abrir/fechar/reabrir)
- Lançamentos (partida dobrada)
- Integração financeiro → contabilidade (mapeamentos)
- Demonstrativos: Balancete, DRE, Balanço

Regra:
- Nada contábil deve ficar “solto”: sempre referenciar organização e, quando fizer sentido, o movimento financeiro.

## 6) Operação do dia a dia (sexto pilar)
Componentes típicos:
- Chamados (Pessoa + Unidade + Status + Histórico)
- Reservas (Dependências)
- Portaria (registros de entrada/saída)
- Correspondência (chegada/retirada por unidade/pessoa)

Regra:
- Tudo ligado ao Condomínio e (quando houver) à Unidade e Pessoa.

## 7) Perfis e acessos (só no final)
Perfis:
- Síndico
- Administrador
- Auxiliar Administrativo
- Porteiro/Portaria
- Morador

Regra estratégica do projeto:
- Primeiro deixar o sistema COMPLETO e redondo.
- Depois aplicar filtragens e permissões por perfil (sem travar evolução).

## 8) Ordem oficial de implantação (para não quebrar e não bagunçar)
1) Estrutura física:
Condomínio → Blocos → Unidades → Dependências → Vagas
2) Pessoas:
Pessoa (cadastro único)
3) Vínculos:
Pessoa ↔ Unidade ↔ Condomínio (papéis)
4) Cadastros Base:
tipos/categorias/status/tags (flexível)
5) Financeiro:
receber/pagar/transferências/rateios (usando cadastros base)
6) Contabilidade:
plano/períodos/lançamentos/integração/demonstrativos
7) Operação:
chamados/reservas/portaria/correspondência
8) Perfis e permissões:
síndico/admin/aux/porteiro/morador

## 9) Critério de “100% funcionando”
O sistema está “redondinho” quando:
- Cadastros base alimentam financeiro e contabilidade
- Pessoa e vínculo amarram cobrança e histórico
- Dá para responder rápido:
Quem deve? Quem pagou? Por quê? Onde mora? Qual unidade? Qual tipo? Qual período?
- Operação do dia a dia registra e consulta sem dado solto
