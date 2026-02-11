import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { can, getActiveMembership, PermissionKey } from "../authz";
import {
  api,
  Anexo,
  Chamado,
  ChamadoHistorico,
  ContaFinanceira,
  CreditoUnidadeResponse,
  LancamentoFinanceiro,
  Membership,
  NotificacaoEvento,
  Organizacao,
  Pessoa,
  Pet,
  Reserva,
  RecursoReservavel,
  UnidadeCobranca,
  UnidadePagamento,
  Veiculo
} from "../api";
import { LoginPage } from "./LoginPage";
import PessoasView from "../views/PessoasView";
import FornecedoresView from "../views/FornecedoresView";
import UnidadesView from "../views/UnidadesView";
import VeiculosView from "../views/VeiculosView";
import PetsView from "../views/PetsView";
import ConfiguracoesView, {
  ConfiguracoesTab,
  menuConfiguracoes
} from "../views/ConfiguracoesView";
import FinanceiroView, {
  FinanceiroTab,
  menuFinanceiro
} from "../views/FinanceiroView";
import AnexosPanel from "../components/AnexosPanel";

const IGNORAR_PERFIS = true;

type AppView =
  | "dashboard"
  | "pessoas"
  | "unidades"
  | "financeiro"
  | "configuracoes"
  | "funcionarios"
  | "fornecedores"
  | "veiculos"
  | "pets"
  | "chamados"
  | "reservas"
  | "portaria"
  | "correspondencia"
  | "comunicados"
  | "documentos"
  | "relatorios"
  | "minhaUnidade";

type Segmento = {
  id: string;
  label: string;
  icon: string;
};

const segmentos: Segmento[] = [
  {
    id: "condominios",
    label: "Condominios",
    icon: "\u{1F3E2}"
  },
  {
    id: "empresas",
    label: "Empresas",
    icon: "\u{1F4BC}"
  },
  {
    id: "igrejas",
    label: "Igrejas",
    icon: "\u{26EA}"
  },
  {
    id: "sitios",
    label: "Sitios / Pousadas",
    icon: "\u{1F3E1}"
  },
  {
    id: "associacoes",
    label: "Associacoes / ONGs",
    icon: "\u{1F91D}"
  },
  {
    id: "outros",
    label: "Outros",
    icon: "\u{2728}"
  }
];

const modulosPorSegmento: Record<string, string> = {
  condominios: "core,financeiro,manutencao,reservas",
  empresas: "core,financeiro,manutencao",
  igrejas: "core,financeiro,igreja,reservas",
  sitios: "core,financeiro,manutencao,reservas,hospedagem",
  associacoes: "core,financeiro,reservas",
  outros: "core,financeiro"
};

const viewMeta: Record<AppView, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Resumo geral",
    subtitle: "Indicadores consolidados da operacao."
  },
  pessoas: {
    title: "Pessoas",
    subtitle: "Cadastro e manutencao de moradores e contatos."
  },
  unidades: {
    title: "Unidades",
    subtitle: "Organizacao das unidades e dados principais."
  },
  financeiro: {
    title: "Financeiro",
    subtitle: "Contas, lancamentos, transferencias e relatorios."
  },
  configuracoes: {
    title: "Configuracoes",
    subtitle: "Estrutura, cadastros e parametros do sistema."
  },
  funcionarios: {
    title: "Funcionarios",
    subtitle: "Gestao de equipe interna."
  },
  fornecedores: {
    title: "Fornecedores",
    subtitle: "Base de parceiros e prestadores de servico."
  },
  veiculos: {
    title: "Veiculos",
    subtitle: "Cadastro e controle de veiculos."
  },
  pets: {
    title: "Pets",
    subtitle: "Cadastro de animais e registros."
  },
  chamados: {
    title: "Chamados",
    subtitle: "Solicitacoes, atendimento e acompanhamento."
  },
  reservas: {
    title: "Reservas",
    subtitle: "Controle de reservas e uso de recursos."
  },
  portaria: {
    title: "Portaria",
    subtitle: "Visitantes, prestadores, ocorrencias e turnos."
  },
  correspondencia: {
    title: "Correspondencia",
    subtitle: "Recebidas, entregues e pendentes."
  },
  comunicados: {
    title: "Comunicados",
    subtitle: "Avisos gerais e por bloco/unidade."
  },
  documentos: {
    title: "Documentos",
    subtitle: "Atas, regimento, contratos e uploads."
  },
  relatorios: {
    title: "Relatorios",
    subtitle: "Financeiros, operacionais e contabeis."
  },
  minhaUnidade: {
    title: "Minha unidade",
    subtitle: "Informacoes e dados da sua unidade."
  }
};

const comingSoonViews = new Set<AppView>([
  "portaria",
  "correspondencia",
  "comunicados",
  "documentos",
  "relatorios"
]);

const financeiroSiglas: Record<FinanceiroTab, string> = {
  mapaFinanceiro: "MF",
  contabilidade: "CTB",
  categorias: "CA",
  contas: "CT",
  consumos: "CS",
  receitasDespesas: "RD",
  contasPagar: "CP",
  contasReceber: "CR",
  previsaoOrcamentaria: "PO",
  transferencias: "TR",
  abonos: "AB",
  baixasManuais: "BM",
  gruposRateio: "GR",
  itensCobrados: "CB",
  faturas: "FT",
  inadimplentes: "IN",
  conciliacaoBancaria: "CC",
  livroPrestacaoContas: "LP",
  relatorios: "RL"
};

const configuracoesSiglas: Record<ConfiguracoesTab, string> = {
  "cadastros-base": "CB",
  "estrutura-condominio": "EC",
  "pessoas-papeis": "PP",
  "financeiro-base": "FC"
};

const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const ComingSoonView: React.FC = () => (
  <div className="card">
    <h2>Em construcao</h2>
    <p>Estamos preparando este modulo. Em breve voce podera usar este fluxo no MVP.</p>
  </div>
);


