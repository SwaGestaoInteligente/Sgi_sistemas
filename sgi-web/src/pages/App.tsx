import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import {
  api,
  ChargeItem,
  ContaFinanceira,
  LancamentoFinanceiro,
  PlanoContas,
  Organizacao,
  Pessoa,
  UnidadeOrganizacional
} from "../api";

import { LoginPage } from "./LoginPage";

// --------------------------------------------------------
// Dashboard (adicionado para evitar erro "Dashboard is not defined")
// --------------------------------------------------------

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
      const [contasRes, chamadosRes, reservasRes] = await Promise.all([
        api.listarContas(token, organizacao.id),
        api.listarChamados(token, organizacao.id),
        api.listarReservas(token, organizacao.id)
      ]);
      setContas(contasRes);
      setChamados(chamadosRes);
      setReservas(reservasRes);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, [token, organizacao?.id]);

  const totalContas = contas.length;
  const saldoInicialTotal = contas.reduce(
    (sum, c) => sum + (c.saldoInicial ?? 0),
    0
  );
  const contasAtivas = contas.filter((c) => c.status === "ativo").length;

  const chamadosAbertos = chamados.filter(
    (c) => c.status && c.status.toLowerCase() !== "concluido"
  ).length;

  const reservasAtivas = reservas.filter(
    (r) => r.status && r.status.toLowerCase() === "ativa"
  ).length;

  return (
    <div className="dashboard">
      <div className="dashboard-header-row">
        <span className="dashboard-caption">
          Visão rápida da organização
        </span>
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
          <div className="dashboard-card-label">Saldo inicial total</div>
          <div className="dashboard-card-value">
            R$ {saldoInicialTotal.toFixed(2)}
          </div>
          <div className="dashboard-card-sub">
            {totalContas} conta(s) cadastrada(s).
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">Contas ativas</div>
          <div className="dashboard-card-value">{contasAtivas}</div>
          <div className="dashboard-card-sub">
            Em uso no dia a dia.
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">Chamados</div>
          <div className="dashboard-card-value">{chamados.length}</div>
          <div className="dashboard-card-sub">
            Abertos / pendentes: {chamadosAbertos}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">Reservas</div>
          <div className="dashboard-card-value">{reservas.length}</div>
          <div className="dashboard-card-sub">
            Ativas / futuras: {reservasAtivas}
          </div>
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
  subtitle: string;
};

