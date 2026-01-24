import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { api, Organizacao, Pessoa } from "../api";
import { LoginPage } from "./LoginPage";

const segmentos = [
  { id: "condominios", label: "Condomínios", icon: "🏢" },
  { id: "empresas", label: "Empresas", icon: "💼" },
  { id: "igrejas", label: "Igrejas", icon: "⛪" },
  { id: "sitios", label: "Sítios / Pousadas", icon: "🏡" },
  { id: "associacoes", label: "Associações / ONGs", icon: "🤝" },
  { id: "outros", label: "Outros", icon: "✨" }
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
  const { token } = useAuth();

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
  const [view, setView] = useState<"dashboard" | "pessoas">("dashboard");

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
              <span>{seg.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 2) Lista de organizações
  if (!organizacaoSelecionada) {
    const seg = segmentos.find((s) => s.id === segmentoSelecionado);
    return (
      <div className="container">
        <h1>Selecione uma organização</h1>
        {seg && (
          <p style={{ marginTop: 8, marginBottom: 16, color: "#4b5563" }}>
            <strong>{seg.label}</strong>
          </p>
        )}

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
          {organizacoes.map((org) => (
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
    );
  }

  // 3) Dashboard + Pessoas para a organização selecionada
  return (
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
    </div>
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
  const [papel, setPapel] = useState("morador");
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
    setPapel("morador");
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
            <option value="morador">Morador</option>
            <option value="proprietario">Proprietário</option>
            <option value="sindico">Síndico</option>
            <option value="subsindico">Subsíndico</option>
            <option value="conselheiro">Conselheiro</option>
            <option value="colaborador">Colaborador</option>
            <option value="fornecedor">Fornecedor</option>
            <option value="membro">Membro</option>
            <option value="outro">Outro</option>
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
