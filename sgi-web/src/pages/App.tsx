import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import {
  api,
  ContaFinanceira,
  Membership,
  Organizacao,
  UserRole
} from "../api";
import { LoginPage } from "./LoginPage";
import PessoasView from "../views/PessoasView";
import UnidadesView from "../views/UnidadesView";
import FinanceiroView, {
  FinanceiroTab,
  menuFinanceiro
} from "../views/FinanceiroView";

type AppView =
  | "dashboard"
  | "pessoas"
  | "unidades"
  | "financeiro"
  | "funcionarios"
  | "fornecedores"
  | "veiculos"
  | "pets"
  | "chamados"
  | "reservas"
  | "minhaUnidade";

type Segmento = {
  id: string;
  label: string;
  icon: string;
};

const segmentos: Segmento[] = [
  {
    id: "condominios",
    label: "Condominios",
    icon: "🏢"
  },
  {
    id: "empresas",
    label: "Empresas",
    icon: "💼"
  },
  {
    id: "igrejas",
    label: "Igrejas",
    icon: "⛪"
  },
  {
    id: "sitios",
    label: "Sitios / Pousadas",
    icon: "🏡"
  },
  {
    id: "associacoes",
    label: "Associacoes / ONGs",
    icon: "🤝"
  },
  {
    id: "outros",
    label: "Outros",
    icon: "✨"
  }
];

const modulosPorSegmento: Record<string, string> = {
  condominios: "core,financeiro,manutencao,reservas",
  empresas: "core,financeiro,manutencao",
  igrejas: "core,financeiro,igreja,reservas",
  sitios: "core,financeiro,manutencao,reservas,hospedagem",
  associacoes: "core,financeiro,reservas",
  outros: "core,financeiro"
};

const viewMeta: Record<AppView, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Resumo geral",
    subtitle: "Indicadores consolidados da operacao."
  },
  pessoas: {
    title: "Pessoas",
    subtitle: "Cadastro e manutencao de moradores e contatos."
  },
  unidades: {
    title: "Unidades",
    subtitle: "Organizacao das unidades e dados principais."
  },
  financeiro: {
    title: "Financeiro",
    subtitle: "Contas, lancamentos, transferencias e relatorios."
  },
  funcionarios: {
    title: "Funcionarios",
    subtitle: "Gestao de equipe interna."
  },
  fornecedores: {
    title: "Fornecedores",
    subtitle: "Base de parceiros e prestadores de servico."
  },
  veiculos: {
    title: "Veiculos",
    subtitle: "Cadastro e controle de veiculos."
  },
  pets: {
    title: "Pets",
    subtitle: "Cadastro de animais e registros."
  },
  chamados: {
    title: "Chamados",
    subtitle: "Solicitacoes, atendimento e acompanhamento."
  },
  reservas: {
    title: "Reservas",
    subtitle: "Controle de reservas e uso de recursos."
  },
  minhaUnidade: {
    title: "Minha unidade",
    subtitle: "Informacoes e dados da sua unidade."
  }
};

const financeiroSiglas: Record<FinanceiroTab, string> = {
  categorias: "CA",
  contas: "CT",
  consumos: "CS",
  receitasDespesas: "RD",
  contasPagar: "CP",
  contasReceber: "CR",
  previsaoOrcamentaria: "PO",
  transferencias: "TR",
  abonos: "AB",
  baixasManuais: "BM",
  gruposRateio: "GR",
  itensCobrados: "CB",
  faturas: "FT",
  inadimplentes: "IN",
  conciliacaoBancaria: "CC",
  livroPrestacaoContas: "LP",
  relatorios: "RL"
};

const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getActiveMembership = (
  memberships: Membership[] | null | undefined,
  orgId?: string | null
) => {
  if (!memberships || !orgId) return null;
  return (
    memberships.find(
      (m) => m.isActive && m.condoId && m.condoId === orgId
    ) ?? null
  );
};

const canAccessFinanceiro = (role: UserRole) =>
  role === "PLATFORM_ADMIN" || role === "CONDO_ADMIN";

const canEditarCadastros = (role: UserRole) =>
  role === "PLATFORM_ADMIN" || role === "CONDO_ADMIN";

const canVerCadastros = (role: UserRole) =>
  role === "PLATFORM_ADMIN" || role === "CONDO_ADMIN" || role === "CONDO_STAFF";

