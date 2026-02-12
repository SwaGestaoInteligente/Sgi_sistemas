import { useEffect, useMemo, useRef, useState } from "react";
import { api, Organizacao, Pessoa, UnidadeOrganizacional } from "../api";
import { useAuth } from "../hooks/useAuth";

type PortariaViewProps = {
  organizacao: Organizacao;
  readOnly?: boolean;
};

type PortariaAcesso = {
  id: string;
  tipo: "visitante" | "prestador" | "entrega";
  nome: string;
  documento?: string | null;
  unidadeId?: string | null;
  veiculo?: string | null;
  autorizadoPorId?: string | null;
  observacao?: string | null;
  entradaEm: string;
  saidaEm?: string | null;
};

type PortariaAutorizacao = {
  id: string;
  nome: string;
  documento?: string | null;
  unidadeId?: string | null;
  validoDe?: string | null;
  validoAte?: string | null;
  observacao?: string | null;
  status?: "ativa" | "suspensa";
  criadoEm: string;
};

type PortariaEntrega = {
  id: string;
  descricao: string;
  remetente?: string | null;
  unidadeId?: string | null;
  observacao?: string | null;
  recebidoPor?: string | null;
  status: "pendente" | "entregue";
  entradaEm: string;
  entregaEm?: string | null;
};

type PortariaStore = {
  acessos: PortariaAcesso[];
  autorizacoes: PortariaAutorizacao[];
  entregas: PortariaEntrega[];
};

type PortariaTab = "acessos" | "autorizacoes" | "entregas";

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

const labelAcessoTipo: Record<PortariaAcesso["tipo"], string> = {
  visitante: "Visitante",
  prestador: "Prestador",
  entrega: "Entrega"
};

