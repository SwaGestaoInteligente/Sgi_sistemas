import React, { useEffect, useMemo, useState } from "react";
import { api, Organizacao, UnidadeOrganizacional } from "../api";
import { useAuth } from "../hooks/useAuth";

type UnidadesViewProps = {
  organizacao: Organizacao;
  readOnly?: boolean;
  titulo?: string;
  tipoInicial?: string;
  filtroTipoInicial?: string;
  tipoFixo?: boolean;
  filtroTipoFixo?: boolean;
};

export default function UnidadesView({
  organizacao,
  readOnly = false,
  titulo,
  tipoInicial,
  filtroTipoInicial,
  tipoFixo = false,
  filtroTipoFixo = false
}: UnidadesViewProps) {
  const { token } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const [tipo, setTipo] = useState(tipoInicial ?? "Apartamento");
  const [codigoInterno, setCodigoInterno] = useState("");
  const [nome, setNome] = useState("");
  const [parentId, setParentId] = useState("");
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState<string | null>(
    null
  );
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCodigoInterno, setEditCodigoInterno] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [editParentId, setEditParentId] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState(filtroTipoInicial ?? "todos");

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

  useEffect(() => {
    if (readOnly && formAberto) {
      setFormAberto(false);
    }
  }, [formAberto, readOnly]);

  useEffect(() => {
    if (tipoInicial) {
      setTipo(tipoInicial);
    }
  }, [tipoInicial]);

  useEffect(() => {
    if (filtroTipoInicial) {
      setFiltroTipo(filtroTipoInicial);
    }
  }, [filtroTipoInicial]);

  const normalizarTipo = (value?: string | null) =>
    (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const isTipo = (value: string, tipos: string[]) =>
    tipos.some((tipoItem) => normalizarTipo(value) === normalizarTipo(tipoItem));

  const parentTiposPara = (value: string) => {
    if (isTipo(value, ["apartamento", "unidade"])) {
      return ["bloco"];
    }
    if (isTipo(value, ["garagem", "vaga", "vagas"])) {
      return ["apartamento", "unidade"];
    }
    return [];
  };

  const parentOptions = useMemo(() => {
    const tipos = parentTiposPara(tipo);
    if (tipos.length === 0) return [];
    return [...unidades]
      .filter((u) => isTipo(u.tipo, tipos))
      .sort((a, b) =>
        `${a.codigoInterno} ${a.nome}`.localeCompare(
          `${b.codigoInterno} ${b.nome}`,
          "pt-BR",
          { sensitivity: "base" }
        )
      );
  }, [tipo, unidades]);

  const editParentOptions = useMemo(() => {
    const tipos = parentTiposPara(editTipo);
    if (tipos.length === 0) return [];
    return [...unidades]
      .filter((u) => isTipo(u.tipo, tipos))
      .sort((a, b) =>
        `${a.codigoInterno} ${a.nome}`.localeCompare(
          `${b.codigoInterno} ${b.nome}`,
          "pt-BR",
          { sensitivity: "base" }
        )
      );
  }, [editTipo, unidades]);

  const parentLookup = useMemo(() => {
    return new Map(unidades.map((u) => [u.id, u]));
  }, [unidades]);

  useEffect(() => {
    if (parentOptions.length === 0 && parentId) {
      setParentId("");
    }
  }, [parentId, parentOptions.length]);

  useEffect(() => {
    if (editParentOptions.length === 0 && editParentId) {
      setEditParentId("");
    }
  }, [editParentId, editParentOptions.length]);

  const salvarUnidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !organizacao) return;
    if (!nome.trim() || !codigoInterno.trim()) {
      setErro("Preencha nome e codigo interno da unidade.");
      return;
    }
    if (parentTiposPara(tipo).length > 0 && !parentId) {
      setErro("Selecione o vinculo pai da unidade.");
      return;
    }

    try {
      setErro(null);
      setLoading(true);
      const criada = await api.criarUnidade(token, {
        organizacaoId: organizacao.id,
        tipo,
        codigoInterno: codigoInterno.trim(),
        nome: nome.trim(),
        parentId: parentId || null
      });
      setUnidades((prev) => [...prev, criada]);
      setCodigoInterno("");
      setNome("");
      setParentId("");
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar unidade");
    } finally {
      setLoading(false);
    }
  };

  const iniciarEdicao = (unidade: UnidadeOrganizacional) => {
    setEditandoId(unidade.id);
    setEditNome(unidade.nome);
    setEditCodigoInterno(unidade.codigoInterno ?? "");
    setEditTipo(unidade.tipo ?? "");
    setEditParentId(unidade.parentId ?? "");
    setUnidadeSelecionadaId(unidade.id);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setEditNome("");
    setEditCodigoInterno("");
    setEditTipo("");
    setEditParentId("");
  };

  const salvarEdicao = async () => {
    if (!token || !organizacao || !editandoId) return;
    if (!editNome.trim()) {
      setErro("Nome da unidade e obrigatorio.");
      return;
    }
    if (parentTiposPara(editTipo).length > 0 && !editParentId) {
      setErro("Selecione o vinculo pai da unidade.");
      return;
    }

    try {
      setErro(null);
      setSalvandoEdicao(true);
      const atualizada = await api.atualizarUnidade(token, editandoId, {
        nome: editNome.trim(),
        codigoInterno: editCodigoInterno.trim(),
        tipo: editTipo.trim(),
        parentId: editParentId || null
      });
      setUnidades((prev) =>
        prev.map((u) => (u.id === atualizada.id ? atualizada : u))
      );
      cancelarEdicao();
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar unidade");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  if (!organizacao) {
    return null;
  }

  const unidadesFiltradas = unidades.filter((u) => {
    const termo = busca.trim().toLowerCase();
    if (termo) {
      const texto = `${u.nome} ${u.codigoInterno}`.toLowerCase();
      if (!texto.includes(termo)) return false;
    }
    if (filtroTipo !== "todos" && u.tipo !== filtroTipo) return false;
    return true;
  });

  const tituloExibido = titulo ?? "Unidades";

  return (
    <div className="people-page">
      <div className={"people-layout" + (formAberto ? "" : " people-layout--single")}>
        <section className="people-list-card">
          <div className="people-header-row">
            <div className="people-list-title">
              <h2>{tituloExibido}</h2>
              <span className="people-count">{unidadesFiltradas.length}</span>
            </div>
            <div className="people-header-actions">
              {!readOnly && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setFormAberto((prev) => !prev)}
                >
                  {formAberto ? "Ocultar formulario" : "Nova unidade"}
                </button>
              )}
            </div>
          </div>

          <div className="people-search-row">
            <input
              type="search"
              placeholder="Buscar por nome ou codigo interno"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {filtroTipoFixo ? (
              <input value={filtroTipo === "todos" ? "" : filtroTipo} disabled />
            ) : (
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="todos">Todos os tipos</option>
                {[...new Set(unidades.map((u) => u.tipo))].map((tipoItem) => (
                  <option key={tipoItem} value={tipoItem}>
                    {tipoItem}
                  </option>
                ))}
              </select>
            )}
          </div>

          {erro && <p className="error">{erro}</p>}

          {unidadesFiltradas.length > 0 ? (
            <div className="unit-table">
              <div className="unit-table-head">
                <span>Unidade</span>
                <span>Tipo</span>
                <span>Vinculo</span>
                <span>Codigo</span>
                {!readOnly && <span>Acoes</span>}
              </div>
              <div className="unit-table-body">
                {unidadesFiltradas.map((unidade) => {
                  const parent = unidade.parentId
                    ? parentLookup.get(unidade.parentId)
                    : null;
                  const parentLabel = parent
                    ? `${parent.codigoInterno} - ${parent.nome}`
                    : "Sem vinculo";
                  return (
                    <div
                      key={unidade.id}
                      className={
                        "unit-table-row" +
                        (unidadeSelecionadaId === unidade.id
                          ? " unit-table-row--active"
                          : "")
                      }
                      onClick={() => setUnidadeSelecionadaId(unidade.id)}
                    >
                      <div className="unit-table-name">
                        <span className="unit-code">{unidade.codigoInterno}</span>
                        <div>
                          <div className="unit-name">{unidade.nome}</div>
                          <div className="unit-meta">{parentLabel}</div>
                        </div>
                      </div>
                      <div className="unit-table-type">{unidade.tipo}</div>
                      <div className="unit-table-parent">{parentLabel}</div>
                      <div className="unit-table-code">{unidade.codigoInterno}</div>
                      {!readOnly && (
                        <div className="unit-table-actions">
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              iniciarEdicao(unidade);
                              setFormAberto(true);
                            }}
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            !loading && <p className="people-empty">Nenhuma unidade encontrada.</p>
          )}
        </section>

        {formAberto && !readOnly && (
          <section className="people-form-card">
            <h3>Nova unidade</h3>
            <form onSubmit={salvarUnidade} className="form">
              <label>
                Tipo
                <input
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  disabled={tipoFixo}
                />
              </label>
              {parentOptions.length > 0 && (
                <label>
                  Vinculo pai
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {parentOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.codigoInterno} - {u.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Codigo interno
                <input
                  value={codigoInterno}
                  onChange={(e) => setCodigoInterno(e.target.value)}
                />
              </label>
              <label>
                Nome
                <input value={nome} onChange={(e) => setNome(e.target.value)} />
              </label>
              <button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </form>

            {editandoId && (
              <div style={{ marginTop: 12 }}>
                <h4>Editar unidade</h4>
                <label>
                  Nome
                  <input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                  />
                </label>
                <label>
                  Codigo interno
                  <input
                    value={editCodigoInterno}
                    onChange={(e) => setEditCodigoInterno(e.target.value)}
                  />
                </label>
                <label>
                  Tipo
                  <input
                    value={editTipo}
                    onChange={(e) => setEditTipo(e.target.value)}
                  />
                </label>
                {editParentOptions.length > 0 && (
                  <label>
                    Vinculo pai
                    <select
                      value={editParentId}
                      onChange={(e) => setEditParentId(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {editParentOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.codigoInterno} - {u.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="form-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={cancelarEdicao}
                  >
                    Cancelar
                  </button>
                  <button type="button" onClick={() => void salvarEdicao()}>
                    {salvandoEdicao ? "Salvando..." : "Salvar edicao"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
