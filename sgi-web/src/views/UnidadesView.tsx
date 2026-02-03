import React, { useEffect, useState } from "react";
import { api, Organizacao, UnidadeOrganizacional } from "../api";
import { useAuth } from "../hooks/useAuth";

type UnidadesViewProps = {
  organizacao: Organizacao;
};

export default function UnidadesView({ organizacao }: UnidadesViewProps) {
  const { token } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const [tipo, setTipo] = useState("Apartamento");
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
      setErro("Nome da unidade é obrigatório.");
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

  const unidadeSelecionada =
    unidadeSelecionadaId != null
      ? unidades.find((u) => u.id === unidadeSelecionadaId) ?? null
      : null;

  return (
    <div className="people-page">
      <div className="people-header-row">
        <div>
          <h2>Unidades</h2>
        </div>
        <div className="people-header-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setNome("");
              setCodigoInterno("");
              setTipo("Apartamento");
              setFormAberto(true);
            }}
          >
            + Nova unidade
          </button>
        </div>
      </div>

      <div className={"people-layout" + (formAberto ? "" : " people-layout--single")}>
        {formAberto && (
          <section className="people-form-card">
            <h3>Nova unidade</h3>

            <form onSubmit={salvarUnidade} className="form">
              <div className="people-form-grid">
                <label>
                  Tipo
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
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
        )}

        <section className="people-list-card">
          <div className="people-list-header">
            <h3>Unidades cadastradas</h3>
          </div>

          {editandoId && (
            <div className="inline-edit-card">
              <div className="inline-edit-header">
                <strong>Editar unidade</strong>
              </div>
              <div className="people-form-grid">
                <label>
                  Nome
                  <input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                  />
                </label>
                <label>
                  Código interno
                  <input
                    value={editCodigoInterno}
                    onChange={(e) => setEditCodigoInterno(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Tipo
                <select
                  value={editTipo}
                  onChange={(e) => setEditTipo(e.target.value)}
                >
                  <option value="Bloco">Bloco</option>
                  <option value="Apartamento">Apartamento</option>
                  <option value="Casa">Casa</option>
                  <option value="Sala">Sala</option>
                  <option value="Outro">Outro</option>
                </select>
              </label>
              <div className="inline-edit-actions">
                <button
                  type="button"
                  onClick={() => void salvarEdicao()}
                  disabled={salvandoEdicao}
                >
                  {salvandoEdicao ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={cancelarEdicao}
                  disabled={salvandoEdicao}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {unidades.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {unidades.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setUnidadeSelecionadaId(u.id)}
                    style={{
                      cursor: "pointer",
                      backgroundColor:
                        unidadeSelecionadaId === u.id ? "#eff6ff" : "transparent"
                    }}
                  >
                    <td>{u.tipo}</td>
                    <td>{u.codigoInterno}</td>
                    <td>{u.nome}</td>
                    <td>{u.status}</td>
                    <td>
                      <button
                        type="button"
                        className="table-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          iniciarEdicao(u);
                        }}
                      >
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

