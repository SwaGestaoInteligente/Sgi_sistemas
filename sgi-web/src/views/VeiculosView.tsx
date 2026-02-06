import { useEffect, useMemo, useState } from "react";
import { api, Organizacao, Pessoa, UnidadeOrganizacional, Veiculo } from "../api";
import { useAuth } from "../hooks/useAuth";

type VeiculosViewProps = {
  organizacao: Organizacao;
  readOnly?: boolean;
};

const statusOpcoes = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" }
];

export default function VeiculosView({ organizacao, readOnly }: VeiculosViewProps) {
  const { token } = useAuth();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroPessoa, setFiltroPessoa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const [placa, setPlaca] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("");
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
      const [listaVeiculos, listaPessoas, listaUnidades] = await Promise.all([
        api.listarVeiculos(token, organizacao.id, {
          unidadeId: filtroUnidade || undefined,
          pessoaId: filtroPessoa || undefined,
          status: filtroStatus || undefined
        }),
        api.listarPessoas(token, organizacao.id),
        api.listarUnidades(token, organizacao.id)
      ]);
      setVeiculos(listaVeiculos);
      setPessoas(listaPessoas);
      setUnidades(listaUnidades);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar veiculos");
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
    if (!placa.trim() || !marca.trim() || !modelo.trim()) {
      setErro("Preencha placa, marca e modelo.");
      return;
    }
    try {
      setErro(null);
      setLoading(true);
      const criado = await api.criarVeiculo(token, {
        organizacaoId: organizacao.id,
        unidadeOrganizacionalId: unidadeId || null,
        pessoaId: pessoaId || null,
        placa: placa.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
        cor: cor.trim(),
        status
      });
      setVeiculos((prev) => [criado, ...prev]);
      setPlaca("");
      setMarca("");
      setModelo("");
      setCor("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar veiculo");
    } finally {
      setLoading(false);
    }
  };

  const editar = async (item: Veiculo) => {
    if (!token) return;
    const novaPlaca = window.prompt("Placa:", item.placa) ?? item.placa;
    const novaMarca = window.prompt("Marca:", item.marca) ?? item.marca;
    const novoModelo = window.prompt("Modelo:", item.modelo) ?? item.modelo;
    const novaCor = window.prompt("Cor:", item.cor) ?? item.cor;
    const novoStatus = window.prompt("Status (ativo/inativo):", item.status) ?? item.status;

    try {
      setErro(null);
      setLoading(true);
      const atualizado = await api.atualizarVeiculo(token, item.id, {
        organizacaoId: organizacao.id,
        unidadeOrganizacionalId: item.unidadeOrganizacionalId ?? null,
        pessoaId: item.pessoaId ?? null,
        placa: novaPlaca,
        marca: novaMarca,
        modelo: novoModelo,
        cor: novaCor,
        status: novoStatus
      });
      setVeiculos((prev) => prev.map((v) => (v.id === atualizado.id ? atualizado : v)));
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar veiculo");
    } finally {
      setLoading(false);
    }
  };

  const remover = async (item: Veiculo) => {
    if (!token) return;
    if (!window.confirm(`Remover veiculo ${item.placa}?`)) return;
    try {
      setErro(null);
      setLoading(true);
      await api.removerVeiculo(token, item.id, organizacao.id);
      setVeiculos((prev) => prev.filter((v) => v.id !== item.id));
    } catch (e: any) {
      setErro(e.message || "Erro ao remover veiculo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finance-layout">
      <section className="finance-form-card">
        <div className="finance-table-header">
          <div>
            <h3>Veiculos</h3>
            <p className="finance-form-sub">Cadastro e controle de veiculos por unidade.</p>
          </div>
          <button type="button" onClick={() => void carregar()} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {!readOnly && (
          <form onSubmit={criar} className="form">
            <div className="finance-form-grid">
              <label>
                Placa
                <input value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC1D23" />
              </label>
              <label>
                Marca
                <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Toyota" />
              </label>
              <label>
                Modelo
                <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Corolla" />
              </label>
              <label>
                Cor
                <input value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Prata" />
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
              {loading ? "Salvando..." : "Salvar veiculo"}
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
              <th>Placa</th>
              <th>Modelo</th>
              <th>Cor</th>
              <th>Unidade</th>
              <th>Responsavel</th>
              <th>Status</th>
              {!readOnly && <th>Acoes</th>}
            </tr>
          </thead>
          <tbody>
            {veiculos.map((v) => (
              <tr key={v.id}>
                <td>{v.placa}</td>
                <td>
                  {v.marca} {v.modelo}
                </td>
                <td>{v.cor}</td>
                <td>{v.unidadeOrganizacionalId ? unidadesPorId[v.unidadeOrganizacionalId]?.codigoInterno : "-"}</td>
                <td>{v.pessoaId ? pessoasPorId[v.pessoaId]?.nome : "-"}</td>
                <td>{v.status}</td>
                {!readOnly && (
                  <td>
                    <div className="finance-table-actions">
                      <button type="button" className="action-primary" onClick={() => editar(v)}>
                        Editar
                      </button>
                      <button type="button" className="action-danger" onClick={() => remover(v)}>
                        Remover
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {veiculos.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 6 : 7} style={{ textAlign: "center" }}>
                  Nenhum veiculo encontrado.
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
