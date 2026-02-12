import { useEffect, useMemo, useState } from "react";
import { api, Organizacao, UnidadeOrganizacional } from "../api";
import { useAuth } from "../hooks/useAuth";

type ComunicadosViewProps = {
  organizacao: Organizacao;
  readOnly?: boolean;
};

type ComunicadoPrioridade = "normal" | "alta" | "urgente";
type ComunicadoStatus = "ativo" | "arquivado";
type ComunicadoEscopo = "geral" | "unidade";

type ComunicadoItem = {
  id: string;
  organizacaoId: string;
  titulo: string;
  mensagem: string;
  prioridade: ComunicadoPrioridade;
  status: ComunicadoStatus;
  escopo: ComunicadoEscopo;
  unidadeId?: string | null;
  criadoEm: string;
  criadoPor: string;
};

const PRIORIDADE_OPTIONS: Array<{ value: ComunicadoPrioridade; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" }
];

const STATUS_OPTIONS: Array<{ value: "todos" | ComunicadoStatus; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "ativo", label: "Ativos" },
  { value: "arquivado", label: "Arquivados" }
];

const ESCOPO_OPTIONS: Array<{ value: ComunicadoEscopo; label: string }> = [
  { value: "geral", label: "Geral (todo condominio)" },
  { value: "unidade", label: "Unidade especifica" }
];

const formatarDataHoraBr = (valor: string) => {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  const hora = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const dia = data.toLocaleDateString("pt-BR");
  return `${hora} ${dia}`;
};