const Dashboard: React.FC<{
  organizacao: Organizacao | null;
  mostrarFinanceiro?: boolean;
}> = ({ organizacao, mostrarFinanceiro = true }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [chamados, setChamados] = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<NotificacaoEvento[]>([]);

  const carregar = async () => {
    if (!token || !organizacao) return;
    try {
      setErro(null);
      setLoading(true);
      const promises: Promise<any>[] = [];
      if (mostrarFinanceiro) {
        promises.push(api.listarContas(token, organizacao.id));
        promises.push(api.listarNotificacoesEventos(token, organizacao.id, 5));
      } else {
        promises.push(Promise.resolve([]));
        promises.push(Promise.resolve([]));
      }
      promises.push(api.listarChamados(token, organizacao.id));
      promises.push(api.listarReservas(token, organizacao.id));

      const [contasRes, alertasRes, chamadosRes, reservasRes] =
        await Promise.allSettled(promises);

      if (contasRes.status === "fulfilled") {
        setContas(contasRes.value);
      } else {
        throw contasRes.reason;
      }

      if (alertasRes.status === "fulfilled") {
        setAlertas(alertasRes.value);
      } else {
        setAlertas([]);
      }

      if (chamadosRes.status === "fulfilled") {
        setChamados(chamadosRes.value);
      } else {
        setChamados([]);
      }

      if (reservasRes.status === "fulfilled") {
        setReservas(reservasRes.value);
      } else {
        setReservas([]);
      }
    } catch (e: any) {
      const msg = e?.message || "Erro ao carregar dados do dashboard";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, [token, organizacao?.id]);

  const saldoInicialTotal = contas.reduce(
    (sum, conta) => sum + (conta.saldoInicial ?? 0),
    0
  );
  const contasAtivas = contas.filter(
    (conta) => (conta.status ?? "").toLowerCase() === "ativo"
  ).length;
  const normalizeStatus = (value?: string | null) => normalizeText(value);
  const isChamadoFechado = (value?: string | null) => {
    const status = normalizeStatus(value);
    return (
      status.includes("fech") ||
      status.includes("conclu") ||
      status.includes("resol") ||
      status.includes("encerra")
    );
  };
  const chamadosAbertos = chamados.filter((chamado) => !isChamadoFechado(chamado.status))
    .length;
  const reservasPendentes = reservas.filter((reserva) => {
    const status = normalizeStatus(reserva.status);
    if (!status) return false;
    return (
      status.includes("pend") ||
      status.includes("aguard") ||
      status.includes("solicit")
    );
  }).length;
  const alertasNaoLidos = alertas.filter((alerta) => !alerta.lidoEm).length;

  const buildSerieSemanal = <T,>(
    items: T[],
    getDate: (item: T) => string | undefined | null
  ) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 6);
    const counts = Array.from({ length: 7 }, () => 0);

    items.forEach((item) => {
      const raw = getDate(item);
      if (!raw) return;
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return;
      parsed.setHours(0, 0, 0, 0);
      const diff = Math.floor((parsed.getTime() - inicio.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) {
        counts[diff] += 1;
      }
    });

    return counts;
  };

  const serieChamados = buildSerieSemanal(chamados, (item) => item.dataAbertura);
  const serieReservas = buildSerieSemanal(
    reservas,
    (item) => item.dataSolicitacao ?? item.dataInicio
  );
  const serieAlertas = buildSerieSemanal(alertas, (item) => item.criadoEm);
  const serieMax = Math.max(
    1,
    ...serieChamados,
    ...serieReservas,
    ...serieAlertas
  );
  const chartLabels = ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "Hoje"];

  return (
    <div className="dashboard">
      <div className="dashboard-header-row">
        <p className="dashboard-caption">
          Painel executivo com os principais indicadores da operacao.
        </p>
        <button
          type="button"
          onClick={carregar}
          disabled={loading}
          className="dashboard-refresh"
        >
          {loading ? "Atualizando..." : "Atualizar dados"}
        </button>
      </div>

      <div className="dashboard-panels">
        <div className="dashboard-panel dashboard-chart-card">
          <div className="dashboard-panel-header">
            <div>
              <h3>Atividade semanal</h3>
              <p>Chamados, reservas e alertas nos ultimos 7 dias.</p>
            </div>
            <div className="dashboard-chart-legend">
              <span className="legend-item legend-item--chamados">Chamados</span>
              <span className="legend-item legend-item--reservas">Reservas</span>
              <span className="legend-item legend-item--alertas">Alertas</span>
            </div>
          </div>
          <div className="dashboard-chart-bars">
            {chartLabels.map((label, index) => {
              const chamadosValue = serieChamados[index] ?? 0;
              const reservasValue = serieReservas[index] ?? 0;
              const alertasValue = serieAlertas[index] ?? 0;
              const scale = 90;
              const heightFor = (value: number) => {
                if (!value) return 6;
                return Math.max(12, Math.round((value / serieMax) * scale));
              };
              return (
                <div key={label} className="dashboard-chart-day">
                  <div className="dashboard-chart-group">
                    <span
                      className="dashboard-chart-bar dashboard-chart-bar--chamados"
                      style={{ height: `${heightFor(chamadosValue)}px` }}
                      title={`Chamados: ${chamadosValue}`}
                    />
                    <span
                      className="dashboard-chart-bar dashboard-chart-bar--reservas"
                      style={{ height: `${heightFor(reservasValue)}px` }}
                      title={`Reservas: ${reservasValue}`}
                    />
                    <span
                      className="dashboard-chart-bar dashboard-chart-bar--alertas"
                      style={{ height: `${heightFor(alertasValue)}px` }}
                      title={`Alertas: ${alertasValue}`}
                    />
                  </div>
                  <span className="dashboard-chart-label">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dashboard-panel dashboard-insights-card">
          <h3>Prioridades da semana</h3>
          <ul className="dashboard-insights">
            <li>
              <span className="insight-label">Chamados abertos</span>
              <strong>{chamadosAbertos}</strong>
            </li>
            <li>
              <span className="insight-label">Reservas pendentes</span>
              <strong>{reservasPendentes}</strong>
            </li>
            <li>
              <span className="insight-label">Alertas nao lidos</span>
              <strong>{alertasNaoLidos}</strong>
            </li>
            <li>
              <span className="insight-label">Contas ativas</span>
              <strong>{contasAtivas}</strong>
            </li>
          </ul>
          <p className="dashboard-insights-note">
            Organize a fila com base nas pendencias acima.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card dashboard-card--primary">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">$</span>
            <span>Saldo inicial total</span>
          </div>
          <div className="dashboard-card-value">
            {mostrarFinanceiro ? `R$ ${saldoInicialTotal.toFixed(2)}` : "Sem acesso"}
          </div>
          <div className="dashboard-card-sub">
            Base consolidada das contas financeiras.
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">CF</span>
            <span>Contas financeiras ativas</span>
          </div>
          <div className="dashboard-card-value">{contasAtivas}</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">CH</span>
            <span>Chamados registrados</span>
          </div>
          <div className="dashboard-card-value">{chamados.length}</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">RS</span>
            <span>Reservas de areas comuns</span>
          </div>
          <div className="dashboard-card-value">{reservas.length}</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">AL</span>
            <span>Alertas recentes</span>
          </div>
          <div className="dashboard-card-value">{alertas.length}</div>
          <div className="dashboard-card-sub">
            {alertas[0]?.titulo ?? "Sem alertas no momento."}
          </div>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="dashboard-alerts">
          <h4>Alertas</h4>
          <ul>
            {alertas.map((alerta) => (
              <li key={alerta.id}>
                <strong>{alerta.titulo}</strong>
                <span>{alerta.mensagem}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {erro && (
        <p className="error" style={{ marginTop: 8 }}>
          {erro}
        </p>
      )}
    </div>
  );
};

const NoAccessPage: React.FC<{ mensagem?: string; onSair?: () => void }> = ({
  mensagem,
  onSair
}) => (
  <div className="container" style={{ maxWidth: 720 }}>
    <div className="org-form-card">
      <h2>Sem acesso</h2>
      <p>{mensagem ?? "Sem vinculo ativo com condominio. Contate a administracao."}</p>
      {onSair && (
        <button type="button" className="primary-button" onClick={onSair}>
          Sair
        </button>
      )}
    </div>
  </div>
);

const MinhaUnidadeView: React.FC<{
  organizacao: Organizacao;
  unidadeId?: string | null;
}> = ({ organizacao, unidadeId }) => {
  const { token } = useAuth();
  const [unidade, setUnidade] = useState<any | null>(null);
  const [moradores, setMoradores] = useState<Pessoa[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [cobrancas, setCobrancas] = useState<UnidadeCobranca[]>([]);
  const [creditoUnidade, setCreditoUnidade] = useState<CreditoUnidadeResponse | null>(
    null
  );
  const [anexosCobrancas, setAnexosCobrancas] = useState<
    Record<string, Anexo[]>
  >({});
  const [competenciaFiltro, setCompetenciaFiltro] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const carregar = async () => {
      if (!token || !unidadeId) return;
      try {
        setLoading(true);
        const [
          listaUnidades,
          listaPessoas,
          listaVeiculos,
          listaPets,
          listaCobrancas,
          listaAnexos,
          creditos
        ] = await Promise.all([
          api.listarUnidades(token, organizacao.id),
          api.listarPessoas(token, organizacao.id),
          api.listarVeiculos(token, organizacao.id, { unidadeId }),
          api.listarPets(token, organizacao.id, { unidadeId }),
          api.listarCobrancasUnidade(
            token,
            unidadeId,
            competenciaFiltro || undefined
          ),
          api.listarAnexos(token, organizacao.id, "cobranca_unidade"),
          api.listarCreditosUnidade(token, unidadeId)
        ]);

        setUnidade(listaUnidades.find((u) => u.id === unidadeId) ?? null);

        const moradoresUnidade = listaPessoas.filter(
          (p) => p.unidadeOrganizacionalId === unidadeId && p.papel === "morador"
        );
        setMoradores(moradoresUnidade);
        setVeiculos(listaVeiculos);
        setPets(listaPets);
        setCobrancas(listaCobrancas);
        setCreditoUnidade(creditos);

        const anexosPorCobranca: Record<string, Anexo[]> = {};
        listaAnexos.forEach((anexo) => {
          if (!anexosPorCobranca[anexo.entidadeId]) {
            anexosPorCobranca[anexo.entidadeId] = [];
          }
          anexosPorCobranca[anexo.entidadeId].push(anexo);
        });
        setAnexosCobrancas(anexosPorCobranca);
      } catch (e: any) {
        setErro(e.message || "Erro ao carregar unidade");
      } finally {
        setLoading(false);
      }
    };
    void carregar();
  }, [token, organizacao.id, unidadeId, competenciaFiltro]);

  if (!unidadeId) {
    return <p className="error">Unidade nao vinculada.</p>;
  }

  if (erro) {
    return <p className="error">{erro}</p>;
  }

  if (!unidade) {
    return <p>{loading ? "Carregando unidade..." : "Unidade nao encontrada."}</p>;
  }

  const pendentes = cobrancas.filter(
    (c) => (c.status ?? "").toUpperCase() !== "PAGA"
  );
  const ultimasCobrancas = cobrancas
    .slice()
    .sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? ""))
    .slice(-5)
    .reverse();
  const competencias = Array.from(
    new Set(cobrancas.map((c) => c.competencia))
  ).sort((a, b) => b.localeCompare(a));

  return (
    <div className="finance-layout">
      <section className="finance-table-card">
        <h3>{unidade.nome}</h3>
        <div className="finance-card-grid" style={{ marginTop: 12 }}>
          <div className="finance-card">
            <div className="finance-card-header-row">
              <strong>Tipo</strong>
            </div>
            <p>{unidade.tipo}</p>
          </div>
          <div className="finance-card">
            <div className="finance-card-header-row">
              <strong>Codigo</strong>
            </div>
            <p>{unidade.codigoInterno}</p>
          </div>
          <div className="finance-card">
            <div className="finance-card-header-row">
              <strong>Status</strong>
            </div>
            <p>{unidade.status}</p>
          </div>
          <div className="finance-card">
            <div className="finance-card-header-row">
              <strong>Credito disponivel</strong>
            </div>
            <p>
              {(creditoUnidade?.saldo ?? 0).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL"
              })}
            </p>
          </div>
        </div>
      </section>

      <section className="finance-table-card">
        <div className="finance-table-header">
          <h3>Moradores vinculados</h3>
        </div>
        <div className="people-list-card">
          {moradores.map((m) => (
            <div key={m.id} className="people-item">
              <span className="people-name">{m.nome}</span>
              <span className="people-meta">{m.telefone ?? "-"}</span>
            </div>
          ))}
          {moradores.length === 0 && <p className="empty">Nenhum morador vinculado.</p>}
        </div>
      </section>

      <section className="finance-table-card">
        <div className="finance-table-header">
          <h3>Veiculos</h3>
        </div>
        <table className="table finance-table table--fixed table--chamados">
          <thead>
            <tr>
              <th>Placa</th>
              <th>Modelo</th>
              <th>Cor</th>
              <th>Status</th>
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
                <td>{v.status}</td>
              </tr>
            ))}
            {veiculos.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center" }}>
                  Nenhum veiculo cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="finance-table-card">
        <div className="finance-table-header">
          <h3>Pets</h3>
        </div>
        <table className="table finance-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Especie</th>
              <th>Porte</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pets.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.especie}</td>
                <td>{p.porte}</td>
                <td>{p.status}</td>
              </tr>
            ))}
            {pets.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center" }}>
                  Nenhum pet cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="finance-table-card">
        <div className="finance-table-header">
          <div>
            <h3>Cobrancas e pendencias</h3>
            <p className="finance-form-sub">
              {pendentes.length} cobranca(s) pendente(s).
            </p>
          </div>
          <div className="finance-form-inline">
            <label>
              Competencia
              <select
                value={competenciaFiltro}
                onChange={(e) => setCompetenciaFiltro(e.target.value)}
              >
                <option value="">Todas</option>
                {competencias.map((comp) => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <table className="table finance-table">
          <thead>
            <tr>
              <th>Descricao</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th className="finance-value-header">Valor</th>
              <th className="finance-value-header">Atualizado</th>
              <th>Comprovante</th>
            </tr>
          </thead>
          <tbody>
            {ultimasCobrancas.map((c) => {
              const anexos = anexosCobrancas[c.id] ?? [];
              const valorAtualizado = c.valorAtualizado ?? c.valor;
              return (
                <tr key={c.id}>
                  <td>{c.descricao}</td>
                  <td>{c.vencimento?.slice(0, 10) ?? "-"}</td>
                  <td>{c.status}</td>
                  <td className="finance-value-cell">
                    {c.valor.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL"
                    })}
                  </td>
                  <td className="finance-value-cell">
                    {valorAtualizado.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL"
                    })}
                  </td>
                  <td>
                    {anexos.length > 0 ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={async () => {
                          const blob = await api.baixarAnexo(token!, anexos[0].id);
                          const url = URL.createObjectURL(blob);
                          window.open(url, "_blank");
                        }}
                      >
                        Baixar
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
            {ultimasCobrancas.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
                  Nenhuma cobranca encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

const ChamadosView: React.FC<{
  organizacao: Organizacao;
  pessoaId: string;
  unidadeId?: string | null;
}> = ({ organizacao, pessoaId, unidadeId }) => {
  const { token, session } = useAuth();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [historico, setHistorico] = useState<ChamadoHistorico[]>([]);
  const [selecionado, setSelecionado] = useState<Chamado | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [prioridade, setPrioridade] = useState("MEDIA");
  const [responsavelPessoaId, setResponsavelPessoaId] = useState("");
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const canCriar = IGNORAR_PERFIS || can(session, organizacao.id, "operacao.create");
  const canGerenciar =
    IGNORAR_PERFIS || can(session, organizacao.id, "operacao.manage");
  const canAnexos = IGNORAR_PERFIS || can(session, organizacao.id, "anexos.write");

  const pessoasResponsaveis = pessoas.filter((p) =>
    ["funcionario", "colaborador", "administrador"].includes(p.papel ?? "")
  );

  const carregar = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [listaChamados, listaPessoas] = await Promise.all([
        api.listarChamados(token, organizacao.id),
        api.listarPessoas(token, organizacao.id)
      ]);
      setChamados(listaChamados);
      setPessoas(listaPessoas);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar chamados");
    } finally {
      setLoading(false);
    }
  };

  const carregarHistorico = async (chamadoId: string) => {
    if (!token) return;
    try {
      const lista = await api.listarHistoricoChamado(token, chamadoId);
      setHistorico(lista);
    } catch {
      setHistorico([]);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizacao.id]);

  useEffect(() => {
    if (!selecionado) return;
    setResponsavelPessoaId(selecionado.responsavelPessoaId ?? "");
    void carregarHistorico(selecionado.id);
  }, [selecionado]);

  const adicionarComentario = async () => {
    if (!token || !selecionado || !comentario.trim()) return;
    try {
      setLoading(true);
      await api.adicionarComentarioChamado(token, selecionado.id, comentario);
      setComentario("");
      await carregarHistorico(selecionado.id);
    } catch (e: any) {
      setErro(e.message || "Erro ao adicionar comentario");
    } finally {
      setLoading(false);
    }
  };


  const criarChamado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const criado = await api.criarChamado(token, {
        id: crypto.randomUUID(),
        organizacaoId: organizacao.id,
        unidadeOrganizacionalId: unidadeId ?? null,
        pessoaSolicitanteId: pessoaId,
        categoria,
        titulo,
        descricao,
        status: "ABERTO",
        prioridade
      });
      setChamados((prev) => [criado, ...prev]);
      setTitulo("");
      setDescricao("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar chamado");
    } finally {
      setLoading(false);
    }
  };

  const atualizarChamado = async (payload: {
    status?: string;
    prioridade?: string;
    responsavelPessoaId?: string | null;
  }) => {
    if (!token || !selecionado) return;
    try {
      setErro(null);
      setLoading(true);
      const atualizado = await api.atualizarChamado(token, selecionado.id, {
        ...payload,
        observacao: "Atualizacao via painel"
      });
      setChamados((prev) =>
        prev.map((c) => (c.id === atualizado.id ? atualizado : c))
      );
      setSelecionado(atualizado);
      await carregarHistorico(atualizado.id);
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar chamado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finance-layout">
      <section className="finance-form-card">
        <h3>Novo chamado</h3>
        {canCriar ? (
          <form onSubmit={criarChamado} className="form">
          <label>
            Categoria
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          </label>
          <label>
            Titulo
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>
          <label>
            Descricao
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </label>
          <label>
            Prioridade
            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </select>
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Enviando..." : "Criar chamado"}
          </button>
          </form>
        ) : (
          <p className="finance-form-sub">Sem acesso para criar chamados.</p>
        )}
        {erro && <p className="error">{erro}</p>}
      </section>

      <section className="finance-table-card">
        <div className="finance-table-header">
          <h3>Chamados</h3>
          <button type="button" onClick={carregar} disabled={loading}>
            Atualizar
          </button>
        </div>
        <table className="table finance-table">
          <thead>
            <tr>
              <th>Titulo</th>
              <th>Status</th>
              <th>Prioridade</th>
            </tr>
          </thead>
          <tbody>
            {chamados.map((c) => (
              <tr
                key={c.id}
                style={{ cursor: "pointer" }}
                onClick={() => setSelecionado(c)}
              >
                <td>{c.titulo}</td>
                <td>{c.status}</td>
                <td>{c.prioridade ?? "-"}</td>
              </tr>
            ))}
            {chamados.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center" }}>
                  Nenhum chamado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="finance-form-card">
        <div className="finance-table-header">
          <h3>Detalhes</h3>
        </div>
        {!selecionado && <p className="finance-form-sub">Selecione um chamado.</p>}
        {selecionado && (
          <>
            <div className="finance-card-grid" style={{ marginTop: 8 }}>
              <div className="finance-card">
                <strong>Status atual</strong>
                <p>{selecionado.status}</p>
              </div>
              <div className="finance-card">
                <strong>Prioridade</strong>
                <p>{selecionado.prioridade ?? "-"}</p>
              </div>
              <div className="finance-card">
                <strong>SLA</strong>
                <p>
                  {selecionado.dataPrazoSla
                    ? new Date(selecionado.dataPrazoSla).toLocaleString("pt-BR")
                    : "-"}
                </p>
                {selecionado.dataPrazoSla &&
                  !["RESOLVIDO", "ENCERRADO"].includes(selecionado.status) &&
                  new Date(selecionado.dataPrazoSla) < new Date() && (
                    <span className="badge-status badge-status--alerta">
                      Atrasado
                    </span>
                  )}
              </div>
            </div>

            {canGerenciar && (
              <div className="form" style={{ marginTop: 12 }}>
                <label>
                  Status
                  <select
                    value={selecionado.status}
                    onChange={(e) => atualizarChamado({ status: e.target.value })}
                  >
                    <option value="ABERTO">Aberto</option>
                    <option value="EM_ATENDIMENTO">Em atendimento</option>
                    <option value="AGUARDANDO">Aguardando</option>
                    <option value="RESOLVIDO">Resolvido</option>
                    <option value="ENCERRADO">Encerrado</option>
                  </select>
                </label>
                <label>
                  Responsavel
                  <select
                    value={responsavelPessoaId}
                    onChange={(e) => {
                      const novo = e.target.value;
                      setResponsavelPessoaId(novo);
                      void atualizarChamado({ responsavelPessoaId: novo || null });
                    }}
                  >
                    <option value="">Sem responsavel</option>
                    {pessoasResponsaveis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <h4>Timeline</h4>
              {historico.length === 0 && (
                <p className="finance-form-sub">Sem historico registrado.</p>
              )}
              <ul className="list">
                {historico.map((h) => (
                  <li key={h.id}>
                    <strong>{new Date(h.dataHora).toLocaleString("pt-BR")}</strong>
                    <span> - {h.acao}</span>
                    {h.detalhes && <span> ({h.detalhes})</span>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="finance-form-card" style={{ marginTop: 16 }}>
              <h4>Comentarios</h4>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Escreva uma atualizacao..."
              />
              <button
                type="button"
                className="button-secondary"
                onClick={adicionarComentario}
                disabled={loading}
              >
                Adicionar comentario
              </button>
            </div>

            <div className="finance-form-card" style={{ marginTop: 16 }}>
              <AnexosPanel
                organizacaoId={organizacao.id}
                tipoEntidade="chamado"
                entidadeId={selecionado.id}
                titulo="Anexos do chamado"
                readOnly={!canAnexos}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
};

const ReservasView: React.FC<{
  organizacao: Organizacao;
  pessoaId: string;
  unidadeId?: string | null;
}> = ({ organizacao, pessoaId, unidadeId }) => {
  const { token, session } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [recursos, setRecursos] = useState<RecursoReservavel[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [status, setStatus] = useState("PENDENTE");
  const [recursoId, setRecursoId] = useState("");
  const [novoRecursoNome, setNovoRecursoNome] = useState("");
  const [novoRecursoCapacidade, setNovoRecursoCapacidade] = useState("");
  const [novoRecursoLimite, setNovoRecursoLimite] = useState("");
  const [novoRecursoExigeAprovacao, setNovoRecursoExigeAprovacao] =
    useState(false);
  const [novoRecursoJanelaInicio, setNovoRecursoJanelaInicio] = useState("08:00");
  const [novoRecursoJanelaFim, setNovoRecursoJanelaFim] = useState("22:00");
  const [novoRecursoBloqueios, setNovoRecursoBloqueios] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reservaSelecionada, setReservaSelecionada] = useState<Reserva | null>(
    null
  );

  const canCriar = IGNORAR_PERFIS || can(session, organizacao.id, "operacao.create");
  const canGerenciar =
    IGNORAR_PERFIS || can(session, organizacao.id, "operacao.manage");
  const canAnexos = IGNORAR_PERFIS || can(session, organizacao.id, "anexos.write");

  const carregar = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [listaReservas, listaRecursos] = await Promise.all([
        api.listarReservas(token, organizacao.id),
        api.listarRecursos(token, organizacao.id)
      ]);
      setReservas(listaReservas);
      setRecursos(listaRecursos);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar reservas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizacao.id]);

  const criarReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const criado = await api.criarReserva(token, {
        id: crypto.randomUUID(),
        organizacaoId: organizacao.id,
        recursoReservavelId: recursoId,
        pessoaSolicitanteId: pessoaId,
        unidadeOrganizacionalId: unidadeId ?? null,
        dataInicio,
        dataFim,
        status
      });
      setReservas((prev) => [criado, ...prev]);
      setDataInicio("");
      setDataFim("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar reserva");
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatusReserva = async (reservaId: string, novoStatus: string) => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const atualizada = await api.atualizarReserva(token, reservaId, {
        status: novoStatus,
        observacao: `Atualizado para ${novoStatus}`
      });
      setReservas((prev) =>
        prev.map((r) => (r.id === atualizada.id ? atualizada : r))
      );
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar reserva");
    } finally {
      setLoading(false);
    }
  };

  const criarRecurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!novoRecursoNome.trim()) {
      setErro("Informe o nome do recurso.");
      return;
    }
    try {
      setErro(null);
      setLoading(true);
      const capacidade = novoRecursoCapacidade.trim()
        ? Number(novoRecursoCapacidade)
        : undefined;
      const limite = novoRecursoLimite.trim()
        ? Number(novoRecursoLimite)
        : undefined;
      const bloqueios = novoRecursoBloqueios
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const criado = await api.criarRecurso(token, {
        organizacaoId: organizacao.id,
        nome: novoRecursoNome.trim(),
        capacidade: Number.isFinite(capacidade) ? capacidade : undefined,
        regrasJson: JSON.stringify({ antecedenciaDias: 7, duracaoHoras: 4 }),
        limitePorUnidadePorMes: Number.isFinite(limite) ? limite : undefined,
        exigeAprovacao: novoRecursoExigeAprovacao,
        janelaHorarioInicio: novoRecursoJanelaInicio,
        janelaHorarioFim: novoRecursoJanelaFim,
        bloqueiosJson: bloqueios.length > 0 ? JSON.stringify(bloqueios) : undefined
      });
      setRecursos((prev) => [...prev, criado]);
      setNovoRecursoNome("");
      setNovoRecursoCapacidade("");
      setNovoRecursoLimite("");
      setNovoRecursoExigeAprovacao(false);
      setNovoRecursoBloqueios("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar recurso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finance-layout">
      <section className="finance-form-card">
        <h3>Nova reserva</h3>
        {canCriar ? (
          <form onSubmit={criarReserva} className="form">
          <label>
            Recurso
            <select value={recursoId} onChange={(e) => setRecursoId(e.target.value)}>
              <option value="">Selecione</option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data inicio
            <input
              type="datetime-local"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </label>
          <label>
            Data fim
            <input
              type="datetime-local"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDENTE">Pendente</option>
              <option value="APROVADA">Aprovada</option>
              <option value="CANCELADA">Cancelada</option>
              <option value="CONCLUIDA">Concluida</option>
            </select>
          </label>
          <button type="submit" disabled={loading || !recursoId}>
            {loading ? "Enviando..." : "Criar reserva"}
          </button>
          </form>
        ) : (
          <p className="finance-form-sub">Sem acesso para criar reservas.</p>
        )}

        <div className="divider" />

        <h4>Recursos disponiveis</h4>
        {canGerenciar ? (
          <form onSubmit={criarRecurso} className="form">
          <label>
            Nome do recurso
            <input
              value={novoRecursoNome}
              onChange={(e) => setNovoRecursoNome(e.target.value)}
              placeholder="Salao de festas"
            />
          </label>
          <label>
            Capacidade
            <input
              value={novoRecursoCapacidade}
              onChange={(e) => setNovoRecursoCapacidade(e.target.value)}
              placeholder="80"
            />
          </label>
          <label>
            Limite por unidade/mes
            <input
              value={novoRecursoLimite}
              onChange={(e) => setNovoRecursoLimite(e.target.value)}
              placeholder="2"
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={novoRecursoExigeAprovacao}
              onChange={(e) => setNovoRecursoExigeAprovacao(e.target.checked)}
            />
            Exige aprovacao
          </label>
          <label>
            Janela horario (inicio)
            <input
              value={novoRecursoJanelaInicio}
              onChange={(e) => setNovoRecursoJanelaInicio(e.target.value)}
              placeholder="08:00"
            />
          </label>
          <label>
            Janela horario (fim)
            <input
              value={novoRecursoJanelaFim}
              onChange={(e) => setNovoRecursoJanelaFim(e.target.value)}
              placeholder="22:00"
            />
          </label>
          <label>
            Bloqueios (datas YYYY-MM-DD)
            <input
              value={novoRecursoBloqueios}
              onChange={(e) => setNovoRecursoBloqueios(e.target.value)}
              placeholder="2026-02-15,2026-03-01"
            />
          </label>
            <button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Criar recurso"}
            </button>
          </form>
        ) : (
          <p className="finance-form-sub">Sem acesso para gerenciar recursos.</p>
        )}
        {erro && <p className="error">{erro}</p>}
      </section>
      <section className="finance-table-card">
        <div className="finance-table-header">
          <h3>Reservas</h3>
          <button type="button" onClick={carregar} disabled={loading}>
            Atualizar
          </button>
        </div>
        <table className="table finance-table">
          <thead>
            <tr>
              <th>Recurso</th>
              <th>Inicio</th>
              <th>Fim</th>
              <th>Status</th>
              {canGerenciar && <th>Acoes</th>}
            </tr>
          </thead>
          <tbody>
            {reservas.map((r) => {
              const selecionada = reservaSelecionada?.id === r.id;
              return (
              <tr
                key={r.id}
                onClick={() => setReservaSelecionada(r)}
                style={{
                  cursor: "pointer",
                  backgroundColor: selecionada ? "#f3f4f6" : undefined
                }}
              >
                <td>{recursos.find((rec) => rec.id === r.recursoReservavelId)?.nome ?? "-"}</td>
                <td>{r.dataInicio}</td>
                <td>{r.dataFim}</td>
                <td>{r.status}</td>
                {canGerenciar && (
                  <td>
                    {r.status === "PENDENTE" && (
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => atualizarStatusReserva(r.id, "APROVADA")}
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => atualizarStatusReserva(r.id, "CANCELADA")}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                    {r.status === "APROVADA" && (
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => atualizarStatusReserva(r.id, "CONCLUIDA")}
                        >
                          Concluir
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => atualizarStatusReserva(r.id, "CANCELADA")}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                    {r.status !== "PENDENTE" && r.status !== "APROVADA" && "-"}
                  </td>
                )}
              </tr>
              );
            })}
            {reservas.length === 0 && (
              <tr>
                <td colSpan={canGerenciar ? 5 : 4} style={{ textAlign: "center" }}>
                  Nenhuma reserva encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="finance-form-card" style={{ marginTop: 12 }}>
        <div className="finance-table-header">
          <h3>Anexos da reserva</h3>
        </div>
        {!reservaSelecionada && (
          <p className="finance-form-sub">
            Selecione uma reserva para ver anexos.
          </p>
        )}
        {reservaSelecionada && (
          <AnexosPanel
            organizacaoId={organizacao.id}
            tipoEntidade="reserva"
            entidadeId={reservaSelecionada.id}
            titulo="Anexos vinculados"
            readOnly={!canAnexos}
          />
        )}
      </section>
    </div>
  );
};

const InnerApp: React.FC = () => {
  const { token, setToken, session, setSession } = useAuth();

  const [segmentoSelecionado, setSegmentoSelecionado] = useState<string | null>(
    null
  );
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [organizacaoSelecionada, setOrganizacaoSelecionada] =
    useState<Organizacao | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novoNomeOrg, setNovoNomeOrg] = useState("");
  const [criandoOrg, setCriandoOrg] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [view, setView] = useState<AppView>("dashboard");
  const [financeiroAba, setFinanceiroAba] =
    useState<FinanceiroTab>("mapaFinanceiro");
  const [sidebarFinanceiroOpen, setSidebarFinanceiroOpen] = useState(false);
  const [configuracoesAba, setConfiguracoesAba] =
    useState<ConfiguracoesTab>("cadastros-base");
  const [sidebarConfiguracoesOpen, setSidebarConfiguracoesOpen] = useState(false);
  const contentRef = useRef<HTMLElement | null>(null);
  const [gerandoDemo, setGerandoDemo] = useState(false);
  const [mensagemDemo, setMensagemDemo] = useState<string | null>(null);

  const carregarOrganizacoes = useCallback(async () => {
    try {
      setErro(null);
      setLoadingOrgs(true);
      if (!token) return;
      const data = await api.listarOrganizacoes(token);
      setOrganizacoes(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar organizacoes");
    } finally {
      setLoadingOrgs(false);
    }
  }, [token]);

  const carregarOrganizacoesUsuario = useCallback(async () => {
    try {
      setErro(null);
      setLoadingOrgs(true);
      if (!token) return;
      const data = await api.listarMinhasOrganizacoes(token);
      setOrganizacoes(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar condominios");
    } finally {
      setLoadingOrgs(false);
    }
  }, [token]);

  const isPlatformAdmin = session?.isPlatformAdmin ?? false;

  useEffect(() => {
    if (!token || !session) return;
    if (isPlatformAdmin) {
      if (!segmentoSelecionado || organizacoes.length > 0) return;
      void carregarOrganizacoes();
      return;
    }

    if (organizacoes.length > 0) return;
    void carregarOrganizacoesUsuario();
  }, [
    carregarOrganizacoes,
    carregarOrganizacoesUsuario,
    isPlatformAdmin,
    organizacoes.length,
    segmentoSelecionado,
    session,
    token
  ]);

  const activeMemberships = useMemo(
    () =>
      (session?.memberships ?? []).filter(
        (m) => m.isActive && m.role !== "PLATFORM_ADMIN"
      ),
    [session?.memberships]
  );

  useEffect(() => {
    if (isPlatformAdmin || !session) return;
    if (organizacaoSelecionada) return;

    const orgIds = Array.from(
      new Set(
        activeMemberships
          .map((m) => m.condoId)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (orgIds.length === 1 && organizacoes.length > 0) {
      const org = organizacoes.find((item) => item.id === orgIds[0]);
      if (org) {
        setOrganizacaoSelecionada(org);
        setView("dashboard");
        setErro(null);
      }
    }
  }, [activeMemberships, isPlatformAdmin, organizacaoSelecionada, organizacoes, session]);

  const segmentoAtual = useMemo(() => {
    if (!isPlatformAdmin) return null;
    return segmentos.find((seg) => seg.id === segmentoSelecionado) ?? null;
  }, [isPlatformAdmin, segmentoSelecionado]);

  const organizacoesDoSegmento = useMemo(() => {
    if (!segmentoAtual) return organizacoes;
    const tipoSegmento = normalizeText(segmentoAtual.label);
    return organizacoes.filter(
      (org) => normalizeText(org.tipo) === tipoSegmento
    );
  }, [organizacoes, segmentoAtual]);

  const opcoesOrganizacao = useMemo(() => {
    if (!organizacaoSelecionada) return organizacoesDoSegmento;
    const map = new Map<string, Organizacao>();
    [...organizacoesDoSegmento, organizacaoSelecionada].forEach((org) =>
      map.set(org.id, org)
    );
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [organizacaoSelecionada, organizacoesDoSegmento]);

  const orgId = organizacaoSelecionada?.id ?? null;

  const membershipAtual = getActiveMembership(session?.memberships, orgId);

  const podeFinanceiro = IGNORAR_PERFIS || can(session, orgId, "financeiro.read");
  const podeFinanceiroEscrita =
    IGNORAR_PERFIS || can(session, orgId, "financeiro.write");
  const podeVerCadastros = IGNORAR_PERFIS || can(session, orgId, "cadastros.read");
  const podeEditarCadastros =
    IGNORAR_PERFIS || can(session, orgId, "cadastros.write");
  const podeOperacao = IGNORAR_PERFIS || can(session, orgId, "operacao.read");
  const podeRelatorios = podeFinanceiro || podeOperacao;
  const podeCriarOperacao =
    IGNORAR_PERFIS || can(session, orgId, "operacao.create");
  const podeMinhaUnidade =
    IGNORAR_PERFIS || can(session, orgId, "minha_unidade.read");

  const viewPermissions: Partial<Record<AppView, PermissionKey>> = {
    pessoas: "cadastros.read",
    unidades: "cadastros.read",
    financeiro: "financeiro.read",
    configuracoes: "cadastros.write",
    funcionarios: "cadastros.read",
    fornecedores: "cadastros.read",
    veiculos: "cadastros.read",
    pets: "cadastros.read",
    chamados: "operacao.read",
    reservas: "operacao.read",
    portaria: "operacao.read",
    correspondencia: "operacao.read",
    comunicados: "operacao.read",
    documentos: "operacao.read",
    relatorios: "operacao.read",
    minhaUnidade: "minha_unidade.read"
  };

  const canView = (target: AppView) => {
    if (IGNORAR_PERFIS) return true;
    const perm = viewPermissions[target];
    return perm ? can(session, orgId, perm) : true;
  };

  const setViewIfAllowed = (target: AppView) => {
    if (!IGNORAR_PERFIS && !canView(target)) {
      setErro("Acesso restrito.");
      return;
    }
    setView(target);
    setErro(null);
  };

  const viewPermitido = canView(view);
  const isComingSoon = comingSoonViews.has(view);

  const activePathname = useMemo(() => {
    if (!token || !session) return "/login";

    if (!organizacaoSelecionada) {
      if (isPlatformAdmin) {
        return segmentoSelecionado
          ? `/segmentos/${segmentoSelecionado}`
          : "/segmentos";
      }
      return "/organizacoes";
    }

    const basePath = `/organizacoes/${organizacaoSelecionada.id}`;
    if (view === "financeiro") {
      return `${basePath}/financeiro/${financeiroAba}`;
    }
    if (view === "configuracoes") {
      return `${basePath}/configuracoes/${configuracoesAba}`;
    }

    return `${basePath}/${view}`;
  }, [
    configuracoesAba,
    financeiroAba,
    isPlatformAdmin,
    organizacaoSelecionada,
    segmentoSelecionado,
    session,
    token,
    view
  ]);

  useEffect(() => {
    window.scrollTo(0, 0);

    const contentEl = contentRef.current;
    if (contentEl) {
      contentEl.scrollTop = 0;
      contentEl.scrollTo({ top: 0, left: 0 });
    }
  }, [activePathname]);

  const gerarDemo = async () => {
    try {
      setMensagemDemo(null);
      setGerandoDemo(true);
      await api.seedDemoFull();
      setMensagemDemo("DEMO completo gerado.");
      if (isPlatformAdmin) {
        await carregarOrganizacoes();
      } else {
        await carregarOrganizacoesUsuario();
      }
    } catch (e: any) {
      setMensagemDemo(e?.message || "Erro ao gerar DEMO.");
    } finally {
      setGerandoDemo(false);
    }
  };

  const irParaInicio = () => {
    setOrganizacaoSelecionada(null);
    setSegmentoSelecionado(null);
    setOrganizacoes([]);
    setView("dashboard");
    setSidebarCompact(false);
    setErro(null);
  };

  const sairDoSistema = () => {
    setToken(null);
    setSession(null);
    setOrganizacaoSelecionada(null);
    setSegmentoSelecionado(null);
    setOrganizacoes([]);
    setView("dashboard");
    setSidebarCompact(false);
    setErro(null);
  };

  const trocarOrganizacao = (orgId: string) => {
    const org = opcoesOrganizacao.find((item) => item.id === orgId);
    if (!org) return;
    setOrganizacaoSelecionada(org);
    setView("dashboard");
    setErro(null);
  };

  const editarNomeOrganizacao = async (organizacaoAlvo: Organizacao) => {
    const novoNome = window.prompt(
      "Novo nome da organizacao:",
      organizacaoAlvo.nome
    );
    if (!novoNome || !novoNome.trim()) return;

    try {
      setErro(null);
      if (!token) return;
      const atualizado = await api.atualizarOrganizacao(token, organizacaoAlvo.id, {
        nome: novoNome.trim(),
        tipo: organizacaoAlvo.tipo,
        modulosAtivos: organizacaoAlvo.modulosAtivos,
        status: "ativo"
      });

      setOrganizacaoSelecionada((atual) =>
        atual?.id === atualizado.id ? atualizado : atual
      );
      setOrganizacoes((prev) =>
        prev.map((item) => (item.id === atualizado.id ? atualizado : item))
      );
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar nome da organizacao");
    }
  };

  const executarAcaoRapida = (acao: "lancamento" | "chamado" | "reserva") => {
    if (acao === "lancamento") {
      if (!IGNORAR_PERFIS && !podeFinanceiroEscrita) {
        setErro("Sem acesso ao financeiro.");
        return;
      }
      setViewIfAllowed("financeiro");
      setFinanceiroAba("contasPagar");
      return;
    }

    if (acao === "chamado") {
      if (!IGNORAR_PERFIS && !podeCriarOperacao) {
        setErro("Sem acesso a chamados.");
        return;
      }
      setViewIfAllowed("chamados");
      return;
    }

    if (!IGNORAR_PERFIS && !podeCriarOperacao) {
      setErro("Sem acesso a reservas.");
      return;
    }
    setViewIfAllowed("reservas");
  };

  useEffect(() => {
    if (view !== "financeiro" && sidebarFinanceiroOpen) {
      setSidebarFinanceiroOpen(false);
    }
  }, [sidebarFinanceiroOpen, view]);

  useEffect(() => {
    if (view !== "configuracoes" && sidebarConfiguracoesOpen) {
      setSidebarConfiguracoesOpen(false);
    }
  }, [sidebarConfiguracoesOpen, view]);

  const topBar = (
    <header className="app-header">
      <div className="app-header-left">
        <img
          src={`${import.meta.env.BASE_URL}swa1.jpeg`}
          alt="Logo SWA"
          className="app-header-logo-img"
        />
        <div className="app-header-brand">
          <span className="app-header-title">SWA Gestao Inteligente</span>
          <span className="app-header-subtitle">
            {organizacaoSelecionada
              ? organizacaoSelecionada.nome
              : "Sistema de gestao corporativa"}
          </span>
        </div>
      </div>

      <div className="app-header-center">
        {organizacaoSelecionada ? (
          <label className="app-header-org-picker">
            <span>Condominio atual</span>
            <select
              value={organizacaoSelecionada.id}
              onChange={(e) => trocarOrganizacao(e.target.value)}
            >
              {opcoesOrganizacao.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.nome}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="app-header-context-pill">
            {segmentoAtual ? segmentoAtual.label : "Selecione um segmento"}
          </span>
        )}
      </div>

      <div className="app-header-right">
        {organizacaoSelecionada && (podeFinanceiroEscrita || podeCriarOperacao) && (
          <details className="app-header-quick-menu">
            <summary className="app-header-quick-trigger">Acoes</summary>
            <div className="app-header-quick-dropdown">
              {podeFinanceiroEscrita && (
                <button
                  type="button"
                  className="app-user-option"
                  onClick={() => executarAcaoRapida("lancamento")}
                >
                  Novo lancamento
                </button>
              )}
              {podeCriarOperacao && (
                <button
                  type="button"
                  className="app-user-option"
                  onClick={() => executarAcaoRapida("chamado")}
                >
                  Novo chamado
                </button>
              )}
              {podeCriarOperacao && (
                <button
                  type="button"
                  className="app-user-option"
                  onClick={() => executarAcaoRapida("reserva")}
                >
                  Nova reserva
                </button>
              )}
            </div>
          </details>
        )}

        <a
          className="app-header-button app-header-button--ghost"
          href="https://swagestaointeligente.github.io/swa-site/"
          target="_blank"
          rel="noreferrer"
        >
          Site SWA
        </a>

        <button
          type="button"
          className="app-header-button app-header-button--ghost"
          onClick={irParaInicio}
        >
          Inicio
        </button>

        <details className="app-user-menu">
          <summary className="app-user-trigger">
            <span className="app-user-avatar">AD</span>
            <span className="app-user-name">Usuario</span>
          </summary>
          <div className="app-user-dropdown">
            <button
              type="button"
              className="app-user-option"
              onClick={() => setErro("Tela de perfil sera liberada em breve.")}
            >
              Perfil
            </button>
            <button
              type="button"
              className="app-user-option app-user-option--danger"
              onClick={sairDoSistema}
            >
              Sair
            </button>
          </div>
        </details>
      </div>
    </header>
  );

  if (!token) {
    return <LoginPage />;
  }

  if (!session) {
    return (
      <NoAccessPage
        mensagem="Sessao incompleta. Faca login novamente."
        onSair={sairDoSistema}
      />
    );
  }

  if (!isPlatformAdmin) {
    if (activeMemberships.length === 0) {
      return (
        <NoAccessPage
          mensagem="Sem vinculo ativo com condominio. Contate a administracao."
          onSair={sairDoSistema}
        />
      );
    }

    if (!organizacaoSelecionada) {
      return (
        <>
          {topBar}
          <div className="container org-page">
            <div className="org-header-row">
              <div>
                <h1>Selecione um condominio</h1>
              </div>
            </div>

            <section className="org-list-card">
              <div className="org-list-header">
                <h3>Condominios vinculados</h3>
              </div>
              {loadingOrgs && <p>Carregando...</p>}
              {!loadingOrgs && organizacoes.length === 0 && (
                <p className="org-empty">Nenhum condominio disponivel.</p>
              )}
              <div className="org-list-grid">
                {organizacoes.map((org) => (
                  <div key={org.id} className="org-card">
                    <button
                      type="button"
                      className="org-card-main"
                      onClick={() => {
                        setOrganizacaoSelecionada(org);
                        setView("dashboard");
                        setErro(null);
                      }}
                    >
                      <div className="org-card-title">{org.nome}</div>
                      {org.tipo && <div className="org-card-sub">{org.tipo}</div>}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      );
    }
  }

  if (isPlatformAdmin && !segmentoSelecionado) {
    return (
      <>
        {topBar}
        <div className="container">
          <h1>Escolha o tipo de organizacao</h1>
          <div className="segment-grid">
            {segmentos.map((segmento) => (
              <button
                key={segmento.id}
                className="segment-card"
                onClick={() => setSegmentoSelecionado(segmento.id)}
              >
                <span className="segment-icon">{segmento.icon}</span>
                <div className="segment-text">
                  <span className="segment-label">{segmento.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (isPlatformAdmin && !organizacaoSelecionada) {
    return (
      <>
        {topBar}
        <div className="container org-page">
          <div className="org-header-row">
            <div>
              <h1>Selecione uma organizacao</h1>
            </div>
            <button
              type="button"
              onClick={irParaInicio}
              className="org-back-button"
            >
              Voltar para tipos
            </button>
          </div>

          <div className="org-layout">
            <section className="org-form-card">
              <h3>Nova organizacao</h3>
              <label>
                Nome da organizacao
                <input
                  type="text"
                  value={novoNomeOrg}
                  onChange={(e) => setNovoNomeOrg(e.target.value)}
                  placeholder="Ex.: Condominio Mar Verde 4"
                />
              </label>
              <button
                onClick={async () => {
                  if (!novoNomeOrg.trim()) return;
                  try {
                    setCriandoOrg(true);
                    const modulosAtivos =
                      (segmentoAtual && modulosPorSegmento[segmentoAtual.id]) ??
                      "core,financeiro";

                    if (!token) return;
                    const orgCriada = await api.criarOrganizacao(token, {
                      nome: novoNomeOrg.trim(),
                      tipo: segmentoAtual?.label,
                      modulosAtivos
                    });

                    setOrganizacoes((prev) => [...prev, orgCriada]);
                    setNovoNomeOrg("");
                  } catch (e: any) {
                    setErro(e.message || "Erro ao criar organizacao");
                  } finally {
                    setCriandoOrg(false);
                  }
                }}
                disabled={criandoOrg || !novoNomeOrg.trim()}
              >
                {criandoOrg ? "Salvando..." : "Criar organizacao"}
              </button>

              <button
                type="button"
                onClick={carregarOrganizacoes}
                disabled={loadingOrgs}
                className="org-load-button"
              >
                {loadingOrgs ? "Carregando..." : "Atualizar organizacoes"}
              </button>
              {erro && <p className="error">{erro}</p>}
            </section>

            <section className="org-list-card">
              <div className="org-list-header">
                <h3>Organizacoes cadastradas</h3>
              </div>
              {opcoesOrganizacao.length > 0 ? (
                <div className="org-list-grid">
                  {opcoesOrganizacao.map((org) => (
                    <div key={org.id} className="org-card">
                      <button
                        type="button"
                        className="org-card-main"
                        onClick={() => {
                          setOrganizacaoSelecionada(org);
                          setView("dashboard");
                          setErro(null);
                        }}
                      >
                        <div className="org-card-title">{org.nome}</div>
                        {org.tipo && <div className="org-card-sub">{org.tipo}</div>}
                        {org.modulosAtivos && (
                          <div className="org-card-tags">
                            {org.modulosAtivos.split(",").map((modulo) => (
                              <span key={modulo} className="org-tag">
                                {modulo}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                      <button
                        type="button"
                        className="org-card-edit"
                        onClick={() => void editarNomeOrganizacao(org)}
                      >
                        Editar nome
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="org-empty">
                  Nenhuma organizacao encontrada para este segmento.
                </p>
              )}
            </section>
          </div>
        </div>
      </>
    );
  }

  const renderSidebarItem = (
    target: AppView,
    label: string,
    icon: string
  ) => (
    <button
      key={target}
      type="button"
      onClick={() => {
        setViewIfAllowed(target);
      }}
      className={"sidebar-item" + (view === target ? " sidebar-item--active" : "")}
      title={label}
    >
      <span className="sidebar-item-icon">{icon}</span>
      <span className="sidebar-item-label">{label}</span>
    </button>
  );

  return (
    <>
      {topBar}
      <div className={"app-shell" + (sidebarCompact ? " app-shell--compact" : "")}>
        <aside className={"sidebar" + (sidebarCompact ? " sidebar--compact" : "")}>
          <div className="sidebar-header">
            <div className="sidebar-title-row">
              <div className="sidebar-title">{organizacaoSelecionada.nome}</div>
              <button
                type="button"
                className="sidebar-collapse"
                onClick={() => setSidebarCompact((prev) => !prev)}
                title={sidebarCompact ? "Expandir menu" : "Compactar menu"}
              >
                {sidebarCompact ? ">>" : "<<"}
              </button>
            </div>

            {!sidebarCompact && (
              <div className="sidebar-actions">
                <button
                  type="button"
                  className="sidebar-action sidebar-action--secondary"
                  onClick={() => {
                    setOrganizacaoSelecionada(null);
                    setView("dashboard");
                    setErro(null);
                  }}
                >
                  Voltar
                </button>
              </div>
            )}
          </div>

          <nav className="sidebar-menu">
            <div className="sidebar-section">
              <p className="sidebar-section-title">Resumo</p>
              {renderSidebarItem("dashboard", "Resumo geral", "\u{1F4CA}")}
              {podeMinhaUnidade &&
                renderSidebarItem("minhaUnidade", "Minha unidade", "\u{1F3E0}")}
            </div>
            {podeOperacao && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Operacao diaria</p>
                {renderSidebarItem("chamados", "Chamados", "\u{1F6E0}")}
                {renderSidebarItem("reservas", "Reservas", "\u{1F4C5}")}
                {renderSidebarItem("portaria", "Portaria", "\u{1F6AA}")}
                {renderSidebarItem("correspondencia", "Correspondencia", "\u{1F4EC}")}
              </div>
            )}

            {podeVerCadastros && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Cadastros</p>
                {renderSidebarItem("pessoas", "Pessoas", "\u{1F465}")}
                {renderSidebarItem("unidades", "Unidades", "\u{1F3E2}")}
                {renderSidebarItem("veiculos", "Veiculos", "\u{1F697}")}
                {renderSidebarItem("pets", "Pets", "\u{1F43E}")}
              </div>
            )}
            {podeFinanceiro && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Financeiro</p>
                <button
                  type="button"
                  onClick={() => {
                    if (view !== "financeiro") {
                      setViewIfAllowed("financeiro");
                      setSidebarFinanceiroOpen(true);
                      return;
                    }
                    setSidebarFinanceiroOpen((prev) => !prev);
                  }}
                  className={
                    "sidebar-item" + (view === "financeiro" ? " sidebar-item--active" : "")
                  }
                  title="Financeiro"
                >
                  <span className="sidebar-item-icon">{"\u{1F4B0}"}</span>
                  <span className="sidebar-item-label">Financeiro</span>
                </button>
                <div
                  className={
                    "sidebar-submenu" +
                    (sidebarFinanceiroOpen ? " sidebar-submenu--open" : "")
                  }
                >
                  {menuFinanceiro.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        "sidebar-subitem" +
                        (view === "financeiro" && financeiroAba === item.id
                          ? " sidebar-subitem--active"
                          : "")
                      }
                      onClick={() => {
                        setViewIfAllowed("financeiro");
                        setFinanceiroAba(item.id);
                        setSidebarFinanceiroOpen(true);
                      }}
                      title={item.label}
                    >
                      <span className="sidebar-subitem-icon">{financeiroSiglas[item.id]}</span>
                      <span className="sidebar-subitem-label">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {podeOperacao && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Comunicacao</p>
                <span className="sidebar-section-subtitle">avisos e documentos</span>
                {renderSidebarItem("comunicados", "Comunicados", "\u{1F4E2}")}
                {renderSidebarItem("documentos", "Documentos", "\u{1F4C1}")}
              </div>
            )}

            {podeRelatorios && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Relatorios</p>
                {renderSidebarItem("relatorios", "Relatorios", "\u{1F4CA}")}
              </div>
            )}
            {podeEditarCadastros && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Configuracoes</p>
                <button
                  type="button"
                  onClick={() => {
                    if (view !== "configuracoes") {
                      setViewIfAllowed("configuracoes");
                      setSidebarConfiguracoesOpen(true);
                      return;
                    }
                    setSidebarConfiguracoesOpen((prev) => !prev);
                  }}
                  className={
                    "sidebar-item" +
                    (view === "configuracoes" ? " sidebar-item--active" : "")
                  }
                  title="Configuracoes"
                >
                  <span className="sidebar-item-icon">{"\u{2699}"}</span>
                  <span className="sidebar-item-label">Configuracoes</span>
                </button>
                <div
                  className={
                    "sidebar-submenu" +
                    (sidebarConfiguracoesOpen ? " sidebar-submenu--open" : "")
                  }
                >
                  {menuConfiguracoes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        "sidebar-subitem" +
                        (view === "configuracoes" && configuracoesAba === item.id
                          ? " sidebar-subitem--active"
                          : "")
                      }
                      onClick={() => {
                        setViewIfAllowed("configuracoes");
                        setConfiguracoesAba(item.id);
                        setSidebarConfiguracoesOpen(true);
                      }}
                      title={item.label}
                    >
                      <span className="sidebar-subitem-icon">
                        {configuracoesSiglas[item.id]}
                      </span>
                      <span className="sidebar-subitem-label">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </nav>
        </aside>

        <main ref={contentRef} className="main-content">
          <header className="page-header">
            <div>
              <p className="page-header-eyebrow">{organizacaoSelecionada.nome}</p>
              <h1 className="page-header-title">{viewMeta[view].title}</h1>
              <p className="page-header-subtitle">{viewMeta[view].subtitle}</p>
            </div>

            <div className="page-header-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={gerarDemo}
                disabled={gerandoDemo}
              >
                {gerandoDemo ? "Gerando DEMO..." : "Gerar DEMO Completo"}
              </button>
              {view !== "dashboard" && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setView("dashboard")}
                >
                  Voltar ao resumo
                </button>
              )}
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setOrganizacaoSelecionada(null);
                  setView("dashboard");
                  setErro(null);
                }}
              >
                Trocar condominio
              </button>
            </div>
          </header>

          {erro && <p className="error">{erro}</p>}
          {mensagemDemo && <p className="success">{mensagemDemo}</p>}

          {!viewPermitido && (
            <NoAccessPage mensagem="Acesso restrito." />
          )}

          {viewPermitido && view === "dashboard" && (
            <Dashboard
              organizacao={organizacaoSelecionada}
              mostrarFinanceiro={podeFinanceiro}
            />
          )}

          {viewPermitido && view === "pessoas" && (
            <PessoasView
              organizacao={organizacaoSelecionada}
              readOnly={!podeEditarCadastros}
            />
          )}

          {viewPermitido && view === "funcionarios" && (
            <PessoasView
              organizacao={organizacaoSelecionada}
              papelFixo="funcionario"
              titulo="Funcionarios"
              readOnly={!podeEditarCadastros}
            />
          )}

          {viewPermitido && view === "fornecedores" && (
            <FornecedoresView
              organizacao={organizacaoSelecionada}
              readOnly={!podeEditarCadastros}
            />
          )}

          {viewPermitido && view === "configuracoes" && (
            <ConfiguracoesView
              organizacao={organizacaoSelecionada}
              abaSelecionada={configuracoesAba}
              onAbaChange={setConfiguracoesAba}
              readOnly={!podeEditarCadastros}
            />
          )}

          {viewPermitido && view === "veiculos" && (
            <VeiculosView
              organizacao={organizacaoSelecionada}
              readOnly={!podeEditarCadastros}
            />
          )}

          {viewPermitido && view === "pets" && (
            <PetsView
              organizacao={organizacaoSelecionada}
              readOnly={!podeEditarCadastros}
            />
          )}

          {viewPermitido && view === "unidades" && (
            <UnidadesView
              organizacao={organizacaoSelecionada}
              readOnly={!podeEditarCadastros}
            />
          )}

          {viewPermitido && view === "financeiro" && (
            <FinanceiroView
              organizacao={organizacaoSelecionada}
              abaSelecionada={financeiroAba}
              onAbaChange={setFinanceiroAba}
              readOnly={!podeFinanceiroEscrita}
              exibirMenuAbas={false}
            />
          )}

          {viewPermitido && view === "minhaUnidade" && membershipAtual && (
            <MinhaUnidadeView
              organizacao={organizacaoSelecionada}
              unidadeId={membershipAtual.unidadeOrganizacionalId}
            />
          )}

          {viewPermitido && view === "chamados" && session && (
            <ChamadosView
              organizacao={organizacaoSelecionada}
              pessoaId={session.pessoaId}
              unidadeId={membershipAtual?.unidadeOrganizacionalId}
            />
          )}

          {viewPermitido && view === "reservas" && session && (
            <ReservasView
              organizacao={organizacaoSelecionada}
              pessoaId={session.pessoaId}
              unidadeId={membershipAtual?.unidadeOrganizacionalId}
            />
          )}

          {viewPermitido && isComingSoon && <ComingSoonView />}
        </main>
      </div>
    </>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <InnerApp />
  </AuthProvider>
);

export default App;
