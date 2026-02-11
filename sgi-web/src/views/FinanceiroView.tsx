import React, { useEffect, useState } from "react";
import { useCallback, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import AnexosPanel from "../components/AnexosPanel";
import {
  api,
  AbonoFinanceiro,
  BalanceteItem,
  BalancoResumo,
  ChargeItem,
  ConciliacaoImportResponse,
  ContaFinanceira,
  ContaContabil,
  CobrancaOrganizacaoResumo,
  DreResumo,
  DocumentoCobranca,
  LancamentoContabil,
  LancamentoFinanceiro,
  LancamentoPagamento,
  LancamentoRateado,
  LeituraConsumo,
  MedidorConsumo,
  Organizacao,
  Pessoa,
  PeriodoContabil,
  PlanoContas,
  PrevisaoOrcamentaria,
  RegraRateio,
  RecursoReservavel,
  AcordoCobranca,
  BoletoFatura,
  IndiceEconomico,
  PoliticaCobranca,
  RemessaCobrancaItem,
  UnidadeOrganizacional
} from "../api";
import { can } from "../authz";
import { useAuth } from "../hooks/useAuth";

type FinanceiroViewProps = {
  organizacao: Organizacao;
  abaSelecionada?: FinanceiroTab;
  onAbaChange?: (aba: FinanceiroTab) => void;
  exibirMenuAbas?: boolean;
  readOnly?: boolean;
};

export type FinanceiroTab =
  | "mapaFinanceiro"
  | "contabilidade"
  | "categorias"
  | "contas"
  | "consumos"
  | "receitasDespesas"
  | "contasPagar"
  | "contasReceber"
  | "previsaoOrcamentaria"
  | "transferencias"
  | "abonos"
  | "baixasManuais"
  | "gruposRateio"
  | "itensCobrados"
  | "faturas"
  | "inadimplentes"
  | "conciliacaoBancaria"
  | "livroPrestacaoContas"
  | "relatorios";

export const menuFinanceiro: Array<{ id: FinanceiroTab; label: string; badge?: string }> = [
  { id: "mapaFinanceiro", label: "Mapa financeiro" },
  { id: "contabilidade", label: "Contabilidade" },
  { id: "categorias", label: "Categorias" },
  { id: "contas", label: "Contas" },
  { id: "consumos", label: "Consumos" },
  { id: "receitasDespesas", label: "Receitas e despesas" },
  { id: "contasPagar", label: "Contas a pagar" },
  { id: "contasReceber", label: "Contas a receber" },
  { id: "previsaoOrcamentaria", label: "Previsao orcamentaria" },
  { id: "transferencias", label: "Transferencias" },
  { id: "abonos", label: "Abonos" },
  { id: "baixasManuais", label: "Baixas manuais" },
  { id: "gruposRateio", label: "Grupos de rateio" },
  { id: "itensCobrados", label: "Cobrancas" },
  { id: "faturas", label: "Faturas" },
  { id: "inadimplentes", label: "Inadimplentes" },
  { id: "conciliacaoBancaria", label: "Conciliacao bancaria" },
  { id: "livroPrestacaoContas", label: "Livro de prestacao de contas" },
  { id: "relatorios", label: "Relatorios" }
];

type ConsumoCsvRow = {
  linha: number;
  medidorId?: string;
  numeroSerie?: string;
  medidorNome?: string;
  unidade?: string;
  competencia?: string;
  dataLeitura?: string;
  leituraAtual?: string;
  observacao?: string;
};

type ConsumoRateioItem = {
  unidadeId: string;
  unidadeLabel: string;
  consumo: number;
  valor: number;
};

export default function FinanceiroView({
  organizacao,
  abaSelecionada,
  onAbaChange,
  exibirMenuAbas = true,
  readOnly = false
}: FinanceiroViewProps) {
  const topoRef = useRef<HTMLDivElement | null>(null);
  const { token, session } = useAuth();
  const ignorarPerfis = true;
  const [abaLocal, setAbaLocal] = useState<FinanceiroTab>("mapaFinanceiro");
  const aba = abaSelecionada ?? abaLocal;
  const setAba = useCallback(
    (novaAba: FinanceiroTab) => {
      if (onAbaChange) {
        onAbaChange(novaAba);
      } else {
        setAbaLocal(novaAba);
      }
    },
    [onAbaChange]
  );
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const membershipAtual = session?.memberships?.find(
    (m) => m.condoId === organizacao.id && m.isActive
  );
  const roleAtual = session?.isPlatformAdmin
    ? "PLATFORM_ADMIN"
    : membershipAtual?.role;
  const isPlatformAdmin = session?.isPlatformAdmin === true;
  const isAdmin = isPlatformAdmin || roleAtual === "CONDO_ADMIN";
  const isStaff = roleAtual === "CONDO_STAFF";
  const canWrite = ignorarPerfis ? true : !readOnly;
  const canReadContabilidade = ignorarPerfis || isAdmin || isStaff;
  const canWriteContabilidade = ignorarPerfis || (isAdmin && canWrite);
  const canAnexos =
    ignorarPerfis || can(session, organizacao.id, "anexos.write");
  const [lancamentoSelecionado, setLancamentoSelecionado] =
    useState<LancamentoFinanceiro | null>(null);
  const [autoOpenAnexoId, setAutoOpenAnexoId] = useState<string | null>(null);

  // Contas
  const [nomeConta, setNomeConta] = useState("");
  const [tipoConta, setTipoConta] = useState("Bancária");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [numeroConta, setNumeroConta] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [moeda, setMoeda] = useState("BRL");
  const [transferenciaOrigemId, setTransferenciaOrigemId] = useState("");
  const [transferenciaDestinoId, setTransferenciaDestinoId] = useState("");
  const [transferenciaValor, setTransferenciaValor] = useState("");
  const [transferenciaData, setTransferenciaData] = useState(() => {
    const agora = new Date();
    const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });
  const [transferenciaDescricao, setTransferenciaDescricao] = useState(
    "Transferencia entre contas"
  );
  const [transferenciaReferencia, setTransferenciaReferencia] = useState("");

  // Contas a pagar (lançamentos)
  const [despesas, setDespesas] = useState<LancamentoFinanceiro[]>([]);
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoVencimento, setNovoVencimento] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novaDespesaCategoriaId, setNovaDespesaCategoriaId] = useState("");
  const [novaDespesaContaId, setNovaDespesaContaId] = useState("");
  const [novaDespesaPessoaId, setNovaDespesaPessoaId] = useState("");
  const [novaDespesaFormaPagamento, setNovaDespesaFormaPagamento] =
    useState("boleto");
  const [novaDespesaReferencia, setNovaDespesaReferencia] = useState("");

  // Contas a receber (lançamentos)
  const [receitas, setReceitas] = useState<LancamentoFinanceiro[]>([]);
  const [novaReceitaDescricao, setNovaReceitaDescricao] = useState("");
  const [novaReceitaVencimento, setNovaReceitaVencimento] = useState("");
  const [novaReceitaValor, setNovaReceitaValor] = useState("");
  const [novaReceitaCategoriaId, setNovaReceitaCategoriaId] = useState("");
  const [novaReceitaContaId, setNovaReceitaContaId] = useState("");
  const [novaReceitaPessoaId, setNovaReceitaPessoaId] = useState("");
  const [novaReceitaFormaPagamento, setNovaReceitaFormaPagamento] =
    useState("pix");
  const [novaReceitaReferencia, setNovaReceitaReferencia] = useState("");
  const [pessoasFinanceiro, setPessoasFinanceiro] = useState<Pessoa[]>([]);

  // Faturas
  const [faturas, setFaturas] = useState<DocumentoCobranca[]>([]);
  const [novaFaturaLancamentoId, setNovaFaturaLancamentoId] = useState("");
  const [novaFaturaTipo, setNovaFaturaTipo] = useState("boleto");
  const [novaFaturaVencimento, setNovaFaturaVencimento] = useState("");
  const [novaFaturaLinhaDigitavel, setNovaFaturaLinhaDigitavel] = useState("");
  const [novaFaturaQrCode, setNovaFaturaQrCode] = useState("");
  const [novaFaturaUrlPagamento, setNovaFaturaUrlPagamento] = useState("");
  const [novaFaturaIdentificador, setNovaFaturaIdentificador] = useState("");

  // Itens cobrados (salão, tags, multas, etc.)
  const [itensCobrados, setItensCobrados] = useState<ChargeItem[]>([]);
  const [novoItemNome, setNovoItemNome] = useState("");
  const [novoItemTipo, setNovoItemTipo] = useState("AreaComum");
  const [novoItemCategoriaId, setNovoItemCategoriaId] = useState("");
  const [categoriasReceita, setCategoriasReceita] = useState<PlanoContas[]>([]);
  const [categoriasDespesa, setCategoriasDespesa] = useState<PlanoContas[]>([]);
  const [novoItemValorPadrao, setNovoItemValorPadrao] = useState("");
  const [novoItemPermiteAlterar, setNovoItemPermiteAlterar] = useState(true);
  const [novoItemExigeReserva, setNovoItemExigeReserva] = useState(false);
  const [novoItemGeraCobrancaAuto, setNovoItemGeraCobrancaAuto] =
    useState(true);
  const [novoItemDescricao, setNovoItemDescricao] = useState("");

  // Grupos de rateio
  const [regrasRateio, setRegrasRateio] = useState<RegraRateio[]>([]);
  const [unidadesRateio, setUnidadesRateio] = useState<
    UnidadeOrganizacional[]
  >([]);
  const [novoRateioNome, setNovoRateioNome] = useState("");
  const [novoRateioTipo, setNovoRateioTipo] = useState<
    "igual" | "percentual"
  >("igual");
  const [novoRateioUnidades, setNovoRateioUnidades] = useState<
    Record<string, string>
  >({});
  const [rateioRegraSelecionadaId, setRateioRegraSelecionadaId] =
    useState("");
  const [rateioLancamentoId, setRateioLancamentoId] = useState("");
  const [rateiosLancamento, setRateiosLancamento] = useState<
    LancamentoRateado[]
  >([]);
  const [rateioLoading, setRateioLoading] = useState(false);
  const [rateioErro, setRateioErro] = useState<string | null>(null);

  // Uploads e conciliação
  const [mostrarEnvio, setMostrarEnvio] = useState(false);
  const [tipoEnvio, setTipoEnvio] = useState("boleto");
  const [arquivoEnvio, setArquivoEnvio] = useState<File | null>(null);
  const [statusEnvio, setStatusEnvio] = useState<string | null>(null);
  const [extratoImportado, setExtratoImportado] =
    useState<ConciliacaoImportResponse | null>(null);
  const [conciliandoId, setConciliandoId] = useState<string | null>(null);
  const [conciliados, setConciliados] = useState<string[]>([]);
  const [contaExtratoId, setContaExtratoId] = useState("");

  // Relatórios dedicados
  const [relatorioLoading, setRelatorioLoading] = useState(false);
  const [relatorioChamadosDe, setRelatorioChamadosDe] = useState("");
  const [relatorioChamadosAte, setRelatorioChamadosAte] = useState("");
  const [relatorioChamadosStatus, setRelatorioChamadosStatus] = useState("");
  const [relatorioReservasDe, setRelatorioReservasDe] = useState("");
  const [relatorioReservasAte, setRelatorioReservasAte] = useState("");
  const [relatorioReservasRecursoId, setRelatorioReservasRecursoId] =
    useState("");
  const [recursosRelatorio, setRecursosRelatorio] = useState<
    RecursoReservavel[]
  >([]);

  // Livro de prestacao de contas
  const [livroInicio, setLivroInicio] = useState("");
  const [livroFim, setLivroFim] = useState("");
  const [livroIncluirInadimplencia, setLivroIncluirInadimplencia] =
    useState(true);
  const [livroIncluirDetalhes, setLivroIncluirDetalhes] = useState(true);

  // Previsao orcamentaria
  const [previsaoAno, setPrevisaoAno] = useState(() => new Date().getFullYear());
  const [previsaoTipo, setPrevisaoTipo] = useState<"Receita" | "Despesa">(
    "Receita"
  );
  const [previsoesOrcamentarias, setPrevisoesOrcamentarias] = useState<
    PrevisaoOrcamentaria[]
  >([]);
  const [previsaoCategoriaId, setPrevisaoCategoriaId] = useState("");
  const [previsaoMes, setPrevisaoMes] = useState(
    () => new Date().getMonth() + 1
  );
  const [previsaoValor, setPrevisaoValor] = useState("");
  const [previsaoObservacao, setPrevisaoObservacao] = useState("");
  const [previsaoLoading, setPrevisaoLoading] = useState(false);
  const [previsaoErro, setPrevisaoErro] = useState<string | null>(null);

  // Abonos
  const [abonos, setAbonos] = useState<AbonoFinanceiro[]>([]);
  const [abonoLancamentoId, setAbonoLancamentoId] = useState("");
  const [abonoTipo, setAbonoTipo] = useState<"valor" | "percentual">("valor");
  const [abonoValor, setAbonoValor] = useState("");
  const [abonoPercentual, setAbonoPercentual] = useState("");
  const [abonoMotivo, setAbonoMotivo] = useState("");
  const [abonoObservacao, setAbonoObservacao] = useState("");
  const [abonoLoading, setAbonoLoading] = useState(false);
  const [abonoErro, setAbonoErro] = useState<string | null>(null);
  const [abonoSelecionadoId, setAbonoSelecionadoId] = useState<string | null>(
    null
  );
  const [autoOpenAbonoAnexoId, setAutoOpenAbonoAnexoId] = useState<
    string | null
  >(null);

  // Baixas manuais
  const [baixaLancamentoId, setBaixaLancamentoId] = useState("");
  const [baixaFiltroTipo, setBaixaFiltroTipo] = useState<"todos" | "pagar" | "receber">(
    "todos"
  );
  const [baixaFiltroTexto, setBaixaFiltroTexto] = useState("");
  const [baixaData, setBaixaData] = useState(() => {
    const agora = new Date();
    const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });
  const [baixaContaId, setBaixaContaId] = useState("");
  const [baixaFormaPagamento, setBaixaFormaPagamento] = useState("dinheiro");
  const [baixaReferencia, setBaixaReferencia] = useState("");
  const [baixaValorPago, setBaixaValorPago] = useState("");
  const [baixaPagamentos, setBaixaPagamentos] = useState<LancamentoPagamento[]>(
    []
  );
  const [baixaPagamentosLoading, setBaixaPagamentosLoading] = useState(false);
  const [baixaPagamentosErro, setBaixaPagamentosErro] = useState<string | null>(
    null
  );
  const [baixaEstornoId, setBaixaEstornoId] = useState<string | null>(null);
  const [baixaLoading, setBaixaLoading] = useState(false);
  const [baixaErro, setBaixaErro] = useState<string | null>(null);

  // Politica de cobranca e acordos
  const [politicaCobranca, setPoliticaCobranca] = useState<PoliticaCobranca | null>(
    null
  );
  const [politicaMulta, setPoliticaMulta] = useState("");
  const [politicaJuros, setPoliticaJuros] = useState("");
  const [politicaCorrecao, setPoliticaCorrecao] = useState("");
  const [politicaCorrecaoTipo, setPoliticaCorrecaoTipo] = useState(
    "PERCENTUAL_FIXO"
  );
  const [politicaCorrecaoIndice, setPoliticaCorrecaoIndice] = useState("");
  const [indiceAtual, setIndiceAtual] = useState<IndiceEconomico | null>(null);
  const [indiceLoading, setIndiceLoading] = useState(false);
  const [indiceErro, setIndiceErro] = useState<string | null>(null);
  const [politicaCarencia, setPoliticaCarencia] = useState("");
  const [politicaAtiva, setPoliticaAtiva] = useState(true);
  const [politicaLoading, setPoliticaLoading] = useState(false);
  const [politicaErro, setPoliticaErro] = useState<string | null>(null);

  const [cobrancasUnidadeOrg, setCobrancasUnidadeOrg] = useState<
    CobrancaOrganizacaoResumo[]
  >([]);
  const [cobrancasUnidadeLoading, setCobrancasUnidadeLoading] = useState(false);
  const [cobrancasUnidadeErro, setCobrancasUnidadeErro] = useState<string | null>(
    null
  );

  const [acordosCobranca, setAcordosCobranca] = useState<AcordoCobranca[]>([]);
  const [acordosLoading, setAcordosLoading] = useState(false);
  const [acordosErro, setAcordosErro] = useState<string | null>(null);
  const [acordosAviso, setAcordosAviso] = useState<string | null>(null);
  const [acordosGerandoId, setAcordosGerandoId] = useState<string | null>(null);

  const [remessaTipo, setRemessaTipo] = useState("boleto");
  const [retornoArquivo, setRetornoArquivo] = useState<File | null>(null);
  const [retornoStatus, setRetornoStatus] = useState<string | null>(null);

  // Consumos
  const [medidoresConsumo, setMedidoresConsumo] = useState<MedidorConsumo[]>([]);
  const [leiturasConsumo, setLeiturasConsumo] = useState<LeituraConsumo[]>([]);
  const [medidorSelecionadoId, setMedidorSelecionadoId] = useState("");
  const [novoMedidorNome, setNovoMedidorNome] = useState("");
  const [novoMedidorTipo, setNovoMedidorTipo] = useState("Agua");
  const [novoMedidorUnidadeId, setNovoMedidorUnidadeId] = useState("");
  const [novoMedidorUnidadeMedida, setNovoMedidorUnidadeMedida] =
    useState("m3");
  const [novoMedidorNumeroSerie, setNovoMedidorNumeroSerie] = useState("");
  const [novoMedidorObservacao, setNovoMedidorObservacao] = useState("");
  const [leituraCompetencia, setLeituraCompetencia] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [leituraData, setLeituraData] = useState(() => {
    const agora = new Date();
    const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });
  const [leituraAtual, setLeituraAtual] = useState("");
  const [leituraObservacao, setLeituraObservacao] = useState("");
  const [consumoLoading, setConsumoLoading] = useState(false);
  const [consumoErro, setConsumoErro] = useState<string | null>(null);
  const [consumoArquivo, setConsumoArquivo] = useState<File | null>(null);
  const [consumoImportStatus, setConsumoImportStatus] = useState<string | null>(
    null
  );
  const [consumoImportErros, setConsumoImportErros] = useState<string[]>([]);
  const [consumoImportando, setConsumoImportando] = useState(false);
  const [rateioConsumoCompetencia, setRateioConsumoCompetencia] = useState(
    () => new Date().toISOString().slice(0, 7)
  );
  const [rateioConsumoTipo, setRateioConsumoTipo] = useState("Agua");
  const [rateioConsumoValorTotal, setRateioConsumoValorTotal] = useState("");
  const [rateioConsumoVencimento, setRateioConsumoVencimento] = useState(() => {
    const agora = new Date();
    const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });
  const [rateioConsumoDescricao, setRateioConsumoDescricao] = useState("");
  const [rateioConsumoCategoriaId, setRateioConsumoCategoriaId] = useState("");
  const [rateioConsumoPreview, setRateioConsumoPreview] = useState<
    ConsumoRateioItem[]
  >([]);
  const [rateioConsumoLoading, setRateioConsumoLoading] = useState(false);
  const [rateioConsumoErro, setRateioConsumoErro] = useState<string | null>(
    null
  );
  const [rateioConsumoStatus, setRateioConsumoStatus] = useState<string | null>(
    null
  );

  // Plano de contas (categorias financeiras)
  const [novaCategoriaCodigo, setNovaCategoriaCodigo] = useState("");
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [novaCategoriaTipo, setNovaCategoriaTipo] =
    useState<"Receita" | "Despesa">("Receita");

  // Contabilidade
  const [contabilidadeAba, setContabilidadeAba] = useState<
    "plano" | "lancamentos" | "periodos" | "demonstrativos" | "integracao"
  >("plano");
  const contabilidadePainelRef = useRef<HTMLDivElement | null>(null);
  const [contasContabeis, setContasContabeis] = useState<ContaContabil[]>([]);
  const [periodosContabeis, setPeriodosContabeis] = useState<PeriodoContabil[]>(
    []
  );
  const [lancamentosContabeis, setLancamentosContabeis] = useState<
    LancamentoContabil[]
  >([]);
  const [contabilidadeLoading, setContabilidadeLoading] = useState(false);
  const [contabilidadeErro, setContabilidadeErro] = useState<string | null>(
    null
  );

  const [novaContaCodigo, setNovaContaCodigo] = useState("");
  const [novaContaNome, setNovaContaNome] = useState("");
  const [novaContaGrupo, setNovaContaGrupo] = useState("Ativo");
  const [novaContaNatureza, setNovaContaNatureza] = useState("Devedora");
  const [novaContaParentId, setNovaContaParentId] = useState("");
  const [novaContaSped, setNovaContaSped] = useState("");

  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [periodoObservacao, setPeriodoObservacao] = useState("");

  const [lancamentoCompetencia, setLancamentoCompetencia] = useState(() => {
    const hoje = new Date();
    const local = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });
  const [lancamentoHistorico, setLancamentoHistorico] = useState("");
  const [lancamentoValor, setLancamentoValor] = useState("");
  const [lancamentoContaDebito, setLancamentoContaDebito] = useState("");
  const [lancamentoContaCredito, setLancamentoContaCredito] = useState("");

  const [demonstrativoInicio, setDemonstrativoInicio] = useState("");
  const [demonstrativoFim, setDemonstrativoFim] = useState("");
  const [balancete, setBalancete] = useState<BalanceteItem[]>([]);
  const [dreResumo, setDreResumo] = useState<DreResumo | null>(null);
  const [balancoResumo, setBalancoResumo] = useState<BalancoResumo | null>(
    null
  );

  const [integracaoInicio, setIntegracaoInicio] = useState("");
  const [integracaoFim, setIntegracaoFim] = useState("");
  const [integracaoResultado, setIntegracaoResultado] = useState<{
    total: number;
    criados: number;
    ignorados: number;
    semMapeamento: number;
  } | null>(null);

  const organizacaoId = organizacao.id;
  const isDemoOrg = organizacao.nome?.toLowerCase().includes("demo") ?? false;
  const demoContasContabeis: ContaContabil[] = [
    {
      id: "demo-cc-ativo",
      organizacaoId,
      codigo: "1",
      nome: "Ativo",
      grupo: "Ativo",
      natureza: "Devedora",
      nivel: 1,
      ativa: true
    },
    {
      id: "demo-cc-ativo-caixa",
      organizacaoId,
      codigo: "1.1.01",
      nome: "Caixa",
      grupo: "Ativo",
      natureza: "Devedora",
      nivel: 3,
      parentId: "demo-cc-ativo",
      ativa: true,
      codigoReferencialSped: "1.01.01"
    },
    {
      id: "demo-cc-ativo-banco",
      organizacaoId,
      codigo: "1.1.02",
      nome: "Banco conta movimento",
      grupo: "Ativo",
      natureza: "Devedora",
      nivel: 3,
      parentId: "demo-cc-ativo",
      ativa: true,
      codigoReferencialSped: "1.01.02"
    },
    {
      id: "demo-cc-ativo-receber",
      organizacaoId,
      codigo: "1.2.01",
      nome: "Contas a receber",
      grupo: "Ativo",
      natureza: "Devedora",
      nivel: 3,
      parentId: "demo-cc-ativo",
      ativa: true
    },
    {
      id: "demo-cc-passivo",
      organizacaoId,
      codigo: "2",
      nome: "Passivo",
      grupo: "Passivo",
      natureza: "Credora",
      nivel: 1,
      ativa: true
    },
    {
      id: "demo-cc-passivo-forn",
      organizacaoId,
      codigo: "2.1.01",
      nome: "Fornecedores",
      grupo: "Passivo",
      natureza: "Credora",
      nivel: 3,
      parentId: "demo-cc-passivo",
      ativa: true
    },
    {
      id: "demo-cc-passivo-pagar",
      organizacaoId,
      codigo: "2.1.02",
      nome: "Contas a pagar",
      grupo: "Passivo",
      natureza: "Credora",
      nivel: 3,
      parentId: "demo-cc-passivo",
      ativa: true
    },
    {
      id: "demo-cc-patrimonio",
      organizacaoId,
      codigo: "3",
      nome: "Patrimonio liquido",
      grupo: "Patrimonio",
      natureza: "Credora",
      nivel: 1,
      ativa: true
    },
    {
      id: "demo-cc-patrimonio-capital",
      organizacaoId,
      codigo: "3.1.01",
      nome: "Capital social",
      grupo: "Patrimonio",
      natureza: "Credora",
      nivel: 3,
      parentId: "demo-cc-patrimonio",
      ativa: true
    },
    {
      id: "demo-cc-resultado",
      organizacaoId,
      codigo: "4",
      nome: "Resultado",
      grupo: "Resultado",
      natureza: "Credora",
      nivel: 1,
      ativa: true
    },
    {
      id: "demo-cc-resultado-receita",
      organizacaoId,
      codigo: "4.1.01",
      nome: "Receitas condominiais",
      grupo: "Resultado",
      natureza: "Credora",
      nivel: 3,
      parentId: "demo-cc-resultado",
      ativa: true
    },
    {
      id: "demo-cc-resultado-despesa",
      organizacaoId,
      codigo: "4.2.01",
      nome: "Despesas administrativas",
      grupo: "Resultado",
      natureza: "Devedora",
      nivel: 3,
      parentId: "demo-cc-resultado",
      ativa: true
    }
  ];
  const demoPeriodosContabeis: PeriodoContabil[] = [
    {
      id: "demo-periodo-jan",
      organizacaoId,
      competenciaInicio: "2026-01-01",
      competenciaFim: "2026-01-31",
      status: "fechado",
      fechadoEm: "2026-02-01T00:00:00Z"
    },
    {
      id: "demo-periodo-fev",
      organizacaoId,
      competenciaInicio: "2026-02-01",
      competenciaFim: "2026-02-28",
      status: "aberto"
    }
  ];
  const demoLancamentosContabeis: LancamentoContabil[] = [
    {
      id: "demo-lanc-1",
      organizacaoId,
      dataLancamento: "2026-02-05",
      competencia: "2026-02-01",
      historico: "Receita condominial fevereiro",
      origem: "financeiro",
      status: "aberto"
    },
    {
      id: "demo-lanc-2",
      organizacaoId,
      dataLancamento: "2026-02-04",
      competencia: "2026-02-01",
      historico: "Pagamento fornecedor limpeza",
      origem: "financeiro",
      status: "aberto"
    },
    {
      id: "demo-lanc-3",
      organizacaoId,
      dataLancamento: "2026-02-02",
      competencia: "2026-02-01",
      historico: "Provisao de despesas",
      origem: "ajuste",
      status: "aberto"
    }
  ];
  const demoBalancete: BalanceteItem[] = [
    {
      contaId: "demo-cc-ativo-caixa",
      codigo: "1.1.01",
      nome: "Caixa",
      debitos: 18000,
      creditos: 4500,
      saldo: 13500
    },
    {
      contaId: "demo-cc-ativo-banco",
      codigo: "1.1.02",
      nome: "Banco conta movimento",
      debitos: 62000,
      creditos: 38000,
      saldo: 24000
    },
    {
      contaId: "demo-cc-passivo-forn",
      codigo: "2.1.01",
      nome: "Fornecedores",
      debitos: 12000,
      creditos: 25000,
      saldo: -13000
    }
  ];
  const demoDre: DreResumo = {
    receitas: 92000,
    despesas: 68000,
    resultado: 24000
  };
  const demoBalanco: BalancoResumo = {
    ativo: 375000,
    passivo: 142000,
    patrimonio: 233000
  };
  const demoIntegracao = {
    total: 18,
    criados: 14,
    ignorados: 2,
    semMapeamento: 2
  };

  const usandoDemoContabilidade =
    isDemoOrg &&
    contasContabeis.length === 0 &&
    periodosContabeis.length === 0 &&
    lancamentosContabeis.length === 0;

  const contasContabeisDisplay =
    contasContabeis.length > 0 ? contasContabeis : isDemoOrg ? demoContasContabeis : [];
  const periodosContabeisDisplay =
    periodosContabeis.length > 0 ? periodosContabeis : isDemoOrg ? demoPeriodosContabeis : [];
  const lancamentosContabeisDisplay =
    lancamentosContabeis.length > 0
      ? lancamentosContabeis
      : isDemoOrg
      ? demoLancamentosContabeis
      : [];
  const balanceteDisplay =
    balancete.length > 0 ? balancete : isDemoOrg ? demoBalancete : [];
  const dreResumoDisplay = dreResumo ?? (isDemoOrg ? demoDre : null);
  const balancoResumoDisplay = balancoResumo ?? (isDemoOrg ? demoBalanco : null);
  const integracaoResultadoDisplay =
    integracaoResultado ?? (isDemoOrg ? demoIntegracao : null);

  const gruposContabeis = new Set(
    contasContabeisDisplay.map((conta) => conta.grupo.toLowerCase())
  );
  const contasAtivo = contasContabeisDisplay.filter(
    (conta) => conta.grupo.toLowerCase() === "ativo" && conta.ativa
  );
  const contasPassivo = contasContabeisDisplay.filter(
    (conta) => conta.grupo.toLowerCase() === "passivo" && conta.ativa
  );
  const contasPatrimonio = contasContabeisDisplay.filter(
    (conta) => conta.grupo.toLowerCase() === "patrimonio" && conta.ativa
  );
  const contasResultado = contasContabeisDisplay.filter(
    (conta) => conta.grupo.toLowerCase() === "resultado" && conta.ativa
  );
  const totalLancamentosContabeis = lancamentosContabeisDisplay.length;

  const carregarContas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarContas(token, organizacaoId);
      setContas(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar contas financeiras");
    } finally {
      setLoading(false);
    }
  };

  const carregarPessoasFinanceiro = async () => {
    if (!token) return;
    try {
      setErro(null);
      const lista = await api.listarPessoas(token, organizacaoId);
      setPessoasFinanceiro(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar pessoas para financeiro");
    }
  };

  const carregarDespesas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const data = await api.listarLancamentos(token, organizacaoId, {
        tipo: "pagar"
      });
      setDespesas(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar lançamentos a pagar");
    } finally {
      setLoading(false);
    }
  };

  const carregarItensCobrados = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarItensCobrados(
        token,
        organizacaoId,
        true // apenas ativos
      );
      setItensCobrados(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar itens cobrados");
    } finally {
      setLoading(false);
    }
  };

  const carregarRegrasRateio = async () => {
    if (!token) return;
    try {
      setRateioErro(null);
      setRateioLoading(true);
      const lista = await api.listarRegrasRateio(token, organizacaoId);
      setRegrasRateio(lista);
    } catch (e: any) {
      setRateioErro(e.message || "Erro ao carregar grupos de rateio");
    } finally {
      setRateioLoading(false);
    }
  };

  const carregarUnidadesRateio = async () => {
    if (!token) return;
    try {
      setRateioErro(null);
      const lista = await api.listarUnidades(token, organizacaoId);
      setUnidadesRateio(lista);
    } catch (e: any) {
      setRateioErro(e.message || "Erro ao carregar unidades para rateio");
    }
  };

  const carregarRateiosLancamento = async (lancamentoId: string) => {
    if (!token) return;
    if (!lancamentoId) {
      setRateiosLancamento([]);
      return;
    }
    try {
      setRateioErro(null);
      setRateioLoading(true);
      const lista = await api.listarRateiosLancamento(
        token,
        lancamentoId,
        organizacaoId
      );
      setRateiosLancamento(lista);
    } catch (e: any) {
      setRateioErro(e.message || "Erro ao carregar rateios do lancamento");
    } finally {
      setRateioLoading(false);
    }
  };

  const limparFormularioRateio = () => {
    setNovoRateioNome("");
    setNovoRateioTipo("igual");
    setNovoRateioUnidades({});
  };

  const selecionarTodasUnidadesRateio = () => {
    const selecionadas = unidadesRateioDisplay.reduce(
      (acc, unidade) => {
        acc[unidade.id] = novoRateioTipo === "percentual" ? "0" : "";
        return acc;
      },
      {} as Record<string, string>
    );
    setNovoRateioUnidades(selecionadas);
  };

  const criarRegraRateio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!novoRateioNome.trim()) {
      setRateioErro("Informe o nome do grupo de rateio.");
      return;
    }

    const unidadesSelecionadas = Object.entries(novoRateioUnidades).map(
      ([unidadeId, percentualRaw]) => {
        const percentual = percentualRaw
          ? Number(percentualRaw.replace(",", "."))
          : undefined;
        return {
          unidadeId,
          percentual: Number.isFinite(percentual) ? percentual : undefined
        };
      }
    );

    if (unidadesSelecionadas.length === 0) {
      setRateioErro("Selecione ao menos uma unidade para o rateio.");
      return;
    }

    if (novoRateioTipo === "percentual") {
      const percentuaisInvalidos = unidadesSelecionadas.some(
        (u) => u.percentual === undefined
      );
      if (percentuaisInvalidos) {
        setRateioErro("Informe o percentual para todas as unidades.");
        return;
      }
      const soma = unidadesSelecionadas.reduce(
        (acc, u) => acc + (u.percentual ?? 0),
        0
      );
      if (Math.abs(soma - 100) > 0.01) {
        setRateioErro("A soma dos percentuais deve ser 100%.");
        return;
      }
    }

    try {
      setRateioErro(null);
      setRateioLoading(true);
      const regra = await api.criarRegraRateio(token, {
        organizacaoId,
        nome: novoRateioNome.trim(),
        tipoBase: novoRateioTipo,
        unidades: unidadesSelecionadas
      });
      setRegrasRateio((prev) => [...prev, regra]);
      limparFormularioRateio();
    } catch (e: any) {
      setRateioErro(e.message || "Erro ao criar grupo de rateio");
    } finally {
      setRateioLoading(false);
    }
  };

  const removerRegraRateio = async (regra: RegraRateio) => {
    if (!token) return;
    if (!window.confirm(`Remover o grupo "${regra.nome}"?`)) {
      return;
    }
    try {
      setRateioErro(null);
      setRateioLoading(true);
      await api.removerRegraRateio(token, regra.id);
      setRegrasRateio((prev) => prev.filter((r) => r.id !== regra.id));
      if (rateioRegraSelecionadaId === regra.id) {
        setRateioRegraSelecionadaId("");
      }
    } catch (e: any) {
      setRateioErro(e.message || "Erro ao remover grupo de rateio");
    } finally {
      setRateioLoading(false);
    }
  };

  const aplicarRegraRateio = async () => {
    if (!token) return;
    if (!rateioLancamentoId) {
      setRateioErro("Selecione um lancamento para aplicar o rateio.");
      return;
    }
    if (!rateioRegraSelecionadaId) {
      setRateioErro("Selecione um grupo de rateio.");
      return;
    }
    try {
      setRateioErro(null);
      setRateioLoading(true);
      const lista = await api.aplicarRegraRateio(
        token,
        rateioRegraSelecionadaId,
        {
          organizacaoId,
          lancamentoId: rateioLancamentoId
        }
      );
      setRateiosLancamento(lista);
    } catch (e: any) {
      setRateioErro(e.message || "Erro ao aplicar rateio");
    } finally {
      setRateioLoading(false);
    }
  };

  const limparRateiosLancamento = async () => {
    if (!token) return;
    if (!rateioLancamentoId) return;
    try {
      setRateioErro(null);
      setRateioLoading(true);
      await api.removerRateiosLancamento(
        token,
        rateioLancamentoId,
        organizacaoId
      );
      setRateiosLancamento([]);
    } catch (e: any) {
      setRateioErro(e.message || "Erro ao limpar rateio");
    } finally {
      setRateioLoading(false);
    }
  };

  const carregarMedidoresConsumo = async () => {
    if (!token) return;
    try {
      setConsumoErro(null);
      setConsumoLoading(true);
      const lista = await api.listarMedidoresConsumo(token, organizacaoId);
      setMedidoresConsumo(lista);
      setMedidorSelecionadoId((prev) => {
        if (prev && lista.some((m) => m.id === prev)) {
          return prev;
        }
        return lista[0]?.id ?? "";
      });
    } catch (e: any) {
      setConsumoErro(e.message || "Erro ao carregar medidores de consumo");
    } finally {
      setConsumoLoading(false);
    }
  };

  const carregarLeiturasConsumo = async (medidorId: string) => {
    if (!token) return;
    if (!medidorId) {
      setLeiturasConsumo([]);
      return;
    }
    try {
      setConsumoErro(null);
      setConsumoLoading(true);
      const lista = await api.listarLeiturasConsumo(
        token,
        organizacaoId,
        medidorId
      );
      setLeiturasConsumo(lista);
    } catch (e: any) {
      setConsumoErro(e.message || "Erro ao carregar leituras do medidor");
    } finally {
      setConsumoLoading(false);
    }
  };

  const criarMedidorConsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!novoMedidorUnidadeId) {
      setConsumoErro("Selecione a unidade do medidor.");
      return;
    }
    if (!novoMedidorNome.trim()) {
      setConsumoErro("Informe o nome do medidor.");
      return;
    }
    if (!novoMedidorUnidadeMedida.trim()) {
      setConsumoErro("Informe a unidade de medida.");
      return;
    }

    try {
      setConsumoErro(null);
      setConsumoLoading(true);
      const criado = await api.criarMedidorConsumo(token, {
        organizacaoId,
        unidadeOrganizacionalId: novoMedidorUnidadeId,
        nome: novoMedidorNome.trim(),
        tipo: novoMedidorTipo,
        unidadeMedida: novoMedidorUnidadeMedida.trim(),
        numeroSerie: novoMedidorNumeroSerie.trim() || null,
        ativo: true,
        observacao: novoMedidorObservacao.trim() || null
      });
      setMedidoresConsumo((prev) => {
        const novaLista = [...prev, criado];
        novaLista.sort((a, b) => a.nome.localeCompare(b.nome));
        return novaLista;
      });
      setMedidorSelecionadoId(criado.id);
      setNovoMedidorNome("");
      setNovoMedidorNumeroSerie("");
      setNovoMedidorObservacao("");
    } catch (e: any) {
      setConsumoErro(e.message || "Erro ao salvar medidor de consumo");
    } finally {
      setConsumoLoading(false);
    }
  };

  const editarMedidorConsumo = async (medidor: MedidorConsumo) => {
    if (!token) return;
    const nome = window.prompt("Nome do medidor:", medidor.nome);
    if (!nome) return;
    const tipo = window.prompt(
      "Tipo (Agua, Gas, Energia, Outro):",
      medidor.tipo
    );
    if (!tipo) return;
    const unidadeMedida = window.prompt(
      "Unidade de medida:",
      medidor.unidadeMedida
    );
    if (!unidadeMedida) return;
    if (!nome.trim()) {
      setConsumoErro("Nome do medidor invalido.");
      return;
    }
    if (!unidadeMedida.trim()) {
      setConsumoErro("Unidade de medida invalida.");
      return;
    }
    const tipoNormalizado = (() => {
      const raw = tipo.trim().toLowerCase();
      if (raw === "agua") return "Agua";
      if (raw === "gas") return "Gas";
      if (raw === "energia") return "Energia";
      if (raw === "outro" || raw === "outros") return "Outro";
      return "";
    })();
    if (!tipoNormalizado) {
      setConsumoErro("Tipo do medidor invalido.");
      return;
    }
    const numeroSerie = window.prompt(
      "Numero de serie (opcional):",
      medidor.numeroSerie ?? ""
    );
    const observacao = window.prompt(
      "Observacao (opcional):",
      medidor.observacao ?? ""
    );

    try {
      setConsumoErro(null);
      setConsumoLoading(true);
      await api.atualizarMedidorConsumo(token, medidor.id, {
        unidadeOrganizacionalId: medidor.unidadeOrganizacionalId,
        nome: nome.trim(),
        tipo: tipoNormalizado,
        unidadeMedida: unidadeMedida.trim(),
        numeroSerie: numeroSerie?.trim() || null,
        ativo: medidor.ativo,
        observacao: observacao?.trim() || null
      });
      setMedidoresConsumo((prev) =>
        prev.map((item) =>
          item.id === medidor.id
            ? {
                ...item,
                nome: nome.trim(),
                tipo: tipoNormalizado,
                unidadeMedida: unidadeMedida.trim(),
                numeroSerie: numeroSerie?.trim() || null,
                observacao: observacao?.trim() || null
              }
            : item
        )
      );
    } catch (e: any) {
      setConsumoErro(e.message || "Erro ao atualizar medidor");
    } finally {
      setConsumoLoading(false);
    }
  };

  const alternarStatusMedidorConsumo = async (medidor: MedidorConsumo) => {
    if (!token) return;
    try {
      setConsumoErro(null);
      setConsumoLoading(true);
      await api.atualizarMedidorConsumo(token, medidor.id, {
        unidadeOrganizacionalId: medidor.unidadeOrganizacionalId,
        nome: medidor.nome,
        tipo: medidor.tipo,
        unidadeMedida: medidor.unidadeMedida,
        numeroSerie: medidor.numeroSerie ?? null,
        ativo: !medidor.ativo,
        observacao: medidor.observacao ?? null
      });
      setMedidoresConsumo((prev) =>
        prev.map((item) =>
          item.id === medidor.id ? { ...item, ativo: !item.ativo } : item
        )
      );
    } catch (e: any) {
      setConsumoErro(e.message || "Erro ao atualizar status do medidor");
    } finally {
      setConsumoLoading(false);
    }
  };

  const removerMedidorConsumo = async (medidor: MedidorConsumo) => {
    if (!token) return;
    if (!window.confirm("Remover este medidor e suas leituras?")) return;
    try {
      setConsumoErro(null);
      setConsumoLoading(true);
      await api.removerMedidorConsumo(token, medidor.id);
      setMedidoresConsumo((prev) => prev.filter((item) => item.id !== medidor.id));
      if (medidorSelecionadoId === medidor.id) {
        setMedidorSelecionadoId("");
        setLeiturasConsumo([]);
      }
    } catch (e: any) {
      setConsumoErro(e.message || "Erro ao remover medidor");
    } finally {
      setConsumoLoading(false);
    }
  };

  const criarLeituraConsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!medidorSelecionadoId) {
      setConsumoErro("Selecione um medidor para registrar a leitura.");
      return;
    }
    if (!leituraCompetencia) {
      setConsumoErro("Informe a competencia.");
      return;
    }
    if (!leituraData) {
      setConsumoErro("Informe a data da leitura.");
      return;
    }
    const leituraValor = Number(
      leituraAtual.replace(/\./g, "").replace(",", ".")
    );
    if (!Number.isFinite(leituraValor) || leituraValor < 0) {
      setConsumoErro("Leitura atual invalida.");
      return;
    }

    try {
      setConsumoErro(null);
      setConsumoLoading(true);
      const criada = await api.criarLeituraConsumo(token, {
        organizacaoId,
        medidorId: medidorSelecionadoId,
        competencia: leituraCompetencia,
        dataLeitura: leituraData,
        leituraAtual: leituraValor,
        observacao: leituraObservacao.trim() || null
      });
      setLeiturasConsumo((prev) => {
        const novaLista = [...prev, criada];
        novaLista.sort((a, b) =>
          (a.dataLeitura ?? "").localeCompare(b.dataLeitura ?? "")
        );
        return novaLista;
      });
      setLeituraAtual("");
      setLeituraObservacao("");
    } catch (e: any) {
      setConsumoErro(e.message || "Erro ao salvar leitura");
    } finally {
      setConsumoLoading(false);
    }
  };

  const editarLeituraConsumo = async (leitura: LeituraConsumo) => {
    if (!token) return;
    const novaLeituraRaw = window.prompt(
      "Nova leitura atual:",
      leitura.leituraAtual.toString()
    );
    if (!novaLeituraRaw) return;
    const novoValor = Number(
      novaLeituraRaw.replace(/\./g, "").replace(",", ".")
    );
    if (!Number.isFinite(novoValor) || novoValor < 0) {
      setConsumoErro("Leitura invalida.");
      return;
    }
    const novaObservacao = window.prompt(
      "Observacao (opcional):",
      leitura.observacao ?? ""
    );

    try {
      setConsumoErro(null);
      setConsumoLoading(true);
      await api.atualizarLeituraConsumo(token, leitura.id, {
        competencia: leitura.competencia,
        dataLeitura: leitura.dataLeitura,
        leituraAtual: novoValor,
        observacao: novaObservacao?.trim() || null
      });
      setLeiturasConsumo((prev) =>
        prev.map((item) =>
          item.id === leitura.id
            ? {
                ...item,
                leituraAtual: novoValor,
                consumo: novoValor - item.leituraAnterior,
                observacao: novaObservacao?.trim() || null
              }
            : item
        )
      );
    } catch (e: any) {
      setConsumoErro(e.message || "Erro ao atualizar leitura");
    } finally {
      setConsumoLoading(false);
    }
  };

  const removerLeituraConsumo = async (leitura: LeituraConsumo) => {
    if (!token) return;
    if (!window.confirm("Remover esta leitura?")) return;
    try {
      setConsumoErro(null);
      setConsumoLoading(true);
      await api.removerLeituraConsumo(token, leitura.id);
      setLeiturasConsumo((prev) => prev.filter((item) => item.id !== leitura.id));
    } catch (e: any) {
      setConsumoErro(e.message || "Erro ao remover leitura");
    } finally {
      setConsumoLoading(false);
    }
  };

  const importarLeiturasCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !consumoArquivo) return;

    try {
      setConsumoImportStatus(null);
      setConsumoImportErros([]);
      setConsumoImportando(true);

      const linhas = await parseConsumoCsv(consumoArquivo);
      if (linhas.length === 0) {
        setConsumoImportErros(["Arquivo vazio ou sem linhas validas."]);
        return;
      }

      const medidoresBase =
        medidoresConsumo.length > 0
          ? medidoresConsumo
          : await api.listarMedidoresConsumo(token, organizacaoId);

      const medidoresPorId = new Map(
        medidoresBase.map((m) => [m.id.toLowerCase(), m])
      );
      const medidoresPorSerie = new Map(
        medidoresBase
          .filter((m) => m.numeroSerie)
          .map((m) => [String(m.numeroSerie).toLowerCase(), m])
      );
      const medidoresPorNome = new Map<string, MedidorConsumo[]>();
      medidoresBase.forEach((m) => {
        const chave = m.nome.trim().toLowerCase();
        const lista = medidoresPorNome.get(chave) ?? [];
        lista.push(m);
        medidoresPorNome.set(chave, lista);
      });

      const unidadesPorCodigo = new Map<string, UnidadeOrganizacional>();
      const unidadesPorNome = new Map<string, UnidadeOrganizacional>();
      unidadesRateio.forEach((unidade) => {
        if (unidade.codigoInterno) {
          unidadesPorCodigo.set(unidade.codigoInterno.trim().toLowerCase(), unidade);
        }
        unidadesPorNome.set(unidade.nome.trim().toLowerCase(), unidade);
      });

      let sucesso = 0;
      const erros: string[] = [];

      for (const linha of linhas) {
        const medidorId = linha.medidorId?.trim();
        const numeroSerie = linha.numeroSerie?.trim();
        const medidorNome = linha.medidorNome?.trim();
        const unidadeInfo = linha.unidade?.trim();

        let medidor: MedidorConsumo | undefined;
        if (medidorId) {
          medidor = medidoresPorId.get(medidorId.toLowerCase());
        } else if (numeroSerie) {
          medidor = medidoresPorSerie.get(numeroSerie.toLowerCase());
        } else if (medidorNome) {
          const candidatos = medidoresPorNome.get(medidorNome.toLowerCase()) ?? [];
          if (candidatos.length === 1) {
            medidor = candidatos[0];
          } else if (candidatos.length > 1 && unidadeInfo) {
            const unidadeKey = unidadeInfo.toLowerCase();
            const unidadeMatch =
              unidadesPorCodigo.get(unidadeKey) || unidadesPorNome.get(unidadeKey);
            if (unidadeMatch) {
              medidor = candidatos.find(
                (item) => item.unidadeOrganizacionalId === unidadeMatch.id
              );
            }
          }
        }

        if (!medidor) {
          erros.push(`Linha ${linha.linha}: medidor nao encontrado.`);
          continue;
        }

        const dataLeitura = parseCsvDate(linha.dataLeitura ?? "");
        const competenciaRaw = linha.competencia?.trim();
        const competenciaValida =
          competenciaRaw && /^\d{4}-\d{2}$/.test(competenciaRaw)
            ? competenciaRaw
            : dataLeitura
            ? dataLeitura.slice(0, 7)
            : "";
        if (!competenciaValida) {
          erros.push(`Linha ${linha.linha}: competencia invalida.`);
          continue;
        }

        const dataFinal = dataLeitura ?? `${competenciaValida}-01`;
        const leituraValor = Number(
          (linha.leituraAtual ?? "").replace(/\./g, "").replace(",", ".")
        );
        if (!Number.isFinite(leituraValor) || leituraValor < 0) {
          erros.push(`Linha ${linha.linha}: leitura atual invalida.`);
          continue;
        }

        try {
          await api.criarLeituraConsumo(token, {
            organizacaoId,
            medidorId: medidor.id,
            competencia: competenciaValida,
            dataLeitura: dataFinal,
            leituraAtual: leituraValor,
            observacao: linha.observacao?.trim() || null
          });
          sucesso += 1;
        } catch (err: any) {
          erros.push(
            `Linha ${linha.linha}: ${err?.message || "Erro ao importar leitura."}`
          );
        }
      }

      setConsumoImportStatus(
        `Importadas ${sucesso} leitura(s). ${erros.length} erro(s).`
      );
      setConsumoImportErros(erros.slice(0, 6));
      setConsumoArquivo(null);

      if (medidorSelecionadoId) {
        await carregarLeiturasConsumo(medidorSelecionadoId);
      }
    } catch (e: any) {
      setConsumoImportErros([e.message || "Erro ao importar CSV."]);
    } finally {
      setConsumoImportando(false);
    }
  };

  const calcularRateioConsumo = async (): Promise<ConsumoRateioItem[]> => {
    if (!token) return [];

    if (!rateioConsumoCompetencia) {
      setRateioConsumoErro("Informe a competencia.");
      return [];
    }

    const valorTotal = Number(
      rateioConsumoValorTotal.replace(/\./g, "").replace(",", ".")
    );
    if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
      setRateioConsumoErro("Informe o valor total da conta.");
      return [];
    }

    const medidoresFiltrados = medidoresConsumo.filter(
      (m) =>
        m.ativo &&
        (rateioConsumoTipo === "Todos" || m.tipo === rateioConsumoTipo)
    );
    if (medidoresFiltrados.length === 0) {
      setRateioConsumoErro("Nenhum medidor ativo encontrado para o tipo.");
      return [];
    }

    const leiturasPorMedidor = await Promise.all(
      medidoresFiltrados.map((medidor) =>
        api.listarLeiturasConsumo(token, organizacaoId, medidor.id, {
          competencia: rateioConsumoCompetencia
        })
      )
    );

    const consumoPorUnidade: Record<string, number> = {};
    medidoresFiltrados.forEach((medidor, index) => {
      const totalMedidor = (leiturasPorMedidor[index] ?? []).reduce(
        (acc, leitura) => acc + (leitura.consumo ?? 0),
        0
      );
      if (totalMedidor <= 0) return;
      consumoPorUnidade[medidor.unidadeOrganizacionalId] =
        (consumoPorUnidade[medidor.unidadeOrganizacionalId] ?? 0) + totalMedidor;
    });

    const itensBase = unidadesRateioDisplay
      .map((unidade) => ({
        unidadeId: unidade.id,
        unidadeLabel: `${unidade.codigoInterno} - ${unidade.nome}`,
        consumo: consumoPorUnidade[unidade.id] ?? 0
      }))
      .filter((item) => item.consumo > 0);

    if (itensBase.length === 0) {
      setRateioConsumoErro("Nenhum consumo encontrado para a competencia.");
      return [];
    }

    const totalConsumo = itensBase.reduce((acc, item) => acc + item.consumo, 0);
    const valores = itensBase.map((item) =>
      Math.round((valorTotal * item.consumo * 100) / totalConsumo) / 100
    );
    const soma = valores.reduce((acc, valor) => acc + valor, 0);
    const diferenca = valorTotal - soma;
    if (valores.length > 0 && diferenca !== 0) {
      valores[valores.length - 1] =
        Math.round((valores[valores.length - 1] + diferenca) * 100) / 100;
    }

    return itensBase.map((item, index) => ({
      ...item,
      valor: valores[index]
    }));
  };

  const simularRateioConsumo = async () => {
    if (!token) return;
    try {
      setRateioConsumoErro(null);
      setRateioConsumoStatus(null);
      setRateioConsumoLoading(true);
      const preview = await calcularRateioConsumo();
      setRateioConsumoPreview(preview);
      if (preview.length > 0) {
        setRateioConsumoStatus(
          `Simulacao gerada para ${preview.length} unidade(s).`
        );
      }
    } catch (e: any) {
      setRateioConsumoErro(e.message || "Erro ao simular rateio.");
    } finally {
      setRateioConsumoLoading(false);
    }
  };

  const gerarCobrancasConsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!rateioConsumoVencimento) {
      setRateioConsumoErro("Informe o vencimento.");
      return;
    }

    try {
      setRateioConsumoErro(null);
      setRateioConsumoStatus(null);
      setRateioConsumoLoading(true);

      const preview = await calcularRateioConsumo();
      if (preview.length === 0) {
        return;
      }
      setRateioConsumoPreview(preview);

      const descricaoFinal =
        rateioConsumoDescricao.trim() ||
        `Consumo ${rateioConsumoTipo} ${rateioConsumoCompetencia}`;

      if (
        !window.confirm(
          `Gerar ${preview.length} cobranca(s) para ${rateioConsumoCompetencia}?`
        )
      ) {
        return;
      }

      for (const item of preview) {
        await api.criarCobrancaUnidade(token, item.unidadeId, {
          organizacaoId,
          competencia: rateioConsumoCompetencia,
          descricao: descricaoFinal,
          categoriaId: rateioConsumoCategoriaId || undefined,
          valor: item.valor,
          vencimento: rateioConsumoVencimento,
          status: "ABERTA"
        });
      }

      setRateioConsumoStatus(
        `Cobrancas geradas: ${preview.length} unidade(s).`
      );
      setRateioConsumoPreview([]);
    } catch (e: any) {
      setRateioConsumoErro(e.message || "Erro ao gerar cobrancas.");
    } finally {
      setRateioConsumoLoading(false);
    }
  };

  const carregarPrevisoesOrcamentarias = async () => {
    if (!token) return;
    try {
      setPrevisaoErro(null);
      setPrevisaoLoading(true);
      const lista = await api.listarPrevisoesOrcamentarias(token, organizacaoId, {
        ano: previsaoAno,
        tipo: previsaoTipo
      });
      setPrevisoesOrcamentarias(lista);
    } catch (e: any) {
      setPrevisaoErro(e.message || "Erro ao carregar previsoes orcamentarias");
    } finally {
      setPrevisaoLoading(false);
    }
  };

  const criarPrevisaoOrcamentaria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!previsaoCategoriaId) {
      setPrevisaoErro("Selecione uma categoria.");
      return;
    }
    const valor = Number(previsaoValor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setPrevisaoErro("Informe um valor valido.");
      return;
    }

    try {
      setPrevisaoErro(null);
      setPrevisaoLoading(true);
      const criada = await api.criarPrevisaoOrcamentaria(token, {
        organizacaoId,
        planoContasId: previsaoCategoriaId,
        tipo: previsaoTipo,
        ano: previsaoAno,
        mes: previsaoMes,
        valorPrevisto: valor,
        observacao: previsaoObservacao.trim() || null
      });
      setPrevisoesOrcamentarias((prev) => {
        const semDuplicado = prev.filter((p) => p.id !== criada.id);
        return [...semDuplicado, criada];
      });
      setPrevisaoValor("");
      setPrevisaoObservacao("");
    } catch (e: any) {
      setPrevisaoErro(e.message || "Erro ao salvar previsao orcamentaria");
    } finally {
      setPrevisaoLoading(false);
    }
  };

  const atualizarPrevisaoOrcamentaria = async (
    previsao: PrevisaoOrcamentaria
  ) => {
    if (!token) return;
    const novoValorRaw = window.prompt(
      "Novo valor previsto:",
      previsao.valorPrevisto.toString()
    );
    if (!novoValorRaw) return;
    const novoValor = Number(novoValorRaw.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(novoValor) || novoValor <= 0) {
      setPrevisaoErro("Valor invalido.");
      return;
    }
    const novaObservacao = window.prompt(
      "Observacao (opcional):",
      previsao.observacao ?? ""
    );

    try {
      setPrevisaoErro(null);
      setPrevisaoLoading(true);
      await api.atualizarPrevisaoOrcamentaria(token, previsao.id, {
        planoContasId: previsao.planoContasId,
        tipo: previsao.tipo,
        ano: previsao.ano,
        mes: previsao.mes,
        valorPrevisto: novoValor,
        observacao: novaObservacao?.trim() || null
      });
      setPrevisoesOrcamentarias((prev) =>
        prev.map((p) =>
          p.id === previsao.id
            ? {
                ...p,
                valorPrevisto: novoValor,
                observacao: novaObservacao?.trim() || null
              }
            : p
        )
      );
    } catch (e: any) {
      setPrevisaoErro(e.message || "Erro ao atualizar previsao");
    } finally {
      setPrevisaoLoading(false);
    }
  };

  const removerPrevisaoOrcamentaria = async (
    previsao: PrevisaoOrcamentaria
  ) => {
    if (!token) return;
    if (!window.confirm("Remover esta previsao?")) return;
    try {
      setPrevisaoErro(null);
      setPrevisaoLoading(true);
      await api.removerPrevisaoOrcamentaria(token, previsao.id);
      setPrevisoesOrcamentarias((prev) =>
        prev.filter((p) => p.id !== previsao.id)
      );
    } catch (e: any) {
      setPrevisaoErro(e.message || "Erro ao remover previsao");
    } finally {
      setPrevisaoLoading(false);
    }
  };

  const carregarAbonos = async () => {
    if (!token) return;
    try {
      setAbonoErro(null);
      setAbonoLoading(true);
      const lista = await api.listarAbonos(token, organizacaoId);
      setAbonos(lista);
    } catch (e: any) {
      setAbonoErro(e.message || "Erro ao carregar abonos.");
    } finally {
      setAbonoLoading(false);
    }
  };

  const criarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!abonoLancamentoId) {
      setAbonoErro("Selecione um lancamento para abonar.");
      return;
    }
    if (!abonoMotivo.trim()) {
      setAbonoErro("Informe o motivo do abono.");
      return;
    }

    let valor: number | null = null;
    let percentual: number | null = null;
    if (abonoTipo === "percentual") {
      const parsed = Number(
        abonoPercentual.replace(/\./g, "").replace(",", ".")
      );
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
        setAbonoErro("Percentual invalido.");
        return;
      }
      percentual = parsed;
    } else {
      const parsed = Number(abonoValor.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setAbonoErro("Valor do abono invalido.");
        return;
      }
      valor = parsed;
    }

    try {
      setAbonoErro(null);
      setAbonoLoading(true);
      const criado = await api.criarAbono(token, {
        organizacaoId,
        lancamentoFinanceiroId: abonoLancamentoId,
        tipo: abonoTipo,
        valor,
        percentual,
        motivo: abonoMotivo.trim(),
        observacao: abonoObservacao.trim() || null
      });
      setAbonos((prev) => [criado, ...prev]);
      setAbonoValor("");
      setAbonoPercentual("");
      setAbonoMotivo("");
      setAbonoObservacao("");
    } catch (e: any) {
      setAbonoErro(e.message || "Erro ao salvar abono.");
    } finally {
      setAbonoLoading(false);
    }
  };

  const atualizarStatusAbono = async (abono: AbonoFinanceiro, status: string) => {
    if (!token) return;
    try {
      setAbonoErro(null);
      setAbonoLoading(true);
      await api.atualizarStatusAbono(token, abono.id, status);
      await Promise.all([carregarAbonos(), carregarReceitas()]);
    } catch (e: any) {
      setAbonoErro(e.message || "Erro ao atualizar status do abono.");
    } finally {
      setAbonoLoading(false);
    }
  };

  const removerAbono = async (abono: AbonoFinanceiro) => {
    if (!token) return;
    if (!window.confirm("Remover este abono?")) return;
    try {
      setAbonoErro(null);
      setAbonoLoading(true);
      await api.removerAbono(token, abono.id);
      setAbonos((prev) => prev.filter((item) => item.id !== abono.id));
    } catch (e: any) {
      setAbonoErro(e.message || "Erro ao remover abono.");
    } finally {
      setAbonoLoading(false);
    }
  };

  const carregarPagamentosBaixa = async (lancamentoId: string) => {
    if (!token) return;
    if (!lancamentoId) {
      setBaixaPagamentos([]);
      return;
    }
    try {
      setBaixaPagamentosErro(null);
      setBaixaPagamentosLoading(true);
      const data = await api.listarPagamentosLancamento(
        token,
        lancamentoId,
        organizacaoId
      );
      setBaixaPagamentos(data);
    } catch (e: any) {
      setBaixaPagamentosErro(e.message || "Erro ao carregar pagamentos.");
    } finally {
      setBaixaPagamentosLoading(false);
    }
  };

  const baixarLancamentoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!baixaLancamentoId) {
      setBaixaErro("Selecione um lancamento para baixar.");
      return;
    }
    const lancamentoSelecionado = baixaLancamentoSelecionado;
    if (!lancamentoSelecionado) {
      setBaixaErro("Lancamento selecionado invalido.");
      return;
    }
    const valorDigitado = baixaValorPago.trim();
    let valorPago: number | undefined;
    if (valorDigitado) {
      const parsed = Number(valorDigitado.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setBaixaErro("Valor pago invalido.");
        return;
      }
      const totalPagoAtual = baixaPagamentos.reduce(
        (sum, pagamento) => sum + (pagamento.estornadoEm ? 0 : pagamento.valorPago),
        0
      );
      const saldoAtual = Number(
        (lancamentoSelecionado.valor - totalPagoAtual).toFixed(2)
      );
      if (parsed > saldoAtual) {
        const excedente = Number((parsed - saldoAtual).toFixed(2));
        const confirmar = window.confirm(
          `Valor acima do saldo. O excedente (${formatarValor(
            excedente
          )}) sera registrado como credito. Deseja continuar?`
        );
        if (!confirmar) {
          return;
        }
      }
      valorPago = parsed;
    }
    try {
      setBaixaErro(null);
      setBaixaLoading(true);
      await api.baixarLancamentoManual(token, baixaLancamentoId, {
        organizacaoId,
        valorPago,
        dataPagamento: baixaData || undefined,
        contaFinanceiraId: baixaContaId || undefined,
        formaPagamento: baixaFormaPagamento || undefined,
        referencia: baixaReferencia.trim() || undefined
      });
      setBaixaReferencia("");
      setBaixaValorPago("");
      await Promise.all([
        carregarDespesas(),
        carregarReceitas(),
        carregarFaturas(),
        carregarPagamentosBaixa(baixaLancamentoId)
      ]);
    } catch (e: any) {
      setBaixaErro(e.message || "Erro ao realizar baixa manual.");
    } finally {
      setBaixaLoading(false);
    }
  };

  const estornarPagamentoLancamento = async (pagamento: LancamentoPagamento) => {
    if (!token) return;
    if (pagamento.estornadoEm) return;
    const motivo = window.prompt("Motivo do estorno (opcional)");
    if (motivo === null) return;
    try {
      setBaixaPagamentosErro(null);
      setBaixaEstornoId(pagamento.id);
      await api.estornarPagamentoLancamento(token, pagamento.id, {
        organizacaoId,
        motivo: motivo.trim() || undefined
      });
      await Promise.all([
        carregarDespesas(),
        carregarReceitas(),
        carregarFaturas(),
        carregarPagamentosBaixa(baixaLancamentoId)
      ]);
    } catch (e: any) {
      setBaixaPagamentosErro(e.message || "Erro ao estornar pagamento.");
    } finally {
      setBaixaEstornoId(null);
    }
  };

  const carregarPoliticaCobranca = async () => {
    if (!token) return;
    try {
      setPoliticaErro(null);
      setPoliticaLoading(true);
      const politica = await api.obterPoliticaCobranca(token, organizacaoId);
      setPoliticaCobranca(politica);
      setPoliticaMulta(politica.multaPercentual.toString().replace(".", ","));
      setPoliticaJuros(politica.jurosMensalPercentual.toString().replace(".", ","));
      setPoliticaCorrecao(
        politica.correcaoMensalPercentual.toString().replace(".", ",")
      );
      setPoliticaCorrecaoTipo(politica.correcaoTipo || "PERCENTUAL_FIXO");
      setPoliticaCorrecaoIndice(politica.correcaoIndice || "");
      setPoliticaCarencia(politica.diasCarencia.toString());
      setPoliticaAtiva(politica.ativo);
      void carregarIndiceAtual(politica.correcaoTipo || "PERCENTUAL_FIXO");
    } catch (e: any) {
      setPoliticaErro(e.message || "Erro ao carregar politica de cobranca.");
    } finally {
      setPoliticaLoading(false);
    }
  };

  const salvarPoliticaCobranca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const multa = Number(politicaMulta.replace(/\./g, "").replace(",", "."));
    const juros = Number(politicaJuros.replace(/\./g, "").replace(",", "."));
    const correcao =
      politicaCorrecaoTipo === "SEM_CORRECAO"
        ? 0
        : Number(politicaCorrecao.replace(/\./g, "").replace(",", "."));
    const carencia = Number(politicaCarencia);
    if (
      !Number.isFinite(multa) ||
      !Number.isFinite(juros) ||
      (politicaCorrecaoTipo !== "SEM_CORRECAO" && !Number.isFinite(correcao)) ||
      !Number.isFinite(carencia)
    ) {
      setPoliticaErro("Informe valores validos para a politica.");
      return;
    }
    if (politicaCorrecaoTipo === "OUTRO" && !politicaCorrecaoIndice.trim()) {
      setPoliticaErro("Informe o indice de correcao.");
      return;
    }
    try {
      setPoliticaErro(null);
      setPoliticaLoading(true);
      const politica = await api.atualizarPoliticaCobranca(token, {
        organizacaoId,
        multaPercentual: multa,
        jurosMensalPercentual: juros,
        correcaoMensalPercentual: correcao,
        correcaoTipo: politicaCorrecaoTipo,
        correcaoIndice:
          politicaCorrecaoTipo === "OUTRO"
            ? politicaCorrecaoIndice.trim()
            : null,
        diasCarencia: Math.max(0, Math.floor(carencia)),
        ativo: politicaAtiva
      });
      setPoliticaCobranca(politica);
    } catch (e: any) {
      setPoliticaErro(e.message || "Erro ao salvar politica.");
    } finally {
      setPoliticaLoading(false);
    }
  };

  const carregarIndiceAtual = async (tipo: string) => {
    if (!token) return;
    if (
      tipo === "PERCENTUAL_FIXO" ||
      tipo === "SEM_CORRECAO" ||
      tipo === "OUTRO"
    ) {
      setIndiceAtual(null);
      setIndiceErro(null);
      return;
    }

    try {
      setIndiceErro(null);
      setIndiceLoading(true);
      const indice = await api.obterIndiceEconomicoAtual(
        token,
        organizacaoId,
        tipo
      );
      setIndiceAtual(indice);
      if (!indice) {
        setIndiceErro("Indice ainda nao carregado. Aguarde alguns minutos.");
      }
    } catch (e: any) {
      setIndiceErro(e.message || "Erro ao carregar indice.");
      setIndiceAtual(null);
    } finally {
      setIndiceLoading(false);
    }
  };

  const carregarCobrancasUnidadeOrg = async () => {
    if (!token) return;
    try {
      setCobrancasUnidadeErro(null);
      setCobrancasUnidadeLoading(true);
      const lista = await api.listarCobrancasOrganizacao(token, organizacaoId);
      setCobrancasUnidadeOrg(lista);
    } catch (e: any) {
      setCobrancasUnidadeErro(e.message || "Erro ao carregar cobrancas.");
    } finally {
      setCobrancasUnidadeLoading(false);
    }
  };

  const carregarAcordosCobranca = async () => {
    if (!token) return;
    try {
      setAcordosErro(null);
      setAcordosAviso(null);
      setAcordosLoading(true);
      const lista = await api.listarAcordosCobranca(token, organizacaoId);
      setAcordosCobranca(lista);
    } catch (e: any) {
      setAcordosErro(e.message || "Erro ao carregar acordos.");
    } finally {
      setAcordosLoading(false);
    }
  };

  const gerarBoletosAcordo = async (acordo: AcordoCobranca) => {
    if (!token) return;
    try {
      setAcordosErro(null);
      setAcordosAviso(null);
      setAcordosGerandoId(acordo.id);
      const resumo = await api.gerarBoletosAcordo(token, acordo.id, {
        organizacaoId,
        tipo: "boleto"
      });
      setAcordosAviso(
        `Boletos gerados: ${resumo.criadas} • Ignorados: ${resumo.ignoradas}`
      );
      await carregarFaturas();
    } catch (e: any) {
      setAcordosErro(e.message || "Erro ao gerar boletos.");
    } finally {
      setAcordosGerandoId(null);
    }
  };

  const formatarEndereco = (endereco?: BoletoFatura["enderecoSacado"] | null) => {
    if (!endereco) return "-";
    const partes = [
      endereco.logradouro,
      endereco.numero,
      endereco.complemento
    ].filter(Boolean);
    const linha1 = partes.join(", ");
    const linha2 = [endereco.bairro, endereco.cidade, endereco.estado]
      .filter(Boolean)
      .join(" - ");
    const cep = endereco.cep ? `CEP ${endereco.cep}` : "";
    return [linha1, linha2, cep].filter(Boolean).join(" • ");
  };

  const desenharCodigoBarras = (
    doc: jsPDF,
    digits: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    const valores = digits.replace(/\D/g, "");
    if (!valores) return;
    const totalBars = valores.length * 2;
    const unit = width / totalBars;
    let cursor = x;
    for (let i = 0; i < valores.length; i += 1) {
      const num = Number(valores[i] ?? "0");
      const barWidth = unit * (num % 2 === 0 ? 1 : 1.6);
      doc.rect(cursor, y, barWidth, height, "F");
      cursor += barWidth + unit * 0.4;
    }
  };

  const gerarBoletoPdf = async (fatura: DocumentoCobranca) => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const boleto = await api.obterBoletoFatura(token, fatura.id, organizacaoId);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      const fullWidth = pageWidth - margin * 2;

      const linhaDigitavel = boleto.linhaDigitavel ?? "-";
      const valorTexto = formatarValor(boleto.valor);
      const vencimentoTexto = formatarData(boleto.vencimento);

      const drawField = (
        x: number,
        y: number,
        w: number,
        h: number,
        label: string,
        value: string,
        align: "left" | "right" = "left"
      ) => {
        doc.rect(x, y, w, h);
        doc.setFontSize(7);
        doc.text(label, x + 1.5, y + 3.5);
        doc.setFontSize(9);
        const valueX = align === "right" ? x + w - 1.5 : x + 1.5;
        doc.text(value, valueX, y + h - 3, { align });
      };

      // Header
      doc.setFontSize(10);
      doc.text(boleto.banco.nome.toUpperCase(), margin, 14);
      doc.setFontSize(12);
      doc.text(boleto.banco.codigo, margin + 55, 14);
      doc.setFontSize(9);
      doc.text(linhaDigitavel, margin + 75, 14);

      doc.setFontSize(7);
      doc.text("Recibo do pagador", margin, 18);
      doc.setFontSize(7);
      doc.setTextColor(180);
      doc.text("BOLETO DE TESTE (NAO PAGAVEL)", margin + 120, 18);
      doc.setTextColor(0);

      let y = 20;
      drawField(margin, y, 120, 10, "Local de pagamento", "Pagavel em qualquer banco ate o vencimento");
      drawField(margin + 120, y, 70, 10, "Vencimento", vencimentoTexto, "right");
      y += 10;
      drawField(margin, y, 120, 10, "Beneficiario", boleto.cedente.nome);
      const agenciaConta = [boleto.banco.agencia, boleto.banco.conta].filter(Boolean).join(" / ");
      drawField(margin + 120, y, 70, 10, "Agencia/Codigo beneficiario", agenciaConta || "0000-0/00000-0");
      y += 10;

      drawField(margin, y, 30, 10, "Data doc.", formatarData(boleto.emissao));
      drawField(margin + 30, y, 40, 10, "Numero doc.", boleto.identificador);
      drawField(margin + 70, y, 25, 10, "Especie", "DM");
      drawField(margin + 95, y, 15, 10, "Aceite", "N");
      drawField(margin + 110, y, 40, 10, "Data proc.", formatarData(boleto.emissao));
      drawField(margin + 150, y, 40, 10, "Nosso numero", boleto.identificador.slice(-10));
      y += 10;

      drawField(margin, y, 60, 10, "Uso do banco", "");
      drawField(margin + 60, y, 20, 10, "Carteira", "17");
      drawField(margin + 80, y, 20, 10, "Especie moeda", "R$");
      drawField(margin + 100, y, 30, 10, "Qtd.", "");
      drawField(margin + 130, y, 60, 10, "Valor", valorTexto, "right");
      y += 10;

      drawField(margin, y, 130, 18, "Instrucoes", (boleto.instrucoes?.[0] ?? "Boleto de teste."));
      drawField(margin + 130, y, 60, 18, "Valor do documento", valorTexto, "right");
      y += 18;

      drawField(margin, y, 130, 18, "Sacado", boleto.sacado.nome);
      drawField(margin + 130, y, 60, 18, "CPF/CNPJ", boleto.sacado.documento ?? "-");
      y += 18;

      drawField(margin, y, fullWidth, 14, "Endereco do sacado", formatarEndereco(boleto.enderecoSacado));
      y += 16;

      if (boleto.qrCode) {
        doc.setFontSize(7);
        doc.text("PIX copia e cola:", margin, y + 4);
        doc.setFontSize(7);
        doc.text(boleto.qrCode, margin + 25, y + 4, { maxWidth: fullWidth - 25 });
        y += 10;
      }

      doc.setFontSize(7);
      doc.text("Ficha de compensacao", margin, y + 4);
      const codigoBase =
        boleto.linhaDigitavel?.replace(/\D/g, "") ||
        boleto.identificador.replace(/\D/g, "") ||
        "00000000000000000000000000000000000000000000";
      const codigo = codigoBase.padEnd(44, "0").slice(0, 44);
      desenharCodigoBarras(doc, codigo, margin, y + 6, fullWidth, 18);
      doc.setFontSize(7);
      doc.text(codigo, margin, y + 28);

      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .slice(0, 14);
      doc.save(`boleto-${boleto.identificador}-${stamp}.pdf`);
    } catch (e: any) {
      setErro(e.message || "Erro ao gerar boleto.");
    } finally {
      setLoading(false);
    }
  };

  const normalizarDataAcordo = (raw: string) => {
    const texto = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      return texto;
    }
    const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, dia, mes, ano] = match;
    const iso = `${ano}-${mes}-${dia}`;
    const data = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(data.getTime())) return null;
    return data.toISOString().slice(0, 10) === iso ? iso : null;
  };

  const criarAcordoRapido = async (cobranca: CobrancaOrganizacaoResumo) => {
    if (!token) return;
    const parcelasRaw = window.prompt("Numero de parcelas do acordo:", "3");
    if (!parcelasRaw) return;
    const parcelas = Number(parcelasRaw);
    if (!Number.isFinite(parcelas) || parcelas <= 0) {
      setAcordosErro("Numero de parcelas invalido.");
      return;
    }
    const descontoRaw = window.prompt("Desconto (valor em R$):", "0");
    if (descontoRaw === null) return;
    const desconto = Number(descontoRaw.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(desconto) || desconto < 0) {
      setAcordosErro("Desconto invalido.");
      return;
    }
    const dataRaw = window.prompt("Data da primeira parcela (DD/MM/AAAA):");
    if (!dataRaw) return;
    const dataNormalizada = normalizarDataAcordo(dataRaw);
    if (!dataNormalizada) {
      setAcordosErro("Data invalida. Use DD/MM/AAAA.");
      return;
    }

    try {
      setAcordosErro(null);
      setAcordosLoading(true);
      await api.criarAcordoCobranca(token, {
        organizacaoId,
        unidadeId: cobranca.unidadeOrganizacionalId,
        cobrancaIds: [cobranca.id],
        numeroParcelas: parcelas,
        dataPrimeiraParcela: dataNormalizada,
        desconto
      });
      await Promise.all([carregarCobrancasUnidadeOrg(), carregarAcordosCobranca()]);
    } catch (e: any) {
      setAcordosErro(e.message || "Erro ao criar acordo.");
    } finally {
      setAcordosLoading(false);
    }
  };

  const gerarRemessaCobranca = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const blob = await api.gerarRemessaCobranca(token, {
        organizacaoId,
        tipo: remessaTipo || undefined
      });
      baixarArquivo(blob, `remessa-${remessaTipo || "todas"}.csv`);
    } catch (e: any) {
      setErro(e.message || "Erro ao gerar remessa.");
    } finally {
      setLoading(false);
    }
  };

  const gerarRemessaPdf = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const itens = await api.listarRemessaCobranca(token, {
        organizacaoId,
        tipo: remessaTipo || undefined
      });

      const doc = new jsPDF({ orientation: "landscape" });
      const titulo = `Remessa ${remessaTipo || "todas"}`.toUpperCase();
      doc.setFontSize(14);
      doc.text(titulo, 14, 16);

      const dataHoje = new Date().toLocaleString("pt-BR");
      doc.setFontSize(9);
      doc.text(`Gerado em: ${dataHoje}`, 14, 22);

      const head = [
        [
          "Id",
          "Identificador",
          "Tipo",
          "Valor",
          "Vencimento",
          "Status",
          "Linha digitavel",
          "PIX/URL"
        ]
      ];

      const body = itens.map((item: RemessaCobrancaItem) => [
        item.id,
        item.identificador ?? "-",
        item.tipo,
        formatarValor(item.valor),
        formatarData(item.vencimento),
        item.status,
        item.linhaDigitavel ?? "-",
        item.qrCode ?? item.urlPagamento ?? "-"
      ]);

      if (body.length === 0) {
        body.push(["-", "-", "-", "-", "-", "Sem itens", "-", "-"]);
      }

      autoTable(doc, {
        startY: 28,
        head,
        body,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [230, 238, 255], textColor: 20 },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 28 },
          2: { cellWidth: 16 },
          3: { cellWidth: 18 },
          4: { cellWidth: 20 },
          5: { cellWidth: 20 },
          6: { cellWidth: 45 },
          7: { cellWidth: 80 }
        }
      });

      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .slice(0, 14);
      doc.save(`remessa-${remessaTipo || "todas"}-${stamp}.pdf`);
    } catch (e: any) {
      setErro(e.message || "Erro ao gerar PDF.");
    } finally {
      setLoading(false);
    }
  };

  const importarRetornoCobranca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !retornoArquivo) return;
    try {
      setRetornoStatus(null);
      setLoading(true);
      const resumo = await api.importarRetornoCobranca(
        token,
        organizacaoId,
        retornoArquivo
      );
      setRetornoStatus(
        `Processado: ${resumo.totalLinhas} • Atualizadas: ${resumo.atualizadas} • Ignoradas: ${resumo.ignoradas}`
      );
      setRetornoArquivo(null);
      await carregarFaturas();
    } catch (e: any) {
      setRetornoStatus(e.message || "Erro ao importar retorno.");
    } finally {
      setLoading(false);
    }
  };

  const carregarReceitas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const data = await api.listarLancamentos(token, organizacaoId, {
        tipo: "receber"
      });
      setReceitas(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar lançamentos a receber");
    } finally {
      setLoading(false);
    }
  };

  const carregarCategoriasReceita = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarPlanosContas(
        token,
        organizacaoId,
        "Receita"
      );
      setCategoriasReceita(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar categorias financeiras");
    } finally {
      setLoading(false);
    }
  };

  const carregarCategoriasDespesa = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarPlanosContas(
        token,
        organizacaoId,
        "Despesa"
      );
      setCategoriasDespesa(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar categorias financeiras");
    } finally {
      setLoading(false);
    }
  };

  const carregarRecursosRelatorio = async () => {
    if (!token) return;
    try {
      const lista = await api.listarRecursos(token, organizacaoId);
      setRecursosRelatorio(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar recursos para relatorios");
    }
  };

  const carregarContasContabeis = async () => {
    if (!token) return;
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      const lista = await api.listarContasContabeis(token, organizacaoId);
      setContasContabeis(lista);
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao carregar plano de contas");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  const carregarPeriodosContabeis = async () => {
    if (!token) return;
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      const lista = await api.listarPeriodosContabeis(token, organizacaoId);
      setPeriodosContabeis(lista);
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao carregar periodos");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  const carregarLancamentosContabeis = async () => {
    if (!token) return;
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      const lista = await api.listarLancamentosContabeis(token, organizacaoId, {
        competenciaInicio: demonstrativoInicio || undefined,
        competenciaFim: demonstrativoFim || undefined
      });
      setLancamentosContabeis(lista);
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao carregar lancamentos contabeis");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  const criarContaContabil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      await api.criarContaContabil(token, {
        organizacaoId,
        codigo: novaContaCodigo,
        nome: novaContaNome,
        grupo: novaContaGrupo,
        natureza: novaContaNatureza,
        parentId: novaContaParentId || null,
        codigoReferencialSped: novaContaSped || null
      });
      setNovaContaCodigo("");
      setNovaContaNome("");
      setNovaContaParentId("");
      setNovaContaSped("");
      await carregarContasContabeis();
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao criar conta contábil");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  const criarPeriodoContabil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      await api.criarPeriodoContabil(token, {
        organizacaoId,
        competenciaInicio: periodoInicio,
        competenciaFim: periodoFim,
        observacao: periodoObservacao || null
      });
      setPeriodoInicio("");
      setPeriodoFim("");
      setPeriodoObservacao("");
      await carregarPeriodosContabeis();
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao criar periodo");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  const fecharPeriodo = async (id: string) => {
    if (!token) return;
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      await api.fecharPeriodoContabil(token, id);
      await carregarPeriodosContabeis();
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao fechar periodo");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  const reabrirPeriodo = async (id: string) => {
    if (!token) return;
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      await api.reabrirPeriodoContabil(token, id);
      await carregarPeriodosContabeis();
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao reabrir periodo");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  const criarLancamentoContabil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const valorNumerico = Number(lancamentoValor.replace(",", "."));
    if (!valorNumerico || valorNumerico <= 0) {
      setContabilidadeErro("Informe um valor válido para o lancamento.");
      return;
    }
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      await api.criarLancamentoContabil(token, {
        organizacaoId,
        competencia: lancamentoCompetencia,
        historico: lancamentoHistorico || "Lancamento manual",
        origem: "manual",
        partidas: [
          {
            contaContabilId: lancamentoContaDebito,
            tipo: "debito",
            valor: valorNumerico
          },
          {
            contaContabilId: lancamentoContaCredito,
            tipo: "credito",
            valor: valorNumerico
          }
        ]
      });
      setLancamentoHistorico("");
      setLancamentoValor("");
      setLancamentoContaDebito("");
      setLancamentoContaCredito("");
      await carregarLancamentosContabeis();
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao criar lancamento contábil");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  const gerarBalancete = async () => {
    if (!token) return;
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      const lista = await api.obterBalancete(token, organizacaoId, {
        competenciaInicio: demonstrativoInicio || undefined,
        competenciaFim: demonstrativoFim || undefined
      });
      setBalancete(lista);
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao gerar balancete");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  const gerarDre = async () => {
    if (!token) return;
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      const data = await api.obterDre(token, organizacaoId, {
        competenciaInicio: demonstrativoInicio || undefined,
        competenciaFim: demonstrativoFim || undefined
      });
      setDreResumo(data);
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao gerar DRE");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  const gerarBalanco = async () => {
    if (!token) return;
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      const data = await api.obterBalanco(
        token,
        organizacaoId,
        demonstrativoFim || undefined
      );
      setBalancoResumo(data);
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao gerar balanco");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  const abrirAbaContabilidade = (
    novaAba: "plano" | "lancamentos" | "periodos" | "demonstrativos" | "integracao"
  ) => {
    setContabilidadeAba(novaAba);
    requestAnimationFrame(() => {
      contabilidadePainelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  };

  const integrarFinanceiro = async () => {
    if (!token) return;
    try {
      setContabilidadeErro(null);
      setContabilidadeLoading(true);
      const resultado = await api.integrarFinanceiroContabil(token, {
        organizacaoId,
        competenciaInicio: integracaoInicio || null,
        competenciaFim: integracaoFim || null
      });
      setIntegracaoResultado(resultado);
    } catch (e: any) {
      setContabilidadeErro(e.message || "Erro ao integrar financeiro");
    } finally {
      setContabilidadeLoading(false);
    }
  };

  useEffect(() => {
    void carregarContas();
    void carregarDespesas();
    void carregarReceitas();
    void carregarFaturas();
    void carregarCategoriasReceita();
    void carregarCategoriasDespesa();
    void carregarPessoasFinanceiro();
    // Itens cobrados serão carregados sob demanda ao abrir a aba
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizacaoId]);

  useEffect(() => {
    if (aba !== "contabilidade") return;
    if (!token) return;
    void carregarContasContabeis();
    void carregarPeriodosContabeis();
    void carregarLancamentosContabeis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, token, organizacaoId]);

  useEffect(() => {
    if (aba !== "contasPagar" && aba !== "contasReceber") {
      setLancamentoSelecionado(null);
      setAutoOpenAnexoId(null);
    }
  }, [aba]);

  useEffect(() => {
    if (contaExtratoId) return;
    const ativa = contas.find(
      (c) => (c.status ?? "ativo").toLowerCase() === "ativo"
    );
    if (ativa) {
      setContaExtratoId(ativa.id);
    }
  }, [contas, contaExtratoId]);

  useEffect(() => {
    if (aba !== "relatorios") return;
    if (!token) return;
    if (recursosRelatorio.length > 0) return;
    void carregarRecursosRelatorio();
  }, [aba, token, organizacaoId, recursosRelatorio.length]);

  useEffect(() => {
    if (aba !== "gruposRateio") return;
    if (!token) return;
    void carregarRegrasRateio();
    void carregarUnidadesRateio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, token, organizacaoId]);

  useEffect(() => {
    if (aba !== "gruposRateio") return;
    if (!rateioLancamentoId) {
      setRateiosLancamento([]);
      return;
    }
    void carregarRateiosLancamento(rateioLancamentoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, rateioLancamentoId]);

  useEffect(() => {
    if (aba !== "abonos") return;
    if (!token) return;
    void carregarAbonos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, token, organizacaoId]);

  useEffect(() => {
    if (aba !== "abonos") return;
    const elegiveis = receitas.filter(
      (r) => !isSituacaoPaga(r.situacao) && !isSituacaoCancelada(r.situacao)
    );
    if (elegiveis.length === 0) {
      if (abonoLancamentoId) {
        setAbonoLancamentoId("");
      }
      return;
    }
    if (!abonoLancamentoId || !elegiveis.some((r) => r.id === abonoLancamentoId)) {
      setAbonoLancamentoId(elegiveis[0].id);
    }
  }, [aba, abonoLancamentoId, receitas]);

  useEffect(() => {
    if (aba !== "baixasManuais") return;
    const pendentes = [...despesas, ...receitas].filter((l) =>
      isSituacaoAberta(l.situacao)
    );
    if (!pendentes.length) {
      if (baixaLancamentoId) {
        setBaixaLancamentoId("");
      }
      return;
    }
    if (
      !baixaLancamentoId ||
      !pendentes.some((l) => l.id === baixaLancamentoId)
    ) {
      setBaixaLancamentoId(pendentes[0].id);
    }
  }, [aba, despesas, receitas, baixaLancamentoId]);

  useEffect(() => {
    if (aba !== "baixasManuais") return;
    if (!token) return;
    if (!baixaLancamentoId) {
      setBaixaPagamentos([]);
      return;
    }
    setBaixaValorPago("");
    void carregarPagamentosBaixa(baixaLancamentoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, token, organizacaoId, baixaLancamentoId]);

  useEffect(() => {
    if (aba !== "baixasManuais") return;
    if (baixaContaId) return;
    const contasAtivas = contas.filter(
      (conta) => (conta.status ?? "ativo").toLowerCase() === "ativo"
    );
    const contaAtiva = contasAtivas[0];
    if (contaAtiva) {
      setBaixaContaId(contaAtiva.id);
    }
  }, [aba, baixaContaId, contas]);

  useEffect(() => {
    if (aba !== "consumos") return;
    if (!token) return;
    void carregarMedidoresConsumo();
    void carregarUnidadesRateio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, token, organizacaoId]);

  useEffect(() => {
    if (aba !== "consumos") return;
    if (!token) return;
    if (!medidorSelecionadoId) {
      setLeiturasConsumo([]);
      return;
    }
    void carregarLeiturasConsumo(medidorSelecionadoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, token, organizacaoId, medidorSelecionadoId]);

  useEffect(() => {
    if (aba !== "consumos") return;
    if (novoMedidorUnidadeId || unidadesRateio.length === 0) return;
    setNovoMedidorUnidadeId(unidadesRateio[0].id);
  }, [aba, novoMedidorUnidadeId, unidadesRateio]);

  useEffect(() => {
    if (aba !== "previsaoOrcamentaria") return;
    if (!token) return;
    void carregarPrevisoesOrcamentarias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, token, organizacaoId, previsaoAno, previsaoTipo]);

  useEffect(() => {
    if (aba !== "previsaoOrcamentaria") return;
    const lista =
      previsaoTipo === "Receita" ? categoriasReceita : categoriasDespesa;
    if (lista.length === 0) {
      if (previsaoCategoriaId) {
        setPrevisaoCategoriaId("");
      }
      return;
    }
    if (
      !previsaoCategoriaId ||
      !lista.some((cat) => cat.id === previsaoCategoriaId)
    ) {
      setPrevisaoCategoriaId(lista[0].id);
    }
  }, [aba, previsaoTipo, categoriasReceita, categoriasDespesa, previsaoCategoriaId]);

  useEffect(() => {
    if (aba !== "inadimplentes") return;
    if (!token) return;
    void carregarPoliticaCobranca();
    void carregarCobrancasUnidadeOrg();
    void carregarAcordosCobranca();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, token, organizacaoId]);

  const handleAbaChange = (novaAba: FinanceiroTab) => {
    setAba(novaAba);
    requestAnimationFrame(() => {
      topoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const formatarValor = (valor: number) =>
    valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  const formatarData = (data?: string) =>
    data ? new Date(data).toLocaleDateString("pt-BR") : "-";

  const formatarConsumo = (valor: number) =>
    valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const normalizarCsvHeader = (valor: string) =>
    valor.trim().toLowerCase().replace(/\s+/g, "");

  const splitCsvLine = (line: string, delimiter: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === "\"") {
        if (inQuotes && line[i + 1] === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCsvDate = (raw: string): string | null => {
    if (!raw) return null;
    const value = raw.trim();
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) {
      return value.replace(/\//g, "-");
    }
    const brMatch = value.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (brMatch) {
      return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  };

  const parseConsumoCsv = async (file: File): Promise<ConsumoCsvRow[]> => {
    const content = await file.text();
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return [];
    }

    const delimiter =
      lines[0].split(";").length >= lines[0].split(",").length ? ";" : ",";
    const headerCells = splitCsvLine(lines[0], delimiter).map(normalizarCsvHeader);
    const knownHeaders = new Set([
      "medidorid",
      "medidor_id",
      "idmedidor",
      "medidor",
      "medidor_nome",
      "nomemedidor",
      "numeroserie",
      "numero_serie",
      "serie",
      "serial",
      "unidade",
      "unidade_id",
      "codigounidade",
      "codigo_unidade",
      "competencia",
      "competencia_mes",
      "mes",
      "data",
      "data_leitura",
      "leitura",
      "leitura_atual",
      "observacao",
      "obs"
    ]);
    const hasHeader = headerCells.some((cell) => knownHeaders.has(cell));
    const headerMap = new Map<string, number>();
    if (hasHeader) {
      headerCells.forEach((cell, index) => {
        if (!headerMap.has(cell)) {
          headerMap.set(cell, index);
        }
      });
    }

    const getByHeader = (cols: string[], keys: string[]) => {
      for (const key of keys) {
        const idx = headerMap.get(key);
        if (idx !== undefined) {
          return cols[idx] ?? "";
        }
      }
      return "";
    };

    const rows: ConsumoCsvRow[] = [];
    const startIndex = hasHeader ? 1 : 0;
    for (let i = startIndex; i < lines.length; i += 1) {
      const cols = splitCsvLine(lines[i], delimiter);
      if (cols.length === 0) continue;

      if (!hasHeader) {
        rows.push({
          linha: i + 1,
          medidorId: cols[0],
          competencia: cols[1],
          dataLeitura: cols[2],
          leituraAtual: cols[3],
          observacao: cols[4],
          numeroSerie: cols[5],
          medidorNome: cols[6],
          unidade: cols[7]
        });
        continue;
      }

      rows.push({
        linha: i + 1,
        medidorId: getByHeader(cols, ["medidorid", "medidor_id", "idmedidor"]),
        numeroSerie: getByHeader(cols, [
          "numeroserie",
          "numero_serie",
          "serie",
          "serial"
        ]),
        medidorNome: getByHeader(cols, ["medidor", "medidor_nome", "nomemedidor"]),
        unidade: getByHeader(cols, ["unidade", "unidade_id", "codigounidade", "codigo_unidade"]),
        competencia: getByHeader(cols, ["competencia", "competencia_mes", "mes"]),
        dataLeitura: getByHeader(cols, ["data", "data_leitura"]),
        leituraAtual: getByHeader(cols, ["leitura", "leitura_atual"]),
        observacao: getByHeader(cols, ["observacao", "obs"])
      });
    }

    return rows;
  };

  const enviarArquivoFinanceiro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !arquivoEnvio) return;
    try {
      setErro(null);
      setStatusEnvio(null);
      setLoading(true);
      if (tipoEnvio === "extrato") {
        const resultado = await api.importarExtrato(
          token,
          organizacaoId,
          arquivoEnvio,
          contaExtratoId || undefined
        );
        setExtratoImportado(resultado);
        setConciliados([]);
        setAba("conciliacaoBancaria");
        setStatusEnvio("Extrato importado com sucesso.");
      } else {
        await api.uploadFinanceiro(token, organizacaoId, tipoEnvio, arquivoEnvio);
        setStatusEnvio("Arquivo enviado com sucesso.");
      }
      setArquivoEnvio(null);
    } catch (e: any) {
      setErro(e.message || "Erro ao enviar arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const confirmarConciliacao = async (
    item: ConciliacaoImportResponse["itens"][number]
  ) => {
    if (!token) return;
    if (!item.movimentoId) {
      setErro("Movimento bancario nao identificado para conciliacao.");
      return;
    }
    const chaveConciliacao = item.movimentoId ?? String(item.index);
    try {
      setErro(null);
      setConciliandoId(chaveConciliacao);
      if (item.sugestaoTipo === "cobranca_unidade" && item.sugestaoCobrancaId) {
        await api.vincularMovimentoBancario(token, item.movimentoId, {
          organizacaoId,
          cobrancaUnidadeId: item.sugestaoCobrancaId,
          contaBancariaId: contaExtratoId || undefined
        });
      } else if (item.sugestaoLancamentoId) {
        await api.confirmarConciliacao(
          token,
          item.sugestaoLancamentoId,
          organizacaoId,
          {
            dataConciliacao: item.data,
            documento: item.documento,
            referencia: item.descricao,
            movimentoBancarioId: item.movimentoId
          }
        );
      } else {
        setErro("Nenhuma sugestao disponivel para conciliar.");
        return;
      }
      setConciliados((prev) =>
        prev.includes(item.movimentoId) ? prev : [...prev, item.movimentoId]
      );
      await Promise.all([carregarDespesas(), carregarReceitas()]);
    } catch (e: any) {
      setErro(e.message || "Erro ao conciliar lançamento.");
    } finally {
      setConciliandoId(null);
    }
  };

  const executarAcaoLancamento = async (
    tipo: "pagar" | "receber",
    acao:
      | "aprovar"
      | "pagar"
      | "conciliar"
      | "fechar"
      | "reabrir"
      | "cancelar",
    id: string
  ) => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      if (acao === "aprovar") {
        await api.aprovarLancamento(token, id);
      } else if (acao === "pagar") {
        await api.pagarLancamento(token, id);
      } else if (acao === "conciliar") {
        await api.conciliarLancamento(token, id);
      } else if (acao === "fechar") {
        await api.fecharLancamento(token, id);
      } else if (acao === "reabrir") {
        await api.reabrirLancamento(token, id);
      } else if (acao === "cancelar") {
        await api.cancelarLancamento(token, id);
      }

      if (tipo === "pagar") {
        await carregarDespesas();
      } else {
        await carregarReceitas();
      }
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar lançamento.");
    } finally {
      setLoading(false);
    }
  };

  const criarConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const saldoNumero = saldoInicial ? Number(saldoInicial) : undefined;

      const criada = await api.criarContaFinanceira(token, {
        organizacaoId,
        nome: nomeConta,
        tipo: tipoConta,
        banco: banco || undefined,
        agencia: agencia || undefined,
        numeroConta: numeroConta || undefined,
        saldoInicial: saldoNumero,
        moeda,
        status: "ativo"
      });

      setContas((prev) => [...prev, criada]);
      setNomeConta("");
      setTipoConta("Bancária");
      setBanco("");
      setAgencia("");
      setNumeroConta("");
      setSaldoInicial("");
      setMoeda("BRL");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar conta financeira");
    } finally {
      setLoading(false);
    }
  };

  const removerConta = async (conta: ContaFinanceira) => {
    if (!token) return;
    if (
      !window.confirm(
        `Tem certeza que deseja excluir a conta "${conta.nome}"?`
      )
    ) {
      return;
    }

    try {
      setErro(null);
      setLoading(true);
      await api.removerContaFinanceira(token, conta.id);
      setContas((prev) => prev.filter((c) => c.id !== conta.id));
    } catch (e: any) {
      setErro(e.message || "Erro ao remover conta financeira");
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatusConta = async (
    conta: ContaFinanceira,
    novoStatus: string
  ) => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      await api.atualizarStatusContaFinanceira(token, conta.id, novoStatus);
      setContas((prev) =>
        prev.map((c) =>
          c.id === conta.id ? { ...c, status: novoStatus } : c
        )
      );
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar status da conta");
    } finally {
      setLoading(false);
    }
  };

  const carregarFaturas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const data = await api.listarFaturas(token, organizacaoId);
      setFaturas(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar faturas");
    } finally {
      setLoading(false);
    }
  };

  const transferirEntreContas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!transferenciaOrigemId || !transferenciaDestinoId) {
      setErro("Selecione conta de origem e destino.");
      return;
    }

    if (transferenciaOrigemId === transferenciaDestinoId) {
      setErro("Conta de origem e destino devem ser diferentes.");
      return;
    }

    const valorNumero = Number(
      transferenciaValor.replace(/\./g, "").replace(",", ".")
    );

    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      setErro("Informe um valor de transferencia valido.");
      return;
    }

    try {
      setErro(null);
      setLoading(true);

      await api.transferirEntreContas(token, {
        organizacaoId,
        contaOrigemId: transferenciaOrigemId,
        contaDestinoId: transferenciaDestinoId,
        valor: valorNumero,
        dataTransferencia: transferenciaData || undefined,
        descricao: transferenciaDescricao.trim() || undefined,
        referencia: transferenciaReferencia.trim() || undefined,
        formaPagamento: "transferencia"
      });

      const [despesasAtualizadas, receitasAtualizadas] = await Promise.all([
        api.listarLancamentos(token, organizacaoId, { tipo: "pagar" }),
        api.listarLancamentos(token, organizacaoId, { tipo: "receber" })
      ]);

      setDespesas(despesasAtualizadas);
      setReceitas(receitasAtualizadas);
      setTransferenciaValor("");
      setTransferenciaReferencia("");
      setTransferenciaOrigemId("");
      setTransferenciaDestinoId("");
    } catch (e: any) {
      setErro(e.message || "Erro ao transferir entre contas");
    } finally {
      setLoading(false);
    }
  };

  const criarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !token ||
      !novaDescricao.trim() ||
      !novoVencimento ||
      !novoValor ||
      !novaDespesaCategoriaId
    ) {
      return;
    }

    const conta =
      contas.find((c) => c.id === novaDespesaContaId) ?? contas[0];
    const pessoa =
      pessoasFinanceiro.find((p) => p.id === novaDespesaPessoaId) ??
      pessoasFinanceiro[0];
    try {
      setErro(null);
      setLoading(true);
      const payload: Omit<LancamentoFinanceiro, "id"> = {
        organizacaoId,
        tipo: "pagar",
        situacao: "aberto",
        planoContasId: novaDespesaCategoriaId,
        centroCustoId: undefined,
        contaFinanceiraId: conta?.id,
        pessoaId: pessoa?.id || "00000000-0000-0000-0000-000000000000",
        descricao: novaDescricao.trim(),
        valor: Number(novoValor.replace(/\./g, "").replace(",", ".")),
        dataCompetencia: novoVencimento,
        dataVencimento: novoVencimento,
        dataPagamento: undefined,
        formaPagamento: novaDespesaFormaPagamento || "indefinido",
        parcelaNumero: undefined,
        parcelaTotal: undefined,
        referencia: novaDespesaReferencia.trim() || undefined
      };

      const lanc = await api.criarLancamento(token, payload);
      setDespesas((prev) => [...prev, lanc]);
      setNovaDescricao("");
      setNovoVencimento("");
      setNovoValor("");
      setNovaDespesaCategoriaId("");
      setNovaDespesaReferencia("");
      setNovaDespesaContaId("");
      setNovaDespesaPessoaId("");
      setNovaDespesaFormaPagamento("boleto");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar despesa");
    } finally {
      setLoading(false);
    }
  };

  const criarReceita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !token ||
      !novaReceitaDescricao.trim() ||
      !novaReceitaVencimento ||
      !novaReceitaValor ||
      !novaReceitaCategoriaId
    ) {
      return;
    }

    const conta =
      contas.find((c) => c.id === novaReceitaContaId) ?? contas[0];
    const pessoa =
      pessoasFinanceiro.find((p) => p.id === novaReceitaPessoaId) ??
      pessoasFinanceiro[0];

    try {
      setErro(null);
      setLoading(true);
      const payload: Omit<LancamentoFinanceiro, "id"> = {
        organizacaoId,
        tipo: "receber",
        situacao: "aberto",
        planoContasId: novaReceitaCategoriaId,
        centroCustoId: undefined,
        contaFinanceiraId: conta?.id,
        pessoaId: pessoa?.id || "00000000-0000-0000-0000-000000000000",
        descricao: novaReceitaDescricao.trim(),
        valor: Number(novaReceitaValor.replace(/\./g, "").replace(",", ".")),
        dataCompetencia: novaReceitaVencimento,
        dataVencimento: novaReceitaVencimento,
        dataPagamento: undefined,
        formaPagamento: novaReceitaFormaPagamento || "indefinido",
        parcelaNumero: undefined,
        parcelaTotal: undefined,
        referencia: novaReceitaReferencia.trim() || undefined
      };

      const lanc = await api.criarLancamento(token, payload);
      setReceitas((prev) => [...prev, lanc]);
      setNovaReceitaDescricao("");
      setNovaReceitaVencimento("");
      setNovaReceitaValor("");
      setNovaReceitaCategoriaId("");
      setNovaReceitaReferencia("");
      setNovaReceitaContaId("");
      setNovaReceitaPessoaId("");
      setNovaReceitaFormaPagamento("pix");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar receita");
    } finally {
      setLoading(false);
    }
  };

  const criarFatura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !novaFaturaLancamentoId) return;
    try {
      setErro(null);
      setLoading(true);
      const criada = await api.criarFatura(token, {
        organizacaoId,
        lancamentoFinanceiroId: novaFaturaLancamentoId,
        tipo: novaFaturaTipo,
        identificadorExterno: novaFaturaIdentificador || undefined,
        linhaDigitavel: novaFaturaLinhaDigitavel || undefined,
        qrCode: novaFaturaQrCode || undefined,
        urlPagamento: novaFaturaUrlPagamento || undefined,
        dataVencimento: novaFaturaVencimento || undefined
      });
      setFaturas((prev) => [criada, ...prev]);
      setNovaFaturaLancamentoId("");
      setNovaFaturaTipo("boleto");
      setNovaFaturaVencimento("");
      setNovaFaturaLinhaDigitavel("");
      setNovaFaturaQrCode("");
      setNovaFaturaUrlPagamento("");
      setNovaFaturaIdentificador("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar fatura");
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatusFatura = async (
    fatura: DocumentoCobranca,
    status: "emitida" | "vencida" | "paga" | "cancelada"
  ) => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      await api.atualizarStatusFatura(token, fatura.id, status);
      await Promise.all([carregarFaturas(), carregarReceitas()]);
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar status da fatura");
    } finally {
      setLoading(false);
    }
  };

  const normalizarSituacao = (situacao?: string) => {
    const valor = (situacao ?? "").toLowerCase();
    return valor === "pendente" ? "aberto" : valor;
  };

  const statusMeta = (situacao?: string) => {
    const normalizada = normalizarSituacao(situacao);
    switch (normalizada) {
      case "aberto":
        return { label: "Aberto", className: "badge-status--aberto" };
      case "aprovado":
        return { label: "Aprovado", className: "badge-status--aprovado" };
      case "pago":
        return { label: "Pago", className: "badge-status--pago" };
      case "conciliado":
        return { label: "Conciliado", className: "badge-status--conciliado" };
      case "fechado":
        return { label: "Fechado", className: "badge-status--fechado" };
      case "cancelado":
        return { label: "Cancelado", className: "badge-status--cancelado" };
      default:
        return { label: "Aberto", className: "badge-status--aberto" };
    }
  };

  const statusAbonoMeta = (status?: string) => {
    const normalizada = (status ?? "").toLowerCase();
    switch (normalizada) {
      case "em_analise":
        return { label: "Em analise", className: "badge-status--alerta" };
      case "aprovado":
        return { label: "Aprovado", className: "badge-status--aprovado" };
      case "cancelado":
        return { label: "Cancelado", className: "badge-status--cancelado" };
      default:
        return { label: "Pendente", className: "badge-status--pendente" };
    }
  };

  const isSituacaoAberta = (situacao?: string) =>
    ["aberto", "aprovado"].includes(normalizarSituacao(situacao));
  const isSituacaoPaga = (situacao?: string) =>
    ["pago", "conciliado", "fechado"].includes(normalizarSituacao(situacao));
  const isSituacaoCancelada = (situacao?: string) =>
    normalizarSituacao(situacao) === "cancelado";

  const totalContas = contas.length;
  const contasAtivasLista = contas.filter(
    (c) => (c.status ?? "ativo").toLowerCase() === "ativo"
  );
  const contasAtivas = contasAtivasLista.length;
  const contasInativas = contas.filter((c) => c.status === "inativo").length;
  const contasTransferencia = contasAtivasLista;
  const saldoInicialTotal = contas.reduce(
    (sum, c) => sum + (c.saldoInicial ?? 0),
    0
  );
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  const dentroMesAtual = (data?: string) => {
    if (!data) return false;
    const dt = new Date(data);
    return dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual;
  };
  const totalAPagarMes = despesas
    .filter((d) => isSituacaoAberta(d.situacao))
    .filter((d) => dentroMesAtual(d.dataVencimento ?? d.dataCompetencia))
    .reduce((sum, d) => sum + d.valor, 0);
  const totalPagoMes = despesas
    .filter((d) => isSituacaoPaga(d.situacao))
    .filter((d) => dentroMesAtual(d.dataPagamento ?? d.dataCompetencia))
    .reduce((sum, d) => sum + d.valor, 0);
  const receitasPagas = receitas
    .filter((r) => isSituacaoPaga(r.situacao))
    .reduce((sum, r) => sum + r.valor, 0);
  const despesasPagas = despesas
    .filter((d) => isSituacaoPaga(d.situacao))
    .reduce((sum, d) => sum + d.valor, 0);
  const saldoAtual = saldoInicialTotal + receitasPagas - despesasPagas;

  const categoriasDespesaPorId = Object.fromEntries(
    categoriasDespesa.map((c) => [c.id, `${c.codigo} - ${c.nome}`])
  );
  const categoriasReceitaPorId = Object.fromEntries(
    categoriasReceita.map((c) => [c.id, `${c.codigo} - ${c.nome}`])
  );
  const receitasPorId = Object.fromEntries(receitas.map((r) => [r.id, r]));
  const unidadesRateioPorId = Object.fromEntries(
    unidadesRateio.map((u) => [u.id, `${u.codigoInterno} - ${u.nome}`])
  );
  const unidadesRateioAtivas = unidadesRateio.filter(
    (u) =>
      (u.status ?? "ativo").toLowerCase() === "ativo" &&
      u.tipo.toLowerCase() !== "bloco"
  );
  const unidadesRateioDisplay =
    unidadesRateioAtivas.length > 0 ? unidadesRateioAtivas : unidadesRateio;

  const despesasValidas = despesas.filter((d) => !isSituacaoCancelada(d.situacao));
  const receitasValidas = receitas.filter((r) => !isSituacaoCancelada(r.situacao));
  const totalReceitasPorCategoria = receitasValidas.reduce(
    (acc, r) => {
      const key = r.planoContasId || "sem-categoria";
      acc[key] = (acc[key] ?? 0) + r.valor;
      return acc;
    },
    {} as Record<string, number>
  );
  const totalDespesasPorCategoria = despesasValidas.reduce(
    (acc, d) => {
      const key = d.planoContasId || "sem-categoria";
      acc[key] = (acc[key] ?? 0) + d.valor;
      return acc;
    },
    {} as Record<string, number>
  );
  const totalReceitas = receitasValidas.reduce(
    (sum, r) => sum + r.valor,
    0
  );
  const totalDespesas = despesasValidas.reduce(
    (sum, d) => sum + d.valor,
    0
  );
  const saldoPeriodo = totalReceitas - totalDespesas;
  const hojeIso = new Date().toISOString().slice(0, 10);
  const inadimplentes = receitas
    .filter(
      (r) =>
        !isSituacaoPaga(r.situacao) &&
        !!r.dataVencimento &&
        r.dataVencimento.slice(0, 10) < hojeIso
    )
    .sort((a, b) =>
      (a.dataVencimento ?? "").localeCompare(b.dataVencimento ?? "")
    );
  const totalInadimplencia = inadimplentes.reduce(
    (sum, item) => sum + item.valor,
    0
  );
  const normalizarDataIso = (data?: string) => (data ? data.slice(0, 10) : "");
  const dentroPeriodoLivro = (data?: string) => {
    const iso = normalizarDataIso(data);
    if (!iso) return false;
    if (livroInicio && iso < livroInicio) return false;
    if (livroFim && iso > livroFim) return false;
    return true;
  };
  const receitasLivro = receitasValidas.filter((r) =>
    dentroPeriodoLivro(r.dataCompetencia ?? r.dataVencimento)
  );
  const despesasLivro = despesasValidas.filter((d) =>
    dentroPeriodoLivro(d.dataCompetencia ?? d.dataVencimento)
  );
  const totalReceitasLivro = receitasLivro.reduce((sum, r) => sum + r.valor, 0);
  const totalDespesasLivro = despesasLivro.reduce((sum, d) => sum + d.valor, 0);
  const saldoLivro = totalReceitasLivro - totalDespesasLivro;
  const receitasLivroPorCategoria = receitasLivro.reduce(
    (acc, r) => {
      const key = r.planoContasId || "sem-categoria";
      acc[key] = (acc[key] ?? 0) + r.valor;
      return acc;
    },
    {} as Record<string, number>
  );
  const despesasLivroPorCategoria = despesasLivro.reduce(
    (acc, d) => {
      const key = d.planoContasId || "sem-categoria";
      acc[key] = (acc[key] ?? 0) + d.valor;
      return acc;
    },
    {} as Record<string, number>
  );
  const inadimplentesLivro = receitasLivro
    .filter(
      (r) =>
        !isSituacaoPaga(r.situacao) &&
        !!r.dataVencimento &&
        r.dataVencimento.slice(0, 10) < hojeIso
    )
    .sort((a, b) =>
      (a.dataVencimento ?? "").localeCompare(b.dataVencimento ?? "")
    );
  const totalInadimplenciaLivro = inadimplentesLivro.reduce(
    (sum, item) => sum + item.valor,
    0
  );
  const lancamentosLivro = [...receitasLivro, ...despesasLivro].sort((a, b) =>
    (a.dataCompetencia ?? a.dataVencimento ?? "").localeCompare(
      b.dataCompetencia ?? b.dataVencimento ?? ""
    )
  );
  const livroPeriodoLabel = `${livroInicio || "Inicio"} ate ${
    livroFim || "Hoje"
  }`;
  const mesesLabel = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez"
  ];
  const categoriasPrevisao =
    previsaoTipo === "Receita" ? categoriasReceita : categoriasDespesa;
  const categoriasPrevisaoPorId =
    previsaoTipo === "Receita" ? categoriasReceitaPorId : categoriasDespesaPorId;
  const lancamentosBasePrevisao = (
    previsaoTipo === "Receita" ? receitasValidas : despesasValidas
  ).filter((item) => isSituacaoPaga(item.situacao));
  const realizadosPorCategoriaMes = lancamentosBasePrevisao.reduce(
    (acc, item) => {
      const dataRef = item.dataCompetencia ?? item.dataVencimento ?? item.dataPagamento;
      const iso = normalizarDataIso(dataRef);
      if (!iso) return acc;
      const [anoRaw, mesRaw] = iso.split("-");
      const ano = Number(anoRaw);
      const mes = Number(mesRaw);
      if (!ano || !mes || ano !== previsaoAno) return acc;
      const key = `${item.planoContasId}-${mes}`;
      acc[key] = (acc[key] ?? 0) + item.valor;
      return acc;
    },
    {} as Record<string, number>
  );
  const previsoesOrdenadas = [...previsoesOrcamentarias].sort(
    (a, b) => a.mes - b.mes || a.planoContasId.localeCompare(b.planoContasId)
  );
  const totalPrevistoPrevisao = previsoesOrdenadas.reduce(
    (sum, item) => sum + item.valorPrevisto,
    0
  );
  const totalRealizadoPrevisao = previsoesOrdenadas.reduce((sum, item) => {
    const key = `${item.planoContasId}-${item.mes}`;
    return sum + (realizadosPorCategoriaMes[key] ?? 0);
  }, 0);
  const totalDesvioPrevisao = totalRealizadoPrevisao - totalPrevistoPrevisao;
  const pessoasPorId = Object.fromEntries(
    pessoasFinanceiro.map((p) => [p.id, p.nome])
  );
  const contasPorId = Object.fromEntries(contas.map((c) => [c.id, c.nome]));
  const receitasLabelPorId = Object.fromEntries(
    receitas.map((r) => [
      r.id,
      `${r.descricao} (${formatarValor(r.valor)})`
    ])
  );
  const receitasElegiveisAbono = receitasValidas.filter(
    (r) => !isSituacaoPaga(r.situacao) && !isSituacaoCancelada(r.situacao)
  );
  const abonoLancamentoSelecionado = receitas.find(
    (r) => r.id === abonoLancamentoId
  );
  const abonoPercentualNumero = Number(
    abonoPercentual.replace(/\./g, "").replace(",", ".")
  );
  const abonoValorEstimado =
    abonoTipo === "percentual" &&
    abonoLancamentoSelecionado &&
    Number.isFinite(abonoPercentualNumero)
      ? (abonoLancamentoSelecionado.valor * abonoPercentualNumero) / 100
      : 0;
  const abonosOrdenados = [...abonos].sort(
    (a, b) =>
      (b.dataSolicitacao ?? "").localeCompare(a.dataSolicitacao ?? "") ||
      a.motivo.localeCompare(b.motivo)
  );
  const abonosPendentes = abonos.filter(
    (a) => (a.status ?? "").toLowerCase() === "pendente"
  ).length;
  const abonosEmAnalise = abonos.filter(
    (a) => (a.status ?? "").toLowerCase() === "em_analise"
  ).length;
  const abonosAprovados = abonos.filter(
    (a) => (a.status ?? "").toLowerCase() === "aprovado"
  ).length;
  const abonosCancelados = abonos.filter(
    (a) => (a.status ?? "").toLowerCase() === "cancelado"
  ).length;
  const medidorSelecionado =
    medidoresConsumo.find((m) => m.id === medidorSelecionadoId) ?? null;
  const leiturasConsumoOrdenadas = [...leiturasConsumo].sort((a, b) =>
    (a.dataLeitura ?? "").localeCompare(b.dataLeitura ?? "")
  );
  const totalConsumoMedidor = leiturasConsumoOrdenadas.reduce(
    (sum, leitura) => sum + leitura.consumo,
    0
  );
  const mediaConsumoMedidor =
    leiturasConsumoOrdenadas.length > 0
      ? totalConsumoMedidor / leiturasConsumoOrdenadas.length
      : 0;
  const ultimaLeituraConsumo =
    leiturasConsumoOrdenadas[leiturasConsumoOrdenadas.length - 1];
  const medidoresAtivos = medidoresConsumo.filter((m) => m.ativo).length;
  const totalConsumoRateio = rateioConsumoPreview.reduce(
    (sum, item) => sum + item.consumo,
    0
  );
  const totalValorRateio = rateioConsumoPreview.reduce(
    (sum, item) => sum + item.valor,
    0
  );
  const pendentesParaBaixa = [...despesas, ...receitas].filter(
    (l) => isSituacaoAberta(l.situacao)
  );
  const cobrancasUnidadePendentes = cobrancasUnidadeOrg.filter((c) => {
    const status = (c.status ?? "").toUpperCase();
    return !["PAGA", "NEGOCIADA", "CANCELADA", "FECHADA"].includes(status);
  });
  const totalCobrancasUnidadePendentes = cobrancasUnidadePendentes.reduce(
    (sum, item) => sum + (item.valorAtualizado ?? item.valor ?? 0),
    0
  );
  const unidadesCobrancaMap = Object.fromEntries(
    cobrancasUnidadeOrg.map((c) => [
      c.unidadeOrganizacionalId,
      `${c.unidadeCodigo} - ${c.unidadeNome}`
    ])
  );
  const pendentesParaBaixaOrdenados = [...pendentesParaBaixa].sort((a, b) =>
    (a.dataVencimento ?? a.dataCompetencia ?? "").localeCompare(
      b.dataVencimento ?? b.dataCompetencia ?? ""
    )
  );
  const filtroBaixaTexto = baixaFiltroTexto.trim().toLowerCase();
  const pendentesParaBaixaFiltrados = pendentesParaBaixaOrdenados.filter(
    (l) => {
      if (baixaFiltroTipo !== "todos" && l.tipo !== baixaFiltroTipo) {
        return false;
      }
      if (!filtroBaixaTexto) return true;
      const base = `${l.descricao} ${l.referencia ?? ""} ${
        pessoasPorId[l.pessoaId] ?? ""
      }`.toLowerCase();
      return base.includes(filtroBaixaTexto);
    }
  );
  const baixaLancamentoSelecionado = pendentesParaBaixa.find(
    (l) => l.id === baixaLancamentoId
  );
  const pagamentosLancamentoOrdenados = [...baixaPagamentos].sort((a, b) =>
    (b.dataPagamento ?? "").localeCompare(a.dataPagamento ?? "")
  );
  const totalPagoLancamento = pagamentosLancamentoOrdenados.reduce(
    (sum, pagamento) => sum + (pagamento.estornadoEm ? 0 : pagamento.valorPago),
    0
  );
  const saldoLancamento = baixaLancamentoSelecionado
    ? Number(
        (baixaLancamentoSelecionado.valor - totalPagoLancamento).toFixed(2)
      )
    : 0;
  const saldoLancamentoAbs = Math.abs(saldoLancamento);
  const totalPendentesValor = pendentesParaBaixaFiltrados.reduce(
    (sum, item) => sum + item.valor,
    0
  );
  const ultimosLancamentos = [...despesasValidas, ...receitasValidas]
    .sort((a, b) =>
      (b.dataCompetencia ?? "").localeCompare(a.dataCompetencia ?? "")
    )
    .slice(0, 20);
  const transferenciasLancadas = [...despesasValidas, ...receitasValidas]
    .filter((l) => (l.formaPagamento ?? "").toLowerCase() === "transferencia")
    .sort((a, b) =>
      (b.dataCompetencia ?? "").localeCompare(a.dataCompetencia ?? "")
    );
  const transferenciasAgrupadas = Object.values(
    transferenciasLancadas.reduce(
      (acc, lanc) => {
        const chave = lanc.referencia || lanc.id;
        if (!acc[chave]) {
          acc[chave] = {
            chave,
            referencia: lanc.referencia || "Sem referencia",
            descricao: lanc.descricao,
            data: lanc.dataCompetencia ?? lanc.dataPagamento ?? lanc.dataVencimento ?? "",
            valor: lanc.valor,
            origemId: undefined as string | undefined,
            destinoId: undefined as string | undefined,
            status: lanc.situacao
          };
        }
        if (lanc.tipo === "pagar") {
          acc[chave].origemId = lanc.contaFinanceiraId;
        } else if (lanc.tipo === "receber") {
          acc[chave].destinoId = lanc.contaFinanceiraId;
        }
        if (!acc[chave].descricao) {
          acc[chave].descricao = lanc.descricao;
        }
        if (!acc[chave].data && (lanc.dataCompetencia || lanc.dataPagamento)) {
          acc[chave].data = lanc.dataCompetencia ?? lanc.dataPagamento ?? "";
        }
        return acc;
      },
      {} as Record<
        string,
        {
          chave: string;
          referencia: string;
          descricao: string;
          data: string;
          valor: number;
          origemId?: string;
          destinoId?: string;
          status: string;
        }
      >
    )
  ).sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  const totalTransferido = transferenciasAgrupadas.reduce(
    (sum, item) => sum + item.valor,
    0
  );
  const faturasAbertas = faturas.filter(
    (f) => f.status !== "paga" && f.status !== "cancelada"
  );
  const lancamentosReceberElegiveisFatura = receitas
    .filter((r) => !isSituacaoCancelada(r.situacao))
    .filter(
      (r) => !faturasAbertas.some((f) => f.lancamentoFinanceiroId === r.id)
    )
    .sort((a, b) =>
      (a.dataVencimento ?? a.dataCompetencia).localeCompare(
        b.dataVencimento ?? b.dataCompetencia
      )
    );
  const totalUnidadesRateioSelecionadas = Object.keys(novoRateioUnidades).length;

  const obterResumoRegraRateio = (regra: RegraRateio) => {
    if (!regra.configuracaoJson) return 0;
    try {
      const parsed = JSON.parse(regra.configuracaoJson) as {
        unidades?: number | Array<{ unidadeId?: string }>;
      };
      if (Array.isArray(parsed.unidades)) {
        return parsed.unidades.length;
      }
      if (typeof parsed.unidades === "number") {
        return parsed.unidades;
      }
    } catch {
      return 0;
    }
    return 0;
  };

  const renderModuloBase = (
    titulo: string,
    descricao: string,
    passos: string[]
  ) => (
    <div className="finance-table-card" style={{ marginTop: 12 }}>
      <div className="finance-table-header">
        <div>
          <h3>{titulo}</h3>
          <p className="finance-form-sub">{descricao}</p>
        </div>
      </div>
      <div className="finance-card-grid" style={{ marginTop: 8 }}>
        {passos.map((passo, idx) => (
          <div key={`${titulo}-${idx}`} className="finance-card">
            <strong>{`Etapa ${idx + 1}`}</strong>
            <p style={{ marginTop: 6 }}>{passo}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTransferenciaForm = () => (
    <section className="finance-form-card">
      <h3>Transferencia entre contas</h3>
      <p className="finance-form-sub">
        Registra saida na conta origem e entrada na conta destino.
      </p>
      {canWrite ? (
        <form onSubmit={transferirEntreContas} className="form">
          <label>
            Conta origem
            <select
              value={transferenciaOrigemId}
              onChange={(e) => setTransferenciaOrigemId(e.target.value)}
              required
            >
              <option value="">Selecione</option>
              {contasTransferencia.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            Conta destino
            <select
              value={transferenciaDestinoId}
              onChange={(e) => setTransferenciaDestinoId(e.target.value)}
              required
            >
              <option value="">Selecione</option>
              {contasTransferencia.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="finance-form-grid">
            <label>
              Valor
              <input
                value={transferenciaValor}
                onChange={(e) => setTransferenciaValor(e.target.value)}
                placeholder="Ex.: 150,00"
                required
              />
            </label>
            <label>
              Data
              <input
                type="date"
                value={transferenciaData}
                onChange={(e) => setTransferenciaData(e.target.value)}
                required
              />
            </label>
          </div>

          <label>
            Descricao
            <input
              value={transferenciaDescricao}
              onChange={(e) => setTransferenciaDescricao(e.target.value)}
              placeholder="Transferencia entre contas"
            />
          </label>

          <label>
            Referencia (opcional)
            <input
              value={transferenciaReferencia}
              onChange={(e) => setTransferenciaReferencia(e.target.value)}
              placeholder="Ex.: TRF-20260205-001"
            />
          </label>

          <button type="submit" disabled={loading || contasTransferencia.length < 2}>
            {loading ? "Transferindo..." : "Transferir"}
          </button>
          {contasTransferencia.length < 2 && (
            <p className="finance-form-sub">
              Cadastre pelo menos duas contas ativas para transferir.
            </p>
          )}
        </form>
      ) : (
        <p className="finance-form-sub">
          Sem acesso para transferencias.
        </p>
      )}
    </section>
  );

  const carregarLogoBase64 = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}swa1.jpeg`);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const gerarRelatorioPdf = async () => {
    const doc = new jsPDF();
    const logo = await carregarLogoBase64();
    const titulo = `Relatorio Financeiro - ${organizacao.nome}`;
    doc.setFontSize(14);
    if (logo) {
      const pageWidth = doc.internal.pageSize.getWidth();
      const logoSize = 32;
      const logoX = (pageWidth - logoSize) / 2;
      doc.addImage(logo, "JPEG", logoX, 8, logoSize, logoSize);
    }
    const titleX = 14;
    const startY = logo ? 48 : 16;
    doc.text(titulo, titleX, startY);
    doc.setFontSize(11);
    doc.text(
      `Total receitas: ${totalReceitas.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      })}`,
      titleX,
      startY + 10
    );
    doc.text(
      `Total despesas: ${totalDespesas.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      })}`,
      titleX,
      startY + 18
    );
    doc.text(
      `Saldo do periodo: ${saldoPeriodo.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      })}`,
      titleX,
      startY + 26
    );

    const receitasRows = Object.entries(totalReceitasPorCategoria).map(
      ([id, total]) => [
        categoriasReceitaPorId[id] ?? "Sem categoria",
        total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      ]
    );
    autoTable(doc, {
      startY: startY + 36,
      head: [["Receitas por categoria", "Total"]],
      body: receitasRows.length ? receitasRows : [["Nenhuma receita", "-"]]
    });

    const despesasRows = Object.entries(totalDespesasPorCategoria).map(
      ([id, total]) => [
        categoriasDespesaPorId[id] ?? "Sem categoria",
        total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      ]
    );
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Despesas por categoria", "Total"]],
      body: despesasRows.length ? despesasRows : [["Nenhuma despesa", "-"]]
    });

    const arquivo = `relatorio_financeiro_${organizacao.nome
      .replace(/[^a-z0-9]+/gi, "_")
      .toLowerCase()}.pdf`;
    doc.save(arquivo);
  };

  const gerarRelatorioExcel = () => {
    const wb = XLSX.utils.book_new();

    const resumo = [
      ["Relatorio Financeiro", organizacao.nome],
      ["Total receitas", totalReceitas],
      ["Total despesas", totalDespesas],
      ["Saldo do periodo", saldoPeriodo]
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    const receitasSheet = [
      ["Categoria", "Total"],
      ...Object.entries(totalReceitasPorCategoria).map(([id, total]) => [
        categoriasReceitaPorId[id] ?? "Sem categoria",
        total
      ])
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(receitasSheet),
      "Receitas"
    );

    const despesasSheet = [
      ["Categoria", "Total"],
      ...Object.entries(totalDespesasPorCategoria).map(([id, total]) => [
        categoriasDespesaPorId[id] ?? "Sem categoria",
        total
      ])
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(despesasSheet),
      "Despesas"
    );

    const arquivo = `relatorio_financeiro_${organizacao.nome
      .replace(/[^a-z0-9]+/gi, "_")
      .toLowerCase()}.xlsx`;
    XLSX.writeFile(wb, arquivo);
  };

  const gerarLivroPrestacaoPdf = async () => {
    const doc = new jsPDF();
    const logo = await carregarLogoBase64();
    const titulo = `Livro de prestacao de contas - ${organizacao.nome}`;
    doc.setFontSize(14);
    if (logo) {
      const pageWidth = doc.internal.pageSize.getWidth();
      const logoSize = 28;
      const logoX = (pageWidth - logoSize) / 2;
      doc.addImage(logo, "JPEG", logoX, 8, logoSize, logoSize);
    }
    const titleX = 14;
    const startY = logo ? 44 : 16;
    doc.text(titulo, titleX, startY);
    doc.setFontSize(11);
    doc.text(`Periodo: ${livroPeriodoLabel}`, titleX, startY + 8);

    const resumoRows = [
      ["Total receitas", formatarValor(totalReceitasLivro)],
      ["Total despesas", formatarValor(totalDespesasLivro)],
      ["Saldo do periodo", formatarValor(saldoLivro)]
    ];
    if (livroIncluirInadimplencia) {
      resumoRows.push([
        "Inadimplencia",
        formatarValor(totalInadimplenciaLivro)
      ]);
    }

    autoTable(doc, {
      startY: startY + 14,
      head: [["Resumo", "Valor"]],
      body: resumoRows
    });

    const receitasRows = Object.entries(receitasLivroPorCategoria).map(
      ([id, total]) => [
        categoriasReceitaPorId[id] ?? "Sem categoria",
        formatarValor(total)
      ]
    );
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Receitas por categoria", "Total"]],
      body: receitasRows.length ? receitasRows : [["Nenhuma receita", "-"]]
    });

    const despesasRows = Object.entries(despesasLivroPorCategoria).map(
      ([id, total]) => [
        categoriasDespesaPorId[id] ?? "Sem categoria",
        formatarValor(total)
      ]
    );
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Despesas por categoria", "Total"]],
      body: despesasRows.length ? despesasRows : [["Nenhuma despesa", "-"]]
    });

    if (livroIncluirInadimplencia) {
      const inadRows = inadimplentesLivro.map((item) => [
        item.descricao,
        formatarData(item.dataVencimento),
        formatarValor(item.valor)
      ]);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [["Inadimplentes", "Vencimento", "Valor"]],
        body: inadRows.length ? inadRows : [["Nenhum inadimplente", "-", "-"]]
      });
    }

    if (livroIncluirDetalhes) {
      const lancRows = lancamentosLivro.map((item) => {
        const categoria =
          item.tipo === "pagar"
            ? categoriasDespesaPorId[item.planoContasId] ?? "Sem categoria"
            : categoriasReceitaPorId[item.planoContasId] ?? "Sem categoria";
        return [
          item.tipo === "pagar" ? "Despesa" : "Receita",
          item.descricao,
          categoria,
          formatarData(item.dataVencimento ?? item.dataCompetencia),
          statusMeta(item.situacao).label,
          formatarValor(item.valor)
        ];
      });
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [["Tipo", "Descricao", "Categoria", "Vencimento", "Situacao", "Valor"]],
        body: lancRows.length ? lancRows : [["Sem lancamentos", "-", "-", "-", "-", "-"]]
      });
    }

    const arquivo = `livro_prestacao_${organizacao.nome
      .replace(/[^a-z0-9]+/gi, "_")
      .toLowerCase()}.pdf`;
    doc.save(arquivo);
  };

  const gerarLivroPrestacaoExcel = () => {
    const wb = XLSX.utils.book_new();
    const resumo = [
      ["Livro de prestacao de contas", organizacao.nome],
      ["Periodo", livroPeriodoLabel],
      ["Total receitas", totalReceitasLivro],
      ["Total despesas", totalDespesasLivro],
      ["Saldo do periodo", saldoLivro]
    ];
    if (livroIncluirInadimplencia) {
      resumo.push(["Inadimplencia", totalInadimplenciaLivro]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

    const receitasSheet = [
      ["Categoria", "Total"],
      ...Object.entries(receitasLivroPorCategoria).map(([id, total]) => [
        categoriasReceitaPorId[id] ?? "Sem categoria",
        total
      ])
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(receitasSheet),
      "Receitas"
    );

    const despesasSheet = [
      ["Categoria", "Total"],
      ...Object.entries(despesasLivroPorCategoria).map(([id, total]) => [
        categoriasDespesaPorId[id] ?? "Sem categoria",
        total
      ])
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(despesasSheet),
      "Despesas"
    );

    if (livroIncluirInadimplencia) {
      const inadSheet = [
        ["Descricao", "Vencimento", "Valor"],
        ...inadimplentesLivro.map((item) => [
          item.descricao,
          item.dataVencimento ?? "",
          item.valor
        ])
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(inadSheet),
        "Inadimplentes"
      );
    }

    if (livroIncluirDetalhes) {
      const lancSheet = [
        ["Tipo", "Descricao", "Categoria", "Vencimento", "Situacao", "Valor"],
        ...lancamentosLivro.map((item) => [
          item.tipo === "pagar" ? "Despesa" : "Receita",
          item.descricao,
          item.tipo === "pagar"
            ? categoriasDespesaPorId[item.planoContasId] ?? "Sem categoria"
            : categoriasReceitaPorId[item.planoContasId] ?? "Sem categoria",
          item.dataVencimento ?? item.dataCompetencia ?? "",
          statusMeta(item.situacao).label,
          item.valor
        ])
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(lancSheet),
        "Lancamentos"
      );
    }

    const arquivo = `livro_prestacao_${organizacao.nome
      .replace(/[^a-z0-9]+/gi, "_")
      .toLowerCase()}.xlsx`;
    XLSX.writeFile(wb, arquivo);
  };

  const baixarArquivo = (blob: Blob, nome: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const baixarRelatorio = async (
    tipo: "chamados" | "reservas" | "veiculos" | "pets",
    formato: "csv" | "pdf"
  ) => {
    if (!token) return;
    try {
      setErro(null);
      setRelatorioLoading(true);
      const dataStamp = new Date().toISOString().slice(0, 10);
      let blob: Blob;
      let arquivo = `relatorio_${tipo}_${dataStamp}.${formato}`;

      if (tipo === "chamados") {
        blob = await api.relatorioChamados(token, organizacaoId, {
          de: relatorioChamadosDe || undefined,
          ate: relatorioChamadosAte || undefined,
          status: relatorioChamadosStatus || undefined,
          formato
        });
      } else if (tipo === "reservas") {
        blob = await api.relatorioReservas(token, organizacaoId, {
          de: relatorioReservasDe || undefined,
          ate: relatorioReservasAte || undefined,
          recursoId: relatorioReservasRecursoId || undefined,
          formato
        });
      } else if (tipo === "veiculos") {
        blob = await api.relatorioVeiculos(token, organizacaoId, "csv");
        arquivo = `relatorio_veiculos_${dataStamp}.csv`;
      } else {
        blob = await api.relatorioPets(token, organizacaoId, "csv");
        arquivo = `relatorio_pets_${dataStamp}.csv`;
      }

      baixarArquivo(blob, arquivo);
    } catch (e: any) {
      setErro(e.message || "Erro ao baixar relatorio.");
    } finally {
      setRelatorioLoading(false);
    }
  };

  return (
    <div ref={topoRef} className="finance-page">
      <div className="finance-header-row">
        <div>
          <h2>Financeiro</h2>
        </div>
        <div className="finance-header-badges">
          <span>Contas: {totalContas}</span>
          <span>Ativas: {contasAtivas}</span>
          <span>Inativas: {contasInativas}</span>
        </div>
      </div>

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <p className="finance-summary-label">Saldo atual</p>
          <p className="finance-summary-value">
            R$ {saldoAtual.toFixed(2)}
          </p>
        </div>
        <div className="finance-summary-card">
          <p className="finance-summary-label">Total a pagar (mês)</p>
          <p className="finance-summary-value">
            R$ {totalAPagarMes.toFixed(2)}
          </p>
        </div>
        <div className="finance-summary-card">
          <p className="finance-summary-label">Total pago (mês)</p>
          <p className="finance-summary-value">
            R$ {totalPagoMes.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="finance-upload-card">
        <div className="finance-upload-header">
          <div>
            <h3>Envios rápidos</h3>
            <span className="finance-form-sub">
              Envie documentos com a câmera ou arquivo.
            </span>
          </div>
          {canWrite && (
            <button
              type="button"
              className="action-primary"
              onClick={() => setMostrarEnvio((prev) => !prev)}
            >
              Enviar para o SGI
            </button>
          )}
        </div>

        {!canWrite && (
          <p className="finance-form-sub">Sem acesso para envios.</p>
        )}

        {canWrite && mostrarEnvio && (
          <form className="finance-upload-form" onSubmit={enviarArquivoFinanceiro}>
            <label>
              Tipo do envio
              <select
                value={tipoEnvio}
                onChange={(e) => setTipoEnvio(e.target.value)}
              >
                <option value="boleto">Boleto / Conta</option>
                <option value="nota">Nota / Compra</option>
                <option value="comprovante">Comprovante</option>
                <option value="extrato">Extrato bancário</option>
              </select>
            </label>
            {tipoEnvio === "extrato" && (
              <label>
                Conta bancaria
                <select
                  value={contaExtratoId}
                  onChange={(e) => setContaExtratoId(e.target.value)}
                >
                  <option value="">Selecionar</option>
                  {contasAtivasLista.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Arquivo
              <input
                type="file"
                accept={
                  tipoEnvio === "extrato"
                    ? ".csv,.ofx"
                    : "image/*,application/pdf"
                }
                capture="environment"
                onChange={(e) =>
                  setArquivoEnvio(e.target.files ? e.target.files[0] : null)
                }
              />
            </label>
            <button type="submit" disabled={loading || !arquivoEnvio}>
              {loading ? "Enviando..." : "Enviar"}
            </button>
          </form>
        )}

        {statusEnvio && <p className="success">{statusEnvio}</p>}
      </div>

      {exibirMenuAbas && (
        <div className="finance-tabs">
          {menuFinanceiro.map((item) => (
            <button
              key={item.id}
              type="button"
              className={"finance-tab" + (aba === item.id ? " finance-tab--active" : "")}
              onClick={() => handleAbaChange(item.id)}
            >
              <span>{item.label}</span>
              {item.badge && <span className="badge">{item.badge}</span>}
            </button>
          ))}
        </div>
      )}

      {aba === "mapaFinanceiro" && (
        <section className="finance-map">
          <div className="finance-map-header">
            <div>
              <h3>Mapa financeiro</h3>
              <p className="finance-form-sub">
                Fluxo visual do dinheiro: origem, classificacao, movimento e destino.
              </p>
            </div>
            <span className="finance-map-pill">Fluxo visual — regras entram depois</span>
          </div>

          <div className="finance-map-grid">
            <div className="finance-map-column finance-map-column--entry">
              <div className="finance-map-column-title">
                <span>Origem</span>
                <span className="finance-map-count">4 fontes</span>
              </div>
              <div className="finance-map-cards">
                {[
                  {
                    title: "Morador",
                    sub: "Taxas e acordos",
                    badge: "12 entradas",
                    tooltip: "Pagamentos de moradores e acordos firmados.",
                    goTo: "contasReceber" as FinanceiroTab
                  },
                  {
                    title: "Fornecedor",
                    sub: "Servicos e contratos",
                    badge: "6 lancamentos",
                    tooltip: "Origem ligada a servicos contratados.",
                    goTo: "contasPagar" as FinanceiroTab
                  },
                  {
                    title: "Funcionario",
                    sub: "Folha e beneficios",
                    badge: "4 lancamentos",
                    tooltip: "Origem interna ligada a pessoal.",
                    goTo: "contasPagar" as FinanceiroTab
                  },
                  {
                    title: "Condominio",
                    sub: "Origem interna",
                    badge: "3 ajustes",
                    tooltip: "Movimentos internos do condominio.",
                    goTo: "transferencias" as FinanceiroTab
                  }
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="finance-map-card"
                    title={`${item.tooltip} Clique para abrir.`}
                    onClick={() => handleAbaChange(item.goTo)}
                  >
                    <div className="finance-map-card-title">{item.title}</div>
                    <p className="finance-map-card-sub">{item.sub}</p>
                    <span className="finance-map-card-badge">{item.badge}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="finance-map-column finance-map-column--neutral">
              <div className="finance-map-column-title">
                <span>Classificacao</span>
                <span className="finance-map-count">6 tipos</span>
              </div>
              <div className="finance-map-chips">
                {[
                  { label: "Receita", goTo: "receitasDespesas" },
                  { label: "Despesa", goTo: "receitasDespesas" },
                  { label: "Acordo", goTo: "receitasDespesas" },
                  { label: "Multa", goTo: "receitasDespesas" },
                  { label: "Taxa", goTo: "receitasDespesas" },
                  { label: "Inadimplencia", goTo: "receitasDespesas" }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="finance-map-chip"
                    title={`Classifica como ${item.label.toLowerCase()}. Clique para abrir.`}
                    onClick={() => handleAbaChange(item.goTo as FinanceiroTab)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="finance-map-column-note">
                Classificacao define o tipo antes de entrar no plano financeiro.
              </p>
            </div>

            <div className="finance-map-column finance-map-column--neutral">
              <div className="finance-map-column-title">
                <span>Plano financeiro</span>
                <span className="finance-map-count">4 bases</span>
              </div>
              <div className="finance-map-cards">
                {[
                  {
                    title: "Categoria financeira",
                    sub: "Agrupador principal",
                    badge: "18 categorias",
                    tooltip: "Organiza receitas e despesas.",
                    goTo: "categorias" as FinanceiroTab
                  },
                  {
                    title: "Centro de custo",
                    sub: "Responsavel pelo gasto",
                    badge: "7 centros",
                    tooltip: "Distribui custos por area.",
                    goTo: "categorias" as FinanceiroTab
                  },
                  {
                    title: "Forma de pagamento",
                    sub: "Pix, boleto, cartao",
                    badge: "5 formas",
                    tooltip: "Define como o valor entra ou sai.",
                    goTo: "contas" as FinanceiroTab
                  },
                  {
                    title: "Status financeiro",
                    sub: "Aberto, pago, atrasado",
                    badge: "6 status",
                    tooltip: "Controla o andamento do lancamento.",
                    goTo: "receitasDespesas" as FinanceiroTab
                  }
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="finance-map-card"
                    title={`${item.tooltip} Clique para abrir.`}
                    onClick={() => handleAbaChange(item.goTo)}
                  >
                    <div className="finance-map-card-title">{item.title}</div>
                    <p className="finance-map-card-sub">{item.sub}</p>
                    <span className="finance-map-card-badge">{item.badge}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="finance-map-column finance-map-column--alert">
              <div className="finance-map-column-title">
                <span>Movimento</span>
                <span className="finance-map-count">5 etapas</span>
              </div>
              <div className="finance-map-cards">
                {[
                  {
                    title: "Contas a pagar",
                    sub: "Saidas planejadas",
                    badge: "8 pendentes",
                    tooltip: "Despesas programadas para pagamento.",
                    goTo: "contasPagar" as FinanceiroTab
                  },
                  {
                    title: "Contas a receber",
                    sub: "Entradas previstas",
                    badge: "14 previstas",
                    tooltip: "Receitas aguardando recebimento.",
                    goTo: "contasReceber" as FinanceiroTab
                  },
                  {
                    title: "Lancamento",
                    sub: "Registro financeiro",
                    badge: "22 ativos",
                    tooltip: "Registro base do movimento.",
                    goTo: "receitasDespesas" as FinanceiroTab
                  },
                  {
                    title: "Parcela",
                    sub: "Divisao do valor",
                    badge: "10 parcelas",
                    tooltip: "Divisao de pagamentos ou recebimentos.",
                    goTo: "receitasDespesas" as FinanceiroTab
                  },
                  {
                    title: "Recorrencia",
                    sub: "Lancamentos automaticos",
                    badge: "4 regras",
                    tooltip: "Fluxo recorrente do condominio.",
                    goTo: "receitasDespesas" as FinanceiroTab
                  }
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="finance-map-card"
                    title={`${item.tooltip} Clique para abrir.`}
                    onClick={() => handleAbaChange(item.goTo)}
                  >
                    <div className="finance-map-card-title">{item.title}</div>
                    <p className="finance-map-card-sub">{item.sub}</p>
                    <span className="finance-map-card-badge">{item.badge}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="finance-map-column finance-map-column--entry">
              <div className="finance-map-column-title">
                <span>Destino</span>
                <span className="finance-map-count">4 alvos</span>
              </div>
              <div className="finance-map-cards">
                {[
                  {
                    title: "Caixa",
                    sub: "Dinheiro imediato",
                    badge: "R$ 8.200",
                    tooltip: "Saldo em caixa no periodo.",
                    goTo: "contas" as FinanceiroTab
                  },
                  {
                    title: "Conta bancaria",
                    sub: "Bancos e pix",
                    badge: "3 contas",
                    tooltip: "Destino bancario principal.",
                    goTo: "contas" as FinanceiroTab
                  },
                  {
                    title: "Fundo",
                    sub: "Reserva generica",
                    badge: "2 fundos",
                    tooltip: "Reserva para projetos ou emergencias.",
                    goTo: "contas" as FinanceiroTab
                  },
                  {
                    title: "Saldo do condominio",
                    sub: "Consolidado geral",
                    badge: "R$ 270.000",
                    tooltip: "Saldo consolidado do condominio.",
                    goTo: "contas" as FinanceiroTab
                  }
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="finance-map-card"
                    title={`${item.tooltip} Clique para abrir.`}
                    onClick={() => handleAbaChange(item.goTo)}
                  >
                    <div className="finance-map-card-title">{item.title}</div>
                    <p className="finance-map-card-sub">{item.sub}</p>
                    <span className="finance-map-card-badge">{item.badge}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="finance-map-legend">
            <span className="legend-dot legend-dot--entry" />
            <span>Entrada</span>
            <span className="legend-dot legend-dot--alert" />
            <span>Alerta</span>
            <span className="legend-dot legend-dot--neutral" />
            <span>Neutro</span>
          </div>

          <p className="finance-map-footnote">
            Fluxo visual — regras entram depois. Nenhum dado real e alterado.
          </p>
        </section>
      )}

      {aba === "contabilidade" && (
        <section className="accounting-map">
          <div className="accounting-header">
            <div>
              <h3>Contabilidade completa</h3>
              <p className="finance-form-sub">
                Visao visual para entender lancamentos, demonstracoes e fechamento.
              </p>
            </div>
            <span className="accounting-pill">Modelo visual — regras entram depois</span>
          </div>

          <div className="accounting-flow">
            <span className="accounting-node">Lancamento (debito/credito)</span>
            <span className="accounting-arrow">→</span>
            <span className="accounting-node">Livro diario / razao</span>
            <span className="accounting-arrow">→</span>
            <span className="accounting-node">Balancete</span>
            <span className="accounting-arrow">→</span>
            <span className="accounting-node">DRE / Balanco</span>
          </div>

          <div className="accounting-grid">
            <div
              className="accounting-column accounting-column--entry accounting-column--clickable"
              role="button"
              tabIndex={0}
              onClick={() => abrirAbaContabilidade("plano")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  abrirAbaContabilidade("plano");
                }
              }}
            >
              <div className="accounting-column-title">
                <span>Plano de contas</span>
                <span className="accounting-count">
                  {gruposContabeis.size} grupos
                </span>
              </div>
              <div className="accounting-cards">
                {[
                  {
                    title: "Ativo",
                    sub: "Bens e direitos",
                    badge: `${contasAtivo.length} contas`
                  },
                  {
                    title: "Passivo",
                    sub: "Obrigacoes e dividas",
                    badge: `${contasPassivo.length} contas`
                  },
                  {
                    title: "Patrimonio liquido",
                    sub: "Capital e reservas",
                    badge: `${contasPatrimonio.length} contas`
                  },
                  {
                    title: "Resultado",
                    sub: "Receitas e despesas",
                    badge: `${contasResultado.length} contas`
                  }
                ].map((item) => (
                  <div key={item.title} className="accounting-card">
                    <div className="accounting-card-title">{item.title}</div>
                    <p className="accounting-card-sub">{item.sub}</p>
                    <span className="accounting-card-badge">{item.badge}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="accounting-column accounting-column--neutral accounting-column--clickable"
              role="button"
              tabIndex={0}
              onClick={() => abrirAbaContabilidade("lancamentos")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  abrirAbaContabilidade("lancamentos");
                }
              }}
            >
              <div className="accounting-column-title">
                <span>Lancamentos contabeis</span>
                <span className="accounting-count">debito/credito</span>
              </div>
              <div className="accounting-cards">
                {[
                  {
                    title: "Debito",
                    sub: "Registro de origem",
                    badge: `${totalLancamentosContabeis} lancamentos`
                  },
                  {
                    title: "Credito",
                    sub: "Registro de destino",
                    badge: `${totalLancamentosContabeis} lancamentos`
                  },
                  {
                    title: "Historico padrao",
                    sub: "Descricao recorrente",
                    badge: "8 modelos"
                  },
                  {
                    title: "Centro de custo",
                    sub: "Rateio por area",
                    badge: "Opcional"
                  }
                ].map((item) => (
                  <div key={item.title} className="accounting-card">
                    <div className="accounting-card-title">{item.title}</div>
                    <p className="accounting-card-sub">{item.sub}</p>
                    <span className="accounting-card-badge">{item.badge}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="accounting-column accounting-column--neutral accounting-column--clickable"
              role="button"
              tabIndex={0}
              onClick={() => abrirAbaContabilidade("periodos")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  abrirAbaContabilidade("periodos");
                }
              }}
            >
              <div className="accounting-column-title">
                <span>Regime de competencia</span>
                <span className="accounting-count">mensal</span>
              </div>
              <div className="accounting-cards">
                {[
                  {
                    title: "Competencia",
                    sub: "Mes/ano do fato",
                    badge: `${periodosContabeisDisplay.length} periodos`
                  },
                  {
                    title: "Ajustes e provisoes",
                    sub: "Reconhecimento futuro",
                    badge: "4 ajustes"
                  },
                  {
                    title: "Apropriacoes",
                    sub: "Rateios por periodo",
                    badge: "6 regras"
                  }
                ].map((item) => (
                  <div key={item.title} className="accounting-card">
                    <div className="accounting-card-title">{item.title}</div>
                    <p className="accounting-card-sub">{item.sub}</p>
                    <span className="accounting-card-badge">{item.badge}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="accounting-column accounting-column--alert accounting-column--clickable"
              role="button"
              tabIndex={0}
              onClick={() => abrirAbaContabilidade("demonstrativos")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  abrirAbaContabilidade("demonstrativos");
                }
              }}
            >
              <div className="accounting-column-title">
                <span>Demonstracoes</span>
                <span className="accounting-count">visual</span>
              </div>
              <div className="accounting-cards">
                {[
                  {
                    title: "Balancete",
                    sub: "Resumo por conta",
                    badge: "Mensal"
                  },
                  {
                    title: "DRE",
                    sub: "Resultado do periodo",
                    badge: "Mensal"
                  },
                  {
                    title: "Balanco patrimonial",
                    sub: "Posicao financeira",
                    badge: "Fechamento"
                  },
                  {
                    title: "DFC",
                    sub: "Fluxo de caixa",
                    badge: "Opcional"
                  },
                  {
                    title: "DMPL / DLPA",
                    sub: "Mutacoes do patrimonio",
                    badge: "Opcional"
                  },
                  {
                    title: "Notas explicativas",
                    sub: "Contexto e detalhes",
                    badge: "Anual"
                  }
                ].map((item) => (
                  <div key={item.title} className="accounting-card">
                    <div className="accounting-card-title">{item.title}</div>
                    <p className="accounting-card-sub">{item.sub}</p>
                    <span className="accounting-card-badge">{item.badge}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="accounting-column accounting-column--entry accounting-column--clickable"
              role="button"
              tabIndex={0}
              onClick={() => abrirAbaContabilidade("integracao")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  abrirAbaContabilidade("integracao");
                }
              }}
            >
              <div className="accounting-column-title">
                <span>Fechamento & integracao</span>
                <span className="accounting-count">SPED</span>
              </div>
              <div className="accounting-cards">
                {[
                  {
                    title: "Fechamento mensal",
                    sub: "Travamento do periodo",
                    badge: "Checklist"
                  },
                  {
                    title: "Termos de abertura/encerramento",
                    sub: "Controle legal",
                    badge: "Livro"
                  },
                  {
                    title: "Conciliacao contabil",
                    sub: "Revisao de contas",
                    badge: "Controle"
                  },
                  {
                    title: "Livro diario / razao",
                    sub: "Exportacao contenciosa",
                    badge: "Obrigatorio"
                  },
                  {
                    title: "SPED ECD/ECF",
                    sub: "Exportacao oficial",
                    badge: "Integracao"
                  },
                  {
                    title: "Plano referencial SPED",
                    sub: "Amarracao fiscal",
                    badge: "Vinculo"
                  },
                  {
                    title: "Integracao contador",
                    sub: "Arquivos e relatorios",
                    badge: "Envio"
                  }
                ].map((item) => (
                  <div key={item.title} className="accounting-card">
                    <div className="accounting-card-title">{item.title}</div>
                    <p className="accounting-card-sub">{item.sub}</p>
                    <span className="accounting-card-badge">{item.badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="accounting-actions">
            <div className="accounting-tabs">
              <button
                type="button"
                className={
                  "accounting-tab" +
                  (contabilidadeAba === "plano" ? " is-active" : "")
                }
                onClick={() => abrirAbaContabilidade("plano")}
              >
                Plano de contas
              </button>
              <button
                type="button"
                className={
                  "accounting-tab" +
                  (contabilidadeAba === "lancamentos" ? " is-active" : "")
                }
                onClick={() => abrirAbaContabilidade("lancamentos")}
              >
                Lancamentos
              </button>
              <button
                type="button"
                className={
                  "accounting-tab" +
                  (contabilidadeAba === "periodos" ? " is-active" : "")
                }
                onClick={() => abrirAbaContabilidade("periodos")}
              >
                Periodos
              </button>
              <button
                type="button"
                className={
                  "accounting-tab" +
                  (contabilidadeAba === "demonstrativos" ? " is-active" : "")
                }
                onClick={() => abrirAbaContabilidade("demonstrativos")}
              >
                Demonstrativos
              </button>
              <button
                type="button"
                className={
                  "accounting-tab" +
                  (contabilidadeAba === "integracao" ? " is-active" : "")
                }
                onClick={() => abrirAbaContabilidade("integracao")}
              >
                Integracao
              </button>
            </div>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                void carregarContasContabeis();
                void carregarPeriodosContabeis();
                void carregarLancamentosContabeis();
              }}
              disabled={contabilidadeLoading}
            >
              {contabilidadeLoading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          <div className="accounting-panel" ref={contabilidadePainelRef}>
            {!canReadContabilidade && (
              <p className="finance-form-sub">
                Sem acesso para consultar contabilidade.
              </p>
            )}
            {canReadContabilidade && (
              <>
                {usandoDemoContabilidade && (
                  <p className="info-note">
                    Modo demo ativo: dados de exemplo para visualizacao. Para
                    dados reais, conecte a API e cadastre contas.
                  </p>
                )}
                {!usandoDemoContabilidade && contabilidadeErro && (
                  <p className="error">{contabilidadeErro}</p>
                )}
                {contabilidadeLoading && (
                  <p className="finance-form-sub">Carregando dados...</p>
                )}

                {contabilidadeAba === "plano" && (
                  <div className="accounting-panel-grid">
                    <form className="accounting-form" onSubmit={criarContaContabil}>
                      <h4>Nova conta contabil</h4>
                      <label>
                        Codigo
                        <input
                          value={novaContaCodigo}
                          onChange={(e) => setNovaContaCodigo(e.target.value)}
                          required
                          placeholder="1.1.01"
                        />
                      </label>
                      <label>
                        Nome
                        <input
                          value={novaContaNome}
                          onChange={(e) => setNovaContaNome(e.target.value)}
                          required
                          placeholder="Caixa"
                        />
                      </label>
                      <div className="accounting-form-row">
                        <label>
                          Grupo
                          <select
                            value={novaContaGrupo}
                            onChange={(e) => setNovaContaGrupo(e.target.value)}
                          >
                            <option value="Ativo">Ativo</option>
                            <option value="Passivo">Passivo</option>
                            <option value="Patrimonio">Patrimonio</option>
                            <option value="Resultado">Resultado</option>
                          </select>
                        </label>
                        <label>
                          Natureza
                          <select
                            value={novaContaNatureza}
                            onChange={(e) =>
                              setNovaContaNatureza(e.target.value)
                            }
                          >
                            <option value="Devedora">Devedora</option>
                            <option value="Credora">Credora</option>
                          </select>
                        </label>
                      </div>
                      <label>
                        Conta pai (opcional)
                        <select
                          value={novaContaParentId}
                          onChange={(e) => setNovaContaParentId(e.target.value)}
                        >
                          <option value="">Sem conta pai</option>
                          {contasContabeisDisplay.map((conta) => (
                            <option key={conta.id} value={conta.id}>
                              {conta.codigo} • {conta.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Codigo referencial SPED (opcional)
                        <input
                          value={novaContaSped}
                          onChange={(e) => setNovaContaSped(e.target.value)}
                          placeholder="1.01.01"
                        />
                      </label>
                      <button type="submit" disabled={!canWriteContabilidade}>
                        Adicionar conta
                      </button>
                      {!canWriteContabilidade && (
                        <p className="finance-form-sub">
                          Somente administradores podem cadastrar contas.
                        </p>
                      )}
                    </form>

                    <div className="accounting-list">
                        <div className="accounting-table-header">
                          <h4>Contas cadastradas</h4>
                          <span className="accounting-count">
                          {contasContabeisDisplay.length} contas
                          </span>
                        </div>
                      {contasContabeisDisplay.length === 0 ? (
                        <p className="finance-form-sub">
                          Nenhuma conta contabil cadastrada ainda.
                        </p>
                      ) : (
                        <table className="accounting-table">
                          <thead>
                            <tr>
                              <th>Codigo</th>
                              <th>Nome</th>
                              <th>Grupo</th>
                              <th>Natureza</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contasContabeisDisplay.map((conta) => (
                              <tr key={conta.id}>
                                <td>{conta.codigo}</td>
                                <td>{conta.nome}</td>
                                <td>{conta.grupo}</td>
                                <td>{conta.natureza}</td>
                                <td>
                                  <span
                                    className={
                                      "badge-status " +
                                      (conta.ativa
                                        ? "badge-status--ativo"
                                        : "badge-status--inativo")
                                    }
                                  >
                                    {conta.ativa ? "Ativa" : "Inativa"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {contabilidadeAba === "lancamentos" && (
                  <div className="accounting-panel-grid">
                    <form
                      className="accounting-form"
                      onSubmit={criarLancamentoContabil}
                    >
                      <h4>Novo lancamento</h4>
                      <label>
                        Competencia
                        <input
                          type="date"
                          value={lancamentoCompetencia}
                          onChange={(e) =>
                            setLancamentoCompetencia(e.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        Historico
                        <input
                          value={lancamentoHistorico}
                          onChange={(e) => setLancamentoHistorico(e.target.value)}
                          placeholder="Descricao do lancamento"
                        />
                      </label>
                      <label>
                        Valor
                        <input
                          value={lancamentoValor}
                          onChange={(e) => setLancamentoValor(e.target.value)}
                          placeholder="0,00"
                        />
                      </label>
                      <label>
                        Conta debito
                        <select
                          value={lancamentoContaDebito}
                          onChange={(e) =>
                            setLancamentoContaDebito(e.target.value)
                          }
                          required
                        >
                          <option value="">Selecione</option>
                          {contasContabeisDisplay.map((conta) => (
                            <option key={conta.id} value={conta.id}>
                              {conta.codigo} • {conta.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Conta credito
                        <select
                          value={lancamentoContaCredito}
                          onChange={(e) =>
                            setLancamentoContaCredito(e.target.value)
                          }
                          required
                        >
                          <option value="">Selecione</option>
                          {contasContabeisDisplay.map((conta) => (
                            <option key={conta.id} value={conta.id}>
                              {conta.codigo} • {conta.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit" disabled={!canWriteContabilidade}>
                        Lancar
                      </button>
                      {!canWriteContabilidade && (
                        <p className="finance-form-sub">
                          Somente administradores podem lançar.
                        </p>
                      )}
                    </form>

                    <div className="accounting-list">
                      <div className="accounting-table-header">
                        <h4>Lancamentos contabeis</h4>
                        <span className="accounting-count">
                          {lancamentosContabeisDisplay.length} lancamentos
                        </span>
                      </div>
                      {lancamentosContabeisDisplay.length === 0 ? (
                        <p className="finance-form-sub">
                          Nenhum lancamento contabil encontrado.
                        </p>
                      ) : (
                        <div className="accounting-list-cards">
                          {lancamentosContabeisDisplay.map((lancamento) => (
                            <div key={lancamento.id} className="accounting-item">
                              <div>
                                <strong>{lancamento.historico || "Lancamento"}</strong>
                                <p className="accounting-item-sub">
                                  Competencia:{" "}
                                  {new Date(
                                    lancamento.competencia
                                  ).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                              <span className="badge-status badge-status--ativo">
                                {lancamento.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {contabilidadeAba === "periodos" && (
                  <div className="accounting-panel-grid">
                    <form className="accounting-form" onSubmit={criarPeriodoContabil}>
                      <h4>Novo periodo</h4>
                      <label>
                        Competencia inicio
                        <input
                          type="date"
                          value={periodoInicio}
                          onChange={(e) => setPeriodoInicio(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Competencia fim
                        <input
                          type="date"
                          value={periodoFim}
                          onChange={(e) => setPeriodoFim(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Observacao
                        <input
                          value={periodoObservacao}
                          onChange={(e) => setPeriodoObservacao(e.target.value)}
                          placeholder="Opcional"
                        />
                      </label>
                      <button type="submit" disabled={!canWriteContabilidade}>
                        Criar periodo
                      </button>
                      {!canWriteContabilidade && (
                        <p className="finance-form-sub">
                          Somente administradores podem criar periodos.
                        </p>
                      )}
                    </form>

                    <div className="accounting-list">
                      <div className="accounting-table-header">
                        <h4>Periodos contabeis</h4>
                        <span className="accounting-count">
                          {periodosContabeisDisplay.length} periodos
                        </span>
                      </div>
                      {periodosContabeisDisplay.length === 0 ? (
                        <p className="finance-form-sub">
                          Nenhum periodo contabil cadastrado.
                        </p>
                      ) : (
                        <div className="accounting-list-cards">
                          {periodosContabeisDisplay.map((periodo) => (
                            <div key={periodo.id} className="accounting-item">
                              <div>
                                <strong>
                                  {new Date(
                                    periodo.competenciaInicio
                                  ).toLocaleDateString("pt-BR")}{" "}
                                  ate{" "}
                                  {new Date(
                                    periodo.competenciaFim
                                  ).toLocaleDateString("pt-BR")}
                                </strong>
                                <p className="accounting-item-sub">
                                  Status: {periodo.status}
                                </p>
                              </div>
                              {canWriteContabilidade && (
                                <div className="accounting-item-actions">
                                  {periodo.status === "aberto" ? (
                                    <button
                                      type="button"
                                      className="button-secondary"
                                      onClick={() => void fecharPeriodo(periodo.id)}
                                    >
                                      Fechar
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="button-secondary"
                                      onClick={() => void reabrirPeriodo(periodo.id)}
                                    >
                                      Reabrir
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {contabilidadeAba === "demonstrativos" && (
                  <div className="accounting-panel-stack">
                    <div className="accounting-form-row">
                      <label>
                        Competencia inicio
                        <input
                          type="date"
                          value={demonstrativoInicio}
                          onChange={(e) =>
                            setDemonstrativoInicio(e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Competencia fim
                        <input
                          type="date"
                          value={demonstrativoFim}
                          onChange={(e) => setDemonstrativoFim(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="accounting-actions-row">
                      <button type="button" onClick={() => void gerarBalancete()}>
                        Gerar balancete
                      </button>
                      <button type="button" onClick={() => void gerarDre()}>
                        Gerar DRE
                      </button>
                      <button type="button" onClick={() => void gerarBalanco()}>
                        Gerar balanco
                      </button>
                    </div>

                    <div className="accounting-report-grid">
                      <div className="accounting-report-card">
                        <h4>Balancete</h4>
                        {balanceteDisplay.length === 0 ? (
                          <p className="finance-form-sub">
                            Nenhum dado gerado ainda.
                          </p>
                        ) : (
                          <table className="accounting-table">
                            <thead>
                              <tr>
                                <th>Conta</th>
                                <th>Debitos</th>
                                <th>Creditos</th>
                                <th>Saldo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {balanceteDisplay.map((item) => (
                                <tr key={item.contaId}>
                                  <td>
                                    {item.codigo} • {item.nome}
                                  </td>
                                  <td>
                                    {item.debitos.toLocaleString("pt-BR", {
                                      style: "currency",
                                      currency: "BRL"
                                    })}
                                  </td>
                                  <td>
                                    {item.creditos.toLocaleString("pt-BR", {
                                      style: "currency",
                                      currency: "BRL"
                                    })}
                                  </td>
                                  <td>
                                    {item.saldo.toLocaleString("pt-BR", {
                                      style: "currency",
                                      currency: "BRL"
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      <div className="accounting-report-card">
                        <h4>DRE</h4>
                        {dreResumoDisplay ? (
                          <div className="accounting-summary">
                            <div>
                              <span>Receitas</span>
                              <strong>
                                {dreResumoDisplay.receitas.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL"
                                })}
                              </strong>
                            </div>
                            <div>
                              <span>Despesas</span>
                              <strong>
                                {dreResumoDisplay.despesas.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL"
                                })}
                              </strong>
                            </div>
                            <div>
                              <span>Resultado</span>
                              <strong>
                                {dreResumoDisplay.resultado.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL"
                                })}
                              </strong>
                            </div>
                          </div>
                        ) : (
                          <p className="finance-form-sub">
                            Gere o DRE para visualizar.
                          </p>
                        )}
                      </div>

                      <div className="accounting-report-card">
                        <h4>Balanco patrimonial</h4>
                        {balancoResumoDisplay ? (
                          <div className="accounting-summary">
                            <div>
                              <span>Ativo</span>
                              <strong>
                                {balancoResumoDisplay.ativo.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL"
                                })}
                              </strong>
                            </div>
                            <div>
                              <span>Passivo</span>
                              <strong>
                                {balancoResumoDisplay.passivo.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL"
                                })}
                              </strong>
                            </div>
                            <div>
                              <span>Patrimonio</span>
                              <strong>
                                {balancoResumoDisplay.patrimonio.toLocaleString(
                                  "pt-BR",
                                  { style: "currency", currency: "BRL" }
                                )}
                              </strong>
                            </div>
                          </div>
                        ) : (
                          <p className="finance-form-sub">
                            Gere o balanco para visualizar.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {contabilidadeAba === "integracao" && (
                  <div className="accounting-panel-stack">
                    <div className="accounting-form-row">
                      <label>
                        Competencia inicio
                        <input
                          type="date"
                          value={integracaoInicio}
                          onChange={(e) => setIntegracaoInicio(e.target.value)}
                        />
                      </label>
                      <label>
                        Competencia fim
                        <input
                          type="date"
                          value={integracaoFim}
                          onChange={(e) => setIntegracaoFim(e.target.value)}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => void integrarFinanceiro()}
                      disabled={!canWriteContabilidade}
                    >
                      Integrar financeiro
                    </button>
                    {!canWriteContabilidade && (
                      <p className="finance-form-sub">
                        Somente administradores podem integrar financeiro.
                      </p>
                    )}
                    {integracaoResultadoDisplay && (
                      <div className="accounting-report-grid">
                        <div className="accounting-report-card">
                          <h4>Resultado da integracao</h4>
                          <div className="accounting-summary">
                            <div>
                              <span>Total</span>
                              <strong>{integracaoResultadoDisplay.total}</strong>
                            </div>
                            <div>
                              <span>Criados</span>
                              <strong>{integracaoResultadoDisplay.criados}</strong>
                            </div>
                            <div>
                              <span>Ignorados</span>
                              <strong>{integracaoResultadoDisplay.ignorados}</strong>
                            </div>
                            <div>
                              <span>Sem mapeamento</span>
                              <strong>{integracaoResultadoDisplay.semMapeamento}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <p className="accounting-footnote">
            Fluxo visual — regras entram depois. Nenhum dado real e alterado.
          </p>
        </section>
      )}

      {aba === "contas" && (
        <div className="finance-layout">
          <div className="finance-side-column">
            {/* Formulário de conta */}
            <section className="finance-form-card">
              <h3>Nova conta</h3>

              {canWrite ? (
                <form onSubmit={criarConta} className="form">
                  <label>
                    Nome da conta
                    <input
                      value={nomeConta}
                      onChange={(e) => setNomeConta(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Tipo de conta
                    <select
                      value={tipoConta}
                      onChange={(e) => setTipoConta(e.target.value)}
                    >
                      <option value="Bancária">Bancária</option>
                      <option value="Caixa">Caixa</option>
                      <option value="Digital">Conta digital</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </label>

                  <div className="finance-form-grid">
                    <label>
                      Banco
                      <input
                        value={banco}
                        onChange={(e) => setBanco(e.target.value)}
                      />
                    </label>
                    <label>
                      Agência
                      <input
                        value={agencia}
                        onChange={(e) => setAgencia(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="finance-form-grid">
                    <label>
                      Número da conta
                      <input
                        value={numeroConta}
                        onChange={(e) => setNumeroConta(e.target.value)}
                      />
                    </label>
                    <label>
                      Saldo inicial
                      <input
                        value={saldoInicial}
                        onChange={(e) => setSaldoInicial(e.target.value)}
                        placeholder="Ex.: 0,00"
                      />
                    </label>
                  </div>

                  <label>
                    Moeda
                    <select
                      value={moeda}
                      onChange={(e) => setMoeda(e.target.value)}
                    >
                      <option value="BRL">Real (BRL)</option>
                      <option value="USD">Dólar (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                    </select>
                  </label>

                  <button type="submit" disabled={loading}>
                    {loading ? "Salvando..." : "Adicionar conta"}
                  </button>
                </form>
              ) : (
                <p className="finance-form-sub">Sem acesso para criar contas.</p>
              )}
              {erro && <p className="error">{erro}</p>}
            </section>

            {renderTransferenciaForm()}
          </div>

          {/* Contas financeiras */}
          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Contas financeiras</h3>
              </div>
            </div>

            <div className="finance-card-list">
              {contas.map((conta) => (
                <div key={conta.id} className="finance-item-card">
                  <div className="finance-item-main">
                    <div>
                      <strong className="finance-item-title">{conta.nome}</strong>
                      <div className="finance-item-sub">
                        {conta.tipo} • {conta.banco || "-"} •{" "}
                        {conta.numeroConta || "-"}
                      </div>
                    </div>
                    <div className="finance-item-right">
                      <span className="finance-value">
                        {(conta.saldoInicial ?? 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: conta.moeda || "BRL"
                        })}
                      </span>
                      <span
                        className={
                          "badge-status " +
                          (conta.status === "ativo"
                            ? "badge-status--ativo"
                            : "badge-status--inativo")
                        }
                      >
                        {conta.status === "ativo" ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                  </div>
                  {canWrite && (
                    <div className="finance-item-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() =>
                          atualizarStatusConta(
                            conta,
                            conta.status === "ativo" ? "inativo" : "ativo"
                          )
                        }
                      >
                        {conta.status === "ativo" ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        className="action-secondary"
                        onClick={() => void removerConta(conta)}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {contas.length === 0 && (
                <p className="empty">Nenhuma conta cadastrada ainda.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {aba === "consumos" && (
        <div className="finance-layout">
          <div className="finance-side-column">
            <section className="finance-form-card">
              <h3>Novo medidor</h3>
              <p className="finance-form-sub">
                Cadastre medidores por unidade e tipo de consumo.
              </p>

              {consumoErro && <p className="error">{consumoErro}</p>}

              {canWrite ? (
                <form className="form" onSubmit={criarMedidorConsumo}>
                  <label>
                    Unidade
                    <select
                      value={novoMedidorUnidadeId}
                      onChange={(e) => setNovoMedidorUnidadeId(e.target.value)}
                      required
                    >
                      <option value="">Selecionar</option>
                      {unidadesRateioDisplay.map((unidade) => (
                        <option key={unidade.id} value={unidade.id}>
                          {unidade.codigoInterno} - {unidade.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Nome do medidor
                    <input
                      value={novoMedidorNome}
                      onChange={(e) => setNovoMedidorNome(e.target.value)}
                      required
                    />
                  </label>

                  <div className="finance-form-grid">
                    <label>
                      Tipo
                      <select
                        value={novoMedidorTipo}
                        onChange={(e) => setNovoMedidorTipo(e.target.value)}
                      >
                        <option value="Agua">Agua</option>
                        <option value="Gas">Gas</option>
                        <option value="Energia">Energia</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </label>
                    <label>
                      Unidade de medida
                      <input
                        value={novoMedidorUnidadeMedida}
                        onChange={(e) =>
                          setNovoMedidorUnidadeMedida(e.target.value)
                        }
                        placeholder="m3, kWh"
                        required
                      />
                    </label>
                  </div>

                  <div className="finance-form-grid">
                    <label>
                      Numero de serie
                      <input
                        value={novoMedidorNumeroSerie}
                        onChange={(e) =>
                          setNovoMedidorNumeroSerie(e.target.value)
                        }
                        placeholder="Opcional"
                      />
                    </label>
                    <label>
                      Observacao
                      <input
                        value={novoMedidorObservacao}
                        onChange={(e) =>
                          setNovoMedidorObservacao(e.target.value)
                        }
                        placeholder="Opcional"
                      />
                    </label>
                  </div>

                  <button type="submit" disabled={!token || consumoLoading}>
                    {consumoLoading ? "Salvando..." : "Salvar medidor"}
                  </button>
                </form>
              ) : (
                <p className="finance-form-sub">
                  Sem acesso para cadastrar medidores.
                </p>
              )}
            </section>

            <section className="finance-form-card">
              <h3>Registrar leitura</h3>
              <p className="finance-form-sub">
                Informe a leitura atual para gerar o consumo mensal.
              </p>

              {canWrite ? (
                <form className="form" onSubmit={criarLeituraConsumo}>
                  <label>
                    Medidor
                    <select
                      value={medidorSelecionadoId}
                      onChange={(e) => setMedidorSelecionadoId(e.target.value)}
                      required
                    >
                      <option value="">Selecionar</option>
                      {medidoresConsumo.map((medidor) => (
                        <option key={medidor.id} value={medidor.id}>
                          {medidor.nome} -{" "}
                          {unidadesRateioPorId[medidor.unidadeOrganizacionalId] ??
                            "Unidade"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="finance-form-grid">
                    <label>
                      Competencia
                      <input
                        type="month"
                        value={leituraCompetencia}
                        onChange={(e) => setLeituraCompetencia(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Data da leitura
                      <input
                        type="date"
                        value={leituraData}
                        onChange={(e) => setLeituraData(e.target.value)}
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Leitura atual
                    <input
                      value={leituraAtual}
                      onChange={(e) => setLeituraAtual(e.target.value)}
                      placeholder="Ex.: 1500,5"
                      required
                    />
                  </label>

                  <label>
                    Observacao
                    <input
                      value={leituraObservacao}
                      onChange={(e) => setLeituraObservacao(e.target.value)}
                      placeholder="Opcional"
                    />
                  </label>

                  <button type="submit" disabled={!token || consumoLoading}>
                    {consumoLoading ? "Salvando..." : "Salvar leitura"}
                  </button>
                </form>
              ) : (
                <p className="finance-form-sub">
                  Sem acesso para registrar leituras.
                </p>
              )}
            </section>

            <section className="finance-form-card">
              <h3>Importar leituras (CSV)</h3>
              <p className="finance-form-sub">
                Importe leituras em lote usando CSV.
              </p>

              {consumoImportStatus && <p className="success">{consumoImportStatus}</p>}
              {consumoImportErros.length > 0 && (
                <div className="error">
                  {consumoImportErros.map((item, index) => (
                    <div key={`${item}-${index}`}>{item}</div>
                  ))}
                </div>
              )}

              {canWrite ? (
                <form className="form" onSubmit={importarLeiturasCsv}>
                  <label>
                    Arquivo CSV
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        setConsumoImportStatus(null);
                        setConsumoImportErros([]);
                        setConsumoArquivo(
                          e.target.files ? e.target.files[0] : null
                        );
                      }}
                    />
                  </label>
                  <p className="finance-form-sub">
                    Colunas aceitas: medidorId/numeroSerie/medidor, competencia,
                    dataLeitura, leituraAtual, observacao, unidade.
                  </p>
                  <button
                    type="submit"
                    disabled={!token || consumoImportando || !consumoArquivo}
                  >
                    {consumoImportando ? "Importando..." : "Importar CSV"}
                  </button>
                </form>
              ) : (
                <p className="finance-form-sub">
                  Sem acesso para importar leituras.
                </p>
              )}
            </section>

            <section className="finance-form-card">
              <h3>Rateio automatico</h3>
              <p className="finance-form-sub">
                Gere cobrancas por unidade com base no consumo do periodo.
              </p>

              {rateioConsumoErro && <p className="error">{rateioConsumoErro}</p>}
              {rateioConsumoStatus && (
                <p className="success">{rateioConsumoStatus}</p>
              )}

              {canWrite ? (
                <form className="form" onSubmit={gerarCobrancasConsumo}>
                  <div className="finance-form-grid">
                    <label>
                      Competencia
                      <input
                        type="month"
                        value={rateioConsumoCompetencia}
                        onChange={(e) => setRateioConsumoCompetencia(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Tipo
                      <select
                        value={rateioConsumoTipo}
                        onChange={(e) => setRateioConsumoTipo(e.target.value)}
                      >
                        <option value="Agua">Agua</option>
                        <option value="Gas">Gas</option>
                        <option value="Energia">Energia</option>
                        <option value="Outro">Outro</option>
                        <option value="Todos">Todos</option>
                      </select>
                    </label>
                  </div>

                  <div className="finance-form-grid">
                    <label>
                      Valor total da conta
                      <input
                        value={rateioConsumoValorTotal}
                        onChange={(e) => setRateioConsumoValorTotal(e.target.value)}
                        placeholder="Ex.: 1200,50"
                        required
                      />
                    </label>
                    <label>
                      Vencimento
                      <input
                        type="date"
                        value={rateioConsumoVencimento}
                        onChange={(e) => setRateioConsumoVencimento(e.target.value)}
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Descricao
                    <input
                      value={rateioConsumoDescricao}
                      onChange={(e) => setRateioConsumoDescricao(e.target.value)}
                      placeholder={`Consumo ${rateioConsumoTipo} ${rateioConsumoCompetencia}`}
                    />
                  </label>

                  <label>
                    Categoria de receita
                    <select
                      value={rateioConsumoCategoriaId}
                      onChange={(e) => setRateioConsumoCategoriaId(e.target.value)}
                    >
                      <option value="">Sem categoria</option>
                      {categoriasReceita.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="finance-form-inline">
                    <button
                      type="button"
                      onClick={() => void simularRateioConsumo()}
                      disabled={!token || rateioConsumoLoading}
                    >
                      {rateioConsumoLoading ? "Simulando..." : "Simular rateio"}
                    </button>
                    <button type="submit" disabled={!token || rateioConsumoLoading}>
                      {rateioConsumoLoading ? "Gerando..." : "Gerar cobrancas"}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="finance-form-sub">
                  Sem acesso para gerar cobrancas por consumo.
                </p>
              )}

              {rateioConsumoPreview.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Unidade</th>
                        <th className="finance-value-header">Consumo</th>
                        <th className="finance-value-header">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateioConsumoPreview.map((item) => (
                        <tr key={item.unidadeId}>
                          <td>{item.unidadeLabel}</td>
                          <td className="finance-value-cell">
                            {formatarConsumo(item.consumo)}
                          </td>
                          <td className="finance-value-cell">
                            {formatarValor(item.valor)}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td>
                          <strong>Total</strong>
                        </td>
                        <td className="finance-value-cell">
                          <strong>{formatarConsumo(totalConsumoRateio)}</strong>
                        </td>
                        <td className="finance-value-cell">
                          <strong>{formatarValor(totalValorRateio)}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="finance-side-column">
            <section className="finance-table-card">
              <div className="finance-table-header">
                <div>
                  <h3>Medidores cadastrados</h3>
                  <p className="finance-form-sub">
                    {medidoresConsumo.length} medidores • {medidoresAtivos} ativos
                  </p>
                </div>
                <button
                  type="button"
                  onClick={carregarMedidoresConsumo}
                  disabled={consumoLoading || !token}
                >
                  {consumoLoading ? "Carregando..." : "Atualizar lista"}
                </button>
              </div>

              <table className="table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Unidade</th>
                    <th>Tipo</th>
                    <th>Medida</th>
                    <th>Status</th>
                    {canWrite && <th>Acoes</th>}
                  </tr>
                </thead>
                <tbody>
                  {medidoresConsumo.map((medidor) => (
                    <tr key={medidor.id}>
                      <td>{medidor.nome}</td>
                      <td>
                        {unidadesRateioPorId[medidor.unidadeOrganizacionalId] ??
                          medidor.unidadeOrganizacionalId}
                      </td>
                      <td>{medidor.tipo}</td>
                      <td>{medidor.unidadeMedida}</td>
                      <td>
                        <span
                          className={
                            "badge-status " +
                            (medidor.ativo
                              ? "badge-status--ativo"
                              : "badge-status--inativo")
                          }
                        >
                          {medidor.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      {canWrite && (
                        <td>
                          <div className="finance-table-actions">
                            <button
                              type="button"
                              className="action-secondary"
                              onClick={() =>
                                setMedidorSelecionadoId(medidor.id)
                              }
                              disabled={medidorSelecionadoId === medidor.id}
                            >
                              {medidorSelecionadoId === medidor.id
                                ? "Selecionado"
                                : "Selecionar"}
                            </button>
                            <button
                              type="button"
                              className="action-secondary"
                              onClick={() => void editarMedidorConsumo(medidor)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="action-secondary"
                              onClick={() =>
                                void alternarStatusMedidorConsumo(medidor)
                              }
                            >
                              {medidor.ativo ? "Desativar" : "Ativar"}
                            </button>
                            <button
                              type="button"
                              className="action-secondary"
                              onClick={() => void removerMedidorConsumo(medidor)}
                            >
                              Remover
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {medidoresConsumo.length === 0 && (
                    <tr>
                      <td colSpan={canWrite ? 6 : 5} style={{ textAlign: "center" }}>
                        Nenhum medidor cadastrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="finance-table-card">
              <div className="finance-table-header">
                <div>
                  <h3>Leituras do medidor</h3>
                  <p className="finance-form-sub">
                    {medidorSelecionado
                      ? `${medidorSelecionado.nome} • ${medidorSelecionado.tipo}`
                      : "Selecione um medidor para visualizar"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    medidorSelecionadoId &&
                    carregarLeiturasConsumo(medidorSelecionadoId)
                  }
                  disabled={!medidorSelecionadoId || consumoLoading || !token}
                >
                  {consumoLoading ? "Carregando..." : "Atualizar leituras"}
                </button>
              </div>

              <div className="finance-card-grid" style={{ marginTop: 8 }}>
                <div className="finance-card">
                  <strong>Total consumido</strong>
                  <p>
                    {formatarConsumo(totalConsumoMedidor)}{" "}
                    {medidorSelecionado?.unidadeMedida ?? ""}
                  </p>
                </div>
                <div className="finance-card">
                  <strong>Media por leitura</strong>
                  <p>
                    {formatarConsumo(mediaConsumoMedidor)}{" "}
                    {medidorSelecionado?.unidadeMedida ?? ""}
                  </p>
                </div>
                <div className="finance-card">
                  <strong>Ultima leitura</strong>
                  <p>
                    {ultimaLeituraConsumo
                      ? formatarConsumo(ultimaLeituraConsumo.leituraAtual)
                      : "-"}{" "}
                    {medidorSelecionado?.unidadeMedida ?? ""}
                  </p>
                </div>
              </div>

              <table className="table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Competencia</th>
                    <th>Data</th>
                    <th className="finance-value-header">Anterior</th>
                    <th className="finance-value-header">Atual</th>
                    <th className="finance-value-header">Consumo</th>
                    <th>Obs.</th>
                    {canWrite && <th>Acoes</th>}
                  </tr>
                </thead>
                <tbody>
                  {leiturasConsumoOrdenadas.map((leitura) => (
                    <tr key={leitura.id}>
                      <td>{leitura.competencia}</td>
                      <td>{formatarData(leitura.dataLeitura)}</td>
                      <td className="finance-value-cell">
                        {formatarConsumo(leitura.leituraAnterior)}
                      </td>
                      <td className="finance-value-cell">
                        {formatarConsumo(leitura.leituraAtual)}
                      </td>
                      <td className="finance-value-cell">
                        {formatarConsumo(leitura.consumo)}
                      </td>
                      <td>{leitura.observacao ?? "-"}</td>
                      {canWrite && (
                        <td>
                          <div className="finance-table-actions">
                            <button
                              type="button"
                              className="action-secondary"
                              onClick={() => void editarLeituraConsumo(leitura)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="action-secondary"
                              onClick={() => void removerLeituraConsumo(leitura)}
                            >
                              Remover
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {leiturasConsumoOrdenadas.length === 0 && (
                    <tr>
                      <td colSpan={canWrite ? 7 : 6} style={{ textAlign: "center" }}>
                        Nenhuma leitura cadastrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      )}

      {aba === "receitasDespesas" && (
        <div className="finance-table-card" style={{ marginTop: 12 }}>
          <div className="finance-table-header">
            <div>
              <h3>Receitas e despesas</h3>
              <p className="finance-form-sub">
                Visao consolidada para acompanhar entradas, saidas e saldo.
              </p>
            </div>
            <div className="finance-card-actions">
              <button type="button" onClick={() => handleAbaChange("contasPagar")}>
                Ir para contas a pagar
              </button>
              <button type="button" onClick={() => handleAbaChange("contasReceber")}>
                Ir para contas a receber
              </button>
            </div>
          </div>

          <div className="finance-card-grid" style={{ marginTop: 10 }}>
            <div className="finance-card">
              <strong>Receitas no periodo</strong>
              <p>
                {totalReceitas.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                })}
              </p>
            </div>
            <div className="finance-card">
              <strong>Despesas no periodo</strong>
              <p>
                {totalDespesas.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                })}
              </p>
            </div>
            <div className="finance-card">
              <strong>Saldo do periodo</strong>
              <p>
                {saldoPeriodo.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                })}
              </p>
            </div>
          </div>

          <table className="table finance-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Descricao</th>
                <th>Vencimento</th>
                <th className="finance-value-header">Valor</th>
                <th>Situacao</th>
              </tr>
            </thead>
            <tbody>
              {ultimosLancamentos.map((lanc) => (
                <tr key={lanc.id}>
                  <td>{lanc.tipo === "pagar" ? "Despesa" : "Receita"}</td>
                  <td>{lanc.descricao}</td>
                  <td>
                    {lanc.dataVencimento
                      ? new Date(lanc.dataVencimento).toLocaleDateString("pt-BR")
                      : "-"}
                  </td>
                  <td className="finance-value-cell">
                    {lanc.valor.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL"
                    })}
                  </td>
                  <td>{statusMeta(lanc.situacao).label}</td>
                </tr>
              ))}
              {ultimosLancamentos.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    Nenhum lancamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {aba === "transferencias" && (
        <div className="finance-layout">
          <div className="finance-side-column">{renderTransferenciaForm()}</div>
          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Historico de transferencias</h3>
              </div>
            </div>

            <div className="finance-card-grid" style={{ marginTop: 8 }}>
              <div className="finance-card">
                <strong>Total transferido</strong>
                <p>{formatarValor(totalTransferido)}</p>
              </div>
              <div className="finance-card">
                <strong>Movimentos</strong>
                <p>{transferenciasAgrupadas.length}</p>
              </div>
            </div>

            <table className="table finance-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Descricao</th>
                  <th>Data</th>
                  <th className="finance-value-header">Valor</th>
                  <th>Referencia</th>
                  <th>Situacao</th>
                </tr>
              </thead>
              <tbody>
                {transferenciasAgrupadas.map((item) => (
                  <tr key={item.chave}>
                    <td>{contasPorId[item.origemId ?? ""] ?? "-"}</td>
                    <td>{contasPorId[item.destinoId ?? ""] ?? "-"}</td>
                    <td>{item.descricao}</td>
                    <td>{item.data ? formatarData(item.data) : "-"}</td>
                    <td className="finance-value-cell">
                      {formatarValor(item.valor)}
                    </td>
                    <td>{item.referencia}</td>
                    <td>{statusMeta(item.status).label}</td>
                  </tr>
                ))}
                {transferenciasAgrupadas.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center" }}>
                      Nenhuma transferencia registrada no periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {aba === "contasPagar" && (
        <div className="finance-table-card" style={{ marginTop: 12 }}>
          <div className="finance-table-header">
            <div>
              <h3>Contas a pagar</h3>
              <p className="finance-form-sub">
                Gerencie despesas e vencimentos do condominio.
              </p>
            </div>
            <button
              type="button"
              className="button-secondary"
              onClick={() => handleAbaChange("contas")}
            >
              Voltar
            </button>
          </div>

          {canWrite ? (
            <form
              onSubmit={criarDespesa}
              className="form"
              style={{ marginTop: 12, marginBottom: 12 }}
            >
              <label>
                Descrição
                <input
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Ex.: Conta de energia"
                />
              </label>
              <div className="finance-form-grid">
                <label>
                  Vencimento
                  <input
                    type="date"
                    value={novoVencimento}
                    onChange={(e) => setNovoVencimento(e.target.value)}
                  />
                </label>
                <label>
                  Valor
                  <input
                    value={novoValor}
                    onChange={(e) => setNovoValor(e.target.value)}
                    placeholder="Ex.: 150,00"
                  />
                </label>
              </div>
              <label>
                Categoria de despesa
                <select
                  value={novaDespesaCategoriaId}
                  onChange={(e) => setNovaDespesaCategoriaId(e.target.value)}
                  required
                >
                  <option value="">Selecione uma categoria</option>
                  {categoriasDespesa.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.codigo} - {cat.nome}
                    </option>
                  ))}
                </select>
              </label>
              <div className="finance-form-grid">
                <label>
                  Conta financeira
                  <select
                    value={novaDespesaContaId}
                    onChange={(e) => setNovaDespesaContaId(e.target.value)}
                  >
                    <option value="">Selecionar automaticamente</option>
                    {contas.map((conta) => (
                      <option key={conta.id} value={conta.id}>
                        {conta.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fornecedor / Favorecido
                  <select
                    value={novaDespesaPessoaId}
                    onChange={(e) => setNovaDespesaPessoaId(e.target.value)}
                  >
                    <option value="">Selecionar automaticamente</option>
                    {pessoasFinanceiro.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="finance-form-grid">
                <label>
                  Forma de pagamento
                  <select
                    value={novaDespesaFormaPagamento}
                    onChange={(e) => setNovaDespesaFormaPagamento(e.target.value)}
                  >
                    <option value="boleto">Boleto</option>
                    <option value="pix">Pix</option>
                    <option value="transferencia">Transferência</option>
                    <option value="cartao">Cartão</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="indefinido">Indefinido</option>
                  </select>
                </label>
                <label>
                  Referência
                  <input
                    value={novaDespesaReferencia}
                    onChange={(e) => setNovaDespesaReferencia(e.target.value)}
                    placeholder="Ex.: NF 12345 / Fevereiro"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={
                  loading ||
                  !novaDescricao.trim() ||
                  !novoVencimento ||
                  !novoValor ||
                  !novaDespesaCategoriaId
                }
              >
                {loading ? "Salvando..." : "Criar despesa"}
              </button>
            </form>
          ) : (
            <p className="finance-form-sub">Sem acesso para criar despesas.</p>
          )}

          <button
            type="button"
            onClick={carregarDespesas}
            disabled={loading}
            style={{ marginBottom: 12 }}
          >
            {loading ? "Carregando..." : "Atualizar lista"}
          </button>

          {erro && <p className="error">{erro}</p>}

          <div className="finance-card-list">
            {despesasValidas.map((d) => {
              const situacao = normalizarSituacao(d.situacao);
              const statusInfo = statusMeta(d.situacao);
              const primaryAction: {
                label: string;
                action: "aprovar" | "pagar" | "conciliar" | "fechar" | "reabrir";
              } | null =
                canWrite && situacao === "aberto" && isAdmin
                  ? { label: "Aprovar", action: "aprovar" }
                  : canWrite && situacao === "aprovado" && (isAdmin || isStaff)
                  ? { label: "Marcar como pago", action: "pagar" }
                  : canWrite && situacao === "pago" && (isAdmin || isStaff)
                  ? { label: "Conciliar", action: "conciliar" }
                  : canWrite && situacao === "conciliado" && isAdmin
                  ? { label: "Fechar", action: "fechar" }
                  : canWrite && situacao === "fechado" && isPlatformAdmin
                  ? { label: "Reabrir", action: "reabrir" }
                  : null;
              const podeCancelar =
                canWrite &&
                isAdmin &&
                (situacao === "aberto" || situacao === "aprovado");
              return (
                <div key={d.id} className="finance-item-card">
                  <div className="finance-item-main">
                    <div>
                      <strong className="finance-item-title">
                        {d.descricao}
                      </strong>
                      <div className="finance-item-sub">
                        {categoriasDespesaPorId[d.planoContasId] ?? "-"} •{" "}
                        {d.dataVencimento
                          ? new Date(d.dataVencimento).toLocaleDateString(
                              "pt-BR"
                            )
                          : "-"}{" "}
                        • {d.formaPagamento || "indefinido"}
                      </div>
                    </div>
                    <div className="finance-item-right">
                      <span className="finance-value">
                        {d.valor.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        })}
                      </span>
                      <span
                        className={`badge-status ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                  <div className="finance-item-actions">
                    {primaryAction && (
                      <button
                        type="button"
                        className="action-primary"
                        disabled={loading}
                        onClick={() =>
                          executarAcaoLancamento(
                            "pagar",
                            primaryAction.action,
                            d.id
                          )
                        }
                      >
                        {primaryAction.label}
                      </button>
                    )}
                    {podeCancelar && (
                      <button
                        type="button"
                        className="action-secondary"
                        disabled={loading}
                        onClick={async () => {
                          if (!window.confirm("Cancelar esta despesa?")) return;
                          await executarAcaoLancamento("pagar", "cancelar", d.id);
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        setLancamentoSelecionado(d);
                        setAutoOpenAnexoId(d.id);
                      }}
                    >
                      Anexos
                    </button>
                  </div>
                </div>
              );
            })}
            {despesasValidas.length === 0 && (
              <p className="empty">Nenhuma despesa cadastrada ainda.</p>
            )}
          </div>

          {lancamentoSelecionado && lancamentoSelecionado.tipo === "pagar" && (
            <section className="finance-form-card" style={{ marginTop: 12 }}>
              <div className="finance-table-header">
                <h3>Anexos do lançamento</h3>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setLancamentoSelecionado(null);
                    setAutoOpenAnexoId(null);
                  }}
                >
                  Fechar
                </button>
              </div>
              <AnexosPanel
                organizacaoId={organizacao.id}
                tipoEntidade="lancamento_financeiro"
                entidadeId={lancamentoSelecionado.id}
                titulo="Comprovantes e anexos"
                readOnly={!canAnexos}
                autoOpenSelector={autoOpenAnexoId === lancamentoSelecionado.id}
                onAutoOpenHandled={() => setAutoOpenAnexoId(null)}
              />
            </section>
          )}
        </div>
      )}

      {aba === "contasReceber" && (
        <div className="finance-table-card" style={{ marginTop: 12 }}>
          <div className="finance-table-header">
            <div>
              <h3>Contas a receber</h3>
              <p className="finance-form-sub">
                Controle receitas e recebimentos previstos.
              </p>
            </div>
            <button
              type="button"
              className="button-secondary"
              onClick={() => handleAbaChange("contas")}
            >
              Voltar
            </button>
          </div>

          {canWrite ? (
            <form
              onSubmit={criarReceita}
              className="form"
              style={{ marginTop: 12, marginBottom: 12 }}
            >
              <label>
                Descrição
                <input
                  value={novaReceitaDescricao}
                  onChange={(e) =>
                    setNovaReceitaDescricao(e.target.value)
                  }
                  placeholder="Ex.: Taxa condominial janeiro"
                />
              </label>
              <div className="finance-form-grid">
                <label>
                  Vencimento
                  <input
                    type="date"
                    value={novaReceitaVencimento}
                    onChange={(e) =>
                      setNovaReceitaVencimento(e.target.value)
                    }
                  />
                </label>
                <label>
                  Valor
                  <input
                    value={novaReceitaValor}
                    onChange={(e) =>
                      setNovaReceitaValor(e.target.value)
                    }
                    placeholder="Ex.: 300,00"
                  />
                </label>
              </div>
              <label>
                Categoria de receita
                <select
                  value={novaReceitaCategoriaId}
                  onChange={(e) => setNovaReceitaCategoriaId(e.target.value)}
                  required
                >
                  <option value="">Selecione uma categoria</option>
                  {categoriasReceita.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.codigo} - {cat.nome}
                    </option>
                  ))}
                </select>
              </label>
              <div className="finance-form-grid">
                <label>
                  Conta financeira
                  <select
                    value={novaReceitaContaId}
                    onChange={(e) => setNovaReceitaContaId(e.target.value)}
                  >
                    <option value="">Selecionar automaticamente</option>
                    {contas.map((conta) => (
                      <option key={conta.id} value={conta.id}>
                        {conta.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Pagador / Cliente
                  <select
                    value={novaReceitaPessoaId}
                    onChange={(e) => setNovaReceitaPessoaId(e.target.value)}
                  >
                    <option value="">Selecionar automaticamente</option>
                    {pessoasFinanceiro.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="finance-form-grid">
                <label>
                  Forma de recebimento
                  <select
                    value={novaReceitaFormaPagamento}
                    onChange={(e) => setNovaReceitaFormaPagamento(e.target.value)}
                  >
                    <option value="pix">Pix</option>
                    <option value="boleto">Boleto</option>
                    <option value="transferencia">Transferência</option>
                    <option value="cartao">Cartão</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="indefinido">Indefinido</option>
                  </select>
                </label>
                <label>
                  Referência
                  <input
                    value={novaReceitaReferencia}
                    onChange={(e) => setNovaReceitaReferencia(e.target.value)}
                    placeholder="Ex.: Cota Março / Unidade 101"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={
                  loading ||
                  !novaReceitaDescricao.trim() ||
                  !novaReceitaVencimento ||
                  !novaReceitaValor ||
                  !novaReceitaCategoriaId
                }
              >
                {loading ? "Salvando..." : "Criar receita"}
              </button>
            </form>
          ) : (
            <p className="finance-form-sub">Sem acesso para criar receitas.</p>
          )}

          <button
            type="button"
            onClick={carregarReceitas}
            disabled={loading}
            style={{ marginBottom: 12 }}
          >
            {loading ? "Carregando..." : "Atualizar lista"}
          </button>

          {erro && <p className="error">{erro}</p>}

          <div className="finance-card-list">
            {receitasValidas.map((r) => {
              const situacao = normalizarSituacao(r.situacao);
              const statusInfo = statusMeta(r.situacao);
              const primaryAction: {
                label: string;
                action: "aprovar" | "pagar" | "conciliar" | "fechar" | "reabrir";
              } | null =
                canWrite && situacao === "aberto" && isAdmin
                  ? { label: "Aprovar", action: "aprovar" }
                  : canWrite && situacao === "aprovado" && (isAdmin || isStaff)
                  ? { label: "Marcar como pago", action: "pagar" }
                  : canWrite && situacao === "pago" && (isAdmin || isStaff)
                  ? { label: "Conciliar", action: "conciliar" }
                  : canWrite && situacao === "conciliado" && isAdmin
                  ? { label: "Fechar", action: "fechar" }
                  : canWrite && situacao === "fechado" && isPlatformAdmin
                  ? { label: "Reabrir", action: "reabrir" }
                  : null;
              const podeCancelar =
                canWrite &&
                isAdmin &&
                (situacao === "aberto" || situacao === "aprovado");
              return (
                <div key={r.id} className="finance-item-card">
                  <div className="finance-item-main">
                    <div>
                      <strong className="finance-item-title">
                        {r.descricao}
                      </strong>
                      <div className="finance-item-sub">
                        {categoriasReceitaPorId[r.planoContasId] ?? "-"} •{" "}
                        {r.dataVencimento
                          ? new Date(r.dataVencimento).toLocaleDateString(
                              "pt-BR"
                            )
                          : "-"}{" "}
                        • {r.formaPagamento || "indefinido"}
                      </div>
                    </div>
                    <div className="finance-item-right">
                      <span className="finance-value">
                        {r.valor.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        })}
                      </span>
                      <span
                        className={`badge-status ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                  <div className="finance-item-actions">
                    {primaryAction && (
                      <button
                        type="button"
                        className="action-primary"
                        disabled={loading}
                        onClick={() =>
                          executarAcaoLancamento(
                            "receber",
                            primaryAction.action,
                            r.id
                          )
                        }
                      >
                        {primaryAction.label}
                      </button>
                    )}
                    {podeCancelar && (
                      <button
                        type="button"
                        className="action-secondary"
                        disabled={loading}
                        onClick={async () => {
                          if (!window.confirm("Cancelar esta receita?")) return;
                          await executarAcaoLancamento(
                            "receber",
                            "cancelar",
                            r.id
                          );
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        setLancamentoSelecionado(r);
                        setAutoOpenAnexoId(r.id);
                      }}
                    >
                      Anexos
                    </button>
                  </div>
                </div>
              );
            })}
            {receitasValidas.length === 0 && (
              <p className="empty">Nenhuma receita cadastrada ainda.</p>
            )}
          </div>

          {lancamentoSelecionado && lancamentoSelecionado.tipo === "receber" && (
            <section className="finance-form-card" style={{ marginTop: 12 }}>
              <div className="finance-table-header">
                <h3>Anexos do lançamento</h3>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setLancamentoSelecionado(null);
                    setAutoOpenAnexoId(null);
                  }}
                >
                  Fechar
                </button>
              </div>
              <AnexosPanel
                organizacaoId={organizacao.id}
                tipoEntidade="lancamento_financeiro"
                entidadeId={lancamentoSelecionado.id}
                titulo="Comprovantes e anexos"
                readOnly={!canAnexos}
                autoOpenSelector={autoOpenAnexoId === lancamentoSelecionado.id}
                onAutoOpenHandled={() => setAutoOpenAnexoId(null)}
              />
            </section>
          )}
        </div>
      )}

      {aba === "previsaoOrcamentaria" && (
        <div className="finance-layout">
          <section className="finance-form-card">
            <h3>Nova previsao</h3>
            <p className="finance-form-sub">
              Planejamento mensal por categoria para acompanhar o orcamento.
            </p>

            {previsaoErro && <p className="error">{previsaoErro}</p>}

            {canWrite ? (
              <form className="form" onSubmit={criarPrevisaoOrcamentaria}>
                <div className="finance-form-grid">
                  <label>
                    Ano
                    <input
                      type="number"
                      min={2000}
                      value={previsaoAno}
                      onChange={(e) => setPrevisaoAno(Number(e.target.value))}
                      required
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={previsaoTipo}
                      onChange={(e) =>
                        setPrevisaoTipo(
                          e.target.value === "Despesa" ? "Despesa" : "Receita"
                        )
                      }
                    >
                      <option value="Receita">Receita</option>
                      <option value="Despesa">Despesa</option>
                    </select>
                  </label>
                </div>

                <label>
                  Categoria
                  <select
                    value={previsaoCategoriaId}
                    onChange={(e) => setPrevisaoCategoriaId(e.target.value)}
                    required
                  >
                    <option value="">Selecione</option>
                    {categoriasPrevisao.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.codigo} - {cat.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="finance-form-grid">
                  <label>
                    Mes
                    <select
                      value={previsaoMes}
                      onChange={(e) => setPrevisaoMes(Number(e.target.value))}
                    >
                      {mesesLabel.map((mes, idx) => (
                        <option key={mes} value={idx + 1}>
                          {mes}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Valor previsto
                    <input
                      value={previsaoValor}
                      onChange={(e) => setPrevisaoValor(e.target.value)}
                      placeholder="Ex.: 1.500,00"
                      required
                    />
                  </label>
                </div>

                <label>
                  Observacao
                  <input
                    value={previsaoObservacao}
                    onChange={(e) => setPrevisaoObservacao(e.target.value)}
                    placeholder="Opcional"
                  />
                </label>

                <button type="submit" disabled={!token || previsaoLoading}>
                  {previsaoLoading ? "Salvando..." : "Salvar previsao"}
                </button>
              </form>
            ) : (
              <p className="finance-form-sub">
                Sem acesso para criar previsoes orcamentarias.
              </p>
            )}
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Previsoes cadastradas</h3>
                <p className="finance-form-sub">
                  {previsaoTipo} • {previsaoAno}
                </p>
              </div>
              <button
                type="button"
                onClick={carregarPrevisoesOrcamentarias}
                disabled={previsaoLoading || !token}
              >
                {previsaoLoading ? "Carregando..." : "Atualizar lista"}
              </button>
            </div>

            <div className="finance-card-grid" style={{ marginTop: 8 }}>
              <div className="finance-card">
                <strong>Total previsto</strong>
                <p>{formatarValor(totalPrevistoPrevisao)}</p>
              </div>
              <div className="finance-card">
                <strong>Total realizado</strong>
                <p>{formatarValor(totalRealizadoPrevisao)}</p>
              </div>
              <div className="finance-card">
                <strong>Desvio</strong>
                <p>{formatarValor(totalDesvioPrevisao)}</p>
              </div>
            </div>

            <table className="table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Categoria</th>
                  <th className="finance-value-header">Previsto</th>
                  <th className="finance-value-header">Realizado</th>
                  <th className="finance-value-header">Desvio</th>
                  <th>Obs.</th>
                  {canWrite && <th>Acoes</th>}
                </tr>
              </thead>
              <tbody>
                {previsoesOrdenadas.map((item) => {
                  const key = `${item.planoContasId}-${item.mes}`;
                  const realizado = realizadosPorCategoriaMes[key] ?? 0;
                  const desvio = realizado - item.valorPrevisto;
                  return (
                    <tr key={item.id}>
                      <td>{mesesLabel[item.mes - 1] ?? item.mes}</td>
                      <td>
                        {categoriasPrevisaoPorId[item.planoContasId] ??
                          item.planoContasId}
                      </td>
                      <td className="finance-value-cell">
                        {formatarValor(item.valorPrevisto)}
                      </td>
                      <td className="finance-value-cell">
                        {formatarValor(realizado)}
                      </td>
                      <td className="finance-value-cell">
                        {formatarValor(desvio)}
                      </td>
                      <td>{item.observacao ?? "-"}</td>
                      {canWrite && (
                        <td>
                          <div className="finance-table-actions">
                            <button
                              type="button"
                              className="action-secondary"
                              onClick={() => void atualizarPrevisaoOrcamentaria(item)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="action-secondary"
                              onClick={() => void removerPrevisaoOrcamentaria(item)}
                            >
                              Remover
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {previsoesOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 7 : 6} style={{ textAlign: "center" }}>
                      Nenhuma previsao cadastrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {abonoSelecionadoId && (
              <section className="finance-form-card" style={{ marginTop: 12 }}>
                <div className="finance-table-header">
                  <h4>Anexos do abono</h4>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setAbonoSelecionadoId(null);
                      setAutoOpenAbonoAnexoId(null);
                    }}
                  >
                    Fechar
                  </button>
                </div>
                <AnexosPanel
                  organizacaoId={organizacao.id}
                  tipoEntidade="abono_financeiro"
                  entidadeId={abonoSelecionadoId}
                  titulo="Comprovantes e anexos"
                  readOnly={!canAnexos}
                  autoOpenSelector={autoOpenAbonoAnexoId === abonoSelecionadoId}
                  onAutoOpenHandled={() => setAutoOpenAbonoAnexoId(null)}
                />
              </section>
            )}
          </section>
        </div>
      )}

      {aba === "abonos" && (
        <div className="finance-layout">
          <section className="finance-form-card">
            <h3>Novo abono</h3>
            <p className="finance-form-sub">
              Registre descontos ou creditos para lancamentos a receber.
            </p>

            {abonoErro && <p className="error">{abonoErro}</p>}

            {canWrite ? (
              <form className="form" onSubmit={criarAbono}>
                <label>
                  Lancamento
                  <select
                    value={abonoLancamentoId}
                    onChange={(e) => setAbonoLancamentoId(e.target.value)}
                    required
                  >
                    <option value="">Selecionar</option>
                    {receitasElegiveisAbono.map((receita) => (
                      <option key={receita.id} value={receita.id}>
                        {receita.descricao} •{" "}
                        {formatarValor(receita.valor)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="finance-form-grid">
                  <label>
                    Tipo
                    <select
                      value={abonoTipo}
                      onChange={(e) =>
                        setAbonoTipo(
                          e.target.value === "percentual"
                            ? "percentual"
                            : "valor"
                        )
                      }
                    >
                      <option value="valor">Valor fixo</option>
                      <option value="percentual">Percentual</option>
                    </select>
                  </label>
                  {abonoTipo === "percentual" ? (
                    <label>
                      Percentual (%)
                      <input
                        value={abonoPercentual}
                        onChange={(e) => setAbonoPercentual(e.target.value)}
                        placeholder="Ex.: 10"
                        required
                      />
                    </label>
                  ) : (
                    <label>
                      Valor do abono
                      <input
                        value={abonoValor}
                        onChange={(e) => setAbonoValor(e.target.value)}
                        placeholder="Ex.: 150,00"
                        required
                      />
                    </label>
                  )}
                </div>

                {abonoTipo === "percentual" && abonoLancamentoSelecionado && (
                  <p className="finance-form-sub">
                    Valor estimado: {formatarValor(abonoValorEstimado)}
                  </p>
                )}

                <label>
                  Motivo
                  <input
                    value={abonoMotivo}
                    onChange={(e) => setAbonoMotivo(e.target.value)}
                    placeholder="Ex.: boa conduta, acordo"
                    required
                  />
                </label>

                <label>
                  Observacao
                  <input
                    value={abonoObservacao}
                    onChange={(e) => setAbonoObservacao(e.target.value)}
                    placeholder="Opcional"
                  />
                </label>

                <button type="submit" disabled={!token || abonoLoading}>
                  {abonoLoading ? "Salvando..." : "Solicitar abono"}
                </button>
              </form>
            ) : (
              <p className="finance-form-sub">Sem acesso para criar abonos.</p>
            )}

            {receitasElegiveisAbono.length === 0 && (
              <p className="finance-form-sub">
                Nenhum lancamento elegivel encontrado para abono.
              </p>
            )}
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Abonos cadastrados</h3>
                <p className="finance-form-sub">
                  {abonosPendentes} pendentes • {abonosEmAnalise} em analise •{" "}
                  {abonosAprovados} aprovados • {abonosCancelados} cancelados
                </p>
              </div>
              <button
                type="button"
                onClick={carregarAbonos}
                disabled={abonoLoading || !token}
              >
                {abonoLoading ? "Carregando..." : "Atualizar lista"}
              </button>
            </div>

            <table className="table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Lancamento</th>
                  <th>Tipo</th>
                  <th className="finance-value-header">Valor</th>
                  <th>Motivo</th>
                  <th>Status</th>
                  <th>Solicitado</th>
                  {canWrite && <th>Acoes</th>}
                </tr>
              </thead>
              <tbody>
                {abonosOrdenados.map((abono) => {
                  const statusInfo = statusAbonoMeta(abono.status);
                  return (
                    <tr key={abono.id}>
                      <td>
                        {receitasLabelPorId[abono.lancamentoFinanceiroId] ??
                          abono.lancamentoFinanceiroId}
                      </td>
                      <td>
                        {abono.tipo === "percentual"
                          ? `Percentual${abono.percentual ? ` (${abono.percentual}%)` : ""}`
                          : "Valor"}
                      </td>
                      <td className="finance-value-cell">
                        {formatarValor(abono.valor)}
                      </td>
                      <td>{abono.motivo}</td>
                      <td>
                        <span className={`badge-status ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td>{formatarData(abono.dataSolicitacao)}</td>
                      {canWrite && (
                        <td>
                          <div className="finance-table-actions">
                            {abono.status === "pendente" && (
                              <>
                                <button
                                  type="button"
                                  className="action-secondary"
                                  onClick={() =>
                                    void atualizarStatusAbono(abono, "em_analise")
                                  }
                                  disabled={abonoLoading}
                                >
                                  Enviar para analise
                                </button>
                                <button
                                  type="button"
                                  className="action-secondary"
                                  onClick={() =>
                                    void atualizarStatusAbono(abono, "cancelado")
                                  }
                                  disabled={abonoLoading}
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                            {abono.status === "em_analise" && (
                              <>
                                <button
                                  type="button"
                                  className="action-secondary"
                                  onClick={() =>
                                    void atualizarStatusAbono(abono, "aprovado")
                                  }
                                  disabled={abonoLoading}
                                >
                                  Aprovar
                                </button>
                                <button
                                  type="button"
                                  className="action-secondary"
                                  onClick={() =>
                                    void atualizarStatusAbono(abono, "cancelado")
                                  }
                                  disabled={abonoLoading}
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="action-secondary"
                              onClick={() => void removerAbono(abono)}
                              disabled={abono.status === "aprovado" || abonoLoading}
                            >
                              Remover
                            </button>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => {
                                setAbonoSelecionadoId(abono.id);
                                setAutoOpenAbonoAnexoId(abono.id);
                              }}
                            >
                              Anexos
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {abonosOrdenados.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 7 : 6} style={{ textAlign: "center" }}>
                      Nenhum abono cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {aba === "baixasManuais" && (
        <div className="finance-layout">
          <div className="finance-side-column">
            <section className="finance-form-card">
            <h3>Baixa manual</h3>
            <p className="finance-form-sub">
              Registre pagamentos/recebimentos feitos fora do fluxo automatico.
            </p>

            {baixaErro && <p className="error">{baixaErro}</p>}

            {canWrite ? (
              <form className="form" onSubmit={baixarLancamentoManual}>
                <label>
                  Lancamento pendente
                  <select
                    value={baixaLancamentoId}
                    onChange={(e) => setBaixaLancamentoId(e.target.value)}
                    required
                  >
                    <option value="">Selecionar</option>
                    {pendentesParaBaixaOrdenados.map((lanc) => (
                      <option key={lanc.id} value={lanc.id}>
                        {lanc.tipo === "pagar" ? "Pagar" : "Receber"} •{" "}
                        {lanc.descricao} • {formatarValor(lanc.valor)}
                      </option>
                    ))}
                  </select>
                </label>

                {baixaLancamentoSelecionado && (
                  <div className="finance-card-grid" style={{ marginTop: 8 }}>
                    <div className="finance-card">
                      <strong>Valor</strong>
                      <p>{formatarValor(baixaLancamentoSelecionado.valor)}</p>
                    </div>
                    <div className="finance-card">
                      <strong>Vencimento</strong>
                      <p>{formatarData(baixaLancamentoSelecionado.dataVencimento)}</p>
                    </div>
                    <div className="finance-card">
                      <strong>Pessoa</strong>
                      <p>
                        {pessoasPorId[baixaLancamentoSelecionado.pessoaId] ??
                          "Nao informado"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="finance-form-grid">
                  <label>
                    Data da baixa
                    <input
                      type="date"
                      value={baixaData}
                      onChange={(e) => setBaixaData(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Valor pago
                    <input
                      value={baixaValorPago}
                      onChange={(e) => setBaixaValorPago(e.target.value)}
                      placeholder={
                        baixaLancamentoSelecionado
                          ? saldoLancamento > 0
                            ? formatarValor(saldoLancamento)
                            : "Saldo quitado"
                          : "Ex.: 1.500,00"
                      }
                    />
                  </label>
                </div>

                {baixaLancamentoSelecionado && (
                  <div className="finance-card-grid" style={{ marginTop: 8 }}>
                    <div className="finance-card">
                      <strong>Total pago</strong>
                      <p>{formatarValor(totalPagoLancamento)}</p>
                    </div>
                    <div className="finance-card">
                      <strong>{saldoLancamento < 0 ? "Credito" : "Saldo"}</strong>
                      <p>{formatarValor(saldoLancamentoAbs)}</p>
                    </div>
                  </div>
                )}

                <div className="finance-form-grid">
                  <label>
                    Conta financeira
                    <select
                      value={baixaContaId}
                      onChange={(e) => setBaixaContaId(e.target.value)}
                    >
                      <option value="">Selecionar</option>
                      {contasAtivasLista.map((conta) => (
                        <option key={conta.id} value={conta.id}>
                          {conta.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Forma de pagamento
                    <select
                      value={baixaFormaPagamento}
                      onChange={(e) => setBaixaFormaPagamento(e.target.value)}
                    >
                      <option value="pix">Pix</option>
                      <option value="boleto">Boleto</option>
                      <option value="transferencia">Transferência</option>
                      <option value="cartao">Cartão</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="indefinido">Indefinido</option>
                    </select>
                  </label>
                </div>

                <label>
                  Referencia
                  <input
                    value={baixaReferencia}
                    onChange={(e) => setBaixaReferencia(e.target.value)}
                    placeholder="Ex.: comprovante / recibo"
                  />
                </label>

                {baixaLancamentoSelecionado && (
                  <p className="finance-form-sub" style={{ marginTop: 6 }}>
                    Deixe em branco para quitar o saldo atual.
                  </p>
                )}

                <button type="submit" disabled={!token || baixaLoading}>
                  {baixaLoading ? "Processando..." : "Dar baixa manual"}
                </button>
              </form>
            ) : (
              <p className="finance-form-sub">
                Sem acesso para registrar baixas manuais.
              </p>
            )}

            {pendentesParaBaixa.length === 0 && (
              <p className="finance-form-sub">
                Nenhum lancamento em aberto para baixa manual.
              </p>
            )}
            </section>
          </div>

          <div className="finance-side-column">
            <section className="finance-table-card">
              <div className="finance-table-header">
                <div>
                  <h3>Pagamentos registrados</h3>
                  {baixaLancamentoSelecionado ? (
                    <p className="finance-form-sub">
                      {pagamentosLancamentoOrdenados.length} pagamento(s) • Total{" "}
                      {formatarValor(totalPagoLancamento)} •{" "}
                      {saldoLancamento < 0 ? "Credito" : "Saldo"}{" "}
                      {formatarValor(saldoLancamentoAbs)}
                    </p>
                  ) : (
                    <p className="finance-form-sub">
                      Selecione um lancamento para ver os pagamentos.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void carregarPagamentosBaixa(baixaLancamentoId)}
                  disabled={
                    baixaPagamentosLoading || !token || !baixaLancamentoSelecionado
                  }
                >
                  {baixaPagamentosLoading ? "Carregando..." : "Atualizar lista"}
                </button>
              </div>

              {baixaPagamentosErro && <p className="error">{baixaPagamentosErro}</p>}

              {baixaLancamentoSelecionado ? (
                <table className="table finance-table" style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th className="finance-value-header">Valor</th>
                      <th>Forma</th>
                      <th>Conta</th>
                      <th>Referencia</th>
                      <th>Status</th>
                      {canWrite && <th>Acoes</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentosLancamentoOrdenados.map((pagamento) => {
                      const estornado = Boolean(pagamento.estornadoEm);
                      return (
                        <tr key={pagamento.id}>
                          <td>{formatarData(pagamento.dataPagamento)}</td>
                          <td className="finance-value-cell">
                            {formatarValor(pagamento.valorPago)}
                          </td>
                          <td>{pagamento.formaPagamento ?? "indefinido"}</td>
                          <td>
                            {contasPorId[pagamento.contaFinanceiraId ?? ""] ?? "-"}
                          </td>
                          <td>{pagamento.referencia ?? "-"}</td>
                          <td>
                            <span
                              className={`badge-status ${
                                estornado
                                  ? "badge-status--cancelado"
                                  : "badge-status--pago"
                              }`}
                            >
                              {estornado ? "Estornado" : "Pago"}
                            </span>
                            {estornado && pagamento.estornadoEm && (
                              <div className="finance-item-sub">
                                {formatarData(pagamento.estornadoEm)}
                              </div>
                            )}
                          </td>
                          {canWrite && (
                            <td>
                              <div className="finance-table-actions">
                                <button
                                  type="button"
                                  className="action-secondary"
                                  onClick={() =>
                                    void estornarPagamentoLancamento(pagamento)
                                  }
                                  disabled={estornado || baixaEstornoId === pagamento.id}
                                >
                                  {baixaEstornoId === pagamento.id
                                    ? "Estornando..."
                                    : "Estornar"}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {pagamentosLancamentoOrdenados.length === 0 && (
                      <tr>
                        <td colSpan={canWrite ? 7 : 6} style={{ textAlign: "center" }}>
                          Nenhum pagamento registrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <p className="finance-form-sub">
                  Nenhum lancamento selecionado para exibir pagamentos.
                </p>
              )}
            </section>

            <section className="finance-table-card">
              <div className="finance-table-header">
                <div>
                  <h3>Lancamentos pendentes</h3>
                  <p className="finance-form-sub">
                    {pendentesParaBaixaFiltrados.length} pendentes • Total{" "}
                    {formatarValor(totalPendentesValor)}
                  </p>
                </div>
              </div>

              <div className="finance-form-grid" style={{ marginTop: 8 }}>
                <label>
                  Tipo
                  <select
                    value={baixaFiltroTipo}
                    onChange={(e) =>
                      setBaixaFiltroTipo(
                        e.target.value === "pagar"
                          ? "pagar"
                          : e.target.value === "receber"
                            ? "receber"
                            : "todos"
                      )
                    }
                  >
                    <option value="todos">Todos</option>
                    <option value="pagar">A pagar</option>
                    <option value="receber">A receber</option>
                  </select>
                </label>
                <label>
                  Buscar
                  <input
                    value={baixaFiltroTexto}
                    onChange={(e) => setBaixaFiltroTexto(e.target.value)}
                    placeholder="Descricao, pessoa, referencia"
                  />
                </label>
              </div>

              <table className="table finance-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Descricao</th>
                    <th>Pessoa</th>
                    <th>Vencimento</th>
                    <th className="finance-value-header">Valor</th>
                    <th>Status</th>
                    {canWrite && <th>Acoes</th>}
                  </tr>
                </thead>
                <tbody>
                  {pendentesParaBaixaFiltrados.map((lanc) => (
                    <tr key={lanc.id}>
                      <td>{lanc.tipo === "pagar" ? "Pagar" : "Receber"}</td>
                      <td>{lanc.descricao}</td>
                      <td>{pessoasPorId[lanc.pessoaId] ?? "-"}</td>
                      <td>{formatarData(lanc.dataVencimento)}</td>
                      <td className="finance-value-cell">
                        {formatarValor(lanc.valor)}
                      </td>
                      <td>{statusMeta(lanc.situacao).label}</td>
                      {canWrite && (
                        <td>
                          <div className="finance-table-actions">
                            <button
                              type="button"
                              className="action-secondary"
                              onClick={() => setBaixaLancamentoId(lanc.id)}
                              disabled={baixaLancamentoId === lanc.id}
                            >
                              {baixaLancamentoId === lanc.id
                                ? "Selecionado"
                                : "Selecionar"}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {pendentesParaBaixaFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={canWrite ? 7 : 6} style={{ textAlign: "center" }}>
                        Nenhum lancamento pendente encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      )}

      {aba === "gruposRateio" && (
        <div className="finance-layout finance-layout--rateio">
          <section className="finance-form-card rateio-span">
            <h3>Novo grupo de rateio</h3>
            <p className="finance-form-sub">
              Distribua despesas por unidade com regra igualitaria ou percentual.
            </p>

            {rateioErro && <p className="error">{rateioErro}</p>}

            {canWrite ? (
              <form className="form" onSubmit={criarRegraRateio}>
                <div className="finance-form-grid">
                  <label>
                    Nome
                    <input
                      value={novoRateioNome}
                      onChange={(e) => setNovoRateioNome(e.target.value)}
                      placeholder="Ex.: Rateio limpeza mensal"
                      required
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={novoRateioTipo}
                      onChange={(e) =>
                        setNovoRateioTipo(
                          e.target.value === "percentual"
                            ? "percentual"
                            : "igual"
                        )
                      }
                    >
                      <option value="igual">Igualitario</option>
                      <option value="percentual">Percentual</option>
                    </select>
                  </label>
                </div>

                <div className="finance-table-card" style={{ marginTop: 12 }}>
                  <div className="finance-table-header">
                    <div>
                      <h4>Unidades no rateio</h4>
                      <p className="finance-form-sub">
                        {totalUnidadesRateioSelecionadas} selecionada(s).
                      </p>
                    </div>
                    <div className="finance-card-actions">
                      <button
                        type="button"
                        onClick={selecionarTodasUnidadesRateio}
                      >
                        Selecionar todas
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => setNovoRateioUnidades({})}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <table className="table">
                    <thead>
                      <tr>
                        <th>Selecionar</th>
                        <th>Unidade</th>
                        <th>Tipo</th>
                        <th>Percentual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unidadesRateioDisplay.map((unidade) => {
                        const selecionada =
                          novoRateioUnidades[unidade.id] !== undefined;
                        return (
                          <tr key={unidade.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selecionada}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setNovoRateioUnidades((prev) => {
                                    if (!checked) {
                                      const { [unidade.id]: _, ...rest } = prev;
                                      return rest;
                                    }
                                    return {
                                      ...prev,
                                      [unidade.id]:
                                        prev[unidade.id] ??
                                        (novoRateioTipo === "percentual"
                                          ? "0"
                                          : "")
                                    };
                                  });
                                }}
                              />
                            </td>
                            <td>
                              {unidade.codigoInterno} - {unidade.nome}
                            </td>
                            <td>{unidade.tipo}</td>
                            <td>
                              {novoRateioTipo === "percentual" ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={novoRateioUnidades[unidade.id] ?? ""}
                                  onChange={(e) =>
                                    setNovoRateioUnidades((prev) => ({
                                      ...prev,
                                      [unidade.id]: e.target.value
                                    }))
                                  }
                                  disabled={!selecionada}
                                  placeholder="%"
                                />
                              ) : (
                                <span className="finance-item-sub">
                                  Divisao igual
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {unidadesRateioDisplay.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: "center" }}>
                            Nenhuma unidade disponivel para rateio.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <button type="submit" disabled={!token || rateioLoading}>
                  {rateioLoading ? "Salvando..." : "Salvar grupo"}
                </button>
              </form>
            ) : (
              <p className="finance-form-sub">
                Sem acesso para criar grupos de rateio.
              </p>
            )}
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Grupos cadastrados</h3>
                <p className="finance-form-sub">
                  Regras prontas para aplicar em lancamentos.
                </p>
              </div>
              <button
                type="button"
                onClick={carregarRegrasRateio}
                disabled={rateioLoading || !token}
              >
                {rateioLoading ? "Carregando..." : "Atualizar lista"}
              </button>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Unidades</th>
                  {canWrite && <th>Acoes</th>}
                </tr>
              </thead>
              <tbody>
                {regrasRateio.map((regra) => (
                  <tr key={regra.id}>
                    <td>{regra.nome}</td>
                    <td>
                      {regra.tipoBase.toLowerCase() === "percentual"
                        ? "Percentual"
                        : "Igualitario"}
                    </td>
                    <td>{obterResumoRegraRateio(regra)}</td>
                    {canWrite && (
                      <td>
                        <button
                          type="button"
                          onClick={() => void removerRegraRateio(regra)}
                          style={{
                            backgroundColor: "#ef4444",
                            color: "#ffffff"
                          }}
                        >
                          Remover
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {regrasRateio.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 4 : 3} style={{ textAlign: "center" }}>
                      Nenhum grupo cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Aplicar rateio</h3>
                <p className="finance-form-sub">
                  Selecione um lancamento de despesa e um grupo para gerar as
                  parcelas por unidade.
                </p>
              </div>
            </div>

            <div className="finance-form-inline" style={{ marginTop: 8 }}>
              <label>
                Lancamento
                <select
                  value={rateioLancamentoId}
                  onChange={(e) => setRateioLancamentoId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {despesasValidas.map((lanc) => (
                    <option key={lanc.id} value={lanc.id}>
                      {lanc.descricao} •{" "}
                      {lanc.valor.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      })}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Grupo
                <select
                  value={rateioRegraSelecionadaId}
                  onChange={(e) => setRateioRegraSelecionadaId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {regrasRateio.map((regra) => (
                    <option key={regra.id} value={regra.id}>
                      {regra.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="inline-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={aplicarRegraRateio}
                disabled={!token || rateioLoading || !canWrite}
              >
                {rateioLoading ? "Aplicando..." : "Aplicar rateio"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={limparRateiosLancamento}
                disabled={
                  !token || rateioLoading || !rateioLancamentoId || !canWrite
                }
              >
                Limpar rateio
              </button>
            </div>

            <table className="table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Unidade</th>
                  <th className="finance-value-header">Valor rateado</th>
                </tr>
              </thead>
              <tbody>
                {rateiosLancamento.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.unidadeOrganizacionalId
                        ? unidadesRateioPorId[item.unidadeOrganizacionalId] ??
                          item.unidadeOrganizacionalId
                        : "-"}
                    </td>
                    <td className="finance-value-cell">
                      {item.valorRateado.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      })}
                    </td>
                  </tr>
                ))}
                {rateiosLancamento.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ textAlign: "center" }}>
                      Nenhum rateio aplicado para este lancamento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {aba === "itensCobrados" && (
        <div className="finance-layout">
          <section className="finance-form-card">
            <h3>Novo item cobrado</h3>

            {canWrite ? (
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!token || !novoItemNome.trim()) return;
                  try {
                    setErro(null);
                    setLoading(true);
                    const valor =
                      novoItemValorPadrao.trim().length > 0
                        ? Number(
                            novoItemValorPadrao
                              .replace(/\./g, "")
                              .replace(",", ".")
                          )
                        : undefined;
                    const criado = await api.criarItemCobrado(token, {
                      organizacaoId,
                      nome: novoItemNome.trim(),
                      tipo: novoItemTipo,
                      financeCategoryId:
                        novoItemCategoriaId ||
                        "00000000-0000-0000-0000-000000000000",
                      valorPadrao: valor,
                      permiteAlterarValor: novoItemPermiteAlterar,
                      exigeReserva: novoItemExigeReserva,
                      geraCobrancaAutomatica: novoItemGeraCobrancaAuto,
                      descricaoOpcional:
                        novoItemDescricao.trim().length > 0
                          ? novoItemDescricao.trim()
                          : undefined
                    });
                    setItensCobrados((prev) => [...prev, criado]);
                    setNovoItemNome("");
                    setNovoItemTipo("AreaComum");
                    setNovoItemCategoriaId("");
                    setNovoItemValorPadrao("");
                    setNovoItemPermiteAlterar(true);
                    setNovoItemExigeReserva(false);
                    setNovoItemGeraCobrancaAuto(true);
                    setNovoItemDescricao("");
                  } catch (e: any) {
                    setErro(e.message || "Erro ao criar item cobrado");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <label>
                  Nome do item
                  <input
                    value={novoItemNome}
                    onChange={(e) => setNovoItemNome(e.target.value)}
                    placeholder="Ex.: Reserva salão de festas"
                    required
                  />
                </label>

                <div className="finance-form-grid">
                  <label>
                    Tipo
                    <select
                      value={novoItemTipo}
                      onChange={(e) => setNovoItemTipo(e.target.value)}
                    >
                      <option value="AreaComum">Área comum</option>
                      <option value="TagAcesso">Tag / acesso</option>
                      <option value="Multa">Multa</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </label>
                  <label>
                    Valor padrão
                    <input
                      value={novoItemValorPadrao}
                      onChange={(e) =>
                        setNovoItemValorPadrao(e.target.value)
                      }
                      placeholder="Ex.: 250,00"
                    />
                  </label>
                </div>

                <label>
                  Categoria financeira
                  <select
                    value={novoItemCategoriaId}
                    onChange={(e) =>
                      setNovoItemCategoriaId(e.target.value)
                    }
                  >
                    <option value="">Selecione uma categoria</option>
                    {categoriasReceita.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.codigo} - {cat.nome}
                      </option>
                    ))}
                  </select>
                  <small style={{ display: "block", marginTop: 4 }}>
                    As categorias são configuradas na aba &quot;Categorias
                    financeiras&quot;.
                  </small>
                </label>

                <label>
                  Descrição
                  <textarea
                    value={novoItemDescricao}
                    onChange={(e) =>
                      setNovoItemDescricao(e.target.value)
                    }
                    rows={3}
                  />
                </label>

                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={novoItemPermiteAlterar}
                    onChange={(e) =>
                      setNovoItemPermiteAlterar(e.target.checked)
                    }
                  />{" "}
                  Permite alterar valor na hora
                </label>

                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={novoItemExigeReserva}
                    onChange={(e) =>
                      setNovoItemExigeReserva(e.target.checked)
                    }
                  />{" "}
                  Exige reserva aprovada (salão, churrasqueira, etc.)
                </label>

                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={novoItemGeraCobrancaAuto}
                    onChange={(e) =>
                      setNovoItemGeraCobrancaAuto(e.target.checked)
                    }
                  />{" "}
                  Gerar cobrança automática no financeiro
                </label>

                <button
                  type="submit"
                  disabled={loading || !novoItemNome.trim()}
                >
                  {loading ? "Salvando..." : "Salvar item"}
                </button>
              </form>
            ) : (
              <p className="finance-form-sub">
                Sem acesso para criar itens cobrados.
              </p>
            )}
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Itens cadastrados</h3>
              </div>
              <button
                type="button"
                onClick={carregarItensCobrados}
                disabled={loading}
              >
                {loading ? "Carregando..." : "Atualizar lista"}
              </button>
            </div>

            {erro && <p className="error">{erro}</p>}

            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Valor padrão</th>
                  <th>Ativo</th>
                  {canWrite && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {itensCobrados.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nome}</td>
                    <td>{item.tipo}</td>
                    <td>
                      {item.financeCategoryId
                        ? categoriasReceitaPorId[item.financeCategoryId] ?? "-"
                        : "-"}
                    </td>
                    <td>
                      {item.valorPadrao != null
                        ? item.valorPadrao.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL"
                          })
                        : "-"}
                    </td>
                    <td>
                      <span
                        className={
                          "badge-status " +
                          (item.ativo
                            ? "badge-status--ativo"
                            : "badge-status--inativo")
                        }
                      >
                        {item.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    {canWrite && (
                      <td>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!token) return;
                            const novoNome = window.prompt(
                              "Nome do item:",
                              item.nome
                            );
                            if (!novoNome || !novoNome.trim()) return;

                            const novoValorStr = window.prompt(
                              "Valor padrão (ex.: 150,00):",
                              item.valorPadrao != null
                                ? item.valorPadrao.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2
                                  })
                                : ""
                            );
                            const novoValor =
                              novoValorStr && novoValorStr.trim().length > 0
                                ? Number(
                                    novoValorStr
                                      .replace(/\./g, "")
                                      .replace(",", ".")
                                  )
                                : undefined;

                            const novaDescricao =
                              window.prompt(
                                "Descrição (opcional):",
                                item.descricaoOpcional ?? ""
                              ) ?? item.descricaoOpcional ?? "";

                            const tipoEscolhido =
                              window.prompt(
                                'Tipo (AreaComum, TagAcesso, Multa, Outros):',
                                item.tipo || "AreaComum"
                              ) ?? item.tipo;

                            try {
                              setErro(null);
                              setLoading(true);
                              await api.atualizarItemCobrado(token, item.id, {
                                nome: novoNome.trim(),
                                tipo: tipoEscolhido || "AreaComum",
                                financeCategoryId: item.financeCategoryId,
                                valorPadrao: novoValor,
                                permiteAlterarValor: item.permiteAlterarValor,
                                exigeReserva: item.exigeReserva,
                                geraCobrancaAutomatica:
                                  item.geraCobrancaAutomatica,
                                descricaoOpcional:
                                  novaDescricao.trim().length > 0
                                    ? novaDescricao.trim()
                                    : undefined,
                                ativo: item.ativo
                              });

                              setItensCobrados((prev) =>
                                prev.map((i) =>
                                  i.id === item.id
                                    ? {
                                        ...i,
                                        nome: novoNome.trim(),
                                        tipo: tipoEscolhido || "AreaComum",
                                        valorPadrao: novoValor ?? i.valorPadrao,
                                        descricaoOpcional:
                                          novaDescricao.trim().length > 0
                                            ? novaDescricao.trim()
                                            : undefined
                                      }
                                    : i
                                )
                              );
                            } catch (e: any) {
                              setErro(
                                e.message || "Erro ao atualizar item cobrado"
                              );
                            } finally {
                              setLoading(false);
                            }
                          }}
                          style={{
                            marginRight: 8,
                            backgroundColor: "#e5e7eb",
                            color: "#111827"
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!token) return;
                            const novoAtivo = !item.ativo;
                            try {
                              setErro(null);
                              setLoading(true);
                              await api.atualizarStatusItemCobrado(
                                token,
                                item.id,
                                novoAtivo
                              );
                              setItensCobrados((prev) =>
                                prev.map((i) =>
                                  i.id === item.id
                                    ? { ...i, ativo: novoAtivo }
                                    : i
                                )
                              );
                            } catch (e: any) {
                              setErro(
                                e.message ||
                                  "Erro ao atualizar item cobrado"
                              );
                            } finally {
                              setLoading(false);
                            }
                          }}
                          style={{
                            backgroundColor: item.ativo
                              ? "#f97316"
                              : "#22c55e"
                          }}
                        >
                          {item.ativo ? "Desativar" : "Ativar"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {itensCobrados.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 6 : 5} style={{ textAlign: "center" }}>
                      Nenhum item cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {aba === "faturas" && (
        <div className="finance-layout">
          <section className="finance-form-card">
            <h3>Nova fatura</h3>
            <p className="finance-form-sub">
              Emite documento de cobranca para um lancamento de receber.
            </p>

            {canWrite ? (
              <form className="form" onSubmit={criarFatura}>
                <label>
                  Lancamento (receber)
                  <select
                    value={novaFaturaLancamentoId}
                    onChange={(e) => setNovaFaturaLancamentoId(e.target.value)}
                    required
                  >
                    <option value="">Selecione</option>
                    {lancamentosReceberElegiveisFatura.map((lanc) => (
                      <option key={lanc.id} value={lanc.id}>
                        {lanc.descricao} -{" "}
                        {lanc.valor.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        })}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="finance-form-grid">
                  <label>
                    Tipo
                    <select
                      value={novaFaturaTipo}
                      onChange={(e) => setNovaFaturaTipo(e.target.value)}
                    >
                      <option value="boleto">Boleto</option>
                      <option value="pix">Pix</option>
                      <option value="cartao">Cartao</option>
                      <option value="link">Link de pagamento</option>
                    </select>
                  </label>
                  <label>
                    Vencimento
                    <input
                      type="date"
                      value={novaFaturaVencimento}
                      onChange={(e) => setNovaFaturaVencimento(e.target.value)}
                    />
                  </label>
                </div>

                <label>
                  Identificador externo
                  <input
                    value={novaFaturaIdentificador}
                    onChange={(e) => setNovaFaturaIdentificador(e.target.value)}
                    placeholder="Ex.: FAT-2026-0001"
                  />
                </label>

                <label>
                  Linha digitavel
                  <input
                    value={novaFaturaLinhaDigitavel}
                    onChange={(e) => setNovaFaturaLinhaDigitavel(e.target.value)}
                    placeholder="Ex.: 00190.00009 01234.567891 23456.789012 3 98760000010000"
                  />
                </label>

                <label>
                  QR Code (texto)
                  <input
                    value={novaFaturaQrCode}
                    onChange={(e) => setNovaFaturaQrCode(e.target.value)}
                    placeholder="Payload Pix copia e cola"
                  />
                </label>

                <label>
                  URL de pagamento
                  <input
                    value={novaFaturaUrlPagamento}
                    onChange={(e) => setNovaFaturaUrlPagamento(e.target.value)}
                    placeholder="https://..."
                  />
                </label>

                <button type="submit" disabled={loading || !novaFaturaLancamentoId}>
                  {loading ? "Emitindo..." : "Emitir fatura"}
                </button>
              </form>
            ) : (
              <p className="finance-form-sub">Sem acesso para emitir faturas.</p>
            )}
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Faturas emitidas</h3>
              </div>
              <div className="finance-card-actions">
                <button type="button" onClick={carregarFaturas} disabled={loading}>
                  {loading ? "Carregando..." : "Atualizar lista"}
                </button>
              </div>
            </div>

            {erro && <p className="error">{erro}</p>}

            <table className="table finance-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Lancamento</th>
                  <th>Emissao</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  {canWrite && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {faturas.map((fat) => (
                  <tr key={fat.id}>
                    <td>{fat.tipo}</td>
                    <td>
                      {receitasPorId[fat.lancamentoFinanceiroId]?.descricao ??
                        fat.lancamentoFinanceiroId}
                    </td>
                    <td>{new Date(fat.dataEmissao).toLocaleDateString("pt-BR")}</td>
                    <td>{new Date(fat.dataVencimento).toLocaleDateString("pt-BR")}</td>
                    <td>{fat.status}</td>
                    {canWrite && (
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="action-primary"
                            disabled={loading || fat.status === "paga"}
                            onClick={() => void atualizarStatusFatura(fat, "paga")}
                          >
                            Dar baixa
                          </button>
                      <details className="action-menu">
                        <summary title="Mais acoes" aria-label="Mais acoes">
                          ⋮
                        </summary>
                        <div className="action-menu-panel">
                          {(fat.tipo === "boleto" || fat.tipo === "pix") && (
                            <button
                              type="button"
                              className="action-secondary"
                              disabled={loading}
                              onClick={() => void gerarBoletoPdf(fat)}
                            >
                              Baixar boleto
                            </button>
                          )}
                          <button
                            type="button"
                            className="action-secondary"
                            disabled={loading || fat.status === "cancelada"}
                            onClick={() => void atualizarStatusFatura(fat, "cancelada")}
                          >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                className="action-secondary"
                                disabled={loading || fat.status === "emitida"}
                                onClick={() => void atualizarStatusFatura(fat, "emitida")}
                              >
                                Reabrir
                              </button>
                            </div>
                          </details>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {faturas.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 6 : 5} style={{ textAlign: "center" }}>
                      Nenhuma fatura emitida ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {aba === "inadimplentes" && (
        <div className="finance-layout finance-layout--single">
          <section className="finance-form-card">
            <h3>Politica de cobranca</h3>
            <p className="finance-form-sub">
              Configure multa, juros e correcao para cobrancas em atraso.
            </p>

            {politicaErro && <p className="error">{politicaErro}</p>}

            {canWrite ? (
              <form className="form" onSubmit={salvarPoliticaCobranca}>
                <div className="finance-form-grid">
                  <label>
                    Multa (%)
                    <input
                      value={politicaMulta}
                      onChange={(e) => setPoliticaMulta(e.target.value)}
                      placeholder="Ex.: 2"
                    />
                  </label>
                  <label>
                    Juros ao mes (%)
                    <input
                      value={politicaJuros}
                      onChange={(e) => setPoliticaJuros(e.target.value)}
                      placeholder="Ex.: 1"
                    />
                  </label>
                </div>
                <div className="finance-form-grid">
                  <label>
                    Tipo de correcao
                    <select
                      value={politicaCorrecaoTipo}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPoliticaCorrecaoTipo(value);
                        if (value !== "OUTRO") {
                          setPoliticaCorrecaoIndice("");
                        }
                        if (value === "SEM_CORRECAO") {
                          setPoliticaCorrecao("0");
                        }
                        void carregarIndiceAtual(value);
                      }}
                    >
                      <option value="PERCENTUAL_FIXO">Percentual fixo</option>
                      <option value="IPCA">IPCA</option>
                      <option value="IGPM">IGP-M</option>
                      <option value="INPC">INPC</option>
                      <option value="CDI">CDI</option>
                      <option value="SEM_CORRECAO">Sem correcao</option>
                      <option value="OUTRO">Outro</option>
                    </select>
                    {indiceLoading && (
                      <span className="finance-form-sub">Carregando indice...</span>
                    )}
                    {!indiceLoading && indiceAtual && (
                      <span className="finance-form-sub">
                        Indice atual:{" "}
                        {indiceAtual.valorPercentual.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                        % ({String(indiceAtual.mes).padStart(2, "0")}/
                        {indiceAtual.ano})
                      </span>
                    )}
                    {!indiceLoading && indiceErro && (
                      <span className="finance-form-sub">{indiceErro}</span>
                    )}
                  </label>
                  <label>
                    Indice (quando outro)
                    <input
                      value={politicaCorrecaoIndice}
                      onChange={(e) => setPoliticaCorrecaoIndice(e.target.value)}
                      placeholder="Ex.: TR"
                      disabled={politicaCorrecaoTipo !== "OUTRO"}
                    />
                  </label>
                </div>
                <div className="finance-form-grid">
                  <label>
                    Correcao ao mes (%)
                    <input
                      value={politicaCorrecao}
                      onChange={(e) => setPoliticaCorrecao(e.target.value)}
                      placeholder="Ex.: 0,5 (fallback)"
                      disabled={politicaCorrecaoTipo === "SEM_CORRECAO"}
                    />
                  </label>
                  <label>
                    Carencia (dias)
                    <input
                      type="number"
                      min="0"
                      value={politicaCarencia}
                      onChange={(e) => setPoliticaCarencia(e.target.value)}
                    />
                  </label>
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={politicaAtiva}
                    onChange={(e) => setPoliticaAtiva(e.target.checked)}
                  />
                  Politica ativa
                </label>
                <button type="submit" disabled={politicaLoading || !token}>
                  {politicaLoading ? "Salvando..." : "Salvar politica"}
                </button>
              </form>
            ) : (
              <p className="finance-form-sub">
                Sem acesso para editar politica de cobranca.
              </p>
            )}
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Inadimplentes (lancamentos)</h3>
                <p className="finance-form-sub">
                  Receitas vencidas e nao pagas com apoio para acao de cobranca.
                </p>
              </div>
              <div className="finance-card-actions">
                <span className="badge-status badge-status--aberto">
                  Total:{" "}
                  {totalInadimplencia.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                  })}
                </span>
              </div>
            </div>

            <table className="table finance-table">
              <thead>
                <tr>
                  <th>Descricao</th>
                  <th>Vencimento</th>
                  <th>Dias atraso</th>
                  <th className="finance-value-header">Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inadimplentes.map((lanc) => {
                  const venc = lanc.dataVencimento
                    ? new Date(lanc.dataVencimento)
                    : null;
                  const diasAtraso = venc
                    ? Math.max(
                        0,
                        Math.floor((Date.now() - venc.getTime()) / 86400000)
                      )
                    : 0;
                  return (
                    <tr key={lanc.id}>
                      <td>{lanc.descricao}</td>
                      <td>
                        {lanc.dataVencimento
                          ? new Date(lanc.dataVencimento).toLocaleDateString("pt-BR")
                          : "-"}
                      </td>
                      <td>{diasAtraso}</td>
                      <td className="finance-value-cell">
                        {lanc.valor.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        })}
                      </td>
                      <td>{statusMeta(lanc.situacao).label}</td>
                    </tr>
                  );
                })}
                {inadimplentes.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
                      Nenhum inadimplente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Cobrancas por unidade</h3>
                <p className="finance-form-sub">
                  {cobrancasUnidadePendentes.length} pendente(s) • Total{" "}
                  {formatarValor(totalCobrancasUnidadePendentes)}
                </p>
              </div>
              <div className="finance-card-actions">
                <button
                  type="button"
                  onClick={carregarCobrancasUnidadeOrg}
                  disabled={cobrancasUnidadeLoading || !token}
                >
                  {cobrancasUnidadeLoading ? "Carregando..." : "Atualizar lista"}
                </button>
              </div>
            </div>

            {cobrancasUnidadeErro && (
              <p className="error">{cobrancasUnidadeErro}</p>
            )}

            <table className="table finance-table">
              <thead>
                <tr>
                  <th>Unidade</th>
                  <th>Descricao</th>
                  <th>Vencimento</th>
                  <th>Dias atraso</th>
                  <th className="finance-value-header">Valor</th>
                  <th className="finance-value-header">Atualizado</th>
                  <th>Status</th>
                  {canWrite && <th>Acoes</th>}
                </tr>
              </thead>
              <tbody>
                {cobrancasUnidadePendentes.map((cobranca) => (
                  <tr key={cobranca.id}>
                    <td>
                      {cobranca.unidadeCodigo} - {cobranca.unidadeNome}
                    </td>
                    <td>{cobranca.descricao}</td>
                    <td>{formatarData(cobranca.vencimento)}</td>
                    <td>{cobranca.diasAtraso ?? 0}</td>
                    <td className="finance-value-cell">
                      {formatarValor(cobranca.valor)}
                    </td>
                    <td className="finance-value-cell">
                      {formatarValor(
                        cobranca.valorAtualizado ?? cobranca.valor
                      )}
                    </td>
                    <td>{cobranca.status}</td>
                    {canWrite && (
                      <td>
                        <div className="finance-table-actions">
                          <button
                            type="button"
                            className="action-secondary"
                            onClick={() => void criarAcordoRapido(cobranca)}
                            disabled={acordosLoading}
                          >
                            Criar acordo
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {cobrancasUnidadePendentes.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 8 : 7} style={{ textAlign: "center" }}>
                      Nenhuma cobranca pendente encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Acordos gerados</h3>
                <p className="finance-form-sub">
                  {acordosCobranca.length} acordo(s) cadastrados.
                </p>
              </div>
              <div className="finance-card-actions">
                <button
                  type="button"
                  onClick={carregarAcordosCobranca}
                  disabled={acordosLoading || !token}
                >
                  {acordosLoading ? "Carregando..." : "Atualizar lista"}
                </button>
              </div>
            </div>

            {acordosErro && <p className="error">{acordosErro}</p>}
            {acordosAviso && <p className="finance-form-sub">{acordosAviso}</p>}

            <table className="table finance-table">
              <thead>
                <tr>
                  <th>Unidade</th>
                  <th>Parcelas</th>
                  <th className="finance-value-header">Total</th>
                  <th className="finance-value-header">Desconto</th>
                  <th>Status</th>
                  {canWrite && <th>Acoes</th>}
                </tr>
              </thead>
              <tbody>
                {acordosCobranca.map((acordo) => (
                  <tr key={acordo.id}>
                    <td>
                      {unidadesCobrancaMap[acordo.unidadeOrganizacionalId] ??
                        acordo.unidadeOrganizacionalId}
                    </td>
                    <td>{acordo.numeroParcelas}</td>
                    <td className="finance-value-cell">
                      {formatarValor(acordo.totalAcordo)}
                    </td>
                    <td className="finance-value-cell">
                      {formatarValor(acordo.desconto)}
                    </td>
                    <td>{acordo.status}</td>
                    {canWrite && (
                      <td>
                        <div className="finance-table-actions">
                          <button
                            type="button"
                            className="action-secondary"
                            onClick={() => void gerarBoletosAcordo(acordo)}
                            disabled={acordosGerandoId === acordo.id}
                          >
                            {acordosGerandoId === acordo.id
                              ? "Gerando..."
                              : "Gerar boletos"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {acordosCobranca.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 6 : 5} style={{ textAlign: "center" }}>
                      Nenhum acordo cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Cobranca bancaria</h3>
                <p className="finance-form-sub">
                  Gere remessa e importe retorno (CSV simplificado).
                </p>
              </div>
            </div>

            {canWrite ? (
              <>
                <div className="finance-form-grid">
                  <label>
                    Tipo de cobranca
                    <select
                      value={remessaTipo}
                      onChange={(e) => setRemessaTipo(e.target.value)}
                    >
                      <option value="boleto">Boleto</option>
                      <option value="pix">Pix</option>
                      <option value="cartao">Cartao</option>
                      <option value="link">Link</option>
                    </select>
                  </label>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      onClick={gerarRemessaPdf}
                      disabled={loading}
                    >
                      {loading ? "Gerando..." : "Gerar remessa (PDF)"}
                    </button>
                    <button
                      type="button"
                      className="action-secondary"
                      onClick={gerarRemessaCobranca}
                      disabled={loading}
                    >
                      {loading ? "Gerando..." : "Baixar CSV"}
                    </button>
                  </div>
                </div>

                <form className="finance-upload-form" onSubmit={importarRetornoCobranca}>
                  <label>
                    Retorno bancario
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) =>
                        setRetornoArquivo(e.target.files ? e.target.files[0] : null)
                      }
                    />
                  </label>
                  <button type="submit" disabled={loading || !retornoArquivo}>
                    {loading ? "Importando..." : "Importar retorno"}
                  </button>
                </form>

                {retornoStatus && (
                  <p className="finance-form-sub" style={{ marginTop: 8 }}>
                    {retornoStatus}
                  </p>
                )}
              </>
            ) : (
              <p className="finance-form-sub">
                Sem acesso para remessa/retorno.
              </p>
            )}
          </section>
        </div>
      )}

      {aba === "conciliacaoBancaria" && (
        <div className="finance-table-card" style={{ marginTop: 12 }}>
          <div className="finance-table-header">
            <div>
              <h3>Conciliação bancária</h3>
              <p className="finance-form-sub">
                Importe extrato (CSV/OFX) e concilie com 1 clique.
              </p>
            </div>
          </div>

          {canWrite ? (
            <form
              className="finance-upload-form"
              onSubmit={(e) => {
                setTipoEnvio("extrato");
                void enviarArquivoFinanceiro(e);
              }}
            >
              <label>
                Conta bancaria
                <select
                  value={contaExtratoId}
                  onChange={(e) => setContaExtratoId(e.target.value)}
                >
                  <option value="">Selecionar</option>
                  {contasAtivasLista.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Extrato bancário
                <input
                  type="file"
                  accept=".csv,.ofx"
                  onChange={(e) =>
                    setArquivoEnvio(e.target.files ? e.target.files[0] : null)
                  }
                />
              </label>
              <button type="submit" disabled={loading || !arquivoEnvio}>
                {loading ? "Importando..." : "Importar extrato"}
              </button>
            </form>
          ) : (
            <p className="finance-form-sub">
              Sem acesso para importar extratos.
            </p>
          )}

          {extratoImportado && (
            <div className="finance-card-list" style={{ marginTop: 16 }}>
              {extratoImportado.itens.map((item) => {
                const conciliado = item.movimentoId
                  ? conciliados.includes(item.movimentoId)
                  : false;
                const chaveItem = item.movimentoId ?? String(item.index);
                const possuiSugestaoLancamento = !!item.sugestaoLancamentoId;
                const possuiSugestaoCobranca = !!item.sugestaoCobrancaId;
                const sugestaoTipo =
                  item.sugestaoTipo ??
                  (possuiSugestaoCobranca
                    ? "cobranca_unidade"
                    : possuiSugestaoLancamento
                    ? "lancamento"
                    : "");
                const sugestaoLabel =
                  sugestaoTipo === "cobranca_unidade"
                    ? "Cobranca por unidade"
                    : sugestaoTipo === "lancamento"
                    ? "Lancamento financeiro"
                    : "";
                const possuiSugestao =
                  possuiSugestaoLancamento || possuiSugestaoCobranca;
                return (
                  <div key={item.index} className="finance-item-card">
                    <div className="finance-item-main">
                      <div>
                        <strong className="finance-item-title">
                          {item.descricao}
                        </strong>
                        <div className="finance-item-sub">
                          {new Date(item.data).toLocaleDateString("pt-BR")} •{" "}
                          {item.documento || "Sem documento"}
                        </div>
                      </div>
                      <div className="finance-item-right">
                        <span className="finance-value">
                          {item.valor.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL"
                          })}
                        </span>
                        <span
                          className={`badge-status ${
                            conciliado
                              ? "badge-status--conciliado"
                              : "badge-status--pendente"
                          }`}
                        >
                          {conciliado ? "Conciliado" : "Pendente"}
                        </span>
                      </div>
                    </div>
                    <div className="finance-item-actions">
                      {possuiSugestao ? (
                        canWrite ? (
                          <button
                            type="button"
                            className="action-primary"
                            disabled={conciliado || conciliandoId === chaveItem}
                            onClick={() => void confirmarConciliacao(item)}
                          >
                            {conciliado
                              ? "Conciliado"
                              : conciliandoId === chaveItem
                              ? "Conciliando..."
                              : "Conciliar"}
                          </button>
                        ) : (
                          <span className="finance-item-sub">Somente leitura</span>
                        )
                      ) : (
                        <span className="finance-item-sub">
                          Sem sugestão automática
                        </span>
                      )}
                    </div>
                    {item.sugestaoDescricao && (
                      <div className="finance-item-sub">
                        Sugestão: {item.sugestaoDescricao}
                        {sugestaoLabel && ` • ${sugestaoLabel}`}
                      </div>
                    )}
                  </div>
                );
              })}
              {extratoImportado.itens.length === 0 && (
                <p className="empty">Nenhum item encontrado no extrato.</p>
              )}
            </div>
          )}
        </div>
      )}

      {aba === "livroPrestacaoContas" && (
        <div className="finance-layout finance-layout--single">
          <section className="finance-form-card">
            <div className="finance-table-header">
              <div>
                <h3>Livro de prestacao de contas</h3>
                <p className="finance-form-sub">
                  Consolidacao por periodo com resumo, categorias e anexos
                  principais.
                </p>
              </div>
              <div className="finance-card-actions">
                <button type="button" onClick={() => void gerarLivroPrestacaoPdf()}>
                  PDF
                </button>
                <button type="button" onClick={gerarLivroPrestacaoExcel}>
                  Excel
                </button>
              </div>
            </div>

            <div className="finance-form-grid">
              <label>
                Inicio
                <input
                  type="date"
                  value={livroInicio}
                  onChange={(e) => setLivroInicio(e.target.value)}
                />
              </label>
              <label>
                Fim
                <input
                  type="date"
                  value={livroFim}
                  onChange={(e) => setLivroFim(e.target.value)}
                />
              </label>
            </div>

            <div className="finance-form-inline" style={{ marginTop: 8 }}>
              <label>
                <input
                  type="checkbox"
                  checked={livroIncluirInadimplencia}
                  onChange={(e) => setLivroIncluirInadimplencia(e.target.checked)}
                />
                Incluir inadimplencia
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={livroIncluirDetalhes}
                  onChange={(e) => setLivroIncluirDetalhes(e.target.checked)}
                />
                Incluir detalhes dos lancamentos
              </label>
            </div>

            <div className="finance-card-grid" style={{ marginTop: 12 }}>
              <div className="finance-card">
                <strong>Total receitas</strong>
                <p>{formatarValor(totalReceitasLivro)}</p>
              </div>
              <div className="finance-card">
                <strong>Total despesas</strong>
                <p>{formatarValor(totalDespesasLivro)}</p>
              </div>
              <div className="finance-card">
                <strong>Saldo do periodo</strong>
                <p>{formatarValor(saldoLivro)}</p>
              </div>
              {livroIncluirInadimplencia && (
                <div className="finance-card">
                  <strong>Inadimplencia</strong>
                  <p>{formatarValor(totalInadimplenciaLivro)}</p>
                </div>
              )}
            </div>
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Receitas e despesas por categoria</h3>
              </div>
            </div>

            <div className="finance-card-grid" style={{ marginTop: 12 }}>
              <div className="finance-card">
                <h4>Receitas</h4>
                <table className="table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th className="finance-value-header">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(receitasLivroPorCategoria).map(
                      ([id, total]) => (
                        <tr key={id}>
                          <td>{categoriasReceitaPorId[id] ?? "Sem categoria"}</td>
                          <td className="finance-value-cell">
                            {formatarValor(total)}
                          </td>
                        </tr>
                      )
                    )}
                    {Object.keys(receitasLivroPorCategoria).length === 0 && (
                      <tr>
                        <td colSpan={2} style={{ textAlign: "center" }}>
                          Nenhuma receita no periodo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="finance-card">
                <h4>Despesas</h4>
                <table className="table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th className="finance-value-header">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(despesasLivroPorCategoria).map(
                      ([id, total]) => (
                        <tr key={id}>
                          <td>{categoriasDespesaPorId[id] ?? "Sem categoria"}</td>
                          <td className="finance-value-cell">
                            {formatarValor(total)}
                          </td>
                        </tr>
                      )
                    )}
                    {Object.keys(despesasLivroPorCategoria).length === 0 && (
                      <tr>
                        <td colSpan={2} style={{ textAlign: "center" }}>
                          Nenhuma despesa no periodo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {livroIncluirInadimplencia && (
            <section className="finance-table-card">
              <div className="finance-table-header">
                <div>
                  <h3>Inadimplentes no periodo</h3>
                </div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Descricao</th>
                    <th>Vencimento</th>
                    <th className="finance-value-header">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {inadimplentesLivro.map((item) => (
                    <tr key={item.id}>
                      <td>{item.descricao}</td>
                      <td>{formatarData(item.dataVencimento)}</td>
                      <td className="finance-value-cell">
                        {formatarValor(item.valor)}
                      </td>
                    </tr>
                  ))}
                  {inadimplentesLivro.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center" }}>
                        Nenhum inadimplente no periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {livroIncluirDetalhes && (
            <section className="finance-table-card">
              <div className="finance-table-header">
                <div>
                  <h3>Lancamentos do periodo</h3>
                </div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Descricao</th>
                    <th>Categoria</th>
                    <th>Vencimento</th>
                    <th>Situacao</th>
                    <th className="finance-value-header">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentosLivro.map((item) => {
                    const categoria =
                      item.tipo === "pagar"
                        ? categoriasDespesaPorId[item.planoContasId] ??
                          "Sem categoria"
                        : categoriasReceitaPorId[item.planoContasId] ??
                          "Sem categoria";
                    return (
                      <tr key={item.id}>
                        <td>{item.tipo === "pagar" ? "Despesa" : "Receita"}</td>
                        <td>{item.descricao}</td>
                        <td>{categoria}</td>
                        <td>{formatarData(item.dataVencimento ?? item.dataCompetencia)}</td>
                        <td>{statusMeta(item.situacao).label}</td>
                        <td className="finance-value-cell">
                          {formatarValor(item.valor)}
                        </td>
                      </tr>
                    );
                  })}
                  {lancamentosLivro.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center" }}>
                        Nenhum lancamento no periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}

      {aba === "categorias" && (
        <div className="finance-layout">
          <section className="finance-form-card">
            <h3>Nova categoria financeira</h3>

            {canWrite ? (
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!token) return;
                  if (!novaCategoriaCodigo.trim() || !novaCategoriaNome.trim()) {
                    return;
                  }

                  try {
                    setErro(null);
                    setLoading(true);
                    const criada = await api.criarPlanoContas(token, {
                      organizacaoId: organizacao.id,
                      codigo: novaCategoriaCodigo.trim(),
                      nome: novaCategoriaNome.trim(),
                      tipo: novaCategoriaTipo,
                      nivel: 1
                    });

                    if (criada.tipo === "Receita") {
                      setCategoriasReceita((prev) => [...prev, criada]);
                    } else {
                      setCategoriasDespesa((prev) => [...prev, criada]);
                    }

                    setNovaCategoriaCodigo("");
                    setNovaCategoriaNome("");
                    setNovaCategoriaTipo("Receita");
                  } catch (e: any) {
                    setErro(e.message || "Erro ao criar categoria financeira");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <div className="finance-form-grid">
                  <label>
                    Código
                    <input
                      value={novaCategoriaCodigo}
                      onChange={(e) => setNovaCategoriaCodigo(e.target.value)}
                      placeholder="Ex.: 1.01.01"
                      required
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={novaCategoriaTipo}
                      onChange={(e) =>
                        setNovaCategoriaTipo(
                          e.target.value === "Despesa" ? "Despesa" : "Receita"
                        )
                      }
                    >
                      <option value="Receita">Receita</option>
                      <option value="Despesa">Despesa</option>
                    </select>
                  </label>
                </div>

                <label>
                  Nome da categoria
                  <input
                    value={novaCategoriaNome}
                    onChange={(e) => setNovaCategoriaNome(e.target.value)}
                    placeholder="Ex.: Receitas de condomínio"
                    required
                  />
                </label>
                <button type="submit" disabled={loading || !token}>
                  {loading ? "Salvando..." : "Adicionar categoria"}
                </button>
              </form>
            ) : (
              <p className="finance-form-sub">
                Sem acesso para criar categorias.
              </p>
            )}
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Plano de contas</h3>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!token) return;
                  try {
                    setErro(null);
                    setLoading(true);
                    const [receitas, despesas] = await Promise.all([
                      api.listarPlanosContas(token, organizacao.id, "Receita"),
                      api.listarPlanosContas(token, organizacao.id, "Despesa")
                    ]);
                    setCategoriasReceita(receitas);
                    setCategoriasDespesa(despesas);
                  } catch (e: any) {
                    setErro(
                      e.message || "Erro ao carregar categorias financeiras"
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !token}
              >
                {loading ? "Carregando..." : "Atualizar lista"}
              </button>
            </div>

            {erro && <p className="error">{erro}</p>}

            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Nível</th>
                  {canWrite && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {[...categoriasReceita, ...categoriasDespesa]
                  .sort((a, b) => a.codigo.localeCompare(b.codigo))
                  .map((cat) => (
                    <tr key={cat.id}>
                      <td>{cat.codigo}</td>
                      <td>{cat.nome}</td>
                      <td>{cat.tipo}</td>
                      <td>{cat.nivel}</td>
                      {canWrite && (
                        <td>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!token) return;
                              const novoNome = window.prompt(
                                "Novo nome da categoria:",
                                cat.nome
                              );
                              if (!novoNome || !novoNome.trim()) return;
                              try {
                                setErro(null);
                                setLoading(true);
                                const atualizada = await api.atualizarPlanoContas(
                                  token,
                                  cat.id,
                                  {
                                    codigo: cat.codigo,
                                    nome: novoNome.trim(),
                                    tipo: cat.tipo,
                                    nivel: cat.nivel,
                                    parentId: cat.parentId
                                  }
                                );

                                if (atualizada.tipo === "Receita") {
                                  setCategoriasReceita((prev) =>
                                    prev.map((c) =>
                                      c.id === atualizada.id ? atualizada : c
                                    )
                                  );
                                } else {
                                  setCategoriasDespesa((prev) =>
                                    prev.map((c) =>
                                      c.id === atualizada.id ? atualizada : c
                                    )
                                  );
                                }
                              } catch (e: any) {
                                setErro(
                                  e.message ||
                                    "Erro ao atualizar categoria financeira"
                                );
                              } finally {
                                setLoading(false);
                              }
                            }}
                            style={{
                              marginRight: 8,
                              backgroundColor: "#e5e7eb",
                              color: "#111827"
                            }}
                          >
                            Renomear
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!token) return;
                              if (
                                !window.confirm(
                                  `Remover categoria "${cat.nome}"? (só é possível se não tiver lançamentos)`
                                )
                              ) {
                                return;
                              }
                              try {
                                setErro(null);
                                setLoading(true);
                                await api.removerPlanoContas(token, cat.id);

                                if (cat.tipo === "Receita") {
                                  setCategoriasReceita((prev) =>
                                    prev.filter((c) => c.id !== cat.id)
                                  );
                                } else {
                                  setCategoriasDespesa((prev) =>
                                    prev.filter((c) => c.id !== cat.id)
                                  );
                                }
                              } catch (e: any) {
                                setErro(
                                  e.message ||
                                    "Erro ao remover categoria financeira"
                                );
                              } finally {
                                setLoading(false);
                              }
                            }}
                            style={{
                              backgroundColor: "#ef4444",
                              color: "#ffffff"
                            }}
                          >
                            Remover
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                {categoriasReceita.length + categoriasDespesa.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 5 : 4} style={{ textAlign: "center" }}>
                      Nenhuma categoria cadastrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {aba === "relatorios" && (
        <div className="finance-layout">
          <section className="finance-form-card">
            <div className="finance-table-header">
              <div>
                <h3>Relatorios dedicados</h3>
                <p className="finance-form-sub">
                  Exportacoes com filtros por modulo.
                </p>
              </div>
            </div>

            <div className="finance-card-grid" style={{ marginTop: 8 }}>
              <div className="finance-card">
                <div className="finance-card-header-row">
                  <strong>Chamados</strong>
                </div>
                <div className="finance-form-inline" style={{ marginTop: 8 }}>
                  <label>
                    De
                    <input
                      type="date"
                      value={relatorioChamadosDe}
                      onChange={(e) => setRelatorioChamadosDe(e.target.value)}
                    />
                  </label>
                  <label>
                    Ate
                    <input
                      type="date"
                      value={relatorioChamadosAte}
                      onChange={(e) => setRelatorioChamadosAte(e.target.value)}
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={relatorioChamadosStatus}
                      onChange={(e) => setRelatorioChamadosStatus(e.target.value)}
                    >
                      <option value="">Todos</option>
                      <option value="ABERTO">Aberto</option>
                      <option value="EM_ATENDIMENTO">Em atendimento</option>
                      <option value="AGUARDANDO">Aguardando</option>
                      <option value="RESOLVIDO">Resolvido</option>
                      <option value="ENCERRADO">Encerrado</option>
                    </select>
                  </label>
                </div>
                <div className="inline-actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void baixarRelatorio("chamados", "csv")}
                    disabled={relatorioLoading}
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void baixarRelatorio("chamados", "pdf")}
                    disabled={relatorioLoading}
                  >
                    PDF
                  </button>
                </div>
              </div>

              <div className="finance-card">
                <div className="finance-card-header-row">
                  <strong>Reservas</strong>
                </div>
                <div className="finance-form-inline" style={{ marginTop: 8 }}>
                  <label>
                    De
                    <input
                      type="date"
                      value={relatorioReservasDe}
                      onChange={(e) => setRelatorioReservasDe(e.target.value)}
                    />
                  </label>
                  <label>
                    Ate
                    <input
                      type="date"
                      value={relatorioReservasAte}
                      onChange={(e) => setRelatorioReservasAte(e.target.value)}
                    />
                  </label>
                  <label>
                    Recurso
                    <select
                      value={relatorioReservasRecursoId}
                      onChange={(e) =>
                        setRelatorioReservasRecursoId(e.target.value)
                      }
                    >
                      <option value="">Todos</option>
                      {recursosRelatorio.map((recurso) => (
                        <option key={recurso.id} value={recurso.id}>
                          {recurso.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="inline-actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void baixarRelatorio("reservas", "csv")}
                    disabled={relatorioLoading}
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void baixarRelatorio("reservas", "pdf")}
                    disabled={relatorioLoading}
                  >
                    PDF
                  </button>
                </div>
              </div>

              <div className="finance-card">
                <div className="finance-card-header-row">
                  <strong>Veiculos</strong>
                </div>
                <p className="finance-form-sub">
                  Exporta lista completa de veiculos cadastrados.
                </p>
                <div className="inline-actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void baixarRelatorio("veiculos", "csv")}
                    disabled={relatorioLoading}
                  >
                    CSV
                  </button>
                </div>
              </div>

              <div className="finance-card">
                <div className="finance-card-header-row">
                  <strong>Pets</strong>
                </div>
                <p className="finance-form-sub">
                  Exporta lista completa de pets cadastrados.
                </p>
                <div className="inline-actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void baixarRelatorio("pets", "csv")}
                    disabled={relatorioLoading}
                  >
                    CSV
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="finance-table-card" style={{ marginTop: 12 }}>
            <div className="finance-table-header">
              <div>
                <h3>Relatorios - Balancete simples</h3>
              </div>
              <div className="finance-card-actions">
                <button type="button" onClick={() => void gerarRelatorioPdf()}>
                  PDF
                </button>
                <button type="button" onClick={gerarRelatorioExcel}>
                  Excel
                </button>
                <button type="button" onClick={() => handleAbaChange("contas")}>
                  Voltar
                </button>
              </div>
            </div>

            <div className="finance-card-grid" style={{ marginTop: 12 }}>
              <div className="finance-card">
                <div className="finance-card-header-row">
                  <strong>Total de receitas</strong>
                </div>
                <p>
                  {totalReceitas.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                  })}
                </p>
              </div>
              <div className="finance-card">
                <div className="finance-card-header-row">
                  <strong>Total de despesas</strong>
                </div>
                <p>
                  {totalDespesas.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                  })}
                </p>
              </div>
              <div className="finance-card">
                <div className="finance-card-header-row">
                  <strong>Saldo do periodo</strong>
                </div>
                <p>
                  {saldoPeriodo.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                  })}
                </p>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <h4>Receitas por categoria</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totalReceitasPorCategoria).map(
                    ([id, total]) => (
                      <tr key={id}>
                        <td>{categoriasReceitaPorId[id] ?? "Sem categoria"}</td>
                        <td>
                          {total.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL"
                          })}
                        </td>
                      </tr>
                    )
                  )}
                  {Object.keys(totalReceitasPorCategoria).length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ textAlign: "center" }}>
                        Nenhuma receita cadastrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16 }}>
              <h4>Despesas por categoria</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totalDespesasPorCategoria).map(
                    ([id, total]) => (
                      <tr key={id}>
                        <td>{categoriasDespesaPorId[id] ?? "Sem categoria"}</td>
                        <td>
                          {total.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL"
                          })}
                        </td>
                      </tr>
                    )
                  )}
                  {Object.keys(totalDespesasPorCategoria).length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ textAlign: "center" }}>
                        Nenhuma despesa cadastrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