const Dashboard: React.FC<{
  organizacao: Organizacao | null;
  mostrarFinanceiro?: boolean;
}> = ({ organizacao, mostrarFinanceiro = true }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [chamados, setChamados] = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);

  const carregar = async () => {
    if (!token || !organizacao) return;
    try {
      setErro(null);
      setLoading(true);
      const promises: Promise<any>[] = [];
      if (mostrarFinanceiro) {
        promises.push(api.listarContas(token, organizacao.id));
      } else {
        promises.push(Promise.resolve([]));
      }
      promises.push(api.listarChamados(token, organizacao.id));
      promises.push(api.listarReservas(token, organizacao.id));

      const [contasRes, chamadosRes, reservasRes] = await Promise.allSettled(
        promises
      );

      if (contasRes.status === "fulfilled") {
        setContas(contasRes.value);
      } else {
        throw contasRes.reason;
      }

      if (chamadosRes.status === "fulfilled") {
        setChamados(chamadosRes.value);
      } else {
        setChamados([]);
      }

      if (reservasRes.status === "fulfilled") {
        setReservas(reservasRes.value);
      } else {
        setReservas([]);
      }
    } catch (e: any) {
      const msg = e?.message || "Erro ao carregar dados do dashboard";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, [token, organizacao?.id]);

  const saldoInicialTotal = contas.reduce(
    (sum, conta) => sum + (conta.saldoInicial ?? 0),
    0
  );
  const contasAtivas = contas.filter(
    (conta) => (conta.status ?? "").toLowerCase() === "ativo"
  ).length;

  return (
    <div className="dashboard">
      <div className="dashboard-header-row">
        <p className="dashboard-caption">
          Painel executivo com os principais indicadores da operacao.
        </p>
        <button
          type="button"
          onClick={carregar}
          disabled={loading}
          className="dashboard-refresh"
        >
          {loading ? "Atualizando..." : "Atualizar dados"}
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card dashboard-card--primary">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">$</span>
            <span>Saldo inicial total</span>
          </div>
          <div className="dashboard-card-value">
            {mostrarFinanceiro ? `R$ ${saldoInicialTotal.toFixed(2)}` : "—"}
          </div>
          <div className="dashboard-card-sub">
            Base consolidada das contas financeiras.
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">CF</span>
            <span>Contas financeiras ativas</span>
          </div>
          <div className="dashboard-card-value">{contasAtivas}</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">CH</span>
            <span>Chamados registrados</span>
          </div>
          <div className="dashboard-card-value">{chamados.length}</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">RS</span>
            <span>Reservas de areas comuns</span>
          </div>
          <div className="dashboard-card-value">{reservas.length}</div>
        </div>
      </div>

      {erro && (
        <p className="error" style={{ marginTop: 8 }}>
          {erro}
        </p>
      )}
    </div>
  );
};

const NoAccessPage: React.FC<{ mensagem?: string; onSair?: () => void }> = ({
  mensagem,
  onSair
}) => (
  <div className="container" style={{ maxWidth: 720 }}>
    <div className="org-form-card">
      <h2>Sem acesso</h2>
      <p>{mensagem ?? "Sem vinculo ativo com condominio. Contate a administracao."}</p>
      {onSair && (
        <button type="button" className="primary-button" onClick={onSair}>
          Sair
        </button>
      )}
    </div>
  </div>
);

const MinhaUnidadeView: React.FC<{
  organizacao: Organizacao;
  unidadeId?: string | null;
}> = ({ organizacao, unidadeId }) => {
  const { token } = useAuth();
  const [unidade, setUnidade] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      if (!token || !unidadeId) return;
      try {
        const lista = await api.listarUnidades(token, organizacao.id);
        setUnidade(lista.find((u) => u.id === unidadeId) ?? null);
      } catch (e: any) {
        setErro(e.message || "Erro ao carregar unidade");
      }
    };
    void carregar();
  }, [token, organizacao.id, unidadeId]);

  if (!unidadeId) {
    return <p className="error">Unidade nao vinculada.</p>;
  }

  if (erro) {
    return <p className="error">{erro}</p>;
  }

  if (!unidade) {
    return <p>Carregando unidade...</p>;
  }

  return (
    <div className="finance-table-card">
      <h3>{unidade.nome}</h3>
      <p>Tipo: {unidade.tipo}</p>
      <p>Codigo interno: {unidade.codigoInterno}</p>
      <p>Status: {unidade.status}</p>
    </div>
  );
};

