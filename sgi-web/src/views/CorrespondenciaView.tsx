import { useEffect, useMemo, useRef, useState } from "react";
import { api, Organizacao, Pessoa, UnidadeOrganizacional } from "../api";
import { useAuth } from "../hooks/useAuth";

type CorrespondenciaViewProps = {
  organizacao: Organizacao;
  readOnly?: boolean;
};

type CorrespondenciaTipo = "carta" | "encomenda" | "documento" | "aviso";

type CorrespondenciaStatus = "pendente" | "entregue" | "retornado";

type CorrespondenciaItem = {
  id: string;
  tipo: CorrespondenciaTipo;
  descricao: string;
  remetente?: string | null;
  unidadeId?: string | null;
  recebidoPorId?: string | null;
  recebidoEm: string;
  retiradoPor?: string | null;
  retiradaEm?: string | null;
  status: CorrespondenciaStatus;
  observacao?: string | null;
};

type CorrespondenciaStore = {
  itens: CorrespondenciaItem[];
};

const tipoLabel: Record<CorrespondenciaTipo, string> = {
  carta: "Carta",
  encomenda: "Encomenda",
  documento: "Documento",
  aviso: "Aviso"
};

const statusLabel: Record<CorrespondenciaStatus, string> = {
  pendente: "pendente",
  entregue: "entregue",
  retornado: "retornado"
};

const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatarData = (value?: string | null) => {
  if (!value) return "-";
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR");
};

const formatarDataHora = (value?: string | null) => {
  if (!value) return "-";
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return "-";
  const dataTexto = data.toLocaleDateString("pt-BR");
  const horaTexto = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
  return `${dataTexto} ${horaTexto}`;
};

const isSameDay = (value: string | null | undefined, ref: Date) => {
  if (!value) return false;
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return false;
  return (
    data.getFullYear() === ref.getFullYear() &&
    data.getMonth() === ref.getMonth() &&
    data.getDate() === ref.getDate()
  );
};

