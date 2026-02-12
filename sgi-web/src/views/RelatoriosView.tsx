import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, FileSpreadsheet, FileText } from "lucide-react";
import { api, Organizacao, RecursoReservavel } from "../api";
import { useAuth } from "../hooks/useAuth";

type RelatoriosViewProps = {
  organizacao: Organizacao;
  onAbrirFinanceiroRelatorios?: () => void;
};

type ModuloRelatorio = "chamados" | "reservas" | "veiculos" | "pets";
type FormatoRelatorio = "csv" | "pdf";

type ItemHistorico = {
  id: string;
  modulo: ModuloRelatorio;
  formato: FormatoRelatorio;
  criadoEm: string;
  filtros: string;
  arquivo: string;
};

type ModuloConfig = {
  id: ModuloRelatorio;
  titulo: string;
  descricao: string;
  suportaPdf: boolean;
  usaPeriodo: boolean;
  usaStatus: boolean;
  usaRecurso: boolean;
};

const MODULOS: ModuloConfig[] = [
  {
    id: "chamados",
    titulo: "Chamados",
    descricao: "Filtro por periodo e status.",
    suportaPdf: true,
    usaPeriodo: true,
    usaStatus: true,
    usaRecurso: false
  },
  {
    id: "reservas",
    titulo: "Reservas",
    descricao: "Filtro por periodo e recurso.",
    suportaPdf: true,
    usaPeriodo: true,
    usaStatus: false,
    usaRecurso: true
  },
  {
    id: "veiculos",
    titulo: "Veiculos",
    descricao: "Exportacao completa em CSV.",
    suportaPdf: false,
    usaPeriodo: false,
    usaStatus: false,
    usaRecurso: false
  },
  {
    id: "pets",
    titulo: "Pets",
    descricao: "Exportacao completa em CSV.",
    suportaPdf: false,
    usaPeriodo: false,
    usaStatus: false,
    usaRecurso: false
  }
];

const STATUS_CHAMADO = [
  { value: "", label: "Todos" },
  { value: "ABERTO", label: "Aberto" },
  { value: "EM_ATENDIMENTO", label: "Em atendimento" },
  { value: "AGUARDANDO", label: "Aguardando" },
  { value: "RESOLVIDO", label: "Resolvido" },
  { value: "ENCERRADO", label: "Encerrado" }
];

function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 600);
}

function construirNomeArquivo(modulo: ModuloRelatorio, formato: FormatoRelatorio) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `relatorio-${modulo}-${stamp}.${formato}`;
}

