import { useEffect, useMemo, useRef, useState } from "react";
import { api, Organizacao, Pessoa, UnidadeOrganizacional } from "../api";
import { useAuth } from "../hooks/useAuth";

type DocumentosViewProps = {
  organizacao: Organizacao;
  readOnly?: boolean;
};

type DocumentoCategoria =
  | "ata"
  | "regimento"
  | "contrato"
  | "financeiro"
  | "comunicado"
  | "manual"
  | "outros";

type DocumentoStatus = "ativo" | "rascunho" | "revisao" | "arquivado";

type DocumentoVisibilidade = "publico" | "interno" | "restrito";

type DocumentoItem = {
  id: string;
  categoria: DocumentoCategoria;
  titulo: string;
  descricao?: string | null;
  arquivoNome: string;
  tamanho: number;
  unidadeId?: string | null;
  autorId?: string | null;
  criadoEm: string;
  atualizadoEm?: string | null;
  visibilidade: DocumentoVisibilidade;
  status: DocumentoStatus;
  versao: string;
  tags: string[];
};

type DocumentoStore = {
  itens: DocumentoItem[];
};

const categoriaLabel: Record<DocumentoCategoria, string> = {
  ata: "Ata",
  regimento: "Regimento",
  contrato: "Contrato",
  financeiro: "Financeiro",
  comunicado: "Comunicado",
  manual: "Manual",
  outros: "Outros"
};

const statusLabel: Record<DocumentoStatus, string> = {
  ativo: "ativo",
  rascunho: "rascunho",
  revisao: "em revisao",
  arquivado: "arquivado"
};

const statusClass: Record<DocumentoStatus, string> = {
  ativo: "badge-status--pago",
  rascunho: "badge-status--pendente",
  revisao: "badge-status--aberto",
  arquivado: "badge-status--cancelado"
};

const visibilidadeLabel: Record<DocumentoVisibilidade, string> = {
  publico: "publico",
  interno: "interno",
  restrito: "restrito"
};

const formatarDataHora = (value?: string | null) => {
  if (!value) return "-";
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR");
};

