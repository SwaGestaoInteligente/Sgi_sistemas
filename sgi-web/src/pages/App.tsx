import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { api, ContaFinanceira, Organizacao, Pessoa } from "../api";
import { LoginPage } from "./LoginPage";

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
    useState<"dashboard" | "pessoas" | "financeiro">("dashboard");

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

  // 2) Lista de organizações
  if (!organizacaoSelecionada) {
    const seg = segmentos.find((s) => s.id === segmentoSelecionado);
    const organizacoesDoSegmento =
      seg == null
        ? organizacoes
        : organizacoes.filter((org) => org.tipo === seg.label);
      return (
        <>
          {topBar}
          <div className="container">
            <h1>Selecione uma organização</h1>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 8,
                marginBottom: 16
              }}
            >
              {seg && (
                <p style={{ color: "#4b5563" }}>
                  <strong>{seg.label}</strong>
                </p>
              )}
              <button
                type="button"
                onClick={irParaInicio}
                style={{
                  backgroundColor: "#e5e7eb",
                  color: "#111827"
                }}
              >
                Voltar para tipos
              </button>
            </div>

            <button onClick={carregarOrganizacoes} disabled={loadingOrgs}>
              {loadingOrgs ? "Carregando..." : "Carregar organizações"}
            </button>
            {erro && <p className="error">{erro}</p>}

            {/* Criar nova organização */}
            <div className="org-new-row">
              <label>
                <span style={{ fontSize: 14 }}>Nova organização</span>
                <input
                  type="text"
                  value={novoNomeOrg}
                  onChange={(e) => setNovoNomeOrg(e.target.value)}
                  placeholder="Nome da organização"
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
            </div>

            <ul className="list" style={{ marginTop: 16 }}>
              {organizacoesDoSegmento.map((org) => (
                <li key={org.id}>
                  <button
                    onClick={() => {
                      setOrganizacaoSelecionada(org);
                      setView("dashboard");
                    }}
                  >
                    {org.nome}
                  </button>
                </li>
              ))}
            </ul>
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
            <Dashboard />
          </>
        )}

          {view === "pessoas" && (
            <PessoasView organizacao={organizacaoSelecionada} />
          )}

          {view === "financeiro" && (
            <FinanceiroView organizacao={organizacaoSelecionada} />
          )}
        </div>
      </>
    );
  };