const ChamadosView: React.FC<{
  organizacao: Organizacao;
  pessoaId: string;
  unidadeId?: string | null;
}> = ({ organizacao, pessoaId, unidadeId }) => {
  const { token } = useAuth();
  const [chamados, setChamados] = useState<any[]>([]);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const lista = await api.listarChamados(token, organizacao.id);
      setChamados(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar chamados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizacao.id]);

  const criarChamado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const criado = await api.criarChamado(token, {
        id: crypto.randomUUID(),
        organizacaoId: organizacao.id,
        unidadeOrganizacionalId: unidadeId ?? null,
        pessoaSolicitanteId: pessoaId,
        categoria,
        titulo,
        descricao,
        status: "aberto"
      });
      setChamados((prev) => [criado, ...prev]);
      setTitulo("");
      setDescricao("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar chamado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finance-layout">
      <section className="finance-form-card">
        <h3>Novo chamado</h3>
        <form onSubmit={criarChamado} className="form">
          <label>
            Categoria
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          </label>
          <label>
            Titulo
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>
          <label>
            Descricao
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Enviando..." : "Criar chamado"}
          </button>
        </form>
        {erro && <p className="error">{erro}</p>}
      </section>
      <section className="finance-table-card">
        <div className="finance-table-header">
          <h3>Chamados</h3>
          <button type="button" onClick={carregar} disabled={loading}>
            Atualizar
          </button>
        </div>
        <table className="table finance-table">
          <thead>
            <tr>
              <th>Titulo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {chamados.map((c) => (
              <tr key={c.id}>
                <td>{c.titulo}</td>
                <td>{c.status}</td>
              </tr>
            ))}
            {chamados.length === 0 && (
              <tr>
                <td colSpan={2} style={{ textAlign: "center" }}>
                  Nenhum chamado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

const ReservasView: React.FC<{
  organizacao: Organizacao;
  pessoaId: string;
  unidadeId?: string | null;
}> = ({ organizacao, pessoaId, unidadeId }) => {
  const { token } = useAuth();
  const [reservas, setReservas] = useState<any[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [status, setStatus] = useState("solicitada");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const lista = await api.listarReservas(token, organizacao.id);
      setReservas(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar reservas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizacao.id]);

  const criarReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const criado = await api.criarReserva(token, {
        id: crypto.randomUUID(),
        organizacaoId: organizacao.id,
        recursoReservavelId: crypto.randomUUID(),
        pessoaSolicitanteId: pessoaId,
        unidadeOrganizacionalId: unidadeId ?? null,
        dataInicio,
        dataFim,
        status
      });
      setReservas((prev) => [criado, ...prev]);
      setDataInicio("");
      setDataFim("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar reserva");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finance-layout">
      <section className="finance-form-card">
        <h3>Nova reserva</h3>
        <form onSubmit={criarReserva} className="form">
          <label>
            Data inicio
            <input
              type="datetime-local"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </label>
          <label>
            Data fim
            <input
              type="datetime-local"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </label>
          <label>
            Status
            <input value={status} onChange={(e) => setStatus(e.target.value)} />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Enviando..." : "Criar reserva"}
          </button>
        </form>
        {erro && <p className="error">{erro}</p>}
      </section>
      <section className="finance-table-card">
        <div className="finance-table-header">
          <h3>Reservas</h3>
          <button type="button" onClick={carregar} disabled={loading}>
            Atualizar
          </button>
        </div>
        <table className="table finance-table">
          <thead>
            <tr>
              <th>Inicio</th>
              <th>Fim</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((r) => (
              <tr key={r.id}>
                <td>{r.dataInicio}</td>
                <td>{r.dataFim}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {reservas.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center" }}>
                  Nenhuma reserva encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

const InnerApp: React.FC = () => {
  const { token, setToken, session, setSession } = useAuth();

  const [segmentoSelecionado, setSegmentoSelecionado] = useState<string | null>(
    null
  );
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [organizacaoSelecionada, setOrganizacaoSelecionada] =
    useState<Organizacao | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novoNomeOrg, setNovoNomeOrg] = useState("");
  const [criandoOrg, setCriandoOrg] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [view, setView] = useState<AppView>("dashboard");
  const [financeiroAba, setFinanceiroAba] = useState<FinanceiroTab>("contas");
  const [sidebarFinanceiroOpen, setSidebarFinanceiroOpen] = useState(false);
  const contentRef = useRef<HTMLElement | null>(null);

  const carregarOrganizacoes = useCallback(async () => {
    try {
      setErro(null);
      setLoadingOrgs(true);
      if (!token) return;
      const data = await api.listarOrganizacoes(token);
      setOrganizacoes(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar organizacoes");
    } finally {
      setLoadingOrgs(false);
    }
  }, [token]);

  const carregarOrganizacoesUsuario = useCallback(async () => {
    try {
      setErro(null);
      setLoadingOrgs(true);
      if (!token) return;
      const data = await api.listarMinhasOrganizacoes(token);
      setOrganizacoes(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar condominios");
    } finally {
      setLoadingOrgs(false);
    }
  }, [token]);

  const isPlatformAdmin = session?.isPlatformAdmin ?? false;

  useEffect(() => {
    if (!token || !session) return;
    if (isPlatformAdmin) {
      if (!segmentoSelecionado || organizacoes.length > 0) return;
      void carregarOrganizacoes();
      return;
    }

    if (organizacoes.length > 0) return;
    void carregarOrganizacoesUsuario();
  }, [
    carregarOrganizacoes,
    carregarOrganizacoesUsuario,
    isPlatformAdmin,
    organizacoes.length,
    segmentoSelecionado,
    session,
    token
  ]);

  const activeMemberships = useMemo(
    () =>
      (session?.memberships ?? []).filter(
        (m) => m.isActive && m.role !== "PLATFORM_ADMIN"
      ),
    [session?.memberships]
  );

  useEffect(() => {
    if (isPlatformAdmin || !session) return;
    if (organizacaoSelecionada) return;

    const orgIds = Array.from(
      new Set(
        activeMemberships
          .map((m) => m.condoId)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (orgIds.length === 1 && organizacoes.length > 0) {
      const org = organizacoes.find((item) => item.id === orgIds[0]);
      if (org) {
        setOrganizacaoSelecionada(org);
        setView("dashboard");
        setErro(null);
      }
    }
  }, [activeMemberships, isPlatformAdmin, organizacaoSelecionada, organizacoes, session]);

  const segmentoAtual = useMemo(() => {
    if (!isPlatformAdmin) return null;
    return segmentos.find((seg) => seg.id === segmentoSelecionado) ?? null;
  }, [isPlatformAdmin, segmentoSelecionado]);

  const organizacoesDoSegmento = useMemo(() => {
    if (!segmentoAtual) return organizacoes;
    const tipoSegmento = normalizeText(segmentoAtual.label);
    return organizacoes.filter(
      (org) => normalizeText(org.tipo) === tipoSegmento
    );
  }, [organizacoes, segmentoAtual]);

  const opcoesOrganizacao = useMemo(() => {
    if (!organizacaoSelecionada) return organizacoesDoSegmento;
    const map = new Map<string, Organizacao>();
    [...organizacoesDoSegmento, organizacaoSelecionada].forEach((org) =>
      map.set(org.id, org)
    );
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [organizacaoSelecionada, organizacoesDoSegmento]);

  const membershipAtual = getActiveMembership(
    session?.memberships,
    organizacaoSelecionada?.id
  );

  const roleAtual: UserRole | null = isPlatformAdmin
    ? "PLATFORM_ADMIN"
    : membershipAtual?.role ?? null;

  const podeFinanceiro = roleAtual ? canAccessFinanceiro(roleAtual) : false;
  const podeVerCadastros = roleAtual ? canVerCadastros(roleAtual) : false;
  const podeEditarCadastros = roleAtual ? canEditarCadastros(roleAtual) : false;
  const isResident = roleAtual === "RESIDENT";

  const activePathname = useMemo(() => {
    if (!token || !session) return "/login";

    if (!organizacaoSelecionada) {
      if (isPlatformAdmin) {
        return segmentoSelecionado
          ? `/segmentos/${segmentoSelecionado}`
          : "/segmentos";
      }
      return "/organizacoes";
    }

    const basePath = `/organizacoes/${organizacaoSelecionada.id}`;
    if (view === "financeiro") {
      return `${basePath}/financeiro/${financeiroAba}`;
    }

    return `${basePath}/${view}`;
  }, [
    financeiroAba,
    isPlatformAdmin,
    organizacaoSelecionada,
    segmentoSelecionado,
    session,
    token,
    view
  ]);

  useEffect(() => {
    window.scrollTo(0, 0);

    const contentEl = contentRef.current;
    if (contentEl) {
      contentEl.scrollTop = 0;
      contentEl.scrollTo({ top: 0, left: 0 });
    }
  }, [activePathname]);

  const irParaInicio = () => {
    setOrganizacaoSelecionada(null);
    setSegmentoSelecionado(null);
    setOrganizacoes([]);
    setView("dashboard");
    setSidebarCompact(false);
    setErro(null);
  };

  const sairDoSistema = () => {
    setToken(null);
    setSession(null);
    setOrganizacaoSelecionada(null);
    setSegmentoSelecionado(null);
    setOrganizacoes([]);
    setView("dashboard");
    setSidebarCompact(false);
    setErro(null);
  };

  const trocarOrganizacao = (orgId: string) => {
    const org = opcoesOrganizacao.find((item) => item.id === orgId);
    if (!org) return;
    setOrganizacaoSelecionada(org);
    setView("dashboard");
    setErro(null);
  };

  const editarNomeOrganizacao = async (organizacaoAlvo: Organizacao) => {
    const novoNome = window.prompt(
      "Novo nome da organizacao:",
      organizacaoAlvo.nome
    );
    if (!novoNome || !novoNome.trim()) return;

    try {
      setErro(null);
      if (!token) return;
      const atualizado = await api.atualizarOrganizacao(token, organizacaoAlvo.id, {
        nome: novoNome.trim(),
        tipo: organizacaoAlvo.tipo,
        modulosAtivos: organizacaoAlvo.modulosAtivos,
        status: "ativo"
      });

      setOrganizacaoSelecionada((atual) =>
        atual?.id === atualizado.id ? atualizado : atual
      );
      setOrganizacoes((prev) =>
        prev.map((item) => (item.id === atualizado.id ? atualizado : item))
      );
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar nome da organizacao");
    }
  };

  const executarAcaoRapida = (acao: "lancamento" | "chamado" | "reserva") => {
    if (!roleAtual) {
      setErro("Sem acesso para executar acoes rapidas.");
      return;
    }
    if (acao === "lancamento") {
      if (!canAccessFinanceiro(roleAtual)) {
        setErro("Sem acesso ao financeiro.");
        return;
      }
      setView("financeiro");
      setFinanceiroAba("contasPagar");
      setErro(null);
      return;
    }

    if (acao === "chamado") {
      setView("chamados");
      setErro(null);
      return;
    }

    setView("reservas");
    setErro(null);
  };

  useEffect(() => {
    if (view !== "financeiro" && sidebarFinanceiroOpen) {
      setSidebarFinanceiroOpen(false);
    }
  }, [sidebarFinanceiroOpen, view]);

  useEffect(() => {
    if (!podeFinanceiro && view === "financeiro") {
      setView("dashboard");
    }
  }, [podeFinanceiro, view]);

  const topBar = (
    <header className="app-header">
      <div className="app-header-left">
        <img
          src={`${import.meta.env.BASE_URL}swa1.jpeg`}
          alt="Logo SWA"
          className="app-header-logo-img"
        />
        <div className="app-header-brand">
          <span className="app-header-title">SWA Gestao Inteligente</span>
          <span className="app-header-subtitle">
            {organizacaoSelecionada
              ? organizacaoSelecionada.nome
              : "Sistema de gestao corporativa"}
          </span>
        </div>
      </div>

      <div className="app-header-center">
        {organizacaoSelecionada ? (
          <label className="app-header-org-picker">
            <span>Condominio atual</span>
            <select
              value={organizacaoSelecionada.id}
              onChange={(e) => trocarOrganizacao(e.target.value)}
            >
              {opcoesOrganizacao.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.nome}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="app-header-context-pill">
            {segmentoAtual ? segmentoAtual.label : "Selecione um segmento"}
          </span>
        )}
      </div>

      <div className="app-header-right">
        {organizacaoSelecionada && roleAtual && (
          <details className="app-header-quick-menu">
            <summary className="app-header-quick-trigger">Acoes</summary>
            <div className="app-header-quick-dropdown">
              {canAccessFinanceiro(roleAtual) && (
                <button
                  type="button"
                  className="app-user-option"
                  onClick={() => executarAcaoRapida("lancamento")}
                >
                  Novo lancamento
                </button>
              )}
              <button
                type="button"
                className="app-user-option"
                onClick={() => executarAcaoRapida("chamado")}
              >
                Novo chamado
              </button>
              <button
                type="button"
                className="app-user-option"
                onClick={() => executarAcaoRapida("reserva")}
              >
                Nova reserva
              </button>
            </div>
          </details>
        )}

        <button
          type="button"
          className="app-header-button app-header-button--ghost"
          onClick={irParaInicio}
        >
          Inicio
        </button>

        <details className="app-user-menu">
          <summary className="app-user-trigger">
            <span className="app-user-avatar">AD</span>
            <span className="app-user-name">Usuario</span>
          </summary>
          <div className="app-user-dropdown">
            <button
              type="button"
              className="app-user-option"
              onClick={() => setErro("Tela de perfil sera liberada em breve.")}
            >
              Perfil
            </button>
            <button
              type="button"
              className="app-user-option app-user-option--danger"
              onClick={sairDoSistema}
            >
              Sair
            </button>
          </div>
        </details>
      </div>
    </header>
  );

  if (!token) {
    return <LoginPage />;
  }

  if (!session) {
    return (
      <NoAccessPage
        mensagem="Sessao incompleta. Faca login novamente."
        onSair={sairDoSistema}
      />
    );
  }

  if (!isPlatformAdmin) {
    if (activeMemberships.length === 0) {
      return (
        <NoAccessPage
          mensagem="Sem vinculo ativo com condominio. Contate a administracao."
          onSair={sairDoSistema}
        />
      );
    }

    if (!organizacaoSelecionada) {
      return (
        <>
          {topBar}
          <div className="container org-page">
            <div className="org-header-row">
              <div>
                <h1>Selecione um condominio</h1>
              </div>
            </div>

            <section className="org-list-card">
              <div className="org-list-header">
                <h3>Condominios vinculados</h3>
              </div>
              {loadingOrgs && <p>Carregando...</p>}
              {!loadingOrgs && organizacoes.length === 0 && (
                <p className="org-empty">Nenhum condominio disponivel.</p>
              )}
              <div className="org-list-grid">
                {organizacoes.map((org) => (
                  <div key={org.id} className="org-card">
                    <button
                      type="button"
                      className="org-card-main"
                      onClick={() => {
                        setOrganizacaoSelecionada(org);
                        setView("dashboard");
                        setErro(null);
                      }}
                    >
                      <div className="org-card-title">{org.nome}</div>
                      {org.tipo && <div className="org-card-sub">{org.tipo}</div>}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      );
    }
  }

  if (isPlatformAdmin && !segmentoSelecionado) {
    return (
      <>
        {topBar}
        <div className="container">
          <h1>Escolha o tipo de organizacao</h1>
          <div className="segment-grid">
            {segmentos.map((segmento) => (
              <button
                key={segmento.id}
                className="segment-card"
                onClick={() => setSegmentoSelecionado(segmento.id)}
              >
                <span className="segment-icon">{segmento.icon}</span>
                <div className="segment-text">
                  <span className="segment-label">{segmento.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (isPlatformAdmin && !organizacaoSelecionada) {
    return (
      <>
        {topBar}
        <div className="container org-page">
          <div className="org-header-row">
            <div>
              <h1>Selecione uma organizacao</h1>
            </div>
            <button
              type="button"
              onClick={irParaInicio}
              className="org-back-button"
            >
              Voltar para tipos
            </button>
          </div>

          <div className="org-layout">
            <section className="org-form-card">
              <h3>Nova organizacao</h3>
              <label>
                Nome da organizacao
                <input
                  type="text"
                  value={novoNomeOrg}
                  onChange={(e) => setNovoNomeOrg(e.target.value)}
                  placeholder="Ex.: Condominio Mar Verde 4"
                />
              </label>
              <button
                onClick={async () => {
                  if (!novoNomeOrg.trim()) return;
                  try {
                    setCriandoOrg(true);
                    const modulosAtivos =
                      (segmentoAtual && modulosPorSegmento[segmentoAtual.id]) ??
                      "core,financeiro";

                    if (!token) return;
                    const orgCriada = await api.criarOrganizacao(token, {
                      nome: novoNomeOrg.trim(),
                      tipo: segmentoAtual?.label,
                      modulosAtivos
                    });

                    setOrganizacoes((prev) => [...prev, orgCriada]);
                    setNovoNomeOrg("");
                  } catch (e: any) {
                    setErro(e.message || "Erro ao criar organizacao");
                  } finally {
                    setCriandoOrg(false);
                  }
                }}
                disabled={criandoOrg || !novoNomeOrg.trim()}
              >
                {criandoOrg ? "Salvando..." : "Criar organizacao"}
              </button>

              <button
                type="button"
                onClick={carregarOrganizacoes}
                disabled={loadingOrgs}
                className="org-load-button"
              >
                {loadingOrgs ? "Carregando..." : "Atualizar organizacoes"}
              </button>
              {erro && <p className="error">{erro}</p>}
            </section>

            <section className="org-list-card">
              <div className="org-list-header">
                <h3>Organizacoes cadastradas</h3>
              </div>
              {opcoesOrganizacao.length > 0 ? (
                <div className="org-list-grid">
                  {opcoesOrganizacao.map((org) => (
                    <div key={org.id} className="org-card">
                      <button
                        type="button"
                        className="org-card-main"
                        onClick={() => {
                          setOrganizacaoSelecionada(org);
                          setView("dashboard");
                          setErro(null);
                        }}
                      >
                        <div className="org-card-title">{org.nome}</div>
                        {org.tipo && <div className="org-card-sub">{org.tipo}</div>}
                        {org.modulosAtivos && (
                          <div className="org-card-tags">
                            {org.modulosAtivos.split(",").map((modulo) => (
                              <span key={modulo} className="org-tag">
                                {modulo}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                      <button
                        type="button"
                        className="org-card-edit"
                        onClick={() => void editarNomeOrganizacao(org)}
                      >
                        Editar nome
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="org-empty">
                  Nenhuma organizacao encontrada para este segmento.
                </p>
              )}
            </section>
          </div>
        </div>
      </>
    );
  }

  const renderSidebarItem = (
    target: AppView,
    label: string,
    icon: string
  ) => (
    <button
      key={target}
      type="button"
      onClick={() => {
        setView(target);
        setErro(null);
      }}
      className={"sidebar-item" + (view === target ? " sidebar-item--active" : "")}
      title={label}
    >
      <span className="sidebar-item-icon">{icon}</span>
      <span className="sidebar-item-label">{label}</span>
    </button>
  );

  return (
    <>
      {topBar}
      <div className={"app-shell" + (sidebarCompact ? " app-shell--compact" : "")}>
        <aside className={"sidebar" + (sidebarCompact ? " sidebar--compact" : "")}>
          <div className="sidebar-header">
            <div className="sidebar-title-row">
              <div className="sidebar-title">{organizacaoSelecionada.nome}</div>
              <button
                type="button"
                className="sidebar-collapse"
                onClick={() => setSidebarCompact((prev) => !prev)}
                title={sidebarCompact ? "Expandir menu" : "Compactar menu"}
              >
                {sidebarCompact ? ">>" : "<<"}
              </button>
            </div>

            {!sidebarCompact && (
              <div className="sidebar-actions">
                <button
                  type="button"
                  className="sidebar-action sidebar-action--secondary"
                  onClick={() => {
                    setOrganizacaoSelecionada(null);
                    setView("dashboard");
                    setErro(null);
                  }}
                >
                  Voltar
                </button>
              </div>
            )}
          </div>

          <nav className="sidebar-menu">
            <div className="sidebar-section">
              <p className="sidebar-section-title">Resumo</p>
              {renderSidebarItem("dashboard", "Resumo geral", "📊")}
              {isResident &&
                renderSidebarItem("minhaUnidade", "Minha unidade", "🏠")}
            </div>

            {podeVerCadastros && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Cadastros</p>
                {renderSidebarItem("pessoas", "Pessoas", "👥")}
                {renderSidebarItem("unidades", "Unidades", "🏢")}
                {podeEditarCadastros &&
                  renderSidebarItem("funcionarios", "Funcionarios", "👔")}
                {podeEditarCadastros &&
                  renderSidebarItem("fornecedores", "Fornecedores", "🤝")}
                {renderSidebarItem("veiculos", "Veiculos", "🚗")}
                {renderSidebarItem("pets", "Pets", "🐾")}
              </div>
            )}

            {podeFinanceiro && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Financeiro</p>
                <button
                  type="button"
                  onClick={() => {
                    if (view !== "financeiro") {
                      setView("financeiro");
                      setSidebarFinanceiroOpen(true);
                      setErro(null);
                      return;
                    }
                    setSidebarFinanceiroOpen((prev) => !prev);
                  }}
                  className={
                    "sidebar-item" + (view === "financeiro" ? " sidebar-item--active" : "")
                  }
                  title="Financeiro"
                >
                  <span className="sidebar-item-icon">💰</span>
                  <span className="sidebar-item-label">Financeiro</span>
                </button>
                <div
                  className={
                    "sidebar-submenu" +
                    (sidebarFinanceiroOpen ? " sidebar-submenu--open" : "")
                  }
                >
                  {menuFinanceiro.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        "sidebar-subitem" +
                        (view === "financeiro" && financeiroAba === item.id
                          ? " sidebar-subitem--active"
                          : "")
                      }
                      onClick={() => {
                        setView("financeiro");
                        setFinanceiroAba(item.id);
                        setSidebarFinanceiroOpen(true);
                        setErro(null);
                      }}
                      title={item.label}
                    >
                      <span className="sidebar-subitem-icon">{financeiroSiglas[item.id]}</span>
                      <span className="sidebar-subitem-label">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="sidebar-section">
              <p className="sidebar-section-title">Operacao</p>
              {renderSidebarItem("chamados", "Chamados", "🛠️")}
              {renderSidebarItem("reservas", "Reservas", "📅")}
            </div>
          </nav>
        </aside>

        <main ref={contentRef} className="main-content">
          <header className="page-header">
            <div>
              <p className="page-header-eyebrow">{organizacaoSelecionada.nome}</p>
              <h1 className="page-header-title">{viewMeta[view].title}</h1>
              <p className="page-header-subtitle">{viewMeta[view].subtitle}</p>
            </div>

            <div className="page-header-actions">
              {view !== "dashboard" && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setView("dashboard")}
                >
                  Voltar ao resumo
                </button>
              )}
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setOrganizacaoSelecionada(null);
                  setView("dashboard");
                  setErro(null);
                }}
              >
                Trocar condominio
              </button>
            </div>
          </header>

          {erro && <p className="error">{erro}</p>}

          {view === "dashboard" && (
            <Dashboard
              organizacao={organizacaoSelecionada}
              mostrarFinanceiro={roleAtual ? canAccessFinanceiro(roleAtual) : true}
            />
          )}

          {view === "pessoas" && (
            <PessoasView
              organizacao={organizacaoSelecionada}
              readOnly={!podeEditarCadastros}
            />
          )}

          {view === "funcionarios" && podeEditarCadastros && (
            <PessoasView
              organizacao={organizacaoSelecionada}
              papelFixo="funcionario"
              titulo="Funcionarios"
            />
          )}
          {view === "funcionarios" && !podeEditarCadastros && (
            <NoAccessPage mensagem="Sem acesso a funcionarios." />
          )}

          {view === "fornecedores" && podeEditarCadastros && (
            <div className="people-page">
              <div className="people-header-row">
                <div>
                  <h2>Fornecedores</h2>
                </div>
              </div>
            </div>
          )}
          {view === "fornecedores" && !podeEditarCadastros && (
            <NoAccessPage mensagem="Sem acesso a fornecedores." />
          )}

          {view === "veiculos" && (
            <div className="people-page">
              <div className="people-header-row">
                <div>
                  <h2>Veiculos</h2>
                </div>
              </div>
            </div>
          )}

          {view === "pets" && (
            <div className="people-page">
              <div className="people-header-row">
                <div>
                  <h2>Pets</h2>
                </div>
              </div>
            </div>
          )}

          {view === "unidades" && (
            <UnidadesView
              organizacao={organizacaoSelecionada}
              readOnly={!podeEditarCadastros}
            />
          )}

          {view === "financeiro" && podeFinanceiro && (
            <FinanceiroView
              organizacao={organizacaoSelecionada}
              abaSelecionada={financeiroAba}
              onAbaChange={setFinanceiroAba}
              exibirMenuAbas={false}
            />
          )}
          {view === "financeiro" && !podeFinanceiro && (
            <NoAccessPage mensagem="Sem acesso ao financeiro." />
          )}

          {view === "minhaUnidade" && membershipAtual && (
            <MinhaUnidadeView
              organizacao={organizacaoSelecionada}
              unidadeId={membershipAtual.unidadeOrganizacionalId}
            />
          )}

          {view === "chamados" && session && (
            <ChamadosView
              organizacao={organizacaoSelecionada}
              pessoaId={session.pessoaId}
              unidadeId={membershipAtual?.unidadeOrganizacionalId}
            />
          )}

          {view === "reservas" && session && (
            <ReservasView
              organizacao={organizacaoSelecionada}
              pessoaId={session.pessoaId}
              unidadeId={membershipAtual?.unidadeOrganizacionalId}
            />
          )}
        </main>
      </div>
    </>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <InnerApp />
  </AuthProvider>
);

export default App;