const normalizar = (valor?: string | null) =>
  (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const criarSeed = (organizacao: Organizacao): ComunicadoItem[] => {
  const agora = new Date();
  return [
    {
      id: crypto.randomUUID(),
      organizacaoId: organizacao.id,
      titulo: "Aviso geral de manutencao",
      mensagem:
        "Manutencao preventiva de elevadores na sexta-feira. Evitar uso entre 09:00 e 12:00.",
      prioridade: "alta",
      status: "ativo",
      escopo: "geral",
      criadoEm: agora.toISOString(),
      criadoPor: "Administracao"
    },
    {
      id: crypto.randomUUID(),
      organizacaoId: organizacao.id,
      titulo: "Coleta de reciclaveis",
      mensagem:
        "A coleta seletiva ocorre toda quarta-feira. Organize os materiais em sacos identificados.",
      prioridade: "normal",
      status: "ativo",
      escopo: "geral",
      criadoEm: new Date(agora.getTime() - 86400000).toISOString(),
      criadoPor: "Portaria"
    }
  ];
};

export default function ComunicadosView({ organizacao, readOnly = false }: ComunicadosViewProps) {
  const { token, session } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [comunicados, setComunicados] = useState<ComunicadoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [prioridade, setPrioridade] = useState<ComunicadoPrioridade>("normal");
  const [escopo, setEscopo] = useState<ComunicadoEscopo>("geral");
  const [unidadeId, setUnidadeId] = useState("");

  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | ComunicadoStatus>("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState<"todas" | ComunicadoPrioridade>("todas");

  const storageKey = useMemo(
    () => `comunicados-demo-${organizacao.id}`,
    [organizacao.id]
  );

  useEffect(() => {
    if (!token) return;
    let cancelado = false;
    const carregarUnidades = async () => {
      try {
        const lista = await api.listarUnidades(token, organizacao.id);
        if (!cancelado) {
          setUnidades(lista.filter((item) => item.tipo !== "Bloco" && item.status === "ativo"));
        }
      } catch {
        if (!cancelado) {
          setUnidades([]);
        }
      }
    };
    void carregarUnidades();
    return () => {
      cancelado = true;
    };
  }, [organizacao.id, token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setComunicados(criarSeed(organizacao));
        return;
      }
      const parsed = JSON.parse(raw) as ComunicadoItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setComunicados(parsed);
      } else {
        setComunicados(criarSeed(organizacao));
      }
    } catch {
      setComunicados(criarSeed(organizacao));
    }
  }, [organizacao, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(comunicados));
    } catch {
      // Ignora indisponibilidade do storage.
    }
  }, [comunicados, storageKey]);

  const comunicadosFiltrados = useMemo(() => {
    const termo = normalizar(filtroTexto);
    return comunicados
      .filter((item) => {
        if (filtroStatus !== "todos" && item.status !== filtroStatus) {
          return false;
        }
        if (filtroPrioridade !== "todas" && item.prioridade !== filtroPrioridade) {
          return false;
        }
        if (!termo) return true;
        const alvo = normalizar(
          `${item.titulo} ${item.mensagem} ${item.criadoPor} ${item.escopo}`
        );
        return alvo.includes(termo);
      })
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [comunicados, filtroPrioridade, filtroStatus, filtroTexto]);

  const criarComunicado = async (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    if (!titulo.trim() || !texto.trim()) {
      setErro("Preencha titulo e mensagem para publicar o comunicado.");
      return;
    }
    if (escopo === "unidade" && !unidadeId) {
      setErro("Selecione a unidade para comunicado direcionado.");
      return;
    }

    try {
      setLoading(true);
      setErro(null);
      const novo: ComunicadoItem = {
        id: crypto.randomUUID(),
        organizacaoId: organizacao.id,
        titulo: titulo.trim(),
        mensagem: texto.trim(),
        prioridade,
        status: "ativo",
        escopo,
        unidadeId: escopo === "unidade" ? unidadeId : null,
        criadoEm: new Date().toISOString(),
        criadoPor: session?.pessoaId ? "Usuario logado" : "Administracao"
      };
      setComunicados((prev) => [novo, ...prev]);
      setTitulo("");
      setTexto("");
      setPrioridade("normal");
      setEscopo("geral");
      setUnidadeId("");
      setMensagem("Comunicado publicado.");
    } finally {
      setLoading(false);
    }
  };

  const alternarStatus = (item: ComunicadoItem) => {
    if (readOnly) return;
    setComunicados((prev) =>
      prev.map((atual) =>
        atual.id === item.id
          ? {
              ...atual,
              status: atual.status === "ativo" ? "arquivado" : "ativo"
            }
          : atual
      )
    );
  };

  const remover = (id: string) => {
    if (readOnly) return;
    if (!window.confirm("Confirma remover este comunicado?")) return;
    setComunicados((prev) => prev.filter((item) => item.id !== id));
  };

  const unidadeMap = useMemo(
    () => Object.fromEntries(unidades.map((item) => [item.id, `${item.tipo} ${item.codigoInterno}`])),
    [unidades]
  );

  return (
    <div className="finance-page comunicados-page">
      <section className="card">
        <h3>Central de comunicados</h3>
        <p className="finance-form-sub">
          Publique avisos para todo o condominio ou para unidades especificas.
        </p>
      </section>

      <div className="finance-layout">
        {!readOnly && (
          <section className="finance-form-card">
            <h3>Novo comunicado</h3>
            <form onSubmit={criarComunicado} className="form">
              <label>
                Titulo
                <input
                  value={titulo}
                  onChange={(event) => setTitulo(event.target.value)}
                  placeholder="Ex.: Manutencao de elevadores"
                  maxLength={120}
                  required
                />
              </label>

              <label>
                Mensagem
                <textarea
                  value={texto}
                  onChange={(event) => setTexto(event.target.value)}
                  rows={5}
                  placeholder="Descreva o aviso para os moradores."
                  required
                />
              </label>

              <div className="finance-form-grid">
                <label>
                  Prioridade
                  <select
                    value={prioridade}
                    onChange={(event) =>
                      setPrioridade(event.target.value as ComunicadoPrioridade)
                    }
                  >
                    {PRIORIDADE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Escopo
                  <select
                    value={escopo}
                    onChange={(event) => setEscopo(event.target.value as ComunicadoEscopo)}
                  >
                    {ESCOPO_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {escopo === "unidade" && (
                <label>
                  Unidade
                  <select
                    value={unidadeId}
                    onChange={(event) => setUnidadeId(event.target.value)}
                    required
                  >
                    <option value="">Selecione</option>
                    {unidades.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.tipo} {item.codigoInterno}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button type="submit" disabled={loading}>
                {loading ? "Publicando..." : "Publicar comunicado"}
              </button>
            </form>
          </section>
        )}

        <section className="finance-table-card">
          <div className="finance-table-header">
            <div>
              <h3>Comunicados cadastrados</h3>
              <p>{comunicadosFiltrados.length} item(ns) exibidos.</p>
            </div>
          </div>

          <div className="config-filters">
            <input
              value={filtroTexto}
              onChange={(event) => setFiltroTexto(event.target.value)}
              placeholder="Buscar por titulo ou mensagem"
            />
            <select
              value={filtroStatus}
              onChange={(event) =>
                setFiltroStatus(event.target.value as "todos" | ComunicadoStatus)
              }
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={filtroPrioridade}
              onChange={(event) =>
                setFiltroPrioridade(event.target.value as "todas" | ComunicadoPrioridade)
              }
            >
              <option value="todas">Todas prioridades</option>
              {PRIORIDADE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="finance-table-scroll finance-table-scroll--wide">
            <table className="table">
              <thead>
                <tr>
                  <th>Titulo</th>
                  <th>Escopo</th>
                  <th>Prioridade</th>
                  <th>Criado em</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {comunicadosFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.titulo}</strong>
                      <div className="comunicados-message">{item.mensagem}</div>
                    </td>
                    <td>
                      {item.escopo === "geral"
                        ? "Geral"
                        : unidadeMap[item.unidadeId ?? ""] ?? "Unidade"}
                    </td>
                    <td>
                      <span className={`comunicados-priority comunicados-priority--${item.prioridade}`}>
                        {item.prioridade}
                      </span>
                    </td>
                    <td>{formatarDataHoraBr(item.criadoEm)}</td>
                    <td>
                      <span className={`comunicados-status comunicados-status--${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="finance-table-actions">
                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            className="action-secondary"
                            onClick={() => alternarStatus(item)}
                          >
                            {item.status === "ativo" ? "Arquivar" : "Reativar"}
                          </button>
                          <button
                            type="button"
                            className="action-danger"
                            onClick={() => remover(item.id)}
                          >
                            Remover
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {comunicadosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center" }}>
                      Nenhum comunicado encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {erro && <p className="error">{erro}</p>}
      {mensagem && <p className="success">{mensagem}</p>}
    </div>
  );
}