export default function RelatoriosView({
  organizacao,
  onAbrirFinanceiroRelatorios
}: RelatoriosViewProps) {
  const { token } = useAuth();
  const [modulo, setModulo] = useState<ModuloRelatorio>("chamados");
  const [formato, setFormato] = useState<FormatoRelatorio>("csv");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [status, setStatus] = useState("");
  const [recursoId, setRecursoId] = useState("");
  const [recursos, setRecursos] = useState<RecursoReservavel[]>([]);
  const [loadingRecursos, setLoadingRecursos] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [historico, setHistorico] = useState<ItemHistorico[]>([]);

  const moduloAtual = useMemo(
    () => MODULOS.find((item) => item.id === modulo) ?? MODULOS[0],
    [modulo]
  );

  const formatosDisponiveis = useMemo<FormatoRelatorio[]>(
    () => (moduloAtual.suportaPdf ? ["csv", "pdf"] : ["csv"]),
    [moduloAtual.suportaPdf]
  );

  useEffect(() => {
    if (!formatosDisponiveis.includes(formato)) {
      setFormato("csv");
    }
  }, [formato, formatosDisponiveis]);

  useEffect(() => {
    if (!token) return;
    if (!moduloAtual.usaRecurso) return;
    let cancelled = false;
    const carregarRecursos = async () => {
      try {
        setLoadingRecursos(true);
        setErro(null);
        const lista = await api.listarRecursos(token, organizacao.id);
        if (!cancelled) {
          setRecursos(lista);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErro(e?.message || "Erro ao carregar recursos para relatorios.");
        }
      } finally {
        if (!cancelled) {
          setLoadingRecursos(false);
        }
      }
    };
    void carregarRecursos();
    return () => {
      cancelled = true;
    };
  }, [moduloAtual.usaRecurso, organizacao.id, token]);

  const resumoFiltros = useMemo(() => {
    const filtros: string[] = [];
    if (moduloAtual.usaPeriodo && de) filtros.push(`de ${de}`);
    if (moduloAtual.usaPeriodo && ate) filtros.push(`ate ${ate}`);
    if (moduloAtual.usaStatus && status) filtros.push(`status ${status}`);
    if (moduloAtual.usaRecurso && recursoId) {
      const recurso = recursos.find((item) => item.id === recursoId);
      if (recurso) filtros.push(`recurso ${recurso.nome}`);
    }
    return filtros.length ? filtros.join(" | ") : "Sem filtros adicionais";
  }, [
    de,
    ate,
    moduloAtual.usaPeriodo,
    moduloAtual.usaRecurso,
    moduloAtual.usaStatus,
    recursoId,
    recursos,
    status
  ]);

  const exportarRelatorio = async () => {
    if (!token) {
      setErro("Sessao expirada. Faca login novamente.");
      return;
    }

    setErro(null);
    setMensagem(null);
    setExportando(true);
    try {
      let blob: Blob;
      let formatoFinal = formato;

      if (modulo === "chamados") {
        blob = await api.relatorioChamados(token, organizacao.id, {
          de: de || undefined,
          ate: ate || undefined,
          status: status || undefined,
          formato
        });
      } else if (modulo === "reservas") {
        blob = await api.relatorioReservas(token, organizacao.id, {
          de: de || undefined,
          ate: ate || undefined,
          recursoId: recursoId || undefined,
          formato
        });
      } else if (modulo === "veiculos") {
        formatoFinal = "csv";
        blob = await api.relatorioVeiculos(token, organizacao.id, "csv");
      } else {
        formatoFinal = "csv";
        blob = await api.relatorioPets(token, organizacao.id, "csv");
      }

      const nomeArquivo = construirNomeArquivo(modulo, formatoFinal);
      baixarArquivo(blob, nomeArquivo);

      setHistorico((prev) => [
        {
          id: crypto.randomUUID(),
          modulo,
          formato: formatoFinal,
          criadoEm: new Date().toISOString(),
          filtros: resumoFiltros,
          arquivo: nomeArquivo
        },
        ...prev
      ].slice(0, 12));

      setMensagem("Relatorio gerado com sucesso.");
    } catch (e: any) {
      setErro(e?.message || "Nao foi possivel gerar o relatorio.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="relatorios-page">
      <section className="card relatorios-hero">
        <div>
          <p className="page-header-eyebrow">Relatorios estruturados</p>
          <h3 className="relatorios-title">Exportacoes por modulo</h3>
          <p className="relatorios-subtitle">
            Filtros por periodo, status e recursos para gerar CSV/PDF.
          </p>
        </div>
        {onAbrirFinanceiroRelatorios && (
          <button
            type="button"
            className="button-secondary"
            onClick={onAbrirFinanceiroRelatorios}
          >
            Abrir relatorios financeiros
          </button>
        )}
      </section>

      <div className="relatorios-module-grid">
        {MODULOS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              "relatorios-module-card" +
              (item.id === modulo ? " relatorios-module-card--active" : "")
            }
            onClick={() => setModulo(item.id)}
          >
            <span className="relatorios-module-icon">
              {item.id === "chamados" && <BarChart3 size={14} />}
              {item.id === "reservas" && <FileText size={14} />}
              {(item.id === "veiculos" || item.id === "pets") && (
                <FileSpreadsheet size={14} />
              )}
            </span>
            <strong>{item.titulo}</strong>
            <span>{item.descricao}</span>
          </button>
        ))}
      </div>

      <section className="card relatorios-filters-card">
        <div className="relatorios-filters-header">
          <div>
            <h3>{moduloAtual.titulo}</h3>
            <p className="relatorios-subtitle">{moduloAtual.descricao}</p>
          </div>
          <button type="button" onClick={() => void exportarRelatorio()} disabled={exportando}>
            <Download size={14} />
            {exportando ? "Gerando..." : "Gerar relatorio"}
          </button>
        </div>

        <div className="relatorios-filters-grid">
          <label>
            Formato
            <select value={formato} onChange={(e) => setFormato(e.target.value as FormatoRelatorio)}>
              {formatosDisponiveis.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          {moduloAtual.usaPeriodo && (
            <>
              <label>
                De
                <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
              </label>
              <label>
                Ate
                <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
              </label>
            </>
          )}

          {moduloAtual.usaStatus && (
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_CHAMADO.map((item) => (
                  <option key={item.value || "todos"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {moduloAtual.usaRecurso && (
            <label>
              Recurso
              <select
                value={recursoId}
                onChange={(e) => setRecursoId(e.target.value)}
                disabled={loadingRecursos}
              >
                <option value="">Todos</option>
                {recursos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="relatorios-filter-resume">
          <strong>Filtros aplicados:</strong> {resumoFiltros}
        </div>
      </section>

      {(erro || mensagem) && (
        <section className="card">
          {erro && <p className="error">{erro}</p>}
          {mensagem && <p className="success">{mensagem}</p>}
        </section>
      )}

      <section className="card relatorios-history-card">
        <div className="relatorios-filters-header">
          <div>
            <h3>Historico de exportacoes</h3>
            <p className="relatorios-subtitle">
              Ultimos arquivos gerados nesta sessao.
            </p>
          </div>
        </div>
        <div className="unit-table-scroll">
          <table className="table relatorios-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Modulo</th>
                <th>Formato</th>
                <th>Filtros</th>
                <th>Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.criadoEm).toLocaleString("pt-BR")}</td>
                  <td>{item.modulo}</td>
                  <td>{item.formato.toUpperCase()}</td>
                  <td>{item.filtros}</td>
                  <td>{item.arquivo}</td>
                </tr>
              ))}
              {historico.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    Nenhuma exportacao realizada nesta sessao.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
