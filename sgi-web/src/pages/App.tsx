import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { api, ContaFinanceira, Organizacao } from "../api";
import { LoginPage } from "./LoginPage";
import PessoasView from "../views/PessoasView";
import UnidadesView from "../views/UnidadesView";
import FinanceiroView from "../views/FinanceiroView";

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
    (sum, c) => sum + (c.saldoInicial ?? 0),
    0
  );
  const contasAtivas = contas.filter((c) => c.status === "ativo").length;

  return (
    <div className="dashboard">
      <div className="dashboard-header-row">
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
          <div className="dashboard-card-label">💰 Saldo inicial total</div>
          <div className="dashboard-card-value">
            R$ {saldoInicialTotal.toFixed(2)}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">🏦 Contas financeiras ativas</div>
          <div className="dashboard-card-value">{contasAtivas}</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">📣 Chamados registrados</div>
          <div className="dashboard-card-value">{chamados.length}</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">🏘️ Reservas de áreas comuns</div>
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

type Segmento = {
  id: string;
  label: string;
  icon: string;
};

const segmentos: Segmento[] = [
  {
    id: "condominios",
    label: "Condomínios",
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
    label: "Sítios / Pousadas",
    icon: "🏡"
  },
  {
    id: "associacoes",
    label: "Associações / ONGs",
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
  const [view, setView] =
    useState<
      | "dashboard"
      | "pessoas"
      | "unidades"
      | "financeiro"
      | "funcionarios"
      | "fornecedores"
      | "veiculos"
      | "pets"
    >("dashboard");

  const irParaInicio = () => {
    setOrganizacaoSelecionada(null);
    setSegmentoSelecionado(null);
    setOrganizacoes([]);
    setView("dashboard");
    setErro(null);
  };

  const sairDoSistema = () => {
    setToken(null);
    setOrganizacaoSelecionada(null);
    setSegmentoSelecionado(null);
    setOrganizacoes([]);
    setView("dashboard");
    setErro(null);
  };

  const topBar = (
    <header className="app-header">
      <div className="app-header-left">
        <img
          src={`${import.meta.env.BASE_URL}swa1.jpeg`}
          alt="Logo SWA"
          className="app-header-logo-img"
        />
        <span className="app-header-title">SWA Gestão Inteligente</span>
      </div>
      <div className="app-header-right">
        <button
          type="button"
          className="app-header-button"
          onClick={irParaInicio}
        >
          Início
        </button>
        <button
          type="button"
          className="app-header-button app-header-button--danger"
          onClick={sairDoSistema}
        >
          Sair
        </button>
      </div>
    </header>
  );

  const carregarOrganizacoes = async () => {
    try {
      setErro(null);
      setLoadingOrgs(true);
      const data = await api.listarOrganizacoes();
      setOrganizacoes(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar organizações");
    } finally {
      setLoadingOrgs(false);
    }
  };

  if (!token) {
    return <LoginPage />;
  }

  if (!segmentoSelecionado) {
    return (
      <>
        {topBar}
        <div className="container">
          <h1>Escolha o tipo de organização</h1>
          <div className="segment-grid">
            {segmentos.map((seg) => (
              <button
                key={seg.id}
                className="segment-card"
                onClick={() => setSegmentoSelecionado(seg.id)}
              >
                <span className="segment-icon">{seg.icon}</span>
                <div className="segment-text">
                  <span className="segment-label">{seg.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (!organizacaoSelecionada) {
    const seg = segmentos.find((s) => s.id === segmentoSelecionado);
    const organizacoesDoSegmento =
      seg == null
        ? organizacoes
        : organizacoes.filter((org) => org.tipo === seg.label);

    return (
      <>
        {topBar}
        <div className="container org-page">
          <div className="org-header-row">
            <div>
              <h1>Selecione uma organização</h1>
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
              <h3>Nova organização</h3>
              <label>
                Nome da organização
                <input
                  type="text"
                  value={novoNomeOrg}
                  onChange={(e) => setNovoNomeOrg(e.target.value)}
                  placeholder="Ex.: Condomínio Mar Verde 4"
                />
              </label>
              <button
                onClick={async () => {
                  if (!novoNomeOrg.trim()) return;
                  try {
                    setCriandoOrg(true);
                    const segAtual = segmentos.find(
                      (s) => s.id === segmentoSelecionado
                    );
                    const modulosAtivos =
                      (segAtual && modulosPorSegmento[segAtual.id]) ??
                      "core,financeiro";

                    const orgCriada = await api.criarOrganizacao({
                      nome: novoNomeOrg.trim(),
                      tipo: segAtual?.label,
                      modulosAtivos
                    });
                    setOrganizacoes((prev) => [...prev, orgCriada]);
                    setNovoNomeOrg("");
                  } catch (e: any) {
                    setErro(e.message || "Erro ao criar organização");
                  } finally {
                    setCriandoOrg(false);
                  }
                }}
                disabled={criandoOrg || !novoNomeOrg.trim()}
              >
                {criandoOrg ? "Salvando..." : "Criar organização"}
              </button>

              <button
                type="button"
                onClick={carregarOrganizacoes}
                disabled={loadingOrgs}
                className="org-load-button"
              >
                {loadingOrgs ? "Carregando..." : "Carregar organizações"}
              </button>
              {erro && <p className="error">{erro}</p>}
            </section>

            <section className="org-list-card">
              <div className="org-list-header">
                <h3>Organizações cadastradas</h3>
              </div>
              {organizacoesDoSegmento.length > 0 ? (
                <div className="org-list-grid">
                  {organizacoesDoSegmento.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      className="org-card"
                      onClick={() => {
                        setOrganizacaoSelecionada(org);
                        setView("dashboard");
                      }}
                    >
                      <div className="org-card-title">{org.nome}</div>
                      {org.tipo && <div className="org-card-sub">{org.tipo}</div>}
                      {org.modulosAtivos && (
                        <div className="org-card-tags">
                          {org.modulosAtivos.split(",").map((m) => (
                            <span key={m} className="org-tag">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {topBar}
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">{organizacaoSelecionada.nome}</div>
            <div className="sidebar-actions">
              <button
                type="button"
                className="sidebar-action"
                onClick={async () => {
                  const novoNome = window.prompt(
                    "Novo nome da organização:",
                    organizacaoSelecionada.nome
                  );
                  if (!novoNome || !novoNome.trim()) return;

                  try {
                    setErro(null);
                    const atualizado = await api.atualizarOrganizacao(
                      organizacaoSelecionada.id,
                      {
                        nome: novoNome.trim(),
                        tipo: organizacaoSelecionada.tipo,
                        modulosAtivos: organizacaoSelecionada.modulosAtivos,
                        status: "ativo"
                      }
                    );

                    setOrganizacaoSelecionada(atualizado);
                    setOrganizacoes((prev) =>
                      prev.map((o) => (o.id === atualizado.id ? atualizado : o))
                    );
                  } catch (e: any) {
                    setErro(
                      e.message || "Erro ao atualizar nome da organização"
                    );
                  }
                }}
              >
                Editar nome
              </button>
              <button
                type="button"
                className="sidebar-action sidebar-action--secondary"
                onClick={() => {
                  setOrganizacaoSelecionada(null);
                  setView("dashboard");
                }}
              >
                Voltar
              </button>
            </div>
          </div>

          <nav className="sidebar-menu">
            <div className="sidebar-section">
              <p className="sidebar-section-title">Resumo</p>
              <button
                type="button"
                onClick={() => setView("dashboard")}
                className={
                  "sidebar-item" +
                  (view === "dashboard" ? " sidebar-item--active" : "")
                }
              >
                <span className="sidebar-item-icon">📊</span>
                Resumo geral
              </button>
            </div>

            <details className="sidebar-accordion">
              <summary>Cadastros</summary>
              <div className="sidebar-accordion-body">
                <button
                  type="button"
                  onClick={() => setView("pessoas")}
                  className={
                    "sidebar-item" +
                    (view === "pessoas" ? " sidebar-item--active" : "")
                  }
                >
                  <span className="sidebar-item-icon">👤</span>
                  Pessoas
                </button>
                <button
                  type="button"
                  onClick={() => setView("unidades")}
                  className={
                    "sidebar-item" +
                    (view === "unidades" ? " sidebar-item--active" : "")
                  }
                >
                  <span className="sidebar-item-icon">🏠</span>
                  Unidades
                </button>
                <button
                  type="button"
                  onClick={() => setView("funcionarios")}
                  className={
                    "sidebar-item" +
                    (view === "funcionarios" ? " sidebar-item--active" : "")
                  }
                >
                  <span className="sidebar-item-icon">🧑‍💼</span>
                  Funcionários
                </button>
                <button
                  type="button"
                  onClick={() => setView("fornecedores")}
                  className={
                    "sidebar-item" +
                    (view === "fornecedores" ? " sidebar-item--active" : "")
                  }
                >
                  <span className="sidebar-item-icon">🏭</span>
                  Fornecedores
                </button>
                <button
                  type="button"
                  onClick={() => setView("veiculos")}
                  className={
                    "sidebar-item" +
                    (view === "veiculos" ? " sidebar-item--active" : "")
                  }
                >
                  <span className="sidebar-item-icon">🚗</span>
                  Veículos
                </button>
                <button
                  type="button"
                  onClick={() => setView("pets")}
                  className={
                    "sidebar-item" +
                    (view === "pets" ? " sidebar-item--active" : "")
                  }
                >
                  <span className="sidebar-item-icon">🐾</span>
                  Pets
                </button>
              </div>
            </details>

            <div className="sidebar-section">
              <p className="sidebar-section-title">Financeiro</p>
              <button
                type="button"
                onClick={() => setView("financeiro")}
                className={
                  "sidebar-item" +
                  (view === "financeiro" ? " sidebar-item--active" : "")
                }
              >
                <span className="sidebar-item-icon">💰</span>
                Financeiro
              </button>
            </div>
          </nav>
        </aside>

        <main className="main-content">
          {view === "dashboard" && (
            <>
              <Dashboard organizacao={organizacaoSelecionada} />
            </>
          )}

          {view === "pessoas" && organizacaoSelecionada && (
            <PessoasView organizacao={organizacaoSelecionada} />
          )}

          {view === "funcionarios" && organizacaoSelecionada && (
            <PessoasView
              organizacao={organizacaoSelecionada}
              papelFixo="funcionario"
              titulo="Funcionários"
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
                  <h2>Veículos</h2>
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

          {view === "unidades" && organizacaoSelecionada && (
            <UnidadesView organizacao={organizacaoSelecionada} />
          )}

          {view === "financeiro" && organizacaoSelecionada && (
            <FinanceiroView organizacao={organizacaoSelecionada} />
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
