import { useEffect, useMemo, useState } from "react";
import { api, Organizacao, Pessoa, Pet, UnidadeOrganizacional } from "../api";
import { useAuth } from "../hooks/useAuth";

type PetsViewProps = {
  organizacao: Organizacao;
  readOnly?: boolean;
};

const statusOpcoes = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" }
];

export default function PetsView({ organizacao, readOnly }: PetsViewProps) {
  const { token } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroPessoa, setFiltroPessoa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const [nome, setNome] = useState("");
  const [especie, setEspecie] = useState("");
  const [raca, setRaca] = useState("");
  const [porte, setPorte] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const [status, setStatus] = useState("ativo");

  const unidadesPorId = useMemo(
    () =>
      unidades.reduce<Record<string, UnidadeOrganizacional>>((acc, u) => {
        acc[u.id] = u;
        return acc;
      }, {}),
    [unidades]
  );

  const pessoasPorId = useMemo(
    () =>
      pessoas.reduce<Record<string, Pessoa>>((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {}),
    [pessoas]
  );

  const carregar = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const [listaPets, listaPessoas, listaUnidades] = await Promise.all([
        api.listarPets(token, organizacao.id, {
          unidadeId: filtroUnidade || undefined,
          pessoaId: filtroPessoa || undefined,
          status: filtroStatus || undefined
        }),
        api.listarPessoas(token, organizacao.id),
        api.listarUnidades(token, organizacao.id)
      ]);
      setPets(listaPets);
      setPessoas(listaPessoas);
      setUnidades(listaUnidades);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar pets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizacao.id]);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!nome.trim() || !especie.trim() || !porte.trim()) {
      setErro("Preencha nome, especie e porte.");
      return;
    }
    try {
      setErro(null);
      setLoading(true);
      const criado = await api.criarPet(token, {
        organizacaoId: organizacao.id,
        unidadeOrganizacionalId: unidadeId || null,
        pessoaId: pessoaId || null,
        nome: nome.trim(),
        especie: especie.trim(),
        raca: raca.trim() || null,
        porte: porte.trim(),
        status
      });
      setPets((prev) => [criado, ...prev]);
      setNome("");
      setEspecie("");
      setRaca("");
      setPorte("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar pet");
    } finally {
      setLoading(false);
    }
  };

  const editar = async (item: Pet) => {
    if (!token) return;
    const novoNome = window.prompt("Nome:", item.nome) ?? item.nome;
    const novaEspecie = window.prompt("Especie:", item.especie) ?? item.especie;
    const novaRaca = window.prompt("Raca:", item.raca ?? "") ?? item.raca ?? "";
    const novoPorte = window.prompt("Porte:", item.porte) ?? item.porte;
    const novoStatus = window.prompt("Status (ativo/inativo):", item.status) ?? item.status;

    try {
      setErro(null);
      setLoading(true);
      const atualizado = await api.atualizarPet(token, item.id, {
        organizacaoId: organizacao.id,
        unidadeOrganizacionalId: item.unidadeOrganizacionalId ?? null,
        pessoaId: item.pessoaId ?? null,
        nome: novoNome,
        especie: novaEspecie,
        raca: novaRaca,
        porte: novoPorte,
        status: novoStatus
      });
      setPets((prev) => prev.map((p) => (p.id === atualizado.id ? atualizado : p)));
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar pet");
    } finally {
      setLoading(false);
    }
  };

  const remover = async (item: Pet) => {
    if (!token) return;
    if (!window.confirm(`Remover pet ${item.nome}?`)) return;
    try {
      setErro(null);
      setLoading(true);
      await api.removerPet(token, item.id, organizacao.id);
      setPets((prev) => prev.filter((p) => p.id !== item.id));
    } catch (e: any) {
      setErro(e.message || "Erro ao remover pet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finance-layout">
      <section className="finance-form-card">
        <div className="finance-table-header">
          <div>
            <h3>Pets</h3>
            <p className="finance-form-sub">Cadastro de animais vinculados ao condominio.</p>
          </div>
          <button type="button" onClick={() => void carregar()} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {!readOnly && (
          <form onSubmit={criar} className="form">
            <div className="finance-form-grid">
              <label>
                Nome
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Thor" />
              </label>
              <label>
                Especie
                <input value={especie} onChange={(e) => setEspecie(e.target.value)} placeholder="Cachorro" />
              </label>
              <label>
                Raca
                <input value={raca} onChange={(e) => setRaca(e.target.value)} placeholder="Labrador" />
              </label>
              <label>
                Porte
                <input value={porte} onChange={(e) => setPorte(e.target.value)} placeholder="Medio" />
              </label>
              <label>
                Unidade
                <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
                  <option value="">Sem unidade</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.codigoInterno} - {u.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Pessoa
                <select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
                  <option value="">Sem pessoa</option>
                  {pessoas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {statusOpcoes.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar pet"}
            </button>
            {erro && <p className="error">{erro}</p>}
          </form>
        )}
      </section>

      <section className="finance-table-card">
        <div className="config-filters">
          <label>
            <span>Unidade</span>
            <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}>
              <option value="">Todas</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.codigoInterno}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Pessoa</span>
            <select value={filtroPessoa} onChange={(e) => setFiltroPessoa(e.target.value)}>
              <option value="">Todas</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              {statusOpcoes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void carregar()}>
            Filtrar
          </button>
        </div>

        <table className="table finance-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Especie</th>
              <th>Raca</th>
              <th>Porte</th>
              <th>Unidade</th>
              <th>Responsavel</th>
              <th>Status</th>
              {!readOnly && <th>Acoes</th>}
            </tr>
          </thead>
          <tbody>
            {pets.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.especie}</td>
                <td>{p.raca ?? "-"}</td>
                <td>{p.porte}</td>
                <td>{p.unidadeOrganizacionalId ? unidadesPorId[p.unidadeOrganizacionalId]?.codigoInterno : "-"}</td>
                <td>{p.pessoaId ? pessoasPorId[p.pessoaId]?.nome : "-"}</td>
                <td>{p.status}</td>
                {!readOnly && (
                  <td>
                    <div className="finance-table-actions">
                      <button type="button" className="action-primary" onClick={() => editar(p)}>
                        Editar
                      </button>
                      <button type="button" className="action-danger" onClick={() => remover(p)}>
                        Remover
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {pets.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 7 : 8} style={{ textAlign: "center" }}>
                  Nenhum pet encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {erro && <p className="error">{erro}</p>}
      </section>
    </div>
  );
}
