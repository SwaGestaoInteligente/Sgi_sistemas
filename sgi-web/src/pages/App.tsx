import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { api, ContaFinanceira, Organizacao } from "../api";
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
  | "pets";

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

const Dashboard: React.FC<{ organizacao: Organizacao | null }> = ({
  organizacao
}) => {
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
      const [contasRes, chamadosRes, reservasRes] = await Promise.allSettled([
        api.listarContas(token, organizacao.id),
        api.listarChamados(token, organizacao.id),
        api.listarReservas(token, organizacao.id)
      ]);

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
            R$ {saldoInicialTotal.toFixed(2)}
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

const InnerApp: React.FC = () => {
  const { token, setToken } = useAuth();

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

  const carregarOrganizacoes = useCallback(async () => {
    try {
      setErro(null);
      setLoadingOrgs(true);
      const data = await api.listarOrganizacoes();
      setOrganizacoes(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar organizacoes");
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  useEffect(() => {
    if (!token || !segmentoSelecionado || organizacoes.length > 0) return;
    void carregarOrganizacoes();
  }, [carregarOrganizacoes, organizacoes.length, segmentoSelecionado, token]);

  const segmentoAtual = useMemo(
    () => segmentos.find((seg) => seg.id === segmentoSelecionado) ?? null,
    [segmentoSelecionado]
  );

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
      const atualizado = await api.atualizarOrganizacao(organizacaoAlvo.id, {
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
    if (acao === "lancamento") {
      setView("financeiro");
      setFinanceiroAba("contasPagar");
      setErro(null);
      return;
    }

    if (acao === "chamado") {
      setErro("Modulo de chamados sera liberado em breve.");
      return;
    }

    setErro("Modulo de reservas sera liberado em breve.");
  };

  useEffect(() => {
    if (view !== "financeiro" && sidebarFinanceiroOpen) {
      setSidebarFinanceiroOpen(false);
    }
  }, [sidebarFinanceiroOpen, view]);

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
        {organizacaoSelecionada && (
          <div className="app-header-quick">
            <button
              type="button"
              className="app-header-button app-header-button--ghost"
              onClick={() => executarAcaoRapida("lancamento")}
            >
              Novo lancamento
            </button>
            <button
              type="button"
              className="app-header-button app-header-button--ghost"
              onClick={() => executarAcaoRapida("chamado")}
            >
              Novo chamado
            </button>
            <button
              type="button"
              className="app-header-button app-header-button--ghost"
              onClick={() => executarAcaoRapida("reserva")}
            >
              Nova reserva
            </button>
          </div>
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

  if (!segmentoSelecionado) {
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

  if (!organizacaoSelecionada) {
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

                    const orgCriada = await api.criarOrganizacao({
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
            </div>

            <div className="sidebar-section">
              <p className="sidebar-section-title">Cadastros</p>
              {renderSidebarItem("pessoas", "Pessoas", "👥")}
              {renderSidebarItem("unidades", "Unidades", "🏢")}
              {renderSidebarItem("funcionarios", "Funcionarios", "👔")}
              {renderSidebarItem("fornecedores", "Fornecedores", "🤝")}
              {renderSidebarItem("veiculos", "Veiculos", "🚗")}
              {renderSidebarItem("pets", "Pets", "🐾")}
            </div>

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
          </nav>
        </aside>

        <main className="main-content">
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

          {view === "dashboard" && <Dashboard organizacao={organizacaoSelecionada} />}

          {view === "pessoas" && <PessoasView organizacao={organizacaoSelecionada} />}

          {view === "funcionarios" && (
            <PessoasView
              organizacao={organizacaoSelecionada}
              papelFixo="funcionario"
              titulo="Funcionarios"
            />
          )}

          {view === "fornecedores" && (
            <div className="people-page">
              <div className="people-header-row">
                <div>
                  <h2>Fornecedores</h2>
                </div>
              </div>
            </div>
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

          {view === "unidades" && <UnidadesView organizacao={organizacaoSelecionada} />}

          {view === "financeiro" && (
            <FinanceiroView
              organizacao={organizacaoSelecionada}
              abaSelecionada={financeiroAba}
              onAbaChange={setFinanceiroAba}
              exibirMenuAbas={false}
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
