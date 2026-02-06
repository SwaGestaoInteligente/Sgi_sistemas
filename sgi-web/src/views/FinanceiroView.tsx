import React, { useEffect, useState } from "react";
import { useCallback, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  api,
  ChargeItem,
  ConciliacaoImportResponse,
  ContaFinanceira,
  DocumentoCobranca,
  LancamentoFinanceiro,
  Organizacao,
  Pessoa,
  PlanoContas
} from "../api";
import { useAuth } from "../hooks/useAuth";

type FinanceiroViewProps = {
  organizacao: Organizacao;
  abaSelecionada?: FinanceiroTab;
  onAbaChange?: (aba: FinanceiroTab) => void;
  exibirMenuAbas?: boolean;
};

export type FinanceiroTab =
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
  { id: "conciliacaoBancaria", label: "Conciliacao bancaria", badge: "Em breve" },
  { id: "livroPrestacaoContas", label: "Livro de prestacao de contas", badge: "Em breve" },
  { id: "relatorios", label: "Relatorios" }
];

export default function FinanceiroView({
  organizacao,
  abaSelecionada,
  onAbaChange,
  exibirMenuAbas = true
}: FinanceiroViewProps) {
  const topoRef = useRef<HTMLDivElement | null>(null);
  const { token, session } = useAuth();
  const [abaLocal, setAbaLocal] = useState<FinanceiroTab>("contas");
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

  // Plano de contas (categorias financeiras)
  const [novaCategoriaCodigo, setNovaCategoriaCodigo] = useState("");
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [novaCategoriaTipo, setNovaCategoriaTipo] =
    useState<"Receita" | "Despesa">("Receita");

  const organizacaoId = organizacao.id;

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
          arquivoEnvio
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
    if (!token || !item.sugestaoLancamentoId) return;
    try {
      setErro(null);
      setConciliandoId(item.sugestaoLancamentoId);
      await api.confirmarConciliacao(token, item.sugestaoLancamentoId, organizacaoId, {
        dataConciliacao: item.data,
        documento: item.documento,
        referencia: item.descricao
      });
      setConciliados((prev) => [...prev, item.sugestaoLancamentoId!]);
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
  const contasAtivas = contas.filter((c) => c.status === "ativo").length;
  const contasInativas = contas.filter((c) => c.status === "inativo").length;
  const contasTransferencia = contas.filter(
    (c) => (c.status ?? "ativo").toLowerCase() === "ativo"
  );
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
          <button
            type="button"
            className="action-primary"
            onClick={() => setMostrarEnvio((prev) => !prev)}
          >
            Enviar para o SGI
          </button>
        </div>

        {mostrarEnvio && (
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

      {aba === "contas" && (
        <div className="finance-layout">
          <div className="finance-side-column">
            {/* Formulário de conta */}
            <section className="finance-form-card">
              <h3>Nova conta</h3>

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
                {erro && <p className="error">{erro}</p>}
              </form>
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
          <h3>Contas a pagar</h3>

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
                situacao === "aberto" && isAdmin
                  ? { label: "Aprovar", action: "aprovar" }
                  : situacao === "aprovado" && (isAdmin || isStaff)
                  ? { label: "Marcar como pago", action: "pagar" }
                  : situacao === "pago" && (isAdmin || isStaff)
                  ? { label: "Conciliar", action: "conciliar" }
                  : situacao === "conciliado" && isAdmin
                  ? { label: "Fechar", action: "fechar" }
                  : situacao === "fechado" && isPlatformAdmin
                  ? { label: "Reabrir", action: "reabrir" }
                  : null;
              const podeCancelar =
                isAdmin && (situacao === "aberto" || situacao === "aprovado");
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
                  </div>
                </div>
              );
            })}
            {despesasValidas.length === 0 && (
              <p className="empty">Nenhuma despesa cadastrada ainda.</p>
            )}
          </div>
        </div>
      )}

      {aba === "contasReceber" && (
        <div className="finance-table-card" style={{ marginTop: 12 }}>
          <h3>Contas a receber</h3>

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
                situacao === "aberto" && isAdmin
                  ? { label: "Aprovar", action: "aprovar" }
                  : situacao === "aprovado" && (isAdmin || isStaff)
                  ? { label: "Marcar como pago", action: "pagar" }
                  : situacao === "pago" && (isAdmin || isStaff)
                  ? { label: "Conciliar", action: "conciliar" }
                  : situacao === "conciliado" && isAdmin
                  ? { label: "Fechar", action: "fechar" }
                  : situacao === "fechado" && isPlatformAdmin
                  ? { label: "Reabrir", action: "reabrir" }
                  : null;
              const podeCancelar =
                isAdmin && (situacao === "aberto" || situacao === "aprovado");
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
                  </div>
                </div>
              );
            })}
            {receitasValidas.length === 0 && (
              <p className="empty">Nenhuma receita cadastrada ainda.</p>
            )}
          </div>
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
                  <th />
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
                  </tr>
                ))}
                {itensCobrados.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
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
                  <th>Acoes</th>
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
                  </tr>
                ))}
                {faturas.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center" }}>
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

          <form
            className="finance-upload-form"
            onSubmit={(e) => {
              setTipoEnvio("extrato");
              void enviarArquivoFinanceiro(e);
            }}
          >
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

          {extratoImportado && (
            <div className="finance-card-list" style={{ marginTop: 16 }}>
              {extratoImportado.itens.map((item) => {
                const conciliado = item.sugestaoLancamentoId
                  ? conciliados.includes(item.sugestaoLancamentoId)
                  : false;
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
                        <span className="badge-status badge-status--conciliado">
                          {conciliado ? "Conciliado" : "Pendente"}
                        </span>
                      </div>
                    </div>
                    <div className="finance-item-actions">
                      {item.sugestaoLancamentoId ? (
                        <button
                          type="button"
                          className="action-primary"
                          disabled={conciliado || conciliandoId === item.sugestaoLancamentoId}
                          onClick={() => void confirmarConciliacao(item)}
                        >
                          {conciliado
                            ? "Conciliado"
                            : conciliandoId === item.sugestaoLancamentoId
                            ? "Conciliando..."
                            : "Conciliar"}
                        </button>
                      ) : (
                        <span className="finance-item-sub">
                          Sem sugestão automática
                        </span>
                      )}
                    </div>
                    {item.sugestaoDescricao && (
                      <div className="finance-item-sub">
                        Sugestão: {item.sugestaoDescricao}
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
                  <th />
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
                    </tr>
                  ))}
                {categoriasReceita.length + categoriasDespesa.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
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
        <div className="finance-table-card" style={{ marginTop: 12 }}>
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
        </div>
      )}
    </div>
  );
}
