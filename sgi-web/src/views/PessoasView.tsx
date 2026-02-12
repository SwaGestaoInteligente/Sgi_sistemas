
import React, { useEffect, useState } from "react";
import { api, Organizacao, Pessoa } from "../api";
import { useAuth } from "../hooks/useAuth";

type PessoasViewProps = {
  organizacao: Organizacao;
  papelFixo?: string;
  titulo?: string;
  subTitulo?: React.ReactNode;
  readOnly?: boolean;
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

const PessoasView: React.FC<PessoasViewProps> = ({
  organizacao,
  papelFixo,
  titulo,
  subTitulo,
  readOnly = false
}) => {
  const { token } = useAuth();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [filtroPapel, setFiltroPapel] = useState<string>("");
  const [formAberto, setFormAberto] = useState(false);

  const [pessoaSelecionadaId, setPessoaSelecionadaId] =
    useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"fisica" | "juridica">("fisica");
  const [documento, setDocumento] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [papel, setPapel] = useState(papelFixo ?? "morador");
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

  useEffect(() => {
    if (readOnly && formAberto) {
      setFormAberto(false);
    }
  }, [formAberto, readOnly]);

  const carregarPessoas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarPessoas(token, organizacao.id);
      const listaFiltrada =
        papelFixo != null
          ? lista.filter((p) => (p.papel ?? "") === papelFixo)
          : lista;
      setPessoas(listaFiltrada);

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
    setFormAberto(true);
    setNome(p.nome);
    setDocumento(p.documento ?? "");
    setEmail(p.email ?? "");
    setTelefone(p.telefone ?? "");
    setPapel(papelFixo ?? p.papel ?? "morador");
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
    setPapel(papelFixo ?? "morador");
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
    const filtroPapelEfetivo = papelFixo ?? filtroPapel;

    if (termo) {
      const bateTermo =
        p.nome.toLowerCase().includes(termo) ||
        (p.telefone ?? "").toLowerCase().includes(termo);
      if (!bateTermo) {
        return false;
      }
    }

    if (filtroPapelEfetivo && (p.papel ?? "") !== filtroPapelEfetivo) {
      return false;
    }

    return true;
  });

  const pessoaSelecionada = pessoaSelecionadaId
    ? pessoas.find((p) => p.id === pessoaSelecionadaId) ?? null
    : null;

  const montarEnderecoResumo = (p: Pessoa) => {
    if (p.enderecoResumo) return p.enderecoResumo;
    const partes = [
      p.logradouro,
      p.numero,
      p.bairro,
      p.cidade,
      p.estado
    ].filter(Boolean);
    return partes.join(", ");
  };
  const getInitials = (nome: string) => {
    const partes = nome
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (partes.length === 0) return "-";
    const first = partes[0]?.[0] ?? "";
    const last = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "";
    return `${first}${last}`.toUpperCase();
  };

  const papeisParaEstaOrganizacao =
    papeisPorTipoOrganizacao[organizacao.tipo ?? ""] ?? papeisPadrao;

  return (
    <div className="people-page">
      <div className="people-header-row">
        <div>
          <h2>{titulo ?? "Pessoas"}</h2>
        </div>
        <div className="people-header-actions">
          {!readOnly && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                limparFormulario();
                setFormAberto(true);
              }}
            >
              + Nova pessoa
            </button>
          )}
        </div>
      </div>

      <div className={"people-layout" + (formAberto ? "" : " people-layout--single")}>
        {/* Formulário */}
        {formAberto && !readOnly && (
          <section className="people-form-card">
            <h3>{pessoaSelecionadaId ? "Editar pessoa" : "Nova pessoa"}</h3>

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
                  Papel na organização
                  <select
                    value={papel}
                    onChange={(e) => setPapel(e.target.value)}
                    disabled={Boolean(papelFixo)}
                  >
                    {papeisParaEstaOrganizacao.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Telefone
                  <input
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
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
                  E-mail
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>

              <details className="people-more-details">
                <summary>Mais dados (opcional)</summary>
                <div className="people-more-content">
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
                      Logradouro
                      <input
                        value={logradouro}
                        onChange={(e) => setLogradouro(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="people-form-grid">
                    <label>
                      Número
                      <input
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                      />
                    </label>
                    <label>
                      Bairro
                      <input
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="people-form-grid">
                    <label>
                      Cidade
                      <input
                        value={cidade}
                        onChange={(e) => setCidade(e.target.value)}
                      />
                    </label>
                    <label>
                      Estado
                      <input
                        value={estado}
                        onChange={(e) => setEstado(e.target.value)}
                      />
                    </label>
                  </div>

                  <label>
                    CEP
                    <input value={cep} onChange={(e) => setCep(e.target.value)} />
                  </label>
                </div>
              </details>

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
        )}

        {/* Lista */}
        <section className="people-list-card">
          <div className="people-list-header">
            <div className="people-list-title">
              <h3>Pessoas cadastradas</h3>
              <span className="people-count">{pessoasFiltradas.length}</span>
            </div>
            <div className="people-search-row">
              <input
                placeholder="Buscar por nome ou telefone"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
              <select
                value={filtroPapel}
                onChange={(e) => setFiltroPapel(e.target.value)}
              >
                <option value="">Todos os papéis</option>
                {papeisParaEstaOrganizacao.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={carregarPessoas}
                disabled={loading}
              >
                {loading ? "Carregando..." : "Atualizar lista"}
              </button>
            </div>
          </div>

          {pessoasFiltradas.length > 0 ? (
            <div className="people-table">
              <div className="people-table-head">
                <span>Nome</span>
                <span>Papel</span>
                <span>Contato</span>
                <span>Endereco</span>
              </div>
              <div className="people-table-body">
                {pessoasFiltradas.map((p) => {
                  const endereco = montarEnderecoResumo(p);
                  const contato = [p.telefone, p.email].filter(Boolean).join(" • ");
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={
                        "people-table-row" +
                        (pessoaSelecionadaId === p.id
                          ? " people-table-row--active"
                          : "")
                      }
                      onClick={() => selecionarPessoa(p)}
                    >
                      <div className="people-table-name">
                        <span className="people-avatar">{getInitials(p.nome)}</span>
                        <div>
                          <div className="people-name">{p.nome}</div>
                          <div className="people-subtext">
                            {contato || "Sem contato"}
                          </div>
                        </div>
                      </div>
                      <div className="people-table-role">
                        {p.papel ? (
                          <span className="person-badge">{p.papel}</span>
                        ) : (
                          <span className="people-subtext">-</span>
                        )}
                      </div>
                      <div className="people-table-contact">
                        <span>{p.telefone ?? "-"}</span>
                      </div>
                      <div className="people-table-address">
                        {endereco || "Sem endereco"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="people-empty">Nenhuma pessoa cadastrada.</p>
          )}

          {pessoaSelecionada && !readOnly && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void removerPessoa(pessoaSelecionada)}
              className="danger-button"
            >
              Excluir: {pessoaSelecionada.nome}
            </button>
          )}
        </section>
      </div>
    </div>
  );
};
export default PessoasView;