export default function PortariaView({ organizacao, readOnly }: PortariaViewProps) {
  const { token } = useAuth();
  const [aba, setAba] = useState<PortariaTab>("acessos");
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [acessos, setAcessos] = useState<PortariaAcesso[]>([]);
  const [autorizacoes, setAutorizacoes] = useState<PortariaAutorizacao[]>([]);
  const [entregas, setEntregas] = useState<PortariaEntrega[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasStorage, setHasStorage] = useState(false);
  const seededRef = useRef(false);

  const storeKey = useMemo(() => `portaria-demo-${organizacao.id}`, [organizacao.id]);

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
      setErro(e?.message || "Erro ao carregar dados da portaria.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storeKey);
    if (!raw) {
      setHasStorage(false);
      setAcessos([]);
      setAutorizacoes([]);
      setEntregas([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<PortariaStore>;
      const acessosRaw = Array.isArray(parsed.acessos) ? parsed.acessos : [];
      const autorizacoesRaw = Array.isArray(parsed.autorizacoes)
        ? parsed.autorizacoes
        : [];
      const entregasRaw = Array.isArray(parsed.entregas) ? parsed.entregas : [];
      setAcessos(acessosRaw);
      setAutorizacoes(autorizacoesRaw);
      setEntregas(entregasRaw);
      setHasStorage(
        acessosRaw.length > 0 || autorizacoesRaw.length > 0 || entregasRaw.length > 0
      );
    } catch {
      setHasStorage(false);
      setAcessos([]);
      setAutorizacoes([]);
      setEntregas([]);
    }
  }, [storeKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: PortariaStore = {
      acessos,
      autorizacoes,
      entregas
    };
    window.localStorage.setItem(storeKey, JSON.stringify(payload));
  }, [storeKey, acessos, autorizacoes, entregas]);

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
    const unidadeA = unidades[0];
    const unidadeB = unidades[1] ?? unidadeA;
    const pessoaA = pessoas[0];
    const pessoaB = pessoas[1] ?? pessoaA;
    const entradaRecente = new Date(now.getTime() - 45 * 60000).toISOString();
    const entradaHoje = new Date(now.getTime() - 2 * 60 * 60000).toISOString();
    const saidaHoje = new Date(now.getTime() - 60 * 60000).toISOString();
    const ontem = new Date(now.getTime() - 24 * 60 * 60000).toISOString();

    setAcessos([
      {
        id: crypto.randomUUID(),
        tipo: "visitante",
        nome: pessoaA?.nome ?? "Carlos Andrade",
        documento: pessoaA?.documento ?? "123.456.789-00",
        unidadeId: unidadeA?.id ?? null,
        veiculo: "ABC-1234",
        autorizadoPorId: pessoaB?.id ?? null,
        observacao: "Visita agendada",
        entradaEm: entradaRecente,
        saidaEm: null
      },
      {
        id: crypto.randomUUID(),
        tipo: "prestador",
        nome: "Equipe Jardins & Cia",
        documento: "12.345.678/0001-90",
        unidadeId: unidadeB?.id ?? unidadeA?.id ?? null,
        veiculo: "DEF-9078",
        autorizadoPorId: pessoaA?.id ?? null,
        observacao: "Manutencao preventiva",
        entradaEm: entradaHoje,
        saidaEm: saidaHoje
      }
    ]);

    setAutorizacoes([
      {
        id: crypto.randomUUID(),
        nome: "Nair Souza",
        documento: "098.765.432-10",
        unidadeId: unidadeA?.id ?? null,
        validoDe: ontem.slice(0, 10),
        validoAte: entradaHoje.slice(0, 10),
        observacao: "Faxina semanal",
        status: "ativa",
        criadoEm: now.toISOString()
      }
    ]);

    setEntregas([
      {
        id: crypto.randomUUID(),
        descricao: "Encomenda Mercado Livre",
        remetente: "ML Logistica",
        unidadeId: unidadeA?.id ?? null,
        observacao: "Caixa pequena",
        recebidoPor: null,
        status: "pendente",
        entradaEm: entradaRecente
      },
      {
        id: crypto.randomUUID(),
        descricao: "Documentos bancarios",
        remetente: "Banco Terra",
        unidadeId: unidadeB?.id ?? unidadeA?.id ?? null,
        observacao: "Envelope lacrado",
        recebidoPor: pessoaA?.nome ?? "Luciana Costa",
        status: "entregue",
        entradaEm: ontem,
        entregaEm: entradaHoje
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

  const getAutorizacaoStatus = (item: PortariaAutorizacao) => {
    if (item.status === "suspensa") return "suspensa";
    if (item.validoAte) {
      const fim = new Date(`${item.validoAte}T23:59:59`);
      if (fim.getTime() < Date.now()) return "expirada";
    }
    return "ativa";
  };

  const hoje = useMemo(() => new Date(), []);
  const acessosAtivos = acessos.filter((item) => !item.saidaEm).length;
  const entradasHoje = acessos.filter((item) => isSameDay(item.entradaEm, hoje)).length;
  const saidasHoje = acessos.filter((item) => isSameDay(item.saidaEm ?? null, hoje)).length;
  const entregasPendentes = entregas.filter((item) => item.status === "pendente").length;
  const autorizacoesAtivas = autorizacoes.filter(
    (item) => getAutorizacaoStatus(item) === "ativa"
  ).length;

  const [acessoTipo, setAcessoTipo] = useState<PortariaAcesso["tipo"]>("visitante");
  const [acessoNome, setAcessoNome] = useState("");
  const [acessoDocumento, setAcessoDocumento] = useState("");
  const [acessoUnidadeId, setAcessoUnidadeId] = useState("");
  const [acessoVeiculo, setAcessoVeiculo] = useState("");
  const [acessoAutorizadoPorId, setAcessoAutorizadoPorId] = useState("");
  const [acessoObservacao, setAcessoObservacao] = useState("");

  const [autorizacaoNome, setAutorizacaoNome] = useState("");
  const [autorizacaoDocumento, setAutorizacaoDocumento] = useState("");
  const [autorizacaoUnidadeId, setAutorizacaoUnidadeId] = useState("");
  const [autorizacaoInicio, setAutorizacaoInicio] = useState("");
  const [autorizacaoFim, setAutorizacaoFim] = useState("");
  const [autorizacaoObservacao, setAutorizacaoObservacao] = useState("");

  const [entregaDescricao, setEntregaDescricao] = useState("");
  const [entregaRemetente, setEntregaRemetente] = useState("");
  const [entregaUnidadeId, setEntregaUnidadeId] = useState("");
  const [entregaObservacao, setEntregaObservacao] = useState("");

  const [filtroAcesso, setFiltroAcesso] = useState("");
  const [filtroAcessoStatus, setFiltroAcessoStatus] = useState("todos");
  const [filtroAutorizacao, setFiltroAutorizacao] = useState("");
  const [filtroAutorizacaoStatus, setFiltroAutorizacaoStatus] = useState("todas");
  const [filtroEntrega, setFiltroEntrega] = useState("");
  const [filtroEntregaStatus, setFiltroEntregaStatus] = useState("todas");

  const registrarEntrada = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acessoNome.trim()) {
      setErro("Preencha o nome do visitante/prestador.");
      return;
    }
    setErro(null);
    const novo: PortariaAcesso = {
      id: crypto.randomUUID(),
      tipo: acessoTipo,
      nome: acessoNome.trim(),
      documento: acessoDocumento.trim() || null,
      unidadeId: acessoUnidadeId || null,
      veiculo: acessoVeiculo.trim() || null,
      autorizadoPorId: acessoAutorizadoPorId || null,
      observacao: acessoObservacao.trim() || null,
      entradaEm: new Date().toISOString(),
      saidaEm: null
    };
    setAcessos((prev) => [novo, ...prev]);
    setAcessoNome("");
    setAcessoDocumento("");
    setAcessoVeiculo("");
    setAcessoObservacao("");
  };

  const registrarSaida = (id: string) => {
    setAcessos((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, saidaEm: new Date().toISOString() } : item
      )
    );
  };

  const removerAcesso = (id: string) => {
    if (!window.confirm("Remover registro de acesso?")) return;
    setAcessos((prev) => prev.filter((item) => item.id !== id));
  };

  const criarAutorizacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!autorizacaoNome.trim()) {
      setErro("Preencha o nome da autorizacao.");
      return;
    }
    setErro(null);
    const novo: PortariaAutorizacao = {
      id: crypto.randomUUID(),
      nome: autorizacaoNome.trim(),
      documento: autorizacaoDocumento.trim() || null,
      unidadeId: autorizacaoUnidadeId || null,
      validoDe: autorizacaoInicio || null,
      validoAte: autorizacaoFim || null,
      observacao: autorizacaoObservacao.trim() || null,
      status: "ativa",
      criadoEm: new Date().toISOString()
    };
    setAutorizacoes((prev) => [novo, ...prev]);
    setAutorizacaoNome("");
    setAutorizacaoDocumento("");
    setAutorizacaoInicio("");
    setAutorizacaoFim("");
    setAutorizacaoObservacao("");
  };

  const alternarAutorizacao = (id: string) => {
    setAutorizacoes((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const novoStatus = item.status === "suspensa" ? "ativa" : "suspensa";
        return { ...item, status: novoStatus };
      })
    );
  };

  const removerAutorizacao = (id: string) => {
    if (!window.confirm("Remover autorizacao?")) return;
    setAutorizacoes((prev) => prev.filter((item) => item.id !== id));
  };

  const criarEntrega = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entregaDescricao.trim()) {
      setErro("Descreva a entrega.");
      return;
    }
    setErro(null);
    const novo: PortariaEntrega = {
      id: crypto.randomUUID(),
      descricao: entregaDescricao.trim(),
      remetente: entregaRemetente.trim() || null,
      unidadeId: entregaUnidadeId || null,
      observacao: entregaObservacao.trim() || null,
      recebidoPor: null,
      status: "pendente",
      entradaEm: new Date().toISOString(),
      entregaEm: null
    };
    setEntregas((prev) => [novo, ...prev]);
    setEntregaDescricao("");
    setEntregaRemetente("");
    setEntregaObservacao("");
  };

  const registrarEntrega = (id: string) => {
    const recebido = window.prompt("Recebido por:", "");
    setEntregas((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              recebidoPor: recebido?.trim() || item.recebidoPor || null,
              entregaEm: new Date().toISOString(),
              status: "entregue"
            }
          : item
      )
    );
  };

  const removerEntrega = (id: string) => {
    if (!window.confirm("Remover entrega?")) return;
    setEntregas((prev) => prev.filter((item) => item.id !== id));
  };

  const acessosFiltrados = useMemo(() => {
    const termo = normalizeText(filtroAcesso);
    return acessos
      .filter((item) => {
        if (filtroAcessoStatus === "ativos" && item.saidaEm) return false;
        if (filtroAcessoStatus === "encerrados" && !item.saidaEm) return false;
        if (!termo) return true;
        const base = [
          item.nome,
          item.documento,
          item.observacao,
          unidadeLabel(item.unidadeId),
          pessoaLabel(item.autorizadoPorId),
          labelAcessoTipo[item.tipo]
        ];
        return base.some((valor) => normalizeText(valor).includes(termo));
      })
      .sort((a, b) => {
        const aAtivo = !a.saidaEm;
        const bAtivo = !b.saidaEm;
        if (aAtivo !== bAtivo) return aAtivo ? -1 : 1;
        return new Date(b.entradaEm).getTime() - new Date(a.entradaEm).getTime();
      });
  }, [acessos, filtroAcesso, filtroAcessoStatus, unidadesPorId, pessoasPorId]);

  const autorizacoesFiltradas = useMemo(() => {
    const termo = normalizeText(filtroAutorizacao);
    return autorizacoes
      .filter((item) => {
        const status = getAutorizacaoStatus(item);
        if (filtroAutorizacaoStatus === "ativas" && status !== "ativa") return false;
        if (filtroAutorizacaoStatus === "suspensas" && status !== "suspensa")
          return false;
        if (filtroAutorizacaoStatus === "expiradas" && status !== "expirada")
          return false;
        if (!termo) return true;
        const base = [
          item.nome,
          item.documento,
          item.observacao,
          unidadeLabel(item.unidadeId),
          status
        ];
        return base.some((valor) => normalizeText(valor).includes(termo));
      })
      .sort((a, b) => {
        const aData = a.validoAte ?? a.validoDe ?? a.criadoEm;
        const bData = b.validoAte ?? b.validoDe ?? b.criadoEm;
        return new Date(bData).getTime() - new Date(aData).getTime();
      });
  }, [autorizacoes, filtroAutorizacao, filtroAutorizacaoStatus, unidadesPorId]);

  const entregasFiltradas = useMemo(() => {
    const termo = normalizeText(filtroEntrega);
    return entregas
      .filter((item) => {
        if (filtroEntregaStatus === "pendentes" && item.status !== "pendente")
          return false;
        if (filtroEntregaStatus === "entregues" && item.status !== "entregue")
          return false;
        if (!termo) return true;
        const base = [
          item.descricao,
          item.remetente,
          item.observacao,
          item.recebidoPor,
          unidadeLabel(item.unidadeId)
        ];
        return base.some((valor) => normalizeText(valor).includes(termo));
      })
      .sort((a, b) => new Date(b.entradaEm).getTime() - new Date(a.entradaEm).getTime());
  }, [entregas, filtroEntrega, filtroEntregaStatus, unidadesPorId]);

  const abaButton = (id: PortariaTab, label: string) => (
    <button
      type="button"
      className={`finance-tab${aba === id ? " finance-tab--active" : ""}`}
      onClick={() => setAba(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="finance-layout finance-layout--single">
      <section className="finance-form-card">
        <div className="finance-header-row">
          <div>
            <h2>Portaria central</h2>
            <p>Controle de acessos, autorizacoes e entregas do condominio.</p>
          </div>
          <div className="finance-header-badges">
            <span>Base: {organizacao.nome}</span>
            <span>Turno: Diario</span>
          </div>
        </div>
        <div className="finance-summary-grid">
          <div className="finance-summary-card">
            <div className="finance-summary-label">Acessos ativos</div>
            <div className="finance-summary-value">{acessosAtivos}</div>
            <div className="finance-summary-sub">Em circulacao</div>
          </div>
          <div className="finance-summary-card">
            <div className="finance-summary-label">Entradas hoje</div>
            <div className="finance-summary-value">{entradasHoje}</div>
            <div className="finance-summary-sub">Registro do dia</div>
          </div>
          <div className="finance-summary-card">
            <div className="finance-summary-label">Entregas pendentes</div>
            <div className="finance-summary-value">{entregasPendentes}</div>
            <div className="finance-summary-sub">Aguardando retirada</div>
          </div>
          <div className="finance-summary-card">
            <div className="finance-summary-label">Autorizacoes ativas</div>
            <div className="finance-summary-value">{autorizacoesAtivas}</div>
            <div className="finance-summary-sub">Liberacoes vigentes</div>
          </div>
        </div>
      </section>

      <section className="finance-form-card">
        <div className="finance-tabs">
          {abaButton("acessos", "Acessos")}
          {abaButton("autorizacoes", "Autorizacoes")}
          {abaButton("entregas", "Entregas")}
        </div>
        {readOnly && (
          <p className="unit-muted" style={{ marginTop: 8 }}>
            Acesso somente leitura. Solicite permissao para operar a portaria.
          </p>
        )}
      </section>

      {erro && <p className="error">{erro}</p>}

      {aba === "acessos" && (
        <div className="finance-layout">
          <div className="finance-side-column">
            <section className="finance-form-card">
              <h3>Registrar entrada</h3>
              <p className="finance-form-sub">Cadastre visitantes e prestadores.</p>
              {!readOnly && (
                <form className="form" onSubmit={registrarEntrada}>
                  <div className="finance-form-grid">
                    <label>
                      Tipo
                      <select
                        value={acessoTipo}
                        onChange={(e) =>
                          setAcessoTipo(e.target.value as PortariaAcesso["tipo"])
                        }
                      >
                        <option value="visitante">Visitante</option>
                        <option value="prestador">Prestador</option>
                        <option value="entrega">Entrega</option>
                      </select>
                    </label>
                    <label>
                      Nome
                      <input
                        value={acessoNome}
                        onChange={(e) => setAcessoNome(e.target.value)}
                        placeholder="Nome completo"
                      />
                    </label>
                    <label>
                      Documento
                      <input
                        value={acessoDocumento}
                        onChange={(e) => setAcessoDocumento(e.target.value)}
                        placeholder="CPF / RG"
                      />
                    </label>
                    <label>
                      Unidade
                      <select
                        value={acessoUnidadeId}
                        onChange={(e) => setAcessoUnidadeId(e.target.value)}
                      >
                        <option value="">Sem unidade</option>
                        {unidades.map((unidade) => (
                          <option key={unidade.id} value={unidade.id}>
                            {unidade.codigoInterno} - {unidade.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Veiculo
                      <input
                        value={acessoVeiculo}
                        onChange={(e) => setAcessoVeiculo(e.target.value)}
                        placeholder="Placa ou modelo"
                      />
                    </label>
                    <label>
                      Autorizado por
                      <select
                        value={acessoAutorizadoPorId}
                        onChange={(e) => setAcessoAutorizadoPorId(e.target.value)}
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
                      value={acessoObservacao}
                      onChange={(e) => setAcessoObservacao(e.target.value)}
                      placeholder="Detalhes da visita"
                    />
                  </label>
                  <button type="submit">Registrar entrada</button>
                </form>
              )}
            </section>
            <section className="finance-form-card">
              <h3>Saidas hoje</h3>
              <p className="finance-form-sub">Total encerrado hoje: {saidasHoje}</p>
              <div className="unit-list">
                {acessos
                  .filter((item) => item.saidaEm && isSameDay(item.saidaEm, hoje))
                  .slice(0, 6)
                  .map((item) => (
                    <div key={item.id} className="unit-list-item">
                      <span>{item.nome}</span>
                      <span className="unit-muted">{formatarDataHora(item.saidaEm)}</span>
                    </div>
                  ))}
                {saidasHoje === 0 && <p className="unit-muted">Nenhuma saida registrada.</p>}
              </div>
            </section>
          </div>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Acessos registrados</h3>
                <p className="finance-form-sub">Controle de entradas e saidas.</p>
              </div>
              <div className="finance-card-actions">
                <label>
                  Buscar
                  <input
                    value={filtroAcesso}
                    onChange={(e) => setFiltroAcesso(e.target.value)}
                    placeholder="Nome, unidade, documento"
                  />
                </label>
                <label>
                  Status
                  <select
                    value={filtroAcessoStatus}
                    onChange={(e) => setFiltroAcessoStatus(e.target.value)}
                  >
                    <option value="todos">Todos</option>
                    <option value="ativos">Ativos</option>
                    <option value="encerrados">Encerrados</option>
                  </select>
                </label>
                <button type="button" onClick={() => void carregarBase()} disabled={loading}>
                  {loading ? "Atualizando..." : "Atualizar"}
                </button>
              </div>
            </div>
            <div className="finance-table-scroll finance-table-scroll--wide">
              <table className="table portaria-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Nome</th>
                  <th>Documento</th>
                  <th>Unidade</th>
                  <th>Entrada</th>
                  <th>Saida</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {acessosFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="badge">{labelAcessoTipo[item.tipo]}</span>
                    </td>
                    <td>{item.nome}</td>
                    <td>{item.documento ?? "-"}</td>
                    <td>{unidadeLabel(item.unidadeId)}</td>
                    <td>{formatarDataHora(item.entradaEm)}</td>
                    <td>{formatarDataHora(item.saidaEm ?? null)}</td>
                    <td>
                      <span
                        className={`badge-status ${
                          item.saidaEm ? "badge-status--fechado" : "badge-status--ativo"
                        }`}
                      >
                        {item.saidaEm ? "encerrado" : "ativo"}
                      </span>
                    </td>
                    <td className="finance-actions-cell">
                      <div className="table-actions">
                        {!readOnly && !item.saidaEm && (
                          <button
                            type="button"
                            className="action-primary"
                            onClick={() => registrarSaida(item.id)}
                          >
                            Registrar saida
                          </button>
                        )}
                        {!readOnly && (
                          <button
                            type="button"
                            className="action-secondary"
                            onClick={() => removerAcesso(item.id)}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {acessosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center" }}>
                      Nenhum acesso encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {aba === "autorizacoes" && (
        <div className="finance-layout">
          <div className="finance-side-column">
            <section className="finance-form-card">
              <h3>Nova autorizacao</h3>
              <p className="finance-form-sub">Cadastre visitantes recorrentes.</p>
              {!readOnly && (
                <form className="form" onSubmit={criarAutorizacao}>
                  <div className="finance-form-grid">
                    <label>
                      Nome
                      <input
                        value={autorizacaoNome}
                        onChange={(e) => setAutorizacaoNome(e.target.value)}
                        placeholder="Nome do autorizado"
                      />
                    </label>
                    <label>
                      Documento
                      <input
                        value={autorizacaoDocumento}
                        onChange={(e) => setAutorizacaoDocumento(e.target.value)}
                        placeholder="CPF / RG"
                      />
                    </label>
                    <label>
                      Unidade
                      <select
                        value={autorizacaoUnidadeId}
                        onChange={(e) => setAutorizacaoUnidadeId(e.target.value)}
                      >
                        <option value="">Sem unidade</option>
                        {unidades.map((unidade) => (
                          <option key={unidade.id} value={unidade.id}>
                            {unidade.codigoInterno} - {unidade.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Validade inicio
                      <input
                        type="date"
                        value={autorizacaoInicio}
                        onChange={(e) => setAutorizacaoInicio(e.target.value)}
                      />
                    </label>
                    <label>
                      Validade fim
                      <input
                        type="date"
                        value={autorizacaoFim}
                        onChange={(e) => setAutorizacaoFim(e.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    Observacao
                    <textarea
                      rows={2}
                      value={autorizacaoObservacao}
                      onChange={(e) => setAutorizacaoObservacao(e.target.value)}
                      placeholder="Dados adicionais"
                    />
                  </label>
                  <button type="submit">Salvar autorizacao</button>
                </form>
              )}
            </section>
          </div>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Autorizacoes vigentes</h3>
                <p className="finance-form-sub">Controle de acessos liberados.</p>
              </div>
              <div className="finance-card-actions">
                <label>
                  Buscar
                  <input
                    value={filtroAutorizacao}
                    onChange={(e) => setFiltroAutorizacao(e.target.value)}
                    placeholder="Nome, unidade, documento"
                  />
                </label>
                <label>
                  Status
                  <select
                    value={filtroAutorizacaoStatus}
                    onChange={(e) => setFiltroAutorizacaoStatus(e.target.value)}
                  >
                    <option value="todas">Todas</option>
                    <option value="ativas">Ativas</option>
                    <option value="suspensas">Suspensas</option>
                    <option value="expiradas">Expiradas</option>
                  </select>
                </label>
                <button type="button" onClick={() => void carregarBase()} disabled={loading}>
                  {loading ? "Atualizando..." : "Atualizar"}
                </button>
              </div>
            </div>
            <div className="finance-table-scroll finance-table-scroll--wide">
              <table className="table portaria-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Documento</th>
                  <th>Unidade</th>
                  <th>Validade</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {autorizacoesFiltradas.map((item) => {
                  const status = getAutorizacaoStatus(item);
                  const badgeClass =
                    status === "ativa"
                      ? "badge-status--ativo"
                      : status === "suspensa"
                        ? "badge-status--inativo"
                        : "badge-status--alerta";
                  const validade = `${formatarData(item.validoDe)} - ${formatarData(
                    item.validoAte
                  )}`;
                  return (
                    <tr key={item.id}>
                      <td>{item.nome}</td>
                      <td>{item.documento ?? "-"}</td>
                      <td>{unidadeLabel(item.unidadeId)}</td>
                      <td>{validade}</td>
                      <td>
                        <span className={`badge-status ${badgeClass}`}>{status}</span>
                      </td>
                      <td className="finance-actions-cell">
                        <div className="table-actions">
                          {!readOnly && (
                            <button
                              type="button"
                              className="action-primary"
                              onClick={() => alternarAutorizacao(item.id)}
                            >
                              {item.status === "suspensa" ? "Ativar" : "Suspender"}
                            </button>
                          )}
                          {!readOnly && (
                            <button
                              type="button"
                              className="action-secondary"
                              onClick={() => removerAutorizacao(item.id)}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {autorizacoesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center" }}>
                      Nenhuma autorizacao encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {aba === "entregas" && (
        <div className="finance-layout">
          <div className="finance-side-column">
            <section className="finance-form-card">
              <h3>Registrar entrega</h3>
              <p className="finance-form-sub">Controle de correspondencias e encomendas.</p>
              {!readOnly && (
                <form className="form" onSubmit={criarEntrega}>
                  <div className="finance-form-grid">
                    <label>
                      Descricao
                      <input
                        value={entregaDescricao}
                        onChange={(e) => setEntregaDescricao(e.target.value)}
                        placeholder="Encomenda / documento"
                      />
                    </label>
                    <label>
                      Remetente
                      <input
                        value={entregaRemetente}
                        onChange={(e) => setEntregaRemetente(e.target.value)}
                        placeholder="Fornecedor"
                      />
                    </label>
                    <label>
                      Unidade
                      <select
                        value={entregaUnidadeId}
                        onChange={(e) => setEntregaUnidadeId(e.target.value)}
                      >
                        <option value="">Sem unidade</option>
                        {unidades.map((unidade) => (
                          <option key={unidade.id} value={unidade.id}>
                            {unidade.codigoInterno} - {unidade.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Observacao
                    <textarea
                      rows={2}
                      value={entregaObservacao}
                      onChange={(e) => setEntregaObservacao(e.target.value)}
                      placeholder="Detalhes adicionais"
                    />
                  </label>
                  <button type="submit">Registrar entrada</button>
                </form>
              )}
            </section>
          </div>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Entregas registradas</h3>
                <p className="finance-form-sub">Status das correspondencias.</p>
              </div>
              <div className="finance-card-actions">
                <label>
                  Buscar
                  <input
                    value={filtroEntrega}
                    onChange={(e) => setFiltroEntrega(e.target.value)}
                    placeholder="Descricao, unidade, remetente"
                  />
                </label>
                <label>
                  Status
                  <select
                    value={filtroEntregaStatus}
                    onChange={(e) => setFiltroEntregaStatus(e.target.value)}
                  >
                    <option value="todas">Todas</option>
                    <option value="pendentes">Pendentes</option>
                    <option value="entregues">Entregues</option>
                  </select>
                </label>
                <button type="button" onClick={() => void carregarBase()} disabled={loading}>
                  {loading ? "Atualizando..." : "Atualizar"}
                </button>
              </div>
            </div>
            <div className="finance-table-scroll finance-table-scroll--wide">
              <table className="table portaria-table">
              <thead>
                <tr>
                  <th>Descricao</th>
                  <th>Remetente</th>
                  <th>Unidade</th>
                  <th>Entrada</th>
                  <th>Entrega</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {entregasFiltradas.map((item) => (
                  <tr key={item.id}>
                    <td>{item.descricao}</td>
                    <td>{item.remetente ?? "-"}</td>
                    <td>{unidadeLabel(item.unidadeId)}</td>
                    <td>{formatarDataHora(item.entradaEm)}</td>
                    <td>
                      {item.entregaEm ? (
                        <>
                          <div>{formatarDataHora(item.entregaEm)}</div>
                          <span className="unit-muted">
                            {item.recebidoPor ?? "Sem recebedor"}
                          </span>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge-status ${
                          item.status === "pendente"
                            ? "badge-status--pendente"
                            : "badge-status--pago"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="finance-actions-cell">
                      <div className="table-actions">
                        {!readOnly && item.status === "pendente" && (
                          <button
                            type="button"
                            className="action-primary"
                            onClick={() => registrarEntrega(item.id)}
                          >
                            Registrar entrega
                          </button>
                        )}
                        {!readOnly && (
                          <button
                            type="button"
                            className="action-secondary"
                            onClick={() => removerEntrega(item.id)}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {entregasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center" }}>
                      Nenhuma entrega registrada.
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
