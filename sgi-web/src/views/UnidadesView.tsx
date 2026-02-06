import React, { useEffect, useState } from "react";
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
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState<string | null>(
    null
  );
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCodigoInterno, setEditCodigoInterno] = useState("");
  const [editTipo, setEditTipo] = useState("");
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

  const salvarUnidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !organizacao) return;
    if (!nome.trim() || !codigoInterno.trim()) {
      setErro("Preencha nome e codigo interno da unidade.");
      return;
    }

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

  const iniciarEdicao = (unidade: UnidadeOrganizacional) => {
    setEditandoId(unidade.id);
    setEditNome(unidade.nome);
    setEditCodigoInterno(unidade.codigoInterno ?? "");
    setEditTipo(unidade.tipo ?? "");
    setUnidadeSelecionadaId(unidade.id);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setEditNome("");
    setEditCodigoInterno("");
    setEditTipo("");
  };

  const salvarEdicao = async () => {
    if (!token || !organizacao || !editandoId) return;
    if (!editNome.trim()) {
      setErro("Nome da unidade e obrigatorio.");
      return;
    }

    try {
      setErro(null);
      setSalvandoEdicao(true);
      const atualizada = await api.atualizarUnidade(token, editandoId, {
        nome: editNome.trim(),
        codigoInterno: editCodigoInterno.trim(),
        tipo: editTipo.trim()
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
            <div>
              <h2>{tituloExibido}</h2>
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

          <div className="person-list">
            {unidadesFiltradas.map((unidade) => (
              <button
                key={unidade.id}
                type="button"
                className={
                  "person-item person-item--compact" +
                  (unidadeSelecionadaId === unidade.id ? " person-item--active" : "")
                }
                onClick={() => setUnidadeSelecionadaId(unidade.id)}
              >
                <div className="person-header">
                  <span className="person-name">{unidade.nome}</span>
                </div>
                <div className="person-meta">
                  {unidade.tipo} • {unidade.codigoInterno}
                </div>
                {!readOnly && (
                  <div className="person-actions">
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
              </button>
            ))}
            {!loading && unidadesFiltradas.length === 0 && (
              <p className="empty">Nenhuma unidade encontrada.</p>
            )}
          </div>
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