export default function CorrespondenciaView({
  organizacao,
  readOnly
}: CorrespondenciaViewProps) {
  const { token } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [itens, setItens] = useState<CorrespondenciaItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasStorage, setHasStorage] = useState(false);
  const seededRef = useRef(false);

  const storeKey = useMemo(
    () => `correspondencia-demo-${organizacao.id}`,
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
      setErro(e?.message || "Erro ao carregar correspondencias.");
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
      const parsed = JSON.parse(raw) as Partial<CorrespondenciaStore>;
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
    const payload: CorrespondenciaStore = { itens };
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

    const now = new Date();
    const ontem = new Date(now.getTime() - 24 * 60 * 60000).toISOString();
    const tresDias = new Date(now.getTime() - 3 * 24 * 60 * 60000).toISOString();
    const unidadeA = unidades[0];
    const unidadeB = unidades[1] ?? unidadeA;
    const porteiro = pessoas[0];

    setItens([
      {
        id: crypto.randomUUID(),
        tipo: "encomenda",
        descricao: "Pedido Amazon caixa pequena",
        remetente: "Amazon",
        unidadeId: unidadeA?.id ?? null,
        recebidoPorId: porteiro?.id ?? null,
        recebidoEm: now.toISOString(),
        retiradoPor: null,
        retiradaEm: null,
        status: "pendente",
        observacao: "Fragil"
      },
      {
        id: crypto.randomUUID(),
        tipo: "carta",
        descricao: "Carta registrada",
        remetente: "Correios",
        unidadeId: unidadeB?.id ?? unidadeA?.id ?? null,
        recebidoPorId: porteiro?.id ?? null,
        recebidoEm: ontem,
        retiradoPor: "Mariana Costa",
        retiradaEm: now.toISOString(),
        status: "entregue",
        observacao: null
      },
      {
        id: crypto.randomUUID(),
        tipo: "documento",
        descricao: "Documentos bancarios",
        remetente: "Banco Terra",
        unidadeId: unidadeA?.id ?? null,
        recebidoPorId: porteiro?.id ?? null,
        recebidoEm: tresDias,
        retiradoPor: null,
        retiradaEm: null,
        status: "pendente",
        observacao: "Assinar recebimento"
      }
    ]);
  }, [hasStorage, unidades, pessoas]);

  const unidadeLabel = (unidadeId?: string | null) => {
    if (!unidadeId) return "-";
    const unidade = unidadesPorId[unidadeId];
    if (!unidade) return unidadeId;
    return `${unidade.codigoInterno} - ${unidade.nome}`;
  };

  const pessoaLabel = (pessoaId?: string | null) => {
    if (!pessoaId) return "-";
    const pessoa = pessoasPorId[pessoaId];
    return pessoa?.nome ?? pessoaId;
  };

  const hoje = useMemo(() => new Date(), []);
  const pendentes = itens.filter((item) => item.status === "pendente").length;
  const entreguesHoje = itens.filter(
    (item) => item.status === "entregue" && isSameDay(item.retiradaEm, hoje)
  ).length;
  const recebidosSemana = itens.filter((item) => {
    const data = new Date(item.recebidoEm);
    if (Number.isNaN(data.getTime())) return false;
    return data.getTime() >= hoje.getTime() - 7 * 86400000;
  }).length;
  const atrasados = itens.filter((item) => {
    if (item.status !== "pendente") return false;
    const data = new Date(item.recebidoEm);
    if (Number.isNaN(data.getTime())) return false;
    return data.getTime() < hoje.getTime() - 2 * 86400000;
  }).length;

  const [tipo, setTipo] = useState<CorrespondenciaTipo>("encomenda");
  const [descricao, setDescricao] = useState("");
  const [remetente, setRemetente] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [recebidoPorId, setRecebidoPorId] = useState("");
  const [observacao, setObservacao] = useState("");

  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todas");

  const registrarRecebimento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      setErro("Informe a descricao da correspondencia.");
      return;
    }
    setErro(null);
    const novo: CorrespondenciaItem = {
      id: crypto.randomUUID(),
      tipo,
      descricao: descricao.trim(),
      remetente: remetente.trim() || null,
      unidadeId: unidadeId || null,
      recebidoPorId: recebidoPorId || null,
      recebidoEm: new Date().toISOString(),
      retiradoPor: null,
      retiradaEm: null,
      status: "pendente",
      observacao: observacao.trim() || null
    };
    setItens((prev) => [novo, ...prev]);
    setDescricao("");
    setRemetente("");
    setObservacao("");
  };

  const registrarRetirada = (id: string) => {
    const retiradoPor = window.prompt("Retirado por:", "");
    setItens((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              retiradoPor: retiradoPor?.trim() || item.retiradoPor || null,
              retiradaEm: new Date().toISOString(),
              status: "entregue"
            }
          : item
      )
    );
  };

  const marcarRetornado = (id: string) => {
    setItens((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "retornado"
            }
          : item
      )
    );
  };

  const removerItem = (id: string) => {
    if (!window.confirm("Remover correspondencia?")) return;
    setItens((prev) => prev.filter((item) => item.id !== id));
  };

  const itensFiltrados = useMemo(() => {
    const termo = normalizeText(filtroTexto);
    return itens
      .filter((item) => {
        if (filtroStatus !== "todas" && item.status !== filtroStatus) return false;
        if (!termo) return true;
        const base = [
          item.descricao,
          item.remetente,
          unidadeLabel(item.unidadeId),
          pessoaLabel(item.recebidoPorId),
          item.retiradoPor,
          tipoLabel[item.tipo],
          statusLabel[item.status]
        ];
        return base.some((valor) => normalizeText(valor).includes(termo));
      })
      .sort((a, b) => new Date(b.recebidoEm).getTime() - new Date(a.recebidoEm).getTime());
  }, [itens, filtroTexto, filtroStatus, unidadesPorId, pessoasPorId]);

  const pendentesPorUnidade = useMemo(() => {
    const map = new Map<string, number>();
    itens
      .filter((item) => item.status === "pendente")
      .forEach((item) => {
        const key = unidadeLabel(item.unidadeId);
        map.set(key, (map.get(key) ?? 0) + 1);
      });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [itens, unidadesPorId]);

  return (
    <div className="finance-layout">
      <div className="finance-side-column">
        <section className="finance-form-card">
          <div className="finance-header-row">
            <div>
              <h3>Correspondencias</h3>
              <p className="finance-form-sub">
                Registre recebimentos e retiradas pela portaria.
              </p>
            </div>
            <button type="button" onClick={() => void carregarBase()} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          <div className="finance-summary-grid">
            <div className="finance-summary-card">
              <div className="finance-summary-label">Pendentes</div>
              <div className="finance-summary-value">{pendentes}</div>
              <div className="finance-summary-sub">Aguardando retirada</div>
            </div>
            <div className="finance-summary-card">
              <div className="finance-summary-label">Entregues hoje</div>
              <div className="finance-summary-value">{entreguesHoje}</div>
              <div className="finance-summary-sub">Baixa do dia</div>
            </div>
            <div className="finance-summary-card">
              <div className="finance-summary-label">Recebidos 7 dias</div>
              <div className="finance-summary-value">{recebidosSemana}</div>
              <div className="finance-summary-sub">Fluxo semanal</div>
            </div>
            <div className="finance-summary-card">
              <div className="finance-summary-label">Atrasadas</div>
              <div className="finance-summary-value">{atrasados}</div>
              <div className="finance-summary-sub">Mais de 2 dias</div>
            </div>
          </div>
        </section>

        <section className="finance-form-card">
          <h3>Registrar recebimento</h3>
          <p className="finance-form-sub">Lancamento rapido de correspondencias.</p>
          {!readOnly && (
            <form className="form" onSubmit={registrarRecebimento}>
              <div className="finance-form-grid">
                <label>
                  Tipo
                  <select value={tipo} onChange={(e) => setTipo(e.target.value as CorrespondenciaTipo)}>
                    <option value="encomenda">Encomenda</option>
                    <option value="carta">Carta</option>
                    <option value="documento">Documento</option>
                    <option value="aviso">Aviso</option>
                  </select>
                </label>
                <label>
                  Descricao
                  <input
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex.: Caixa pequena"
                  />
                </label>
                <label>
                  Remetente
                  <input
                    value={remetente}
                    onChange={(e) => setRemetente(e.target.value)}
                    placeholder="Ex.: Correios"
                  />
                </label>
                <label>
                  Unidade
                  <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
                    <option value="">Sem unidade</option>
                    {unidades.map((unidade) => (
                      <option key={unidade.id} value={unidade.id}>
                        {unidade.codigoInterno} - {unidade.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Recebido por
                  <select
                    value={recebidoPorId}
                    onChange={(e) => setRecebidoPorId(e.target.value)}
                  >
                    <option value="">Sem registro</option>
                    {pessoas.map((pessoa) => (
                      <option key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Observacao
                <textarea
                  rows={2}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Detalhes adicionais"
                />
              </label>
              <button type="submit">Registrar</button>
            </form>
          )}
        </section>

        <section className="finance-form-card">
          <h3>Pendentes por unidade</h3>
          <p className="finance-form-sub">Priorize as retiradas.</p>
          <div className="unit-list">
            {pendentesPorUnidade.map(([unidade, total]) => (
              <div key={unidade} className="unit-list-item">
                <span>{unidade}</span>
                <span className="unit-muted">{total}</span>
              </div>
            ))}
            {pendentesPorUnidade.length === 0 && (
              <p className="unit-muted">Nenhuma pendencia encontrada.</p>
            )}
          </div>
        </section>
      </div>

      <section className="finance-table-card">
        <div className="finance-table-header">
          <div>
            <h3>Registro geral</h3>
            <p className="finance-form-sub">Historico completo de correspondencias.</p>
          </div>
          <div className="finance-card-actions">
            <label>
              Buscar
              <input
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Descricao, unidade, remetente"
              />
            </label>
            <label>
              Status
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                <option value="todas">Todas</option>
                <option value="pendente">Pendentes</option>
                <option value="entregue">Entregues</option>
                <option value="retornado">Retornadas</option>
              </select>
            </label>
          </div>
        </div>

        {erro && <p className="error">{erro}</p>}

        <table className="table correspondencia-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descricao</th>
              <th>Remetente</th>
              <th>Unidade</th>
              <th>Recebido em</th>
              <th>Retirada</th>
              <th>Status</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {itensFiltrados.map((item) => {
              const statusClass =
                item.status === "pendente"
                  ? "badge-status--pendente"
                  : item.status === "entregue"
                    ? "badge-status--pago"
                    : "badge-status--cancelado";
              return (
                <tr key={item.id}>
                  <td>
                    <span className="badge">{tipoLabel[item.tipo]}</span>
                  </td>
                  <td>
                    <div>{item.descricao}</div>
                    {item.observacao && <span className="unit-muted">{item.observacao}</span>}
                  </td>
                  <td>{item.remetente ?? "-"}</td>
                  <td>{unidadeLabel(item.unidadeId)}</td>
                  <td>
                    <div>{formatarDataHora(item.recebidoEm)}</div>
                    <span className="unit-muted">
                      {pessoaLabel(item.recebidoPorId)}
                    </span>
                  </td>
                  <td>
                    {item.retiradaEm ? (
                      <>
                        <div>{formatarDataHora(item.retiradaEm)}</div>
                        <span className="unit-muted">
                          {item.retiradoPor ?? "Sem recebedor"}
                        </span>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <span className={`badge-status ${statusClass}`}>
                      {statusLabel[item.status]}
                    </span>
                  </td>
                  <td className="finance-actions-cell">
                    <div className="table-actions">
                      {!readOnly && item.status === "pendente" && (
                        <button
                          type="button"
                          className="action-primary"
                          onClick={() => registrarRetirada(item.id)}
                        >
                          Registrar retirada
                        </button>
                      )}
                      {!readOnly && item.status === "pendente" && (
                        <button
                          type="button"
                          className="action-secondary"
                          onClick={() => marcarRetornado(item.id)}
                        >
                          Retornar
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          type="button"
                          className="action-secondary"
                          onClick={() => removerItem(item.id)}
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
                  Nenhuma correspondencia encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