const formatarTamanho = (bytes?: number | null) => {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const criarArquivoResumo = (doc: DocumentoItem, organizacao: Organizacao) => {
  const linhas = [
    `Documento: ${doc.titulo}`,
    `Categoria: ${categoriaLabel[doc.categoria]}`,
    `Organizacao: ${organizacao.nome}`,
    `Versao: ${doc.versao}`,
    `Status: ${statusLabel[doc.status]}`,
    `Visibilidade: ${visibilidadeLabel[doc.visibilidade]}`,
    `Criado em: ${formatarDataHora(doc.criadoEm)}`,
    `Atualizado em: ${formatarDataHora(doc.atualizadoEm)}`,
    `Descricao: ${doc.descricao ?? "-"}`,
    `Tags: ${doc.tags.join(", ") || "-"}`,
    "",
    "Arquivo ficticio para demonstracao."
  ];
  return new Blob([linhas.join("\n")], { type: "text/plain;charset=utf-8" });
};

export default function DocumentosView({
  organizacao,
  readOnly
}: DocumentosViewProps) {
  const { token } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [itens, setItens] = useState<DocumentoItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasStorage, setHasStorage] = useState(false);
  const seededRef = useRef(false);

  const storeKey = useMemo(
    () => `documentos-demo-${organizacao.id}`,
    [organizacao.id]
  );

  const unidadesPorId = useMemo(
    () =>
      unidades.reduce<Record<string, UnidadeOrganizacional>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [unidades]
  );

  const pessoasPorId = useMemo(
    () =>
      pessoas.reduce<Record<string, Pessoa>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [pessoas]
  );

  const carregarBase = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setErro(null);
      const [listaUnidades, listaPessoas] = await Promise.all([
        api.listarUnidades(token, organizacao.id),
        api.listarPessoas(token, organizacao.id)
      ]);
      setUnidades(listaUnidades);
      setPessoas(listaPessoas);
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar documentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storeKey);
    if (!raw) {
      setHasStorage(false);
      setItens([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<DocumentoStore>;
      const lista = Array.isArray(parsed.itens) ? parsed.itens : [];
      setItens(lista);
      setHasStorage(lista.length > 0);
    } catch {
      setHasStorage(false);
      setItens([]);
    }
  }, [storeKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: DocumentoStore = { itens };
    window.localStorage.setItem(storeKey, JSON.stringify(payload));
  }, [storeKey, itens]);

  useEffect(() => {
    void carregarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizacao.id]);

  useEffect(() => {
    if (seededRef.current) return;
    if (hasStorage) {
      seededRef.current = true;
      return;
    }
    if (!unidades.length && !pessoas.length) return;
    seededRef.current = true;

    const agora = new Date();
    const doisDias = new Date(agora.getTime() - 2 * 86400000).toISOString();
    const seteDias = new Date(agora.getTime() - 7 * 86400000).toISOString();
    const unidadeA = unidades[0];
    const unidadeB = unidades[1] ?? unidadeA;
    const autor = pessoas[0];

    setItens([
      {
        id: crypto.randomUUID(),
        categoria: "ata",
        titulo: "Ata da assembleia geral",
        descricao: "Aprovacao de contas e obras 2026.",
        arquivoNome: "ata-assembleia-2026.pdf",
        tamanho: 234567,
        unidadeId: unidadeA?.id ?? null,
        autorId: autor?.id ?? null,
        criadoEm: seteDias,
        atualizadoEm: seteDias,
        visibilidade: "publico",
        status: "ativo",
        versao: "v1.0",
        tags: ["assembleia", "prestacao"]
      },
      {
        id: crypto.randomUUID(),
        categoria: "regimento",
        titulo: "Regimento interno atualizado",
        descricao: "Versao consolidada do regimento.",
        arquivoNome: "regimento-interno.pdf",
        tamanho: 145332,
        unidadeId: null,
        autorId: autor?.id ?? null,
        criadoEm: seteDias,
        atualizadoEm: doisDias,
        visibilidade: "publico",
        status: "ativo",
        versao: "v2.3",
        tags: ["regimento", "regras"]
      },
      {
        id: crypto.randomUUID(),
        categoria: "contrato",
        titulo: "Contrato elevadores - manutencao",
        descricao: "Contrato anual com fornecedor.",
        arquivoNome: "contrato-elevadores-2026.pdf",
        tamanho: 99322,
        unidadeId: unidadeB?.id ?? null,
        autorId: autor?.id ?? null,
        criadoEm: doisDias,
        atualizadoEm: doisDias,
        visibilidade: "interno",
        status: "revisao",
        versao: "v1.1",
        tags: ["manutencao", "fornecedor"]
      },
      {
        id: crypto.randomUUID(),
        categoria: "financeiro",
        titulo: "Balancete mensal - janeiro",
        descricao: "Resumo financeiro do mes.",
        arquivoNome: "balancete-jan-2026.pdf",
        tamanho: 321400,
        unidadeId: null,
        autorId: autor?.id ?? null,
        criadoEm: agora.toISOString(),
        atualizadoEm: agora.toISOString(),
        visibilidade: "interno",
        status: "rascunho",
        versao: "v0.9",
        tags: ["balancete", "financeiro"]
      }
    ]);
  }, [hasStorage, unidades, pessoas]);

  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<DocumentoCategoria>("comunicado");
  const [visibilidade, setVisibilidade] = useState<DocumentoVisibilidade>("interno");
  const [status, setStatus] = useState<DocumentoStatus>("rascunho");
  const [unidadeId, setUnidadeId] = useState("");
  const [autorId, setAutorId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tags, setTags] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroVisibilidade, setFiltroVisibilidade] = useState("todas");
  const [filtroUnidade, setFiltroUnidade] = useState("todas");

  const registrarDocumento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro("Informe o titulo do documento.");
      return;
    }
    setErro(null);
    const arquivoNome =
      arquivo?.name ||
      `${categoriaLabel[categoria].toLowerCase()}-${Date.now()}.pdf`;
    const novo: DocumentoItem = {
      id: crypto.randomUUID(),
      categoria,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      arquivoNome,
      tamanho: arquivo?.size ?? 0,
      unidadeId: unidadeId || null,
      autorId: autorId || null,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      visibilidade,
      status,
      versao: "v1.0",
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    };
    setItens((prev) => [novo, ...prev]);
    setTitulo("");
    setDescricao("");
    setTags("");
    setArquivo(null);
  };

  const baixarDocumento = (doc: DocumentoItem) => {
    const blob = criarArquivoResumo(doc, organizacao);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.arquivoNome || `documento-${doc.id}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const visualizarDocumento = (doc: DocumentoItem) => {
    const blob = criarArquivoResumo(doc, organizacao);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const alterarStatus = (id: string, novo: DocumentoStatus) => {
    setItens((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: novo, atualizadoEm: new Date().toISOString() } : item
      )
    );
  };

  const removerDocumento = (id: string) => {
    if (!window.confirm("Remover documento?")) return;
    setItens((prev) => prev.filter((item) => item.id !== id));
  };

  const itensFiltrados = useMemo(() => {
    const termo = filtroTexto.trim().toLowerCase();
    return itens
      .filter((item) => {
        if (filtroCategoria !== "todas" && item.categoria !== filtroCategoria) {
          return false;
        }
        if (filtroStatus !== "todos" && item.status !== filtroStatus) {
          return false;
        }
        if (filtroVisibilidade !== "todas" && item.visibilidade !== filtroVisibilidade) {
          return false;
        }
        if (filtroUnidade !== "todas" && item.unidadeId !== filtroUnidade) {
          return false;
        }
        if (!termo) return true;
        const unidade = item.unidadeId ? unidadesPorId[item.unidadeId] : null;
        const pessoa = item.autorId ? pessoasPorId[item.autorId] : null;
        const base = [
          item.titulo,
          item.descricao,
          item.arquivoNome,
          categoriaLabel[item.categoria],
          unidade?.nome,
          unidade?.codigoInterno,
          pessoa?.nome,
          item.tags.join(" ")
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return base.includes(termo);
      })
      .sort((a, b) => (b.atualizadoEm ?? b.criadoEm).localeCompare(a.atualizadoEm ?? a.criadoEm));
  }, [
    itens,
    filtroTexto,
    filtroCategoria,
    filtroStatus,
    filtroVisibilidade,
    filtroUnidade,
    unidadesPorId,
    pessoasPorId
  ]);

  const totalDocumentos = itens.length;
  const ativos = itens.filter((i) => i.status === "ativo").length;
  const pendentes = itens.filter((i) => i.status === "revisao").length;
  const arquivados = itens.filter((i) => i.status === "arquivado").length;
  const publicos = itens.filter((i) => i.visibilidade === "publico").length;

  return (
    <div className="finance-layout">
      <div className="finance-side-column">
        <section className="finance-form-card">
          <div className="finance-header-row">
            <div>
              <h3>Documentos</h3>
              <p className="finance-form-sub">
                Biblioteca de arquivos, atas e contratos do condominio.
              </p>
            </div>
            <button type="button" onClick={() => void carregarBase()} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          <div className="finance-summary-grid">
            <div className="finance-summary-card">
              <div className="finance-summary-label">Total</div>
              <div className="finance-summary-value">{totalDocumentos}</div>
              <div className="finance-summary-sub">Arquivos cadastrados</div>
            </div>
            <div className="finance-summary-card">
              <div className="finance-summary-label">Ativos</div>
              <div className="finance-summary-value">{ativos}</div>
              <div className="finance-summary-sub">Disponiveis</div>
            </div>
            <div className="finance-summary-card">
              <div className="finance-summary-label">Publicos</div>
              <div className="finance-summary-value">{publicos}</div>
              <div className="finance-summary-sub">Visiveis a todos</div>
            </div>
            <div className="finance-summary-card">
              <div className="finance-summary-label">Pendentes</div>
              <div className="finance-summary-value">{pendentes}</div>
              <div className="finance-summary-sub">Em revisao</div>
            </div>
            <div className="finance-summary-card">
              <div className="finance-summary-label">Arquivados</div>
              <div className="finance-summary-value">{arquivados}</div>
              <div className="finance-summary-sub">Historico</div>
            </div>
          </div>
        </section>

        <section className="finance-form-card">
          <h3>Novo documento</h3>
          <p className="finance-form-sub">Registre um novo arquivo na biblioteca.</p>
          {!readOnly && (
            <form className="form" onSubmit={registrarDocumento}>
              <div className="finance-form-grid">
                <label>
                  Categoria
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value as DocumentoCategoria)}>
                    {Object.entries(categoriaLabel).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Visibilidade
                  <select
                    value={visibilidade}
                    onChange={(e) => setVisibilidade(e.target.value as DocumentoVisibilidade)}
                  >
                    {Object.entries(visibilidadeLabel).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select value={status} onChange={(e) => setStatus(e.target.value as DocumentoStatus)}>
                    {Object.entries(statusLabel).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Titulo
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Regimento interno"
                />
              </label>
              <label>
                Descricao
                <textarea
                  rows={2}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Observacoes ou resumo"
                />
              </label>
              <div className="finance-form-grid">
                <label>
                  Unidade
                  <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
                    <option value="">Geral</option>
                    {unidades.map((unidade) => (
                      <option key={unidade.id} value={unidade.id}>
                        {unidade.codigoInterno} - {unidade.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Autor
                  <select value={autorId} onChange={(e) => setAutorId(e.target.value)}>
                    <option value="">Sem autor</option>
                    {pessoas.map((pessoa) => (
                      <option key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Tags (separe por virgula)
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="financeiro, assembleia"
                />
              </label>
              <label>
                Arquivo
                <input
                  type="file"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </label>
              <button type="submit">Cadastrar documento</button>
            </form>
          )}
          {readOnly && <p className="finance-form-sub">Sem acesso para cadastrar.</p>}
        </section>
      </div>

      <section className="finance-table-card">
        <div className="finance-table-header">
          <div>
            <h3>Biblioteca</h3>
            <p className="finance-form-sub">Documentos disponiveis no condominio.</p>
          </div>
          <div className="finance-card-actions">
            <label>
              Buscar
              <input
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Titulo, tag ou unidade"
              />
            </label>
            <label>
              Categoria
              <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                <option value="todas">Todas</option>
                {Object.entries(categoriaLabel).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                <option value="todos">Todos</option>
                {Object.entries(statusLabel).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Visibilidade
              <select
                value={filtroVisibilidade}
                onChange={(e) => setFiltroVisibilidade(e.target.value)}
              >
                <option value="todas">Todas</option>
                {Object.entries(visibilidadeLabel).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Unidade
              <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}>
                <option value="todas">Todas</option>
                {unidades.map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.codigoInterno}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {erro && <p className="error">{erro}</p>}

        <table className="table documentos-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Categoria</th>
              <th>Unidade</th>
              <th>Atualizado</th>
              <th>Status</th>
              <th>Visibilidade</th>
              <th>Tamanho</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {itensFiltrados.map((doc) => {
              const unidade = doc.unidadeId ? unidadesPorId[doc.unidadeId] : null;
              const autor = doc.autorId ? pessoasPorId[doc.autorId] : null;
              return (
                <tr key={doc.id}>
                  <td>
                    <div>{doc.titulo}</div>
                    <span className="unit-muted">
                      {doc.arquivoNome} • {doc.versao}
                      {autor ? ` • ${autor.nome}` : ""}
                    </span>
                    {doc.tags.length > 0 && (
                      <div className="documentos-tags">
                        {doc.tags.map((tag) => (
                          <span key={tag} className="badge">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{categoriaLabel[doc.categoria]}</td>
                  <td>{unidade ? `${unidade.codigoInterno} - ${unidade.nome}` : "Geral"}</td>
                  <td>{formatarDataHora(doc.atualizadoEm ?? doc.criadoEm)}</td>
                  <td>
                    <span className={`badge-status ${statusClass[doc.status]}`}>
                      {statusLabel[doc.status]}
                    </span>
                  </td>
                  <td>
                    <span className="badge">{visibilidadeLabel[doc.visibilidade]}</span>
                  </td>
                  <td>{formatarTamanho(doc.tamanho)}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="action-secondary"
                        onClick={() => visualizarDocumento(doc)}
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        className="action-primary"
                        onClick={() => baixarDocumento(doc)}
                      >
                        Baixar
                      </button>
                      {!readOnly && doc.status !== "arquivado" && (
                        <button
                          type="button"
                          className="action-secondary"
                          onClick={() => alterarStatus(doc.id, "arquivado")}
                        >
                          Arquivar
                        </button>
                      )}
                      {!readOnly && doc.status === "arquivado" && (
                        <button
                          type="button"
                          className="action-secondary"
                          onClick={() => alterarStatus(doc.id, "ativo")}
                        >
                          Reabrir
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          type="button"
                          className="action-secondary"
                          onClick={() => removerDocumento(doc.id)}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {itensFiltrados.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center" }}>
                  Nenhum documento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