const Dashboard: React.FC = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [contas, setContas] = useState<any[]>([]);
    const [chamados, setChamados] = useState<any[]>([]);
    const [reservas, setReservas] = useState<any[]>([]);
  
    const carregar = async () => {
      if (!token) return;
      try {
        setErro(null);
        setLoading(true);
        const [contasRes, chamadosRes, reservasRes] = await Promise.all([
          api.listarContas(token),
          api.listarChamados(token),
          api.listarReservas(token)
        ]);
        setContas(contasRes);
        setChamados(chamadosRes);
        setReservas(reservasRes);
      } catch (e: any) {
        setErro(e.message || "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <div>
        <button onClick={carregar} disabled={loading}>
          {loading ? "Carregando..." : "Atualizar resumo"}
        </button>
        {erro && <p className="error">{erro}</p>}
  
        <div className="grid">
          <div className="card">
            <h2>Contas Financeiras</h2>
            <p>Total: {contas.length}</p>
          </div>
          <div className="card">
            <h2>Chamados</h2>
            <p>Total: {chamados.length}</p>
          </div>
          <div className="card">
            <h2>Reservas</h2>
            <p>Total: {reservas.length}</p>
          </div>
        </div>
      </div>
    );
  };
  
const FinanceiroView: React.FC<{ organizacao: Organizacao }> = ({
  organizacao
}) => {
  const { token } = useAuth();
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [tipo, setTipo] = useState("bancaria");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [numeroConta, setNumeroConta] = useState("");
  const [saldoInicial, setSaldoInicial] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"contas" | "contasPagar">("contas");

  const [despesas, setDespesas] = useState<LancamentoFinanceiro[]>([]);
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoVencimento, setNovoVencimento] = useState("");
  const [novoValor, setNovoValor] = useState<string>("");
  const [contaSelecionadaId, setContaSelecionadaId] = useState<string | null>(
    null
  );
  const [lancamentosContaSelecionada, setLancamentosContaSelecionada] =
    useState<LancamentoFinanceiro[]>([]);
  const [filtroMes, setFiltroMes] = useState<string>("");
  const [filtroAno, setFiltroAno] = useState<string>("");

  const organizacaoId = organizacao.id;

  const carregarContas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const data = await api.listarContas(token, organizacaoId);
      setContas(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar contas");
    } finally {
      setLoading(false);
    }
  };

  const carregarDespesas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const data = await api.listarLancamentos(token, organizacaoId);
      const somentePagar = data.filter(
        (l) => l.tipo === "pagar" && l.situacao !== "cancelado"
      );
      setDespesas(somentePagar);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar lançamentos");
    } finally {
      setLoading(false);
    }
  };

  const carregarLancamentosDaConta = async (contaId: string) => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const data = await api.listarLancamentos(
        token,
        organizacaoId,
        contaId
      );
      setLancamentosContaSelecionada(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar lan\u00e7amentos da conta");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarContas();
    void carregarDespesas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizacaoId, token]);

  const criarConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !novoNome.trim()) return;
    try {
      setErro(null);
      setLoading(true);
      const saldoNumero =
        saldoInicial && saldoInicial.trim().length > 0
          ? Number(
              saldoInicial
                .replace(/\./g, "")
                .replace(",", ".")
            )
          : 0;

      const conta = await api.criarContaFinanceira(token, {
        organizacaoId,
        nome: novoNome.trim(),
        tipo,
        banco: banco || undefined,
        agencia: agencia || undefined,
        numeroConta: numeroConta || undefined,
        saldoInicial: saldoNumero
      });
      setContas((prev) => [...prev, conta]);
      setNovoNome("");
      setBanco("");
      setAgencia("");
      setNumeroConta("");
      setSaldoInicial("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const criarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !novaDescricao.trim() || !novoValor || !novoVencimento) {
      return;
    }

    const conta = contas[0];

    try {
      setErro(null);
      setLoading(true);
      const payload = {
        organizacaoId,
        tipo: "pagar",
        situacao: "pendente",
        planoContasId: "00000000-0000-0000-0000-000000000000",
        centroCustoId: undefined,
        contaFinanceiraId: conta?.id ?? undefined,
        pessoaId: "00000000-0000-0000-0000-000000000000",
        descricao: novaDescricao.trim(),
        valor: Number(novoValor),
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
    } catch (e: any) {
      setErro(e.message || "Erro ao criar despesa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <h2>Financeiro</h2>
      <p style={{ marginBottom: 12 }}>
        Contas financeiras vinculadas à organização{" "}
        <strong>{organizacao.nome}</strong>.
      </p>

      <div className="finance-tabs">
        <button
          type="button"
          className={`finance-tab ${
            aba === "contas" ? "finance-tab--active" : ""
          }`}
          onClick={() => setAba("contas")}
        >
          Contas
        </button>
        <button
          type="button"
          className={`finance-tab ${
            aba === "contasPagar" ? "finance-tab--active" : ""
          }`}
          onClick={() => setAba("contasPagar")}
        >
          Contas a pagar
        </button>
      </div>

      {aba === "contas" && (
        <>
          <form
            onSubmit={criarConta}
            className="form"
            style={{ marginBottom: 16 }}
          >
            <label>
              Nome da conta
              <input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Conta corrente Banco X"
              />
            </label>
            <label>
              Tipo de conta
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                <option value="bancaria">Bancária</option>
                <option value="caixa">Caixa</option>
                <option value="cartao">Cartão</option>
                <option value="poupanca">Poupança</option>
                <option value="outra">Outra</option>
              </select>
            </label>
            <label>
              Banco
              <input
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="Ex.: Bradesco"
              />
            </label>
            <label>
              Agência
              <input
                value={agencia}
                onChange={(e) => setAgencia(e.target.value)}
                placeholder="Ex.: 1234-5"
              />
            </label>
            <label>
              Número da conta
              <input
                value={numeroConta}
                onChange={(e) => setNumeroConta(e.target.value)}
                placeholder="Ex.: 12345-6"
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
            <button type="submit" disabled={loading || !novoNome.trim()}>
              {loading ? "Salvando..." : "Criar conta"}
            </button>
          </form>

          <button
            type="button"
            onClick={carregarContas}
            disabled={loading}
            style={{ marginBottom: 12 }}
          >
            {loading ? "Carregando..." : "Atualizar lista"}
          </button>

          {erro && <p className="error">{erro}</p>}

          <div className="finance-card-grid">
            {contas.map((c) => (
              <div key={c.id} className="finance-card">
                <div className="person-header">
                  <span className="person-name">{c.nome}</span>
                  {c.tipo && <span className="person-badge">{c.tipo}</span>}
                </div>
                {(c.banco || c.agencia || c.numeroConta) && (
                  <div className="person-sub">
                    {[c.banco, c.agencia, c.numeroConta]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                )}
              </div>
            ))}
            {contas.length === 0 && !loading && (
              <p style={{ marginTop: 8, color: "#6b7280" }}>
                Nenhuma conta cadastrada ainda.
              </p>
            )}
          </div>
        </>
      )}

      {aba === "contasPagar" && (
        <>
          <form
            onSubmit={criarDespesa}
            className="form"
            style={{ marginBottom: 16 }}
          >
            <label>
              Descrição
              <input
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Ex.: Conta de energia"
              />
            </label>
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
            <button
              type="submit"
              disabled={loading || !novaDescricao.trim() || !novoVencimento || !novoValor}
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
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {despesas.map((d) => (
                <tr key={d.id}>
                  <td>{d.descricao}</td>
                  <td>
                    {d.dataVencimento
                      ? new Date(d.dataVencimento).toLocaleDateString("pt-BR")
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
                      className={`badge-status ${
                        d.situacao === "pago"
                          ? "badge-status--pago"
                          : "badge-status--pendente"
                      }`}
                    >
                      {d.situacao === "pago" ? "Paga" : "Pendente"}
                    </span>
                  </td>
                </tr>
              ))}
              {despesas.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} style={{ color: "#6b7280" }}>
                    Nenhuma despesa cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
      {erro && <p className="error">{erro}</p>}

      <div className="finance-card-grid">
        {contas.map((c) => (
          <div
            key={c.id}
            className="finance-card"
            style={
              contaSelecionadaId === c.id
                ? { borderColor: "#2563eb", boxShadow: "0 0 0 1px #2563eb" }
                : undefined
            }
          >
            <div className="finance-card-header-row">
              <div className="person-header">
                <span className="person-name">{c.nome}</span>
                {c.tipo && <span className="person-badge">{c.tipo}</span>}
              </div>
              <div className="finance-card-actions">
                <span
                  className={`badge-status ${
                    (c.status ?? "ativo") === "ativo"
                      ? "badge-status--ativo"
                      : "badge-status--inativo"
                  }`}
                >
                  {(c.status ?? "ativo") === "ativo" ? "Ativa" : "Inativa"}
                </span>
                <button
                  type="button"
                  style={{
                    backgroundColor: "#e5e7eb",
                    color: "#111827",
                    paddingInline: 10,
                    marginTop: 0
                  }}
                  onClick={() => {
                    // Futuro: edição de conta
                    alert("Edição de conta ainda será implementada.");
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  style={{
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    paddingInline: 10,
                    marginTop: 0
                  }}
                  onClick={() => {
                    setContaSelecionadaId(c.id);
                    void carregarLancamentosDaConta(c.id);
                  }}
                >
                  Ver extrato
                </button>
                <button
                  type="button"
                  style={{
                    backgroundColor: "#ef4444",
                    color: "#ffffff",
                    paddingInline: 10,
                    marginTop: 0
                  }}
                  onClick={async () => {
                    if (!token) return;
                    const novoStatus =
                      (c.status ?? "ativo") === "ativo" ? "inativo" : "ativo";
                    const acao =
                      novoStatus === "inativo" ? "desativar" : "reativar";

                    const ok = window.confirm(
                      `Deseja ${acao} a conta "${c.nome}"?`
                    );
                    if (!ok) return;

                    try {
                      setErro(null);
                      setLoading(true);
                      await api.atualizarStatusContaFinanceira(
                        token,
                        c.id,
                        novoStatus
                      );
                      setContas((prev) =>
                        prev.map((item) =>
                          item.id === c.id ? { ...item, status: novoStatus } : item
                        )
                      );
                    } catch (e: any) {
                      setErro(e.message || "Erro ao atualizar status da conta");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  {(c.status ?? "ativo") === "ativo" ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
            {(c.banco || c.agencia || c.numeroConta) && (
              <div className="person-sub">
                {[c.banco, c.agencia, c.numeroConta].filter(Boolean).join(" • ")}
              </div>
            )}
          </div>
        ))}
        {contas.length === 0 && !loading && (
          <p style={{ marginTop: 8, color: "#6b7280" }}>
            Nenhuma conta cadastrada ainda.
          </p>
        )}
      </div>

      {contaSelecionadaId && (
        <div style={{ marginTop: 24 }}>
          <h3>Extrato da conta selecionada</h3>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginTop: 8,
              marginBottom: 8
            }}
          >
            <label>
              Mês
              <select
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                style={{ marginLeft: 4 }}
              >
                <option value="">Todos</option>
                <option value="1">Jan</option>
                <option value="2">Fev</option>
                <option value="3">Mar</option>
                <option value="4">Abr</option>
                <option value="5">Mai</option>
                <option value="6">Jun</option>
                <option value="7">Jul</option>
                <option value="8">Ago</option>
                <option value="9">Set</option>
                <option value="10">Out</option>
                <option value="11">Nov</option>
                <option value="12">Dez</option>
              </select>
            </label>
            <label>
              Ano
              <input
                style={{ marginLeft: 4, width: 80 }}
                value={filtroAno}
                onChange={(e) => setFiltroAno(e.target.value)}
                placeholder="2026"
              />
            </label>
          </div>
          {(() => {
            const lancamentosFiltrados = lancamentosContaSelecionada.filter(
              (l) => {
                const dataBase = l.dataVencimento ?? l.dataCompetencia;
                if (!dataBase) return true;
                const d = new Date(dataBase);
                if (filtroMes && d.getMonth() + 1 !== Number(filtroMes)) {
                  return false;
                }
                if (filtroAno && d.getFullYear() !== Number(filtroAno)) {
                  return false;
                }
                return true;
              }
            );

            const conta = contas.find((c) => c.id === contaSelecionadaId);
            const saldoInicialConta = conta?.saldoInicial ?? 0;

            const totais = lancamentosFiltrados.reduce(
              (acc, l) => {
                if (l.situacao === "cancelado") return acc;
                if (l.tipo === "receber") {
                  acc.entradas += l.valor;
                } else if (l.tipo === "pagar") {
                  acc.saidas += l.valor;
                }
                return acc;
              },
              { entradas: 0, saidas: 0 }
            );

            const saldoAtual =
              saldoInicialConta + totais.entradas - totais.saidas;

            if (lancamentosFiltrados.length === 0 && !loading) {
              return (
                <p style={{ color: "#6b7280" }}>
                  Nenhum lan\u00e7amento encontrado para esta conta.
                </p>
              );
            }

            return (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 8,
                    flexWrap: "wrap"
                  }}
                >
                  <div style={{ minWidth: 140 }}>
                    <strong>Saldo inicial: </strong>
                    {saldoInicialConta.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL"
                    })}
                  </div>
                  <div style={{ minWidth: 140 }}>
                    <strong>Entradas: </strong>
                    {totais.entradas.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL"
                    })}
                  </div>
                  <div style={{ minWidth: 140 }}>
                    <strong>Saídas: </strong>
                    {totais.saidas.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL"
                    })}
                  </div>
                  <div style={{ minWidth: 140 }}>
                    <strong>Saldo atual: </strong>
                    {saldoAtual.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL"
                    })}
                  </div>
                </div>

                <table className="table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentosFiltrados.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {(
                            l.dataVencimento ||
                            l.dataCompetencia
                          )
                            ? new Date(
                                l.dataVencimento ?? l.dataCompetencia
                              ).toLocaleDateString("pt-BR")
                            : "-"}
                        </td>
                        <td>{l.descricao}</td>
                        <td style={{ textTransform: "capitalize" }}>
                          {l.tipo}
                        </td>
                        <td>
                          {l.valor.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL"
                          })}
                        </td>
                        <td>
                          <span
                            className={`badge-status ${
                              l.situacao === "pago"
                                ? "badge-status--pago"
                                : l.situacao === "cancelado"
                                ? "badge-status--inativo"
                                : "badge-status--pendente"
                            }`}
                          >
                            {l.situacao}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

const PessoasView: React.FC<{ organizacao: Organizacao }> = ({
  organizacao
}) => {
  const organizacaoId = organizacao.id;
  const { token } = useAuth();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pessoaSelecionadaId, setPessoaSelecionadaId] = useState<
    string | null
  >(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [documento, setDocumento] = useState("");
  const [papel, setPapel] = useState(() => {
    const listaInicial =
      papeisPorTipoOrganizacao[organizacao.tipo ?? ""] ?? papeisPadrao;
    return listaInicial[0]?.value ?? "outro";
  });
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [filtroPessoa, setFiltroPessoa] = useState("");
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

  const papeisParaEstaOrganizacao: PapelOption[] =
    papeisPorTipoOrganizacao[organizacao.tipo ?? ""] ?? papeisPadrao;

  const carregarPessoas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const data = await api.listarPessoas(token, organizacaoId);
      setPessoas(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar pessoas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarPessoas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizacaoId, token]);

  const limparFormulario = () => {
    setPessoaSelecionadaId(null);
    setNome("");
    setEmail("");
    setTelefone("");
    setDocumento("");
    setPapel(papeisParaEstaOrganizacao[0]?.value ?? "outro");
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

      const payload = {
        organizacaoId,
        nome,
        tipo: "fisica" as const,
        documento: documento || undefined,
        email: email || undefined,
        telefone: telefone || undefined,
        papel,
        logradouro: logradouro || undefined,
        numero: numero || undefined,
        bairro: bairro || undefined,
        cidade: cidade || undefined,
        estado: estado || undefined,
        cep: cep || undefined
      };

      const enderecoAtual = {
        logradouro: payload.logradouro,
        numero: payload.numero,
        bairro: payload.bairro,
        cidade: payload.cidade,
        estado: payload.estado,
        cep: payload.cep
      };

      let result: Pessoa;
      if (pessoaSelecionadaId) {
        result = await api.atualizarPessoa(
          token,
          pessoaSelecionadaId,
          organizacaoId,
          payload
        );
        setEnderecosPorPessoa((prev) => ({
          ...prev,
          [pessoaSelecionadaId]: enderecoAtual
        }));
        setPessoas((prev) =>
          prev.map((p) => (p.id === pessoaSelecionadaId ? result : p))
        );
      } else {
        result = await api.criarPessoa(token, payload);
        setEnderecosPorPessoa((prev) => ({
          ...prev,
          [result.id]: enderecoAtual
        }));
        setPessoas((prev) => [...prev, result]);
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
    const confirmar = window.confirm(
      `Remover o cadastro de "${p.nome}" desta organização?`
    );
    if (!confirmar) return;

    try {
      setLoading(true);
      await api.removerPessoa(token, p.id, organizacaoId);
      setPessoas((prev) => prev.filter((item) => item.id !== p.id));
      setEnderecosPorPessoa((prev) => {
        const copia = { ...prev };
        delete copia[p.id];
        return copia;
      });
      if (pessoaSelecionadaId === p.id) {
        limparFormulario();
      }
    } catch (e: any) {
      setErro(e.message || "Erro ao remover pessoa");
    } finally {
      setLoading(false);
    }
  };

  const pessoasFiltradas = pessoas
    // Esconde o usuário técnico/admin da lista
    .filter(
      (p) =>
        p.email !== "admin@teste.com" &&
        p.nome.toLowerCase() !== "usuário admin"
    )
    .filter((p) => {
      if (!filtroPessoa.trim()) return true;
      const termo = filtroPessoa.toLowerCase();
      return (
        p.nome.toLowerCase().includes(termo) ||
        (p.telefone ?? "").toLowerCase().includes(termo)
      );
    });

  const selecionarPessoa = (p: Pessoa) => {
    setPessoaSelecionadaId(p.id);
    setNome(p.nome);
    setEmail(p.email ?? "");
    setTelefone(p.telefone ?? "");
    setDocumento(p.documento ?? "");
    setPapel(p.papel ?? "morador");
    // Não temos os campos de endereço detalhados no DTO, então deixamos em branco.
    setLogradouro("");
    setNumero("");
    setBairro("");
    setCidade("");
    setEstado("");
    setCep("");
  };

  return (
    <div style={{ marginTop: 24 }}>
      <h2>Pessoas</h2>
      <p style={{ marginBottom: 12 }}>
        Cadastro básico de pessoas vinculadas à organização{" "}
        <strong>{organizacao.nome}</strong>.
      </p>

      <form
        onSubmit={salvarPessoa}
        className="form"
        style={{ marginBottom: 24 }}
      >
        <label>
          Nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Telefone
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
        </label>
        <label>
          Documento (CPF/CNPJ)
          <input
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
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

        <label>
          Logradouro
          <input
            value={logradouro}
            onChange={(e) => setLogradouro(e.target.value)}
          />
        </label>
        <label>
          Número
          <input value={numero} onChange={(e) => setNumero(e.target.value)} />
        </label>
        <label>
          Bairro
          <input value={bairro} onChange={(e) => setBairro(e.target.value)} />
        </label>
        <label>
          Cidade
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </label>
        <label>
          Estado
          <input value={estado} onChange={(e) => setEstado(e.target.value)} />
        </label>
        <label>
          CEP
          <input value={cep} onChange={(e) => setCep(e.target.value)} />
        </label>

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

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginTop: 8
        }}
      >
        <input
          placeholder="Buscar pessoa por nome ou telefone"
          value={filtroPessoa}
          onChange={(e) => setFiltroPessoa(e.target.value)}
          style={{
            flex: 1,
            borderRadius: 999,
            padding: "8px 14px",
            border: "1px solid #e5e7eb"
          }}
        />
        <button onClick={carregarPessoas} disabled={loading}>
          {loading ? "Carregando..." : "Atualizar lista"}
        </button>
      </div>

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

      <div className="person-list">
        {pessoasFiltradas.map((p) => (
          <button
            key={p.id}
            type="button"
            className="person-item"
            onClick={() => {
              selecionarPessoa(p);
              const endereco = enderecosPorPessoa[p.id];
              setLogradouro(endereco?.logradouro ?? "");
              setNumero(endereco?.numero ?? "");
              setBairro(endereco?.bairro ?? "");
              setCidade(endereco?.cidade ?? "");
              setEstado(endereco?.estado ?? "");
              setCep(endereco?.cep ?? "");
            }}
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
              {p.papel && <span className="person-badge">{p.papel}</span>}
            </div>
            {p.enderecoResumo && (
              <div className="person-sub">{p.enderecoResumo}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <InnerApp />
  </AuthProvider>
);
