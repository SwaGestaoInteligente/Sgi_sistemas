import React, { useEffect, useState } from "react";
import { useCallback, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import AnexosPanel from "../components/AnexosPanel";
import {
  api,
  BalanceteItem,
  BalancoResumo,
  ChargeItem,
  ConciliacaoImportResponse,
  ContaFinanceira,
  ContaContabil,
  DreResumo,
  DocumentoCobranca,
  LancamentoContabil,
  LancamentoFinanceiro,
  Organizacao,
  Pessoa,
  PeriodoContabil,
  PlanoContas,
  RecursoReservavel
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
  { id: "consumos", label: "Consumos", badge: "Em breve" },
  { id: "receitasDespesas", label: "Receitas e despesas" },
  { id: "contasPagar", label: "Contas a pagar" },
  { id: "contasReceber", label: "Contas a receber" },
  { id: "previsaoOrcamentaria", label: "Previsao orcamentaria", badge: "Em breve" },
  { id: "transferencias", label: "Transferencias" },
  { id: "abonos", label: "Abonos", badge: "Em breve" },
  { id: "baixasManuais", label: "Baixas manuais" },
  { id: "gruposRateio", label: "Grupos de rateio", badge: "Em breve" },
  { id: "itensCobrados", label: "Cobrancas" },
  { id: "faturas", label: "Faturas" },
  { id: "inadimplentes", label: "Inadimplentes" },
  { id: "conciliacaoBancaria", label: "Conciliacao bancaria" },
  { id: "livroPrestacaoContas", label: "Livro de prestacao de contas", badge: "Em breve" },
  { id: "relatorios", label: "Relatorios" }
];

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

  const handleAbaChange = (novaAba: FinanceiroTab) => {
    setAba(novaAba);
    requestAnimationFrame(() => {
      topoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
  const pendentesParaBaixa = [...despesas, ...receitas].filter(
    (l) => isSituacaoAberta(l.situacao)
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

  // TODO: corpo completo do FinanceiroView (funções + render)
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
                    tooltip: "Pagamentos de moradores e acordos firmados."
                  },
                  {
                    title: "Fornecedor",
                    sub: "Servicos e contratos",
                    badge: "6 lancamentos",
                    tooltip: "Origem ligada a servicos contratados."
                  },
                  {
                    title: "Funcionario",
                    sub: "Folha e beneficios",
                    badge: "4 lancamentos",
                    tooltip: "Origem interna ligada a pessoal."
                  },
                  {
                    title: "Condominio",
                    sub: "Origem interna",
                    badge: "3 ajustes",
                    tooltip: "Movimentos internos do condominio."
                  }
                ].map((item) => (
                  <div
                    key={item.title}
                    className="finance-map-card"
                    title={item.tooltip}
                  >
                    <div className="finance-map-card-title">{item.title}</div>
                    <p className="finance-map-card-sub">{item.sub}</p>
                    <span className="finance-map-card-badge">{item.badge}</span>
                  </div>
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
                  "Receita",
                  "Despesa",
                  "Acordo",
                  "Multa",
                  "Taxa",
                  "Inadimplencia"
                ].map((label) => (
                  <span
                    key={label}
                    className="finance-map-chip"
                    title={`Classifica como ${label.toLowerCase()}.`}
                  >
                    {label}
                  </span>
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
                    tooltip: "Organiza receitas e despesas."
                  },
                  {
                    title: "Centro de custo",
                    sub: "Responsavel pelo gasto",
                    badge: "7 centros",
                    tooltip: "Distribui custos por area."
                  },
                  {
                    title: "Forma de pagamento",
                    sub: "Pix, boleto, cartao",
                    badge: "5 formas",
                    tooltip: "Define como o valor entra ou sai."
                  },
                  {
                    title: "Status financeiro",
                    sub: "Aberto, pago, atrasado",
                    badge: "6 status",
                    tooltip: "Controla o andamento do lancamento."
                  }
                ].map((item) => (
                  <div
                    key={item.title}
                    className="finance-map-card"
                    title={item.tooltip}
                  >
                    <div className="finance-map-card-title">{item.title}</div>
                    <p className="finance-map-card-sub">{item.sub}</p>
                    <span className="finance-map-card-badge">{item.badge}</span>
                  </div>
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
                    tooltip: "Despesas programadas para pagamento."
                  },
                  {
                    title: "Contas a receber",
                    sub: "Entradas previstas",
                    badge: "14 previstas",
                    tooltip: "Receitas aguardando recebimento."
                  },
                  {
                    title: "Lancamento",
                    sub: "Registro financeiro",
                    badge: "22 ativos",
                    tooltip: "Registro base do movimento."
                  },
                  {
                    title: "Parcela",
                    sub: "Divisao do valor",
                    badge: "10 parcelas",
                    tooltip: "Divisao de pagamentos ou recebimentos."
                  },
                  {
                    title: "Recorrencia",
                    sub: "Lancamentos automaticos",
                    badge: "4 regras",
                    tooltip: "Fluxo recorrente do condominio."
                  }
                ].map((item) => (
                  <div
                    key={item.title}
                    className="finance-map-card"
                    title={item.tooltip}
                  >
                    <div className="finance-map-card-title">{item.title}</div>
                    <p className="finance-map-card-sub">{item.sub}</p>
                    <span className="finance-map-card-badge">{item.badge}</span>
                  </div>
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
                    tooltip: "Saldo em caixa no periodo."
                  },
                  {
                    title: "Conta bancaria",
                    sub: "Bancos e pix",
                    badge: "3 contas",
                    tooltip: "Destino bancario principal."
                  },
                  {
                    title: "Fundo",
                    sub: "Reserva generica",
                    badge: "2 fundos",
                    tooltip: "Reserva para projetos ou emergencias."
                  },
                  {
                    title: "Saldo do condominio",
                    sub: "Consolidado geral",
                    badge: "R$ 270.000",
                    tooltip: "Saldo consolidado do condominio."
                  }
                ].map((item) => (
                  <div
                    key={item.title}
                    className="finance-map-card"
                    title={item.tooltip}
                  >
                    <div className="finance-map-card-title">{item.title}</div>
                    <p className="finance-map-card-sub">{item.sub}</p>
                    <span className="finance-map-card-badge">{item.badge}</span>
                  </div>
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

      {aba === "consumos" &&
        renderModuloBase(
          "Consumos",
          "MVP inicial para agua, gas, energia e medicoes por unidade.",
          [
            "Cadastrar medidores, unidade vinculada e tipo de consumo.",
            "Importar leitura mensal (manual/CSV) e calcular variacao.",
            "Gerar rateio automatico por unidade com historico."
          ]
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
            <table className="table finance-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descricao</th>
                  <th>Data</th>
                  <th className="finance-value-header">Valor</th>
                  <th>Situacao</th>
                </tr>
              </thead>
              <tbody>
                {transferenciasLancadas.map((lanc) => (
                  <tr key={lanc.id}>
                    <td>{lanc.tipo === "pagar" ? "Saida" : "Entrada"}</td>
                    <td>{lanc.descricao}</td>
                    <td>
                      {lanc.dataCompetencia
                        ? new Date(lanc.dataCompetencia).toLocaleDateString("pt-BR")
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
                {transferenciasLancadas.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
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
                      onClick={() => setLancamentoSelecionado(d)}
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
                  onClick={() => setLancamentoSelecionado(null)}
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
                      onClick={() => setLancamentoSelecionado(r)}
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
                  onClick={() => setLancamentoSelecionado(null)}
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
              />
            </section>
          )}
        </div>
      )}

      {aba === "previsaoOrcamentaria" &&
        renderModuloBase(
          "Previsao orcamentaria",
          "Base para planejar receitas, despesas e desvios por competencia.",
          [
            "Criar cenarios por ano e centro de custo.",
            "Definir metas mensais de receita e limite de despesa.",
            "Comparar previsto x realizado com alertas automaticos."
          ]
        )}

      {aba === "abonos" &&
        renderModuloBase(
          "Abonos",
          "MVP para registrar descontos/creditos em cobrancas e lancamentos.",
          [
            "Selecionar lancamento de origem e motivo do abono.",
            "Aplicar percentual ou valor fixo com trilha de aprovacao.",
            "Emitir comprovante de abono para morador/cliente."
          ]
        )}

      {aba === "baixasManuais" && (
        <div className="finance-table-card" style={{ marginTop: 12 }}>
          <div className="finance-table-header">
            <div>
              <h3>Baixas manuais</h3>
              <p className="finance-form-sub">
                Base para baixa parcial, acerto por caixa e conciliacao manual.
              </p>
            </div>
          </div>
          <table className="table finance-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Descricao</th>
                <th>Vencimento</th>
                <th className="finance-value-header">Valor</th>
                <th>Acao sugerida</th>
              </tr>
            </thead>
            <tbody>
              {pendentesParaBaixa.slice(0, 20).map((lanc) => (
                <tr key={lanc.id}>
                  <td>{lanc.tipo === "pagar" ? "Pagar" : "Receber"}</td>
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
                  <td>Registrar baixa manual</td>
                </tr>
              ))}
              {pendentesParaBaixa.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    Nenhum lançamento em aberto para baixa manual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {aba === "gruposRateio" &&
        renderModuloBase(
          "Grupos de rateio",
          "MVP para distribuir custos por grupo, unidade ou fracao ideal.",
          [
            "Criar grupo de rateio com criterio (igual, fracao, consumo).",
            "Vincular despesas recorrentes ao grupo de rateio.",
            "Gerar lancamentos automaticamente por periodo."
          ]
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
        <div className="finance-table-card" style={{ marginTop: 12 }}>
          <div className="finance-table-header">
            <div>
              <h3>Inadimplentes</h3>
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

      {aba === "livroPrestacaoContas" &&
        renderModuloBase(
          "Livro de prestacao de contas",
          "Base para consolidar balancete, comprovantes e parecer por periodo.",
          [
            "Selecionar periodo de fechamento e dados obrigatorios.",
            "Consolidar receitas, despesas, inadimplencia e saldos.",
            "Exportar livro final em PDF para assembleia e auditoria."
          ]
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