const segmentos: Segmento[] = [
  {
    id: "condominios",
    label: "Condomínios",
    icon: "🏢",
    subtitle: "Residenciais, comerciais ou mistos"
  },
  {
    id: "empresas",
    label: "Empresas",
    icon: "💼",
    subtitle: "Escritórios, comércios e prestadores de serviço"
  },
  {
    id: "igrejas",
    label: "Igrejas",
    icon: "⛪",
    subtitle: "Comunidades, ministérios e organizações religiosas"
  },
  {
    id: "sitios",
    label: "Sítios / Pousadas",
    icon: "🏡",
    subtitle: "Hospedagem, lazer e eventos em área de retiro"
  },
  {
    id: "associacoes",
    label: "Associações / ONGs",
    icon: "🤝",
    subtitle: "Institutos, fundações e associações sem fins lucrativos"
  },
  {
    id: "outros",
    label: "Outros",
    icon: "✨",
    subtitle: "Qualquer outra organização que você administre"
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

type PapelOption = { value: string; label: string };

const papeisPadrao: PapelOption[] = [
  { value: "morador", label: "Morador" },
  { value: "proprietario", label: "Proprietário" },
  { value: "sindico", label: "Síndico" },
  { value: "subsindico", label: "Subsíndico" },
  { value: "conselheiro", label: "Conselheiro" },
  { value: "colaborador", label: "Colaborador" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "membro", label: "Membro" },
  { value: "outro", label: "Outro" }
];

const papeisPorTipoOrganizacao: Record<string, PapelOption[]> = {
  // Condomínios residenciais / comerciais
  "Condomínios": papeisPadrao,
  // Empresas
  "Empresas": [
    { value: "socio", label: "Sócio" },
    { value: "funcionario", label: "Funcionário" },
    { value: "cliente", label: "Cliente" },
    { value: "fornecedor", label: "Fornecedor" },
    { value: "parceiro", label: "Parceiro" },
    { value: "outro", label: "Outro" }
  ],
  // Igrejas
  "Igrejas": [
    { value: "pastor", label: "Pastor" },
    { value: "obreiro", label: "Obreiro / Diácono" },
    { value: "membro", label: "Membro" },
    { value: "visitante", label: "Visitante" },
    { value: "ministerio", label: "Líder de ministério" },
    { value: "colaborador", label: "Colaborador" },
    { value: "fornecedor", label: "Fornecedor" },
    { value: "outro", label: "Outro" }
  ],
  // Sítios / pousadas
  "Sítios / Pousadas": [
    { value: "proprietario", label: "Proprietário" },
    { value: "hospede", label: "Hóspede" },
    { value: "funcionario", label: "Funcionário" },
    { value: "zelador", label: "Zelador / Caseiro" },
    { value: "fornecedor", label: "Fornecedor" },
    { value: "outro", label: "Outro" }
  ],
  // Associações / ONGs
  "Associações / ONGs": [
    { value: "associado", label: "Associado" },
    { value: "diretor", label: "Diretor / Conselho" },
    { value: "voluntario", label: "Voluntário" },
    { value: "colaborador", label: "Colaborador" },
    { value: "fornecedor", label: "Fornecedor" },
    { value: "outro", label: "Outro" }
  ]
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
   useState<"dashboard" | "pessoas" | "unidades" | "financeiro">(
    "dashboard"
  );



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
          src="swa1.jpeg"
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

  // 1) Escolha de segmento
  if (!segmentoSelecionado) {
    return (
      <>
        {topBar}
        <div className="container">
          <h1>Escolha o tipo de organização</h1>
          <p style={{ marginTop: 8, marginBottom: 16, color: "#4b5563" }}>
            Selecione em qual segmento você quer trabalhar agora.
          </p>
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
                  <span className="segment-subtitle">{seg.subtitle}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

   // 2) Lista de organizações (layout mais rico)
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
              <p className="org-header-sub">
                {seg ? (
                  <>
                    Segmento: <strong>{seg.label}</strong>
                  </>
                ) : (
                  "Escolha em qual organização você quer trabalhar agora."
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={irParaInicio}
              className="org-back-button"
            >
              Voltar para tipos
            </button>
          </div>

          <div className="org-header-badges">
            <span>Total de organizações: {organizacoesDoSegmento.length}</span>
            {seg && <span>Tipo selecionado: {seg.label}</span>}
          </div>

          <div className="org-layout">
            {/* Card de nova organização */}
            <section className="org-form-card">
              <h3>Nova organização</h3>
              <p className="org-form-sub">
                Crie um condomínio, empresa ou outra unidade para começar a
                organizar a gestão.
              </p>
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

            {/* Card de lista de organizações */}
            <section className="org-list-card">
              <div className="org-list-header">
                <h3>Organizações cadastradas</h3>
                <p>
                  Clique em uma organização para abrir o painel completo (dashboard,
                  pessoas e financeiro).
                </p>
              </div>
              {organizacoesDoSegmento.length === 0 ? (
                <p className="org-empty">
                  Nenhuma organização encontrada neste segmento ainda.
                </p>
              ) : (
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
                      {org.tipo && (
                        <div className="org-card-sub">{org.tipo}</div>
                      )}
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
              )}
            </section>
          </div>
        </div>
      </>
    );
  }

  // 3) Dashboard + Pessoas para a organização selecionada
  return (
    <>
      {topBar}
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <h1>{organizacaoSelecionada.nome}</h1>
            <button
              type="button"
              style={{
                marginTop: 4,
                marginRight: 8,
                backgroundColor: "#dbeafe",
                color: "#1d4ed8"
              }}
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
                    prev.map((o) =>
                      o.id === atualizado.id ? atualizado : o
                    )
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
              onClick={() => {
                setOrganizacaoSelecionada(null);
                setView("dashboard");
              }}
              style={{
                marginTop: 4,
                backgroundColor: "#e5e7eb",
                color: "#111827"
              }}
            >
              Voltar para organizações
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setView("dashboard")}
              style={{
                backgroundColor: view === "dashboard" ? "#2563eb" : "#e5e7eb",
                color: view === "dashboard" ? "#ffffff" : "#111827"
              }}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView("pessoas")}
              style={{
                backgroundColor: view === "pessoas" ? "#2563eb" : "#e5e7eb",
                color: view === "pessoas" ? "#ffffff" : "#111827"
              }}
            >
              Pessoas
            </button>
            <button
              onClick={() => setView("unidades")}
              style={{
                backgroundColor: view === "unidades" ? "#2563eb" : "#e5e7eb",
                color: view === "unidades" ? "#ffffff" : "#111827"
              }}
            >
              Unidades
            </button>
            <button
              onClick={() => setView("financeiro")}
              style={{
                backgroundColor: view === "financeiro" ? "#2563eb" : "#e5e7eb",
                color: view === "financeiro" ? "#ffffff" : "#111827"
              }}
            >
              Financeiro
            </button>
          </div>
        </div>

        {view === "dashboard" && (
          <>
            <p style={{ marginTop: 8 }}>
              Aqui podemos mostrar resumos de financeiro, chamados e reservas
              usando os endpoints já existentes.
            </p>
            <Dashboard organizacao={organizacaoSelecionada} />
          </>
        )}

        {view === "pessoas" && (
          <PessoasView organizacao={organizacaoSelecionada} />
        )}

        {view === "unidades" && (
          <UnidadesView organizacao={organizacaoSelecionada} />
        )}

        {view === "financeiro" && (
          <FinanceiroView organizacao={organizacaoSelecionada} />
        )}
      </div>
    </>
  );
};

  const UnidadesView: React.FC<{ organizacao: Organizacao | null }> = ({
  organizacao
}) => {
  const { token } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [tipo, setTipo] = useState("Apartamento");
  const [codigoInterno, setCodigoInterno] = useState("");
  const [nome, setNome] = useState("");

  const carregarUnidades = async () => {
    if (!token || !organizacao) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarUnidades(token, organizacao.id);
      setUnidades(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar unidades");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarUnidades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizacao?.id]);

  const salvarUnidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !organizacao) return;
    if (!nome.trim()) return;

    try {
      setErro(null);
      setLoading(true);
      const criada = await api.criarUnidade(token, {
        organizacaoId: organizacao.id,
        tipo,
        codigoInterno: codigoInterno.trim(),
        nome: nome.trim()
      });
      setUnidades((prev) => [...prev, criada]);
      setCodigoInterno("");
      setNome("");
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar unidade");
    } finally {
      setLoading(false);
    }
  };

  if (!organizacao) {
    return null;
  }

  return (
    <div className="people-page">
      <div className="people-header-row">
        <div>
          <h2>Unidades</h2>
          <p className="people-header-sub">
            Cadastre blocos, apartamentos, casas e outras unidades da
            organização <strong>{organizacao.nome}</strong>.
          </p>
        </div>
        <div className="people-header-badges">
          <span>Total de unidades: {unidades.length}</span>
        </div>
      </div>

      <div className="people-layout">
        <section className="people-form-card">
          <h3>Nova unidade</h3>
          <p className="people-form-sub">
            Use tipo, código e nome para identificar cada unidade
            (ex.: Bloco A, Ap 101).
          </p>

          <form onSubmit={salvarUnidade} className="form">
            <div className="people-form-grid">
              <label>
                Tipo
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                >
                  <option value="Bloco">Bloco</option>
                  <option value="Apartamento">Apartamento</option>
                  <option value="Casa">Casa</option>
                  <option value="Sala">Sala</option>
                  <option value="Outro">Outro</option>
                </select>
              </label>
              <label>
                Código interno
                <input
                  value={codigoInterno}
                  onChange={(e) => setCodigoInterno(e.target.value)}
                  placeholder="Ex.: A, 101, A-101"
                />
              </label>
            </div>

            <label>
              Nome da unidade
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Bloco A, Ap 101"
                required
              />
            </label>

            <button type="submit" disabled={loading || !nome.trim()}>
              {loading ? "Salvando..." : "Salvar unidade"}
            </button>

            {erro && <p className="error">{erro}</p>}
          </form>
        </section>

        <section className="people-list-card">
          <div className="people-list-header">
            <h3>Unidades cadastradas</h3>
          </div>

          {unidades.length === 0 ? (
            <p className="org-empty">
              Nenhuma unidade cadastrada ainda para esta organização.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {unidades.map((u) => (
                  <tr key={u.id}>
                    <td>{u.tipo}</td>
                    <td>{u.codigoInterno}</td>
                    <td>{u.nome}</td>
                    <td>{u.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
};


const PessoasView: React.FC<{ organizacao: Organizacao }> = ({
  organizacao
}) => {
  const { token } = useAuth();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  const [pessoaSelecionadaId, setPessoaSelecionadaId] =
    useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"fisica" | "juridica">("fisica");
  const [documento, setDocumento] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [papel, setPapel] = useState("morador");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");

  const [enderecosPorPessoa, setEnderecosPorPessoa] = useState<
    Record<
      string,
      {
        logradouro?: string;
        numero?: string;
        bairro?: string;
        cidade?: string;
        estado?: string;
        cep?: string;
      }
    >
  >({});

  const carregarPessoas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarPessoas(token, organizacao.id);
      setPessoas(lista);

      const mapa: Record<
        string,
        {
          logradouro?: string;
          numero?: string;
          bairro?: string;
          cidade?: string;
          estado?: string;
          cep?: string;
        }
      > = {};
      for (const p of lista) {
        mapa[p.id] = {
          logradouro: p.logradouro,
          numero: p.numero,
          bairro: p.bairro,
          cidade: p.cidade,
          estado: p.estado,
          cep: p.cep
        };
      }
      setEnderecosPorPessoa(mapa);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar pessoas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarPessoas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizacao.id]);

  const selecionarPessoa = (p: Pessoa) => {
    setPessoaSelecionadaId(p.id);
    setNome(p.nome);
    setDocumento(p.documento ?? "");
    setEmail(p.email ?? "");
    setTelefone(p.telefone ?? "");
    setPapel(p.papel ?? "morador");
    setTipo("fisica");

    const end = enderecosPorPessoa[p.id];
    setLogradouro(end?.logradouro ?? "");
    setNumero(end?.numero ?? "");
    setBairro(end?.bairro ?? "");
    setCidade(end?.cidade ?? "");
    setEstado(end?.estado ?? "");
    setCep(end?.cep ?? "");
  };

  const limparFormulario = () => {
    setPessoaSelecionadaId(null);
    setNome("");
    setDocumento("");
    setEmail("");
    setTelefone("");
    setPapel("morador");
    setTipo("fisica");
    setLogradouro("");
    setNumero("");
    setBairro("");
    setCidade("");
    setEstado("");
    setCep("");
  };

  const salvarPessoa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);

      if (pessoaSelecionadaId) {
        const atualizada = await api.atualizarPessoa(
          token,
          pessoaSelecionadaId,
          organizacao.id,
          {
            nome,
            tipo,
            documento: documento || undefined,
            email: email || undefined,
            telefone: telefone || undefined,
            papel: papel || undefined,
            logradouro: logradouro || undefined,
            numero: numero || undefined,
            bairro: bairro || undefined,
            cidade: cidade || undefined,
            estado: estado || undefined,
            cep: cep || undefined
          }
        );
        setPessoas((prev) =>
          prev.map((p) => (p.id === atualizada.id ? atualizada : p))
        );
      } else {
        const criada = await api.criarPessoa(token, {
          organizacaoId: organizacao.id,
          nome,
          tipo,
          documento: documento || undefined,
          email: email || undefined,
          telefone: telefone || undefined,
          papel: papel || undefined,
          logradouro: logradouro || undefined,
          numero: numero || undefined,
          bairro: bairro || undefined,
          cidade: cidade || undefined,
          estado: estado || undefined,
          cep: cep || undefined
        });
        setPessoas((prev) => [...prev, criada]);
      }

      limparFormulario();
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar pessoa");
    } finally {
      setLoading(false);
    }
  };

  const removerPessoa = async (p: Pessoa) => {
    if (!token) return;
    if (
      !window.confirm(
        `Tem certeza que deseja excluir a pessoa "${p.nome}"?`
      )
    ) {
      return;
    }

    try {
      setErro(null);
      setLoading(true);
      await api.removerPessoa(token, p.id, organizacao.id);
      setPessoas((prev) => prev.filter((x) => x.id !== p.id));
      if (pessoaSelecionadaId === p.id) {
        limparFormulario();
      }
    } catch (e: any) {
      setErro(e.message || "Erro ao remover pessoa");
    } finally {
      setLoading(false);
    }
  };

  const pessoasFiltradas = pessoas.filter((p) => {
    const termo = filtro.trim().toLowerCase();
    if (!termo) return true;
    return (
      p.nome.toLowerCase().includes(termo) ||
      (p.telefone ?? "").toLowerCase().includes(termo)
    );
  });

  const papeisParaEstaOrganizacao =
    papeisPorTipoOrganizacao[organizacao.tipo ?? ""] ?? papeisPadrao;

  return (
    <div className="people-page">
      <div className="people-header-row">
        <div>
          <h2>Pessoas</h2>
          <p className="people-header-sub">
            Cadastre moradores, colaboradores e pessoas ligadas a{" "}
            <strong>{organizacao.nome}</strong>.
          </p>
        </div>
        <div className="people-header-badges">
          <span>Total: {pessoas.length}</span>
          <span>Filtradas: {pessoasFiltradas.length}</span>
        </div>
      </div>

      <div className="people-layout">
        {/* Formulário */}
        <section className="people-form-card">
          <h3>{pessoaSelecionadaId ? "Editar pessoa" : "Nova pessoa"}</h3>
          <p className="people-form-sub">
            Informações básicas e contato. Papel ajuda a segmentar comunicações.
          </p>

          <form onSubmit={salvarPessoa} className="form">
            <label>
              Nome
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </label>

            <div className="people-form-grid">
              <label>
                Tipo de pessoa
                <select
                  value={tipo}
                  onChange={(e) =>
                    setTipo(e.target.value as "fisica" | "juridica")
                  }
                >
                  <option value="fisica">Pessoa física</option>
                  <option value="juridica">Pessoa jurídica</option>
                </select>
              </label>
              <label>
                Papel na organização
                <select
                  value={papel}
                  onChange={(e) => setPapel(e.target.value)}
                >
                  {papeisParaEstaOrganizacao.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="people-form-grid">
              <label>
                Documento (CPF/CNPJ)
                <input
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                />
              </label>
              <label>
                Telefone
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
              </label>
            </div>

            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <div className="people-form-grid">
              <label>
                Logradouro
                <input
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                />
              </label>
              <label>
                Número
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                />
              </label>
            </div>

            <div className="people-form-grid">
              <label>
                Bairro
                <input
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                />
              </label>
              <label>
                Cidade
                <input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                />
              </label>
            </div>

            <div className="people-form-grid">
              <label>
                Estado
                <input
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                />
              </label>
              <label>
                CEP
                <input value={cep} onChange={(e) => setCep(e.target.value)} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="submit" disabled={loading}>
                {loading
                  ? "Salvando..."
                  : pessoaSelecionadaId
                  ? "Atualizar pessoa"
                  : "Salvar pessoa"}
              </button>
              {pessoaSelecionadaId && (
                <button type="button" onClick={limparFormulario}>
                  Nova pessoa
                </button>
              )}
            </div>
            {erro && <p className="error">{erro}</p>}
          </form>
        </section>

        {/* Lista */}
        <section className="people-list-card">
          <div className="people-list-header">
            <h3>Pessoas cadastradas</h3>
            <div className="people-search-row">
              <input
                placeholder="Buscar por nome ou telefone"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
              <button
                type="button"
                onClick={carregarPessoas}
                disabled={loading}
              >
                {loading ? "Carregando..." : "Atualizar lista"}
              </button>
            </div>
          </div>

          {pessoasFiltradas.length === 0 ? (
            <p className="org-empty">
              Nenhuma pessoa encontrada para esta organização.
            </p>
          ) : (
            <div className="person-list">
              {pessoasFiltradas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={
                    "person-item" +
                    (pessoaSelecionadaId === p.id ? " person-item--active" : "")
                  }
                  onClick={() => selecionarPessoa(p)}
                >
                  <div className="person-header">
                    <span className="person-name">
                      {p.nome}
                      {p.telefone && (
                        <span className="person-phone" style={{ marginLeft: 8 }}>
                          <span role="img" aria-label="Telefone">
                            📞
                          </span>
                          <span>{p.telefone}</span>
                        </span>
                      )}
                    </span>
                    {p.papel && (
                      <span className="person-badge">{p.papel}</span>
                    )}
                  </div>
                  {p.enderecoResumo && (
                    <div className="person-sub">{p.enderecoResumo}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={!pessoaSelecionadaId || loading}
            onClick={() => {
              const pessoa = pessoas.find(
                (p) => p.id === pessoaSelecionadaId
              );
              if (pessoa) {
                void removerPessoa(pessoa);
              }
            }}
            style={{
              marginTop: 8,
              backgroundColor: "#ef4444",
              color: "#ffffff"
            }}
          >
            Excluir pessoa selecionada
          </button>
        </section>
      </div>
    </div>
  );
};


const FinanceiroView: React.FC<{ organizacao: Organizacao }> = ({
  organizacao
}) => {
  const { token } = useAuth();
  const [aba, setAba] =
    useState<
      | "contas"
      | "contasPagar"
      | "contasReceber"
      | "itensCobrados"
      | "categorias"
      | "relatorios"
    >("contas");
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Contas
  const [nomeConta, setNomeConta] = useState("");
  const [tipoConta, setTipoConta] = useState("Bancária");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [numeroConta, setNumeroConta] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [moeda, setMoeda] = useState("BRL");

  // Contas a pagar (lançamentos)
  const [despesas, setDespesas] = useState<LancamentoFinanceiro[]>([]);
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoVencimento, setNovoVencimento] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novaDespesaCategoriaId, setNovaDespesaCategoriaId] = useState("");

  // Contas a receber (lançamentos)
  const [receitas, setReceitas] = useState<LancamentoFinanceiro[]>([]);
  const [novaReceitaDescricao, setNovaReceitaDescricao] = useState("");
  const [novaReceitaVencimento, setNovaReceitaVencimento] = useState("");
  const [novaReceitaValor, setNovaReceitaValor] = useState("");
  const [novaReceitaCategoriaId, setNovaReceitaCategoriaId] = useState("");

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
    void carregarCategoriasReceita();
    void carregarCategoriasDespesa();
    // Itens cobrados serão carregados sob demanda ao abrir a aba
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizacaoId]);

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

    const conta = contas[0];
    try {
      setErro(null);
      setLoading(true);
      const payload: Omit<LancamentoFinanceiro, "id"> = {
        organizacaoId,
        tipo: "pagar",
        situacao: "pendente",
        planoContasId: novaDespesaCategoriaId,
        centroCustoId: undefined,
        contaFinanceiraId: conta?.id,
        pessoaId: "00000000-0000-0000-0000-000000000000",
        descricao: novaDescricao.trim(),
        valor: Number(novoValor.replace(/\./g, "").replace(",", ".")),
        dataCompetencia: novoVencimento,
        dataVencimento: novoVencimento,
        dataPagamento: undefined,
        formaPagamento: "indefinido",
        parcelaNumero: undefined,
        parcelaTotal: undefined,
        referencia: undefined
      };

      const lanc = await api.criarLancamento(token, payload);
      setDespesas((prev) => [...prev, lanc]);
      setNovaDescricao("");
      setNovoVencimento("");
      setNovoValor("");
      setNovaDespesaCategoriaId("");
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

    const conta = contas[0];

    try {
      setErro(null);
      setLoading(true);
      const payload: Omit<LancamentoFinanceiro, "id"> = {
        organizacaoId,
        tipo: "receber",
        situacao: "pendente",
        planoContasId: novaReceitaCategoriaId,
        centroCustoId: undefined,
        contaFinanceiraId: conta?.id,
        pessoaId: "00000000-0000-0000-0000-000000000000",
        descricao: novaReceitaDescricao.trim(),
        valor: Number(
          novaReceitaValor.replace(/\./g, "").replace(",", ".")
        ),
        dataCompetencia: novaReceitaVencimento,
        dataVencimento: novaReceitaVencimento,
        dataPagamento: undefined,
        formaPagamento: "indefinido",
        parcelaNumero: undefined,
        parcelaTotal: undefined,
        referencia: undefined
      };

      const lanc = await api.criarLancamento(token, payload);
      setReceitas((prev) => [...prev, lanc]);
      setNovaReceitaDescricao("");
      setNovaReceitaVencimento("");
      setNovaReceitaValor("");
      setNovaReceitaCategoriaId("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar receita");
    } finally {
      setLoading(false);
    }
  };

  const totalContas = contas.length;
  const contasAtivas = contas.filter((c) => c.status === "ativo").length;
  const contasInativas = contas.filter((c) => c.status === "inativo").length;
  const saldoInicialTotal = contas.reduce(
    (sum, c) => sum + (c.saldoInicial ?? 0),
    0
  );

  const totalAPagar = despesas
    .filter((d) => d.situacao === "pendente")
    .reduce((sum, d) => sum + d.valor, 0);
  const totalPagas = despesas
    .filter((d) => d.situacao === "pago")
    .reduce((sum, d) => sum + d.valor, 0);

  const categoriasDespesaPorId = Object.fromEntries(
    categoriasDespesa.map((c) => [c.id, `${c.codigo} - ${c.nome}`])
  );
  const categoriasReceitaPorId = Object.fromEntries(
    categoriasReceita.map((c) => [c.id, `${c.codigo} - ${c.nome}`])
  );

  const despesasValidas = despesas.filter(
    (d) => d.situacao !== "cancelado"
  );
  const receitasValidas = receitas.filter(
    (r) => r.situacao !== "cancelado"
  );
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

  const carregarLogoBase64 = async () => {
    try {
      const res = await fetch("/swa1.jpeg");
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

  return (
    <div className="finance-page">
      <div className="finance-header-row">
        <div>
          <h2>Financeiro</h2>
          <p className="people-header-sub">
            Contas e lançamentos da organização{" "}
            <strong>{organizacao.nome}</strong>.
          </p>
        </div>
        <div className="finance-header-badges">
          <span>Contas: {totalContas}</span>
          <span>Ativas: {contasAtivas}</span>
          <span>Inativas: {contasInativas}</span>
        </div>
      </div>

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <p className="finance-summary-label">Saldo inicial total</p>
          <p className="finance-summary-value">
            R$ {saldoInicialTotal.toFixed(2)}
          </p>
          <p className="finance-summary-sub">
            Soma de todas as contas cadastradas.
          </p>
        </div>
        <div className="finance-summary-card">
          <p className="finance-summary-label">Total a pagar</p>
          <p className="finance-summary-value">
            R$ {totalAPagar.toFixed(2)}
          </p>
          <p className="finance-summary-sub">
            Títulos pendentes da aba Contas a pagar.
          </p>
        </div>
        <div className="finance-summary-card">
          <p className="finance-summary-label">Total já pago</p>
          <p className="finance-summary-value">
            R$ {totalPagas.toFixed(2)}
          </p>
          <p className="finance-summary-sub">
            Lançamentos marcados como pagos.
          </p>
        </div>
      </div>

      <div className="finance-tabs">
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "contas" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("contas")}
        >
          Contas
        </button>
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "contasPagar" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("contasPagar")}
        >
          Contas a pagar
        </button>
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "contasReceber" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("contasReceber")}
        >
          Contas a receber
        </button>
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "itensCobrados" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("itensCobrados")}
        >
          Itens de cobrança
        </button>
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "categorias" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("categorias")}
        >
          Cadastro de categorias
        </button>
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "relatorios" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("relatorios")}
        >
          Relatorios
        </button>
      </div>

      {aba === "contas" && (
        <div className="finance-layout">
          {/* Formulário de conta */}
          <section className="finance-form-card">
            <h3>Nova conta</h3>
            <p className="finance-form-sub">
              Cadastre contas bancárias, carteiras digitais ou caixa.
            </p>

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

          {/* Tabela de contas */}
          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Contas financeiras</h3>
                <p>
                  Contas bancárias, carteiras digitais e caixa da organização.
                </p>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Banco</th>
                  <th>Agência</th>
                  <th>Número</th>
                  <th>Saldo inicial</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {contas.map((conta) => (
                  <tr key={conta.id}>
                    <td>{conta.nome}</td>
                    <td>{conta.tipo}</td>
                    <td>{conta.banco || "-"}</td>
                    <td>{conta.agencia || "-"}</td>
                    <td>{conta.numeroConta || "-"}</td>
                    <td>
                      {conta.saldoInicial?.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: conta.moeda || "BRL"
                      })}
                    </td>
                    <td>
                      {conta.status ? (
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
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <div className="finance-card-actions">
                        <button
                          type="button"
                          onClick={() =>
                            atualizarStatusConta(
                              conta,
                              conta.status === "ativo" ? "inativo" : "ativo"
                            )
                          }
                          style={{
                            backgroundColor:
                              conta.status === "ativo"
                                ? "#f97316"
                                : "#22c55e"
                          }}
                        >
                          {conta.status === "ativo"
                            ? "Desativar"
                            : "Ativar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removerConta(conta)}
                          style={{
                            backgroundColor: "#ef4444",
                            color: "#ffffff"
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {contas.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center" }}>
                      Nenhuma conta cadastrada ainda.
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
          <p style={{ marginTop: 4, color: "#6b7280" }}>
            Despesas com vencimento e valor definidos. Use para montar a visão
            de fluxo de caixa.
          </p>

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

          <table className="table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {despesas
                .filter((d) => d.situacao !== "cancelado")
                .map((d) => (
                  <tr key={d.id}>
                    <td>{d.descricao}</td>
                    <td>
                      {categoriasDespesaPorId[d.planoContasId] ?? "-"}
                    </td>
                    <td>
                      {d.dataVencimento
                        ? new Date(d.dataVencimento).toLocaleDateString(
                            "pt-BR"
                          )
                        : "-"}
                    </td>
                    <td>
                      {d.valor.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      })}
                    </td>
                    <td>
                      <span
                        className={
                          "badge-status " +
                          (d.situacao === "pago"
                            ? "badge-status--pago"
                            : "badge-status--pendente")
                        }
                      >
                        {d.situacao === "pago" ? "Pago" : "Pendente"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={loading || d.situacao === "pago"}
                        onClick={async () => {
                          if (!token) return;
                          try {
                            setErro(null);
                            setLoading(true);
                            await api.pagarLancamento(token, d.id);
                            await carregarDespesas();
                          } catch (e: any) {
                            setErro(
                              e.message || "Erro ao marcar como pago"
                            );
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Marcar como pago
                      </button>
                      <button
                        type="button"
                        style={{
                          marginLeft: 8,
                          backgroundColor: "#ef4444",
                          color: "#ffffff"
                        }}
                        disabled={loading}
                        onClick={async () => {
                          if (!token) return;
                          if (!window.confirm("Cancelar esta despesa?"))
                            return;
                          try {
                            setErro(null);
                            setLoading(true);
                            await api.cancelarLancamento(token, d.id);
                            await carregarDespesas();
                          } catch (e: any) {
                            setErro(
                              e.message || "Erro ao cancelar despesa"
                            );
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ))}
              {despesas.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    Nenhuma despesa cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {aba === "contasReceber" && (
        <div className="finance-table-card" style={{ marginTop: 12 }}>
          <h3>Contas a receber</h3>
          <p style={{ marginTop: 4, color: "#6b7280" }}>
            Receitas com vencimento e valor definidos. Use para acompanhar quem
            deve ao condomínio.
          </p>

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

          <table className="table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {receitas.map((r) => (
                <tr key={r.id}>
                  <td>{r.descricao}</td>
                  <td>
                    {categoriasReceitaPorId[r.planoContasId] ?? "-"}
                  </td>
                  <td>
                    {r.dataVencimento
                      ? new Date(r.dataVencimento).toLocaleDateString(
                          "pt-BR"
                        )
                      : "-"}
                  </td>
                  <td>
                    {r.valor.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL"
                    })}
                  </td>
                  <td>{r.situacao}</td>
                </tr>
              ))}
              {receitas.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    Nenhuma receita cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {aba === "itensCobrados" && (
        <div className="finance-layout">
          <section className="finance-form-card">
            <h3>Novo item cobrado</h3>
            <p className="finance-form-sub">
              Cadastre itens como taxa de salão de festas, tags de acesso,
              multas e outras receitas extras.
            </p>

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
                <p>
                  Tudo o que o condomínio pode cobrar: salão, tags,
                  multas, outros.
                </p>
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
                      {/* aqui continuam os botões Editar / Ativar / Desativar
                          exatamente como já estavam antes */}

               
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
                              ? item.valorPadrao
                                  .toLocaleString("pt-BR", {
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

           {aba === "categorias" && (
        <div className="finance-layout">
          <section className="finance-form-card">
            <h3>Nova categoria financeira</h3>
            <p className="finance-form-sub">
              Organize seu plano de contas com categorias de receita e despesa.
            </p>

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

              <p style={{ color: "#6b7280", marginTop: 8 }}>
                Use o campo Código para organizar subcategorias (ex.: 1, 1.01,
                1.01.01) e escolha o Tipo Receita ou Despesa conforme o uso.
              </p>
              <button type="submit" disabled={loading || !token}>
                {loading ? "Salvando..." : "Adicionar categoria"}
              </button>
            </form>
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Plano de contas</h3>
                <p>
                  Categorias financeiras usadas nas receitas, despesas e itens
                  cobrados.
                </p>
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
              <p style={{ marginTop: 4, color: "#6b7280" }}>
                Totais por categoria com base nos lancamentos atuais.
              </p>
            </div>
            <div className="finance-card-actions">
              <button type="button" onClick={() => void gerarRelatorioPdf()}>
                PDF
              </button>
              <button type="button" onClick={gerarRelatorioExcel}>
                Excel
              </button>
              <button type="button" onClick={() => setAba("contas")}>
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
};



export const App: React.FC = () => (
  <AuthProvider>
    <InnerApp />
  </AuthProvider>
);
