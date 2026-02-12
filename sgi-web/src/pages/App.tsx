import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import {
  can,
  getActiveMembership,
  getActivePermissions,
  getActiveRole,
  getRoleLabel,
  getRoleShortCode,
  permissionLabels,
  PermissionKey
} from "../authz";
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
  UnidadeOrganizacional,
  UnidadePagamento,
  Veiculo
} from "../api";
import { LoginPage } from "./LoginPage";
import PessoasView from "../views/PessoasView";
import FornecedoresView from "../views/FornecedoresView";
import UnidadesView from "../views/UnidadesView";
import VeiculosView from "../views/VeiculosView";
import PetsView from "../views/PetsView";
import PortariaView from "../views/PortariaView";
import CorrespondenciaView from "../views/CorrespondenciaView";
import ComunicadosView from "../views/ComunicadosView";
import DocumentosView from "../views/DocumentosView";
import RelatoriosView from "../views/RelatoriosView";
import CartaoPontoView from "../views/CartaoPontoView";
import ConfiguracoesView, {
  ConfiguracoesTab,
  menuConfiguracoes
} from "../views/ConfiguracoesView";
import FinanceiroView, {
  FinanceiroTab,
  menuFinanceiro
} from "../views/FinanceiroView";
import AnexosPanel from "../components/AnexosPanel";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronRight,
  Clock3,
  DoorOpen,
  FolderOpen,
  Home,
  LayoutDashboard,
  Mail,
  Menu,
  Megaphone,
  PawPrint,
  Settings,
  Users,
  Wallet,
  Wrench
} from "lucide-react";

const IGNORAR_PERFIS = false;

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
  | "cartaoPonto"
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
  cartaoPonto: {
    title: "Cartao de ponto",
    subtitle: "Marcacoes de jornada, espelho e comprovantes."
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

const comingSoonViews = new Set<AppView>([]);

const autoAjudaPassos: Record<AppView, string[]> = {
  dashboard: [
    "Revise os indicadores de saldo, contas e alertas do dia.",
    "Use os atalhos para abrir o modulo de trabalho rapidamente.",
    "Atualize os dados antes de iniciar o expediente."
  ],
  pessoas: [
    "Cadastre nome, papel e contato principal.",
    "Use o filtro por papel para localizar moradores e fornecedores.",
    "Clique na pessoa para editar ou remover."
  ],
  unidades: [
    "Cadastre a estrutura em ordem: bloco e depois unidade.",
    "Mantenha codigo interno unico para evitar duplicidade.",
    "Arquive unidade inativa em vez de remover historico."
  ],
  financeiro: [
    "Confira contas a pagar e receber da competencia.",
    "Registre pagamento/baixa com conta financeira correta.",
    "Feche pendencias de inadimplencia e conciliacao."
  ],
  configuracoes: [
    "Ajuste cadastros base antes de operar o financeiro.",
    "Valide plano de contas e categorias da operacao.",
    "Evite hardcode: mantenha tudo configuravel."
  ],
  funcionarios: [
    "Cadastre dados essenciais do colaborador.",
    "Vincule telefone e papel para rastreio operacional.",
    "Use busca por nome para manutencao rapida."
  ],
  fornecedores: [
    "Cadastre fornecedor com telefone e documento.",
    "Padronize categoria para relatorios e filtros.",
    "Mantenha somente fornecedores ativos na operacao."
  ],
  veiculos: [
    "Cadastre placa e dados basicos do veiculo.",
    "Vincule o veiculo ao responsavel correto.",
    "Revise status periodicamente."
  ],
  pets: [
    "Cadastre nome, especie, porte e status.",
    "Relacione pet a unidade/pessoa quando necessario.",
    "Use filtros para consultas rapidas."
  ],
  chamados: [
    "Abra chamado com titulo claro e prioridade.",
    "Registre atualizacoes no historico do atendimento.",
    "Conclua com status resolvido/encerrado."
  ],
  reservas: [
    "Selecione recurso e periodo de uso.",
    "Confirme janela de horario antes de salvar.",
    "Acompanhe status: pendente, aprovada, concluida."
  ],
  portaria: [
    "Cadastre entradas, autorizacoes e entregas.",
    "Valide documento e unidade no ato do acesso.",
    "Finalize a movimentacao para manter trilha correta."
  ],
  cartaoPonto: [
    "Selecione colaborador e competencia da apuracao.",
    "Registre marcacoes na sequencia correta do dia.",
    "Use ajustes com justificativa para trilha de auditoria."
  ],
  correspondencia: [
    "Cadastre recebimento com unidade e remetente.",
    "Atualize status para entregue quando finalizado.",
    "Use busca por unidade para retirada rapida."
  ],
  comunicados: [
    "Publique aviso com titulo objetivo e texto direto.",
    "Escolha escopo geral ou unidade especifica.",
    "Arquive comunicados antigos para manter painel limpo."
  ],
  documentos: [
    "Classifique por categoria e visibilidade.",
    "Use tags para facilitar busca por tema.",
    "Arquive versoes antigas mantendo historico."
  ],
  relatorios: [
    "Escolha modulo e periodo antes de exportar.",
    "Prefira PDF para envio ao cliente final.",
    "Consulte historico para rastrear arquivos gerados."
  ],
  minhaUnidade: [
    "Revise cobrancas em aberto e historico de pagamento.",
    "Use atalhos para 2a via e inadimplencia.",
    "Acompanhe credito e comprovantes da unidade."
  ]
};

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

const financeiroGrupos: Array<{
  id: string;
  label: string;
  itens: FinanceiroTab[];
}> = [
  {
    id: "base",
    label: "Base financeira",
    itens: ["mapaFinanceiro", "contabilidade", "categorias", "contas", "gruposRateio"]
  },
  {
    id: "operacao",
    label: "Operacao",
    itens: [
      "consumos",
      "receitasDespesas",
      "transferencias",
      "abonos",
      "baixasManuais",
      "conciliacaoBancaria"
    ]
  },
  {
    id: "cobranca",
    label: "Cobrancas",
    itens: ["contasPagar", "contasReceber", "itensCobrados", "faturas", "inadimplentes"]
  },
  {
    id: "planejamento",
    label: "Planejamento",
    itens: ["previsaoOrcamentaria"]
  },
  {
    id: "relatorios",
    label: "Relatorios",
    itens: ["livroPrestacaoContas", "relatorios"]
  }
];

const configuracoesGrupos: Array<{
  id: string;
  label: string;
  itens: ConfiguracoesTab[];
}> = [
  {
    id: "cadastros",
    label: "Cadastros",
    itens: ["cadastros-base", "pessoas-papeis"]
  },
  {
    id: "estrutura",
    label: "Estrutura",
    itens: ["estrutura-condominio"]
  },
  {
    id: "financeiro",
    label: "Financeiro",
    itens: ["financeiro-base"]
  }
];

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
  onAbrirDestino?: (destino: AppView, abaFinanceiro?: FinanceiroTab) => void;
}> = ({ organizacao, mostrarFinanceiro = true, onAbrirDestino }) => {
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
  const formatarMoeda = (valor?: number | null) =>
    (valor ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  const isContaAtiva = (status?: string | null) => {
    const normalized = (status ?? "ativo").toLowerCase();
    return normalized === "ativo" || normalized === "ativa";
  };
  const contasAtivas = contas.filter((conta) => isContaAtiva(conta.status)).length;
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
  const resolverDestinoAlerta = (alerta: NotificacaoEvento) => {
    const texto = normalizeText(
      `${alerta.tipo ?? ""} ${alerta.titulo ?? ""} ${alerta.mensagem ?? ""}`
    );
    if (texto.includes("inadimpl")) {
      return { view: "financeiro" as AppView, aba: "inadimplentes" as FinanceiroTab };
    }
    if (texto.includes("cobranca") || texto.includes("cobrança")) {
      return { view: "financeiro" as AppView, aba: "itensCobrados" as FinanceiroTab };
    }
    if (texto.includes("conta a pagar") || texto.includes("pagar")) {
      return { view: "financeiro" as AppView, aba: "contasPagar" as FinanceiroTab };
    }
    if (texto.includes("conta a receber") || texto.includes("receber")) {
      return {
        view: "financeiro" as AppView,
        aba: "contasReceber" as FinanceiroTab
      };
    }
    if (texto.includes("chamado")) {
      return { view: "chamados" as AppView };
    }
    if (texto.includes("reserva")) {
      return { view: "reservas" as AppView };
    }
    if (texto.includes("documento")) {
      return { view: "documentos" as AppView };
    }
    if (texto.includes("comunicado")) {
      return { view: "comunicados" as AppView };
    }
    if (texto.includes("portaria")) {
      return { view: "portaria" as AppView };
    }
    return null;
  };

  const resumoExecutivo: Array<{
    id: string;
    label: string;
    valor: number;
    destino?: { view: AppView; aba?: FinanceiroTab };
  }> = [
    { id: "chamados", label: "Chamados abertos", valor: chamadosAbertos, destino: { view: "chamados" } },
    { id: "reservas", label: "Reservas pendentes", valor: reservasPendentes, destino: { view: "reservas" } },
    { id: "alertas", label: "Alertas nao lidos", valor: alertasNaoLidos },
    {
      id: "contas",
      label: "Contas ativas",
      valor: contasAtivas,
      destino: mostrarFinanceiro ? { view: "financeiro", aba: "contas" } : undefined
    }
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header-row">
        <div>
          <p className="dashboard-caption">Indicadores consolidados da operacao.</p>
          <h2>Painel executivo</h2>
        </div>
        <button type="button" className="dashboard-refresh" onClick={carregar} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar dados"}
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card dashboard-card--primary">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">R$</span>
            Saldo consolidado
          </div>
          <div className="dashboard-card-value">
            {mostrarFinanceiro ? formatarMoeda(saldoInicialTotal) : "Sem acesso"}
          </div>
          <div className="dashboard-card-sub">Base consolidada das contas financeiras.</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">CF</span>
            Contas ativas
          </div>
          <div className="dashboard-card-value">{contasAtivas}</div>
          <div className="dashboard-card-sub">Contas financeiras habilitadas</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">CH</span>
            Chamados abertos
          </div>
          <div className="dashboard-card-value">{chamadosAbertos}</div>
          <div className="dashboard-card-sub">Chamados pendentes na operacao</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-label">
            <span className="dashboard-card-icon">AL</span>
            Alertas nao lidos
          </div>
          <div className="dashboard-card-value">{alertasNaoLidos}</div>
          <div className="dashboard-card-sub">Alertas aguardando visualizacao</div>
        </div>
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
                const scale = 52;
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
          <div className="dashboard-panel-header">
            <div>
              <h3>Resumo executivo</h3>
              <p>Indicadores para decisao rapida.</p>
            </div>
          </div>
          <ul className="dashboard-insights">
            {resumoExecutivo.map((item) => {
              const podeAbrir = Boolean(item.destino && onAbrirDestino);
              return (
                <li
                  key={item.id}
                  className={
                    "dashboard-insight-row" +
                    (podeAbrir ? " dashboard-insight-row--actionable" : "")
                  }
                  role={podeAbrir ? "button" : undefined}
                  tabIndex={podeAbrir ? 0 : undefined}
                  onClick={() => {
                    if (!podeAbrir || !item.destino) return;
                    onAbrirDestino?.(item.destino.view, item.destino.aba);
                  }}
                  onKeyDown={(event) => {
                    if (!podeAbrir || !item.destino) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onAbrirDestino?.(item.destino.view, item.destino.aba);
                    }
                  }}
                >
                  <span className="insight-label">{item.label}</span>
                  <strong className="dashboard-insight-value">{item.valor}</strong>
                </li>
              );
            })}
          </ul>
          <p className="dashboard-insights-note">
            Ultima atualizacao: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="dashboard-alerts">
          <h4>Alertas recentes</h4>
          <ul>
            {alertas.map((alerta) => {
              const destino = resolverDestinoAlerta(alerta);
              const podeAbrir = Boolean(destino && onAbrirDestino);
              return (
                <li
                  key={alerta.id}
                  className={
                    "dashboard-alert-item" +
                    (podeAbrir ? " dashboard-alert-item--actionable" : "")
                  }
                  role={podeAbrir ? "button" : undefined}
                  tabIndex={podeAbrir ? 0 : undefined}
                  onClick={() => {
                    if (podeAbrir && destino) {
                      onAbrirDestino?.(destino.view, destino.aba);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!podeAbrir || !destino) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onAbrirDestino?.(destino.view, destino.aba);
                    }
                  }}
                >
                  <strong className="dashboard-alert-title">{alerta.titulo}</strong>
                  <span>{alerta.mensagem}</span>
                  {podeAbrir && <span className="dashboard-alert-action">Clique para abrir</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {erro && <p className="error">{erro}</p>}
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

type MinhaUnidadeFinanceiroFiltro = {
  tipo: "faturas" | "inadimplencia";
  termo: string;
};

const MinhaUnidadeView: React.FC<{
  organizacao: Organizacao;
  unidadeId?: string | null;
  onAbrirChamados?: () => void;
  onAbrirFinanceiro?: (aba: FinanceiroTab, filtro?: MinhaUnidadeFinanceiroFiltro) => void;
}> = ({ organizacao, unidadeId, onAbrirChamados, onAbrirFinanceiro }) => {
  const { token } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState<string | null>(
    unidadeId ?? null
  );
  const [moradores, setMoradores] = useState<Pessoa[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [cobrancas, setCobrancas] = useState<UnidadeCobranca[]>([]);
  const [pagamentos, setPagamentos] = useState<
    Array<{ pagamento: UnidadePagamento; cobranca?: UnidadeCobranca }>
  >([]);
  const [creditoUnidade, setCreditoUnidade] = useState<CreditoUnidadeResponse | null>(
    null
  );
  const [anexosCobrancas, setAnexosCobrancas] = useState<
    Record<string, Anexo[]>
  >({});
  const [competenciaFiltro, setCompetenciaFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todas");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [loadingPagamentos, setLoadingPagamentos] = useState(false);

  const formatarMoeda = useCallback((valor?: number | null) => {
    return (valor ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }, []);

  const formatarData = useCallback((valor?: string | null) => {
    if (!valor) return "-";
    const base = valor.slice(0, 10);
    if (base.includes("/")) return base;
    const partes = base.split("-");
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return base;
  }, []);

  useEffect(() => {
    setUnidadeSelecionadaId(unidadeId ?? null);
  }, [unidadeId]);

  useEffect(() => {
    const carregarUnidades = async () => {
      if (!token) return;
      try {
        setLoadingUnidades(true);
        const lista = await api.listarUnidades(token, organizacao.id);
        setUnidades(lista);
        if (!unidadeId && !unidadeSelecionadaId && lista.length === 1) {
          setUnidadeSelecionadaId(lista[0].id);
        }
      } catch (e: any) {
        setErro(e.message || "Erro ao carregar unidades");
      } finally {
        setLoadingUnidades(false);
      }
    };

    void carregarUnidades();
  }, [token, organizacao.id, unidadeId, unidadeSelecionadaId]);

  useEffect(() => {
    const carregar = async () => {
      if (!token || !unidadeSelecionadaId) {
        setMoradores([]);
        setVeiculos([]);
        setPets([]);
        setCobrancas([]);
        setCreditoUnidade(null);
        setAnexosCobrancas({});
        return;
      }
      try {
        setLoading(true);
        const [
          listaPessoas,
          listaVeiculos,
          listaPets,
          listaCobrancas,
          listaAnexos,
          creditos
        ] = await Promise.all([
          api.listarPessoas(token, organizacao.id),
          api.listarVeiculos(token, organizacao.id, {
            unidadeId: unidadeSelecionadaId
          }),
          api.listarPets(token, organizacao.id, {
            unidadeId: unidadeSelecionadaId
          }),
          api.listarCobrancasUnidade(
            token,
            unidadeSelecionadaId,
            competenciaFiltro || undefined
          ),
          api.listarAnexos(token, organizacao.id, "cobranca_unidade"),
          api.listarCreditosUnidade(token, unidadeSelecionadaId)
        ]);

        const moradoresUnidade = listaPessoas.filter(
          (p) =>
            p.unidadeOrganizacionalId === unidadeSelecionadaId &&
            p.papel === "morador"
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
  }, [token, organizacao.id, unidadeSelecionadaId, competenciaFiltro]);

  const carregarPagamentos = useCallback(async () => {
    if (!token || !unidadeSelecionadaId) return;
    if (cobrancas.length === 0) {
      setPagamentos([]);
      return;
    }
    setLoadingPagamentos(true);
    try {
      const cobrancasOrdenadas = [...cobrancas]
        .sort((a, b) => (b.vencimento ?? "").localeCompare(a.vencimento ?? ""))
        .slice(0, 12);
      const respostas = await Promise.all(
        cobrancasOrdenadas.map(async (c) => {
          try {
            return await api.listarPagamentosCobranca(token, c.id);
          } catch {
            return [];
          }
        })
      );
      const lista = cobrancasOrdenadas.flatMap((c, index) =>
        (respostas[index] ?? []).map((p) => ({ pagamento: p, cobranca: c }))
      );
      lista.sort((a, b) =>
        (b.pagamento.dataPagamento ?? "").localeCompare(a.pagamento.dataPagamento ?? "")
      );
      setPagamentos(lista);
    } finally {
      setLoadingPagamentos(false);
    }
  }, [token, unidadeSelecionadaId, cobrancas]);

  useEffect(() => {
    void carregarPagamentos();
  }, [carregarPagamentos]);

  const unidade = useMemo(
    () => unidades.find((item) => item.id === unidadeSelecionadaId) ?? null,
    [unidades, unidadeSelecionadaId]
  );

  if (erro) {
    return <p className="error">{erro}</p>;
  }

  if (!unidadeSelecionadaId) {
    return (
      <div className="finance-layout finance-layout--single">
        <section className="finance-table-card unit-card">
          <div className="finance-table-header">
            <h3>Minha unidade</h3>
          </div>
          <p className="unit-muted">
            Seu usuario nao esta vinculado a uma unidade. Escolha abaixo para
            visualizar os dados ou solicite o vinculo a administracao.
          </p>
          {loadingUnidades ? (
            <p className="unit-muted">Carregando unidades...</p>
          ) : unidades.length > 0 ? (
            <label className="unit-select">
              Unidade
              <select
                value={unidadeSelecionadaId ?? ""}
                onChange={(e) => setUnidadeSelecionadaId(e.target.value || null)}
              >
                <option value="">Selecione</option>
                {unidades.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome} ({item.codigoInterno})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="unit-muted">Nenhuma unidade cadastrada.</p>
          )}
        </section>
      </div>
    );
  }

  if (!unidade) {
    return <p>{loading ? "Carregando unidade..." : "Unidade nao encontrada."}</p>;
  }

  const termoUnidade = unidade.codigoInterno || unidade.nome || "";
  const abrirFaturas = () => {
    if (!onAbrirFinanceiro) return;
    onAbrirFinanceiro("faturas", {
      tipo: "faturas",
      termo: termoUnidade
    });
  };
  const abrirInadimplencia = () => {
    if (!onAbrirFinanceiro) return;
    onAbrirFinanceiro("inadimplentes", {
      tipo: "inadimplencia",
      termo: termoUnidade
    });
  };

  const pendentes = cobrancas.filter(
    (c) => (c.status ?? "").toUpperCase() !== "PAGA"
  );
  const vencidas = cobrancas.filter((c) => {
    const status = (c.status ?? "").toUpperCase();
    if (status === "PAGA") return false;
    if (status === "ATRASADA" || status === "VENCIDA") return true;
    if (c.diasAtraso && c.diasAtraso > 0) return true;
    if (!c.vencimento) return false;
    return c.vencimento < new Date().toISOString().slice(0, 10);
  });
  const totalPago = cobrancas
    .filter((c) => (c.status ?? "").toUpperCase() === "PAGA")
    .reduce((acc, item) => acc + (item.valorAtualizado ?? item.valor ?? 0), 0);
  const totalAberto = cobrancas
    .filter((c) => (c.status ?? "").toUpperCase() !== "PAGA")
    .reduce((acc, item) => acc + (item.valorAtualizado ?? item.valor ?? 0), 0);
  const competencias = Array.from(
    new Set(cobrancas.map((c) => c.competencia).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));
  const statusDisponiveis = Array.from(
    new Set(cobrancas.map((c) => (c.status ?? "ABERTA").toUpperCase()))
  ).sort((a, b) => a.localeCompare(b));
  const cobrancasFiltradas = cobrancas
    .slice()
    .sort((a, b) => (b.vencimento ?? "").localeCompare(a.vencimento ?? ""))
    .filter((item) => {
      if (statusFiltro !== "todas") {
        if ((item.status ?? "").toUpperCase() !== statusFiltro) return false;
      }
      if (busca.trim()) {
        const alvo = normalizeText(busca);
        const descricao = normalizeText(item.descricao);
        const competencia = normalizeText(item.competencia);
        if (!descricao.includes(alvo) && !competencia.includes(alvo)) {
          return false;
        }
      }
      return true;
    });
  const movimentosCredito = (creditoUnidade?.movimentos ?? [])
    .slice()
    .sort((a, b) => (b.dataMovimento ?? "").localeCompare(a.dataMovimento ?? ""))
    .slice(0, 8);

  return (
    <div className="finance-layout">
      <div className="finance-main-column">
        <section className="finance-table-card">
          <div className="finance-table-header">
            <div>
              <p className="finance-form-sub">Condominio {organizacao.nome}</p>
              <h3>{unidade.nome}</h3>
              <p className="unit-muted">
                {unidade.tipo} • Codigo {unidade.codigoInterno}
              </p>
            </div>
            <div className="unit-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setUnidadeSelecionadaId(null)}
              >
                Trocar unidade
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={abrirFaturas}
                disabled={!onAbrirFinanceiro}
              >
                2a via / Faturas
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={abrirInadimplencia}
                disabled={!onAbrirFinanceiro}
              >
                Inadimplencia
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => onAbrirChamados?.()}
                disabled={!onAbrirChamados}
              >
                Falar com administracao
              </button>
            </div>
          </div>
          <div className="unit-summary-grid">
            <div className="finance-card">
              <span className="finance-summary-label">Status</span>
              <div className="finance-summary-value">{unidade.status}</div>
            </div>
            <div className="finance-card">
              <span className="finance-summary-label">Moradores</span>
              <div className="finance-summary-value">{moradores.length}</div>
              <div className="finance-summary-sub">Vinculos ativos</div>
            </div>
            <div className="finance-card">
              <span className="finance-summary-label">Pendencias</span>
              <div className="finance-summary-value">{pendentes.length}</div>
              <div className="finance-summary-sub">Cobrancas em aberto</div>
            </div>
            <div className="finance-card">
              <span className="finance-summary-label">Em atraso</span>
              <div className="finance-summary-value">{vencidas.length}</div>
              <div className="finance-summary-sub">Cobrancas vencidas</div>
            </div>
            <div className="finance-card">
              <span className="finance-summary-label">Total em aberto</span>
              <div className="finance-summary-value">{formatarMoeda(totalAberto)}</div>
            </div>
            <div className="finance-card">
              <span className="finance-summary-label">Total pago</span>
              <div className="finance-summary-value">{formatarMoeda(totalPago)}</div>
            </div>
            <div className="finance-card">
              <span className="finance-summary-label">Credito disponivel</span>
              <div className="finance-summary-value">
                {formatarMoeda(creditoUnidade?.saldo ?? 0)}
              </div>
            </div>
          </div>
          {vencidas.length > 0 && (
            <div className="unit-alert">
              <div>
                <strong>Você tem {vencidas.length} cobrança(s) vencida(s).</strong>
                <p className="unit-muted">
                  Total em atraso: {formatarMoeda(totalAberto)}
                </p>
              </div>
              <button type="button" className="action-primary" onClick={abrirInadimplencia}>
                Ir para inadimplência
              </button>
            </div>
          )}
        </section>

      <section className="finance-table-card unit-card">
        <div className="finance-table-header">
          <div className="finance-header-badges">
            <h3>Moradores vinculados</h3>
            <span className="badge">{moradores.length}</span>
          </div>
        </div>
        <div className="unit-list">
          {moradores.map((m) => (
            <div key={m.id} className="unit-list-item">
              <span className="people-name">{m.nome}</span>
              <span className="people-meta">{m.telefone ?? "-"}</span>
            </div>
          ))}
          {moradores.length === 0 && (
            <p className="unit-muted">Nenhum morador vinculado.</p>
          )}
        </div>
      </section>

      <section className="finance-table-card unit-card">
        <div className="finance-table-header">
          <div className="finance-header-badges">
            <h3>Veiculos</h3>
            <span className="badge">{veiculos.length}</span>
          </div>
        </div>
        <div className="unit-table-scroll">
          <table className="table finance-table table--fixed unit-vehicles-table">
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
        </div>
      </section>

      <section className="finance-table-card unit-card">
        <div className="finance-table-header">
          <div className="finance-header-badges">
            <h3>Pets</h3>
            <span className="badge">{pets.length}</span>
          </div>
        </div>
        <div className="unit-table-scroll">
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
        </div>
      </section>
      </div>

      <div className="finance-side-column">
      <section className="finance-table-card unit-card">
        <div className="finance-table-header">
          <div>
            <h3>Extrato completo</h3>
            <p className="finance-form-sub">
              {cobrancasFiltradas.length} cobranca(s) encontradas.
            </p>
          </div>
          <div className="finance-card-actions">
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
            <label>
              Status
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
              >
                <option value="todas">Todos</option>
                {statusDisponiveis.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="text"
              placeholder="Buscar descricao"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        <div className="unit-table-scroll">
          <table className="table finance-table">
            <thead>
              <tr>
                <th>Competencia</th>
                <th>Descricao</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th className="finance-value-header">Valor</th>
                <th className="finance-value-header">Atualizado</th>
                <th>Pago em</th>
                <th>Comprovante</th>
              </tr>
            </thead>
            <tbody>
              {cobrancasFiltradas.map((c) => {
                const anexos = anexosCobrancas[c.id] ?? [];
                const valorAtualizado = c.valorAtualizado ?? c.valor;
                return (
                  <tr key={c.id}>
                    <td>{c.competencia}</td>
                    <td>{c.descricao}</td>
                    <td>{formatarData(c.vencimento)}</td>
                    <td>{c.status}</td>
                    <td className="finance-value-cell">{formatarMoeda(c.valor)}</td>
                    <td className="finance-value-cell">
                      {formatarMoeda(valorAtualizado)}
                    </td>
                    <td>{formatarData(c.pagoEm)}</td>
                    <td>
                      {anexos.length > 0 ? (
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={async () => {
                            const blob = await api.baixarAnexo(
                              token!,
                              anexos[0].id
                            );
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
              {cobrancasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center" }}>
                    Nenhuma cobranca encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="finance-table-card unit-card">
        <div className="finance-table-header">
          <div>
            <h3>Historico de pagamentos</h3>
            <p className="finance-form-sub">Ultimos pagamentos da unidade.</p>
          </div>
          <div className="finance-card-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => carregarPagamentos()}
              disabled={loadingPagamentos}
            >
              {loadingPagamentos ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>
        <div className="unit-table-scroll">
          <table className="table finance-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descricao</th>
                <th className="finance-value-header">Valor pago</th>
                <th>Observacao</th>
                <th>Comprovante</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((item) => (
                <tr key={item.pagamento.id}>
                  <td>{formatarData(item.pagamento.dataPagamento)}</td>
                  <td>{item.cobranca?.descricao ?? "Pagamento de cobranca"}</td>
                  <td className="finance-value-cell">
                    {formatarMoeda(item.pagamento.valorPago)}
                  </td>
                  <td>{item.pagamento.observacao ?? "-"}</td>
                  <td>
                    {item.pagamento.comprovanteAnexoId ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={async () => {
                          const blob = await api.baixarAnexo(
                            token!,
                            item.pagamento.comprovanteAnexoId!
                          );
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
              ))}
              {pagamentos.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    Nenhum pagamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="finance-table-card unit-card">
        <div className="finance-table-header">
          <div>
            <h3>Movimentos de credito</h3>
            <p className="finance-form-sub">
              Saldo atual: {formatarMoeda(creditoUnidade?.saldo ?? 0)}
            </p>
          </div>
        </div>
        <div className="unit-table-scroll">
          <table className="table finance-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th className="finance-value-header">Valor</th>
                <th>Observacao</th>
              </tr>
            </thead>
            <tbody>
              {movimentosCredito.map((mov) => (
                <tr key={mov.id}>
                  <td>{formatarData(mov.dataMovimento)}</td>
                  <td>{mov.tipo}</td>
                  <td className="finance-value-cell">{formatarMoeda(mov.valor)}</td>
                  <td>{mov.observacao ?? "-"}</td>
                </tr>
              ))}
              {movimentosCredito.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center" }}>
                    Nenhum movimento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
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
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [ocultarEncerrados, setOcultarEncerrados] = useState(true);
  const [relatorioDe, setRelatorioDe] = useState("");
  const [relatorioAte, setRelatorioAte] = useState("");
  const [relatorioStatus, setRelatorioStatus] = useState("");
  const [relatorioFormato, setRelatorioFormato] = useState<"pdf" | "csv">("pdf");
  const [dossieTexto, setDossieTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pastaRef = useRef<HTMLDivElement | null>(null);

  const canCriar = IGNORAR_PERFIS || can(session, organizacao.id, "operacao.create");
  const canGerenciar =
    IGNORAR_PERFIS || can(session, organizacao.id, "operacao.manage");
  const canAnexos = IGNORAR_PERFIS || can(session, organizacao.id, "anexos.write");

  const pessoasResponsaveis = useMemo(
    () =>
      pessoas.filter((p) =>
        ["funcionario", "colaborador", "administrador"].includes(p.papel ?? "")
      ),
    [pessoas]
  );

  const pessoaNomeMap = useMemo(() => {
    return new Map(pessoas.map((p) => [p.id, p.nome]));
  }, [pessoas]);

  const categoriasDisponiveis = useMemo(() => {
    return Array.from(
      new Set(chamados.map((c) => c.categoria).filter(Boolean))
    ).sort();
  }, [chamados]);

  const statusDisponiveis = useMemo(() => {
    return Array.from(new Set(chamados.map((c) => c.status).filter(Boolean)));
  }, [chamados]);

  const prioridadesDisponiveis = useMemo(() => {
    return Array.from(
      new Set(chamados.map((c) => c.prioridade).filter(Boolean))
    );
  }, [chamados]);

  const normalizarTexto = useCallback((texto: string) => {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }, []);

  const chamadosOrdenados = useMemo(() => {
    const statusOrdem: Record<string, number> = {
      ABERTO: 0,
      EM_ATENDIMENTO: 1,
      AGUARDANDO: 2,
      RESOLVIDO: 3,
      ENCERRADO: 4
    };
    const prioridadeOrdem: Record<string, number> = {
      URGENTE: 0,
      ALTA: 1,
      MEDIA: 2,
      BAIXA: 3
    };
    return [...chamados].sort((a, b) => {
      const statusDiff =
        (statusOrdem[a.status] ?? 9) - (statusOrdem[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      const prioDiff =
        (prioridadeOrdem[a.prioridade ?? ""] ?? 9) -
        (prioridadeOrdem[b.prioridade ?? ""] ?? 9);
      if (prioDiff !== 0) return prioDiff;
      const dataA = a.dataAbertura ? new Date(a.dataAbertura).getTime() : 0;
      const dataB = b.dataAbertura ? new Date(b.dataAbertura).getTime() : 0;
      return dataB - dataA;
    });
  }, [chamados]);

  const chamadosFiltrados = useMemo(() => {
    const buscaNormalizada = normalizarTexto(busca.trim());
    return chamadosOrdenados.filter((c) => {
      if (ocultarEncerrados && c.status === "ENCERRADO") {
        return false;
      }
      if (filtroStatus && c.status !== filtroStatus) {
        return false;
      }
      if (filtroPrioridade && (c.prioridade ?? "") !== filtroPrioridade) {
        return false;
      }
      if (
        filtroCategoria &&
        normalizarTexto(c.categoria) !== normalizarTexto(filtroCategoria)
      ) {
        return false;
      }
      if (!buscaNormalizada) return true;
      const pessoaNome = pessoaNomeMap.get(c.pessoaSolicitanteId) ?? "";
      const alvo = [c.titulo, c.descricao, c.categoria, pessoaNome]
        .filter(Boolean)
        .join(" ");
      return normalizarTexto(alvo).includes(buscaNormalizada);
    });
  }, [
    busca,
    chamadosOrdenados,
    filtroCategoria,
    filtroPrioridade,
    filtroStatus,
    normalizarTexto,
    ocultarEncerrados,
    pessoaNomeMap
  ]);

  const resumoChamados = useMemo(() => {
    const total = chamados.length;
    const abertos = chamados.filter((c) => c.status === "ABERTO").length;
    const emAtendimento = chamados.filter(
      (c) => c.status === "EM_ATENDIMENTO"
    ).length;
    const aguardando = chamados.filter((c) => c.status === "AGUARDANDO").length;
    const resolvidos = chamados.filter((c) => c.status === "RESOLVIDO").length;
    const encerrados = chamados.filter((c) => c.status === "ENCERRADO").length;
    const urgentes = chamados.filter((c) => c.prioridade === "URGENTE").length;
    return {
      total,
      abertos,
      emAtendimento,
      aguardando,
      resolvidos,
      encerrados,
      urgentes
    };
  }, [chamados]);

  const pessoaSelecionada = useMemo(() => {
    if (!selecionado) return null;
    return pessoas.find((p) => p.id === selecionado.pessoaSolicitanteId) ?? null;
  }, [selecionado, pessoas]);

  const chamadosMorador = useMemo(() => {
    if (!selecionado) return [];
    return chamados.filter(
      (c) => c.pessoaSolicitanteId === selecionado.pessoaSolicitanteId
    );
  }, [chamados, selecionado]);

  const resumoMorador = useMemo(() => {
    const total = chamadosMorador.length;
    const abertos = chamadosMorador.filter(
      (c) => !["RESOLVIDO", "ENCERRADO"].includes(c.status)
    ).length;
    const atrasados = chamadosMorador.filter(
      (c) => c.status === "AGUARDANDO"
    ).length;
    const urgentes = chamadosMorador.filter(
      (c) => c.prioridade === "URGENTE"
    ).length;
    return { total, abertos, atrasados, urgentes };
  }, [chamadosMorador]);

  const moradorTags = useMemo(() => {
    if (!selecionado) return [];
    const tags = new Set<string>();
    chamadosMorador.forEach((c) => {
      if (c.categoria) {
        tags.add(c.categoria.toUpperCase());
      }
      if (c.prioridade === "URGENTE") {
        tags.add("ATENCAO");
      }
    });
    if (chamadosMorador.some((c) => c.status === "AGUARDANDO")) {
      tags.add("PENDENCIA");
    }
    return Array.from(tags).slice(0, 6);
  }, [chamadosMorador, selecionado]);

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

  useEffect(() => {
    if (!selecionado) {
      setDossieTexto("");
      return;
    }
    const key = `dossie-morador-${selecionado.pessoaSolicitanteId}`;
    setDossieTexto(localStorage.getItem(key) ?? "");
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

  const atualizarChamadoDireto = async (
    chamadoId: string,
    payload: {
      status?: string;
      prioridade?: string;
      responsavelPessoaId?: string | null;
    }
  ) => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const atualizado = await api.atualizarChamado(token, chamadoId, {
        ...payload,
        observacao: "Atualizacao via painel"
      });
      setChamados((prev) =>
        prev.map((c) => (c.id === atualizado.id ? atualizado : c))
      );
      if (selecionado?.id === atualizado.id) {
        setSelecionado(atualizado);
        await carregarHistorico(atualizado.id);
      }
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar chamado");
    } finally {
      setLoading(false);
    }
  };

  const baixarArquivo = (blob: Blob, nome: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const gerarRelatorio = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const blob = await api.relatorioChamados(token, organizacao.id, {
        de: relatorioDe || undefined,
        ate: relatorioAte || undefined,
        status: relatorioStatus || undefined,
        formato: relatorioFormato
      });
      const data = new Date().toISOString().slice(0, 10);
      const nomeBase = (organizacao.nome || "condominio")
        .toLowerCase()
        .replace(/\s+/g, "-");
      baixarArquivo(blob, `chamados-${nomeBase}-${data}.${relatorioFormato}`);
    } catch (e: any) {
      setErro(e.message || "Erro ao gerar relatorio");
    } finally {
      setLoading(false);
    }
  };

  const gerarRelatorioMorador = () => {
    if (!selecionado) return;
    const linhas = [
      "titulo;categoria;status;prioridade;abertura;fechamento"
    ];
    chamadosMorador.forEach((c) => {
      linhas.push(
        [
          c.titulo,
          c.categoria,
          c.status,
          c.prioridade ?? "",
          c.dataAbertura ?? "",
          c.dataFechamento ?? ""
        ]
          .map((item) => `"${String(item ?? "").replace(/\"/g, '\"\"')}"`)
          .join(";")
      );
    });
    const blob = new Blob([linhas.join("\n")], {
      type: "text/csv;charset=utf-8"
    });
    const nome = (pessoaSelecionada?.nome || "morador")
      .toLowerCase()
      .replace(/\s+/g, "-");
    baixarArquivo(blob, `morador-${nome}-chamados.csv`);
  };

  const salvarDossie = () => {
    if (!selecionado) return;
    const key = `dossie-morador-${selecionado.pessoaSolicitanteId}`;
    localStorage.setItem(key, dossieTexto.trim());
  };

  const formatarStatus = (status: string) => {
    return status.replace(/_/g, " ");
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "ABERTO":
        return "badge-status--aberto";
      case "EM_ATENDIMENTO":
        return "badge-status--atendimento";
      case "AGUARDANDO":
        return "badge-status--aguardando";
      case "RESOLVIDO":
        return "badge-status--resolvido";
      case "ENCERRADO":
        return "badge-status--encerrado";
      default:
        return "badge-status--alerta";
    }
  };

  const prioridadePillClass = (valor?: string | null) => {
    switch (valor) {
      case "URGENTE":
        return "role-pill--danger";
      case "ALTA":
        return "role-pill--warning";
      case "MEDIA":
        return "role-pill--info";
      case "BAIXA":
        return "role-pill--neutral";
      default:
        return "role-pill--neutral";
    }
  };

  const abrirPastaMorador = () => {
    pastaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="finance-layout">
      <div className="finance-side-column">
        <section className="finance-form-card">
          <h3>Novo chamado</h3>
          {canCriar ? (
            <form onSubmit={criarChamado} className="form">
              <label>
                Categoria
                <input
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  list="chamado-categorias"
                />
                <datalist id="chamado-categorias">
                  {categoriasDisponiveis.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </label>
              <label>
                Titulo
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </label>
              <label>
                Descricao
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </label>
              <label>
                Prioridade
                <select
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value)}
                >
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

        <section className="finance-form-card">
          <h3>Filtros</h3>
          <div className="chamados-filters">
            <label className="span-2">
              Buscar
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Titulo, descricao ou morador"
              />
            </label>
            <label>
              Status
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                <option value="">Todos</option>
                {statusDisponiveis.map((status) => (
                  <option key={status} value={status}>
                    {formatarStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prioridade
              <select
                value={filtroPrioridade}
                onChange={(e) => setFiltroPrioridade(e.target.value)}
              >
                <option value="">Todas</option>
                {prioridadesDisponiveis.map((item) => (
                  <option key={item ?? ""} value={item ?? ""}>
                    {item ?? "-"}
                  </option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Categoria
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
              >
                <option value="">Todas</option>
                {categoriasDisponiveis.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
            <label className="span-2 checkbox-row">
              <input
                type="checkbox"
                checked={ocultarEncerrados}
                onChange={(e) => setOcultarEncerrados(e.target.checked)}
              />
              Ocultar encerrados
            </label>
            <div className="chamados-actions-row span-2">
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setBusca("");
                  setFiltroStatus("");
                  setFiltroPrioridade("");
                  setFiltroCategoria("");
                }}
              >
                Limpar filtros
              </button>
              <button type="button" onClick={carregar} disabled={loading}>
                Atualizar lista
              </button>
            </div>
          </div>
        </section>

        <section className="finance-form-card">
          <h3>Relatorios</h3>
          <div className="chamados-filters">
            <label>
              De
              <input type="date" value={relatorioDe} onChange={(e) => setRelatorioDe(e.target.value)} />
            </label>
            <label>
              Ate
              <input type="date" value={relatorioAte} onChange={(e) => setRelatorioAte(e.target.value)} />
            </label>
            <label>
              Status
              <select
                value={relatorioStatus}
                onChange={(e) => setRelatorioStatus(e.target.value)}
              >
                <option value="">Todos</option>
                {statusDisponiveis.map((status) => (
                  <option key={status} value={status}>
                    {formatarStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Formato
              <select
                value={relatorioFormato}
                onChange={(e) =>
                  setRelatorioFormato(e.target.value as "pdf" | "csv")
                }
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <div className="chamados-actions-row span-2">
              <button type="button" onClick={gerarRelatorio} disabled={loading}>
                Gerar relatorio
              </button>
            </div>
          </div>
        </section>

        <section className="finance-form-card">
          <h3>Resumo</h3>
          <div className="chamados-summary-grid">
            <div className="finance-card">
              <strong>Total</strong>
              <p>{resumoChamados.total}</p>
            </div>
            <div className="finance-card">
              <strong>Abertos</strong>
              <p>{resumoChamados.abertos}</p>
            </div>
            <div className="finance-card">
              <strong>Em atendimento</strong>
              <p>{resumoChamados.emAtendimento}</p>
            </div>
            <div className="finance-card">
              <strong>Aguardando</strong>
              <p>{resumoChamados.aguardando}</p>
            </div>
            <div className="finance-card">
              <strong>Resolvidos</strong>
              <p>{resumoChamados.resolvidos}</p>
            </div>
            <div className="finance-card">
              <strong>Encerrados</strong>
              <p>{resumoChamados.encerrados}</p>
            </div>
            <div className="finance-card">
              <strong>Urgentes</strong>
              <p>{resumoChamados.urgentes}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="finance-main-column">
        <section className="finance-table-card">
          <div className="finance-table-header">
            <div>
              <h3>Chamados</h3>
              <p className="finance-form-sub">
                {chamadosFiltrados.length} de {chamados.length} chamados
              </p>
            </div>
            <button type="button" onClick={carregar} disabled={loading}>
              Atualizar
            </button>
          </div>
          <div className="chamados-scroll finance-table-scroll finance-table-scroll--wide">
            <table className="table finance-table chamados-table table--chamados">
              <thead>
                <tr>
                  <th>Titulo</th>
                  <th>Status</th>
                  <th>Prioridade</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {chamadosFiltrados.map((c) => (
                  <tr
                    key={c.id}
                    className={selecionado?.id === c.id ? "chamados-row-active" : ""}
                    onClick={() => setSelecionado(c)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <div className="chamado-title">{c.titulo}</div>
                      <div className="chamado-meta">
                        {c.categoria} • {pessoaNomeMap.get(c.pessoaSolicitanteId) ?? "Morador"}
                        {c.dataAbertura
                          ? ` • ${new Date(c.dataAbertura).toLocaleDateString("pt-BR")}`
                          : ""}
                      </div>
                    </td>
                    <td>
                      <span className={`badge-status ${statusBadgeClass(c.status)}`}>
                        {formatarStatus(c.status)}
                      </span>
                    </td>
                    <td>
                      <span className={`role-pill ${prioridadePillClass(c.prioridade)}`}>
                        {c.prioridade ?? "-"}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="action-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelecionado(c);
                          }}
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          className="action-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            const novoStatus =
                              c.status === "ENCERRADO" ? "ABERTO" : "ENCERRADO";
                            void atualizarChamadoDireto(c.id, { status: novoStatus });
                          }}
                        >
                          {c.status === "ENCERRADO" ? "Reabrir" : "Encerrar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {chamadosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center" }}>
                      Nenhum chamado encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="finance-form-card">
          <div className="finance-table-header">
            <h3>Detalhes</h3>
            {selecionado && (
              <button type="button" className="button-secondary" onClick={abrirPastaMorador}>
                Ver pasta do morador
              </button>
            )}
          </div>
          {!selecionado && <p className="finance-form-sub">Selecione um chamado.</p>}
          {selecionado && (
            <>
              <div className="finance-card-grid" style={{ marginTop: 8 }}>
                <div className="finance-card">
                  <strong>Status atual</strong>
                  <p>{formatarStatus(selecionado.status)}</p>
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
                <div className="finance-card">
                  <strong>Solicitante</strong>
                  <p>{pessoaSelecionada?.nome ?? "Morador"}</p>
                </div>
              </div>

              {canGerenciar && (
                <div className="form" style={{ marginTop: 12 }}>
                  <label>
                    Status
                    <select
                      value={selecionado.status}
                      onChange={(e) =>
                        atualizarChamadoDireto(selecionado.id, { status: e.target.value })
                      }
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
                        void atualizarChamadoDireto(selecionado.id, {
                          responsavelPessoaId: novo || null
                        });
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

        <section className="finance-form-card" ref={pastaRef}>
          <div className="finance-table-header">
            <h3>Pasta do morador</h3>
            <button
              type="button"
              className="button-secondary"
              onClick={gerarRelatorioMorador}
              disabled={!selecionado}
            >
              Relatorio do morador
            </button>
          </div>
          {!selecionado && (
            <p className="finance-form-sub">
              Selecione um chamado para visualizar a pasta do morador.
            </p>
          )}
          {selecionado && (
            <>
              <div className="chamados-pasta-header">
                <div>
                  <strong>{pessoaSelecionada?.nome ?? "Morador"}</strong>
                  <p className="finance-form-sub">
                    Unidade vinculada: {unidadeId ?? "-"}
                  </p>
                </div>
                <div className="chamados-tags">
                  {moradorTags.length === 0 && (
                    <span className="org-tag">Sem tags</span>
                  )}
                  {moradorTags.map((tag) => (
                    <span key={tag} className="org-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="chamados-summary-grid">
                <div className="finance-card">
                  <strong>Chamados do morador</strong>
                  <p>{resumoMorador.total}</p>
                </div>
                <div className="finance-card">
                  <strong>Pendencias ativas</strong>
                  <p>{resumoMorador.abertos}</p>
                </div>
                <div className="finance-card">
                  <strong>Aguardando retorno</strong>
                  <p>{resumoMorador.atrasados}</p>
                </div>
                <div className="finance-card">
                  <strong>Urgentes</strong>
                  <p>{resumoMorador.urgentes}</p>
                </div>
              </div>

              <div className="chamados-pasta-grid">
                <div className="finance-card">
                  <strong>Multas e advertencias</strong>
                  <p>R$ 0,00</p>
                  <span className="finance-form-sub">
                    Sem registro no modulo atual.
                  </span>
                </div>
                <div className="finance-card">
                  <strong>Reclamacoes recentes</strong>
                  {chamadosMorador.length === 0 && (
                    <p className="finance-form-sub">Nenhuma reclamacao.</p>
                  )}
                  {chamadosMorador.slice(0, 3).map((c) => (
                    <div key={c.id} className="chamados-reclamacao">
                      <span>{c.titulo}</span>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setSelecionado(c)}
                      >
                        Ver
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="finance-form-card" style={{ marginTop: 16 }}>
                <h4>Observacoes do morador</h4>
                <textarea
                  value={dossieTexto}
                  onChange={(e) => setDossieTexto(e.target.value)}
                  placeholder="Registre contatos, combinados e ocorrencias..."
                />
                <div className="chamados-actions-row">
                  <button type="button" className="button-secondary" onClick={salvarDossie}>
                    Salvar observacoes
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
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

  const formatarDataHoraBrasil = (valor: string) => {
    if (!valor) return "-";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "-";
    const hora = data.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
    const dia = data.toLocaleDateString("pt-BR");
    return `${hora} ${dia}`;
  };

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
            <span className="inline-edit-hint">
              Padrao BR: {formatarDataHoraBrasil(dataInicio)}
            </span>
          </label>
          <label>
            Data fim
            <input
              type="datetime-local"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
            <span className="inline-edit-hint">
              Padrao BR: {formatarDataHoraBrasil(dataFim)}
            </span>
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
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [view, setView] = useState<AppView>("dashboard");
  const [financeiroAba, setFinanceiroAba] =
    useState<FinanceiroTab>("mapaFinanceiro");
  const [financeiroFiltro, setFinanceiroFiltro] =
    useState<MinhaUnidadeFinanceiroFiltro | null>(null);
  const [sidebarFinanceiroOpen, setSidebarFinanceiroOpen] = useState(false);
  const [sidebarFinanceiroGroupsOpen, setSidebarFinanceiroGroupsOpen] = useState<
    Record<string, boolean>
  >({
    base: true,
    operacao: true,
    cobranca: true,
    planejamento: false,
    relatorios: false
  });
  const [configuracoesAba, setConfiguracoesAba] =
    useState<ConfiguracoesTab>("cadastros-base");
  const [sidebarConfiguracoesOpen, setSidebarConfiguracoesOpen] = useState(false);
  const [sidebarConfiguracoesGroupsOpen, setSidebarConfiguracoesGroupsOpen] =
    useState<Record<string, boolean>>({
      cadastros: true,
      estrutura: true,
      financeiro: true
    });
  const contentRef = useRef<HTMLElement | null>(null);
  const [gerandoDemo, setGerandoDemo] = useState(false);
  const [mensagemDemo, setMensagemDemo] = useState<string | null>(null);

  const financeiroGrupoPorAba = useMemo(() => {
    const map = new Map<FinanceiroTab, string>();
    financeiroGrupos.forEach((grupo) => {
      grupo.itens.forEach((item) => map.set(item, grupo.id));
    });
    return map;
  }, []);

  const configuracoesGrupoPorAba = useMemo(() => {
    const map = new Map<ConfiguracoesTab, string>();
    configuracoesGrupos.forEach((grupo) => {
      grupo.itens.forEach((item) => map.set(item, grupo.id));
    });
    return map;
  }, []);

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
  const roleAtual = getActiveRole(session, orgId);
  const perfilLabel = getRoleLabel(roleAtual);
  const perfilSigla = getRoleShortCode(roleAtual);
  const permissoesAtivas = getActivePermissions(session, orgId);
  const resumoPermissoes = permissoesAtivas
    .slice(0, 3)
    .map((key) => permissionLabels[key]);

  const podeFinanceiro = IGNORAR_PERFIS || can(session, orgId, "financeiro.read");
  const podeFinanceiroEscrita =
    IGNORAR_PERFIS || can(session, orgId, "financeiro.write");
  const podeVerCadastros = IGNORAR_PERFIS || can(session, orgId, "cadastros.read");
  const podeEditarCadastros =
    IGNORAR_PERFIS || can(session, orgId, "cadastros.write");
  const podeOperacao = IGNORAR_PERFIS || can(session, orgId, "operacao.read");
  const podeRelatorios =
    IGNORAR_PERFIS ||
    can(session, orgId, "financeiro.read") ||
    can(session, orgId, "operacao.manage");
  const podeCriarOperacao =
    IGNORAR_PERFIS || can(session, orgId, "operacao.create");
  const podeCartaoPonto =
    IGNORAR_PERFIS || can(session, orgId, "operacao.manage");
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
    cartaoPonto: "operacao.manage",
    correspondencia: "operacao.read",
    comunicados: "operacao.read",
    documentos: "operacao.read",
    relatorios: "financeiro.read",
    minhaUnidade: "minha_unidade.read"
  };

  const canView = (target: AppView) => {
    if (IGNORAR_PERFIS) return true;
    if (target === "relatorios") {
      return podeRelatorios;
    }
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
  const ajudaPassos = autoAjudaPassos[view] ?? [];

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
    if (view === "financeiro" && !sidebarFinanceiroOpen) {
      setSidebarFinanceiroOpen(true);
    }
  }, [sidebarFinanceiroOpen, view]);

  useEffect(() => {
    if (view === "financeiro") {
      const grupoAtivo = financeiroGrupoPorAba.get(financeiroAba);
      if (grupoAtivo) {
        setSidebarFinanceiroGroupsOpen((prev) => ({
          ...prev,
          [grupoAtivo]: true
        }));
      }
    }
  }, [financeiroAba, financeiroGrupoPorAba, view]);

  useEffect(() => {
    if (view !== "configuracoes" && sidebarConfiguracoesOpen) {
      setSidebarConfiguracoesOpen(false);
    }
  }, [sidebarConfiguracoesOpen, view]);

  useEffect(() => {
    if (view === "configuracoes" && !sidebarConfiguracoesOpen) {
      setSidebarConfiguracoesOpen(true);
    }
  }, [sidebarConfiguracoesOpen, view]);

  useEffect(() => {
    if (view === "configuracoes") {
      const grupoAtivo = configuracoesGrupoPorAba.get(configuracoesAba);
      if (grupoAtivo) {
        setSidebarConfiguracoesGroupsOpen((prev) => ({
          ...prev,
          [grupoAtivo]: true
        }));
      }
    }
  }, [configuracoesAba, configuracoesGrupoPorAba, view]);

  useEffect(() => {
    setSidebarMobileOpen(false);
  }, [view]);

  const topBar = (
    <header className="app-header">
      <div className="app-header-left">
        <button
          type="button"
          className="app-header-menu-toggle"
          onClick={() => setSidebarMobileOpen((prev) => !prev)}
          aria-label="Alternar menu"
        >
          <Menu size={18} />
        </button>
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
            <span className="app-user-avatar">{perfilSigla}</span>
            <span className="app-user-name">{perfilLabel}</span>
          </summary>
          <div className="app-user-dropdown">
            <div className="app-user-profile-card">
              <strong>{perfilLabel}</strong>
              <span>
                {isPlatformAdmin
                  ? "Acesso completo da plataforma."
                  : organizacaoSelecionada
                    ? `Condominio: ${organizacaoSelecionada.nome}`
                    : "Selecione um condominio para aplicar permissoes."}
              </span>
              {resumoPermissoes.length > 0 && (
                <span className="app-user-profile-summary">
                  {resumoPermissoes.join(" • ")}
                </span>
              )}
            </div>
            <div className="app-user-permissions">
              {permissoesAtivas.map((permissao) => (
                <span key={permissao} className="app-user-permission-pill">
                  {permissionLabels[permissao]}
                </span>
              ))}
              {!permissoesAtivas.length && (
                <span className="app-user-permission-pill">
                  Sem permissao para esta organizacao
                </span>
              )}
            </div>
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
    icon: React.ReactNode
  ) => (
    <button
      key={target}
      type="button"
      onClick={() => {
        setViewIfAllowed(target);
        setSidebarMobileOpen(false);
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
        <div
          className={
            "sidebar-backdrop" + (sidebarMobileOpen ? " sidebar-backdrop--open" : "")
          }
          onClick={() => setSidebarMobileOpen(false)}
        />
        <aside
          className={
            "sidebar" +
            (sidebarCompact ? " sidebar--compact" : "") +
            (sidebarMobileOpen ? " sidebar--mobile-open" : "")
          }
        >
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
              {renderSidebarItem(
                "dashboard",
                "Resumo geral",
                <LayoutDashboard size={14} />
              )}
              {podeMinhaUnidade &&
                renderSidebarItem("minhaUnidade", "Minha unidade", <Home size={14} />)}
            </div>
            {podeOperacao && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Operacao diaria</p>
                {renderSidebarItem("chamados", "Chamados", <Wrench size={14} />)}
                {renderSidebarItem("reservas", "Reservas", <CalendarDays size={14} />)}
                {renderSidebarItem("portaria", "Portaria", <DoorOpen size={14} />)}
                {podeCartaoPonto &&
                  renderSidebarItem("cartaoPonto", "Cartao de ponto", <Clock3 size={14} />)}
                {renderSidebarItem(
                  "correspondencia",
                  "Correspondencia",
                  <Mail size={14} />
                )}
              </div>
            )}

            {podeVerCadastros && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Cadastros</p>
                {renderSidebarItem("pessoas", "Pessoas", <Users size={14} />)}
                {renderSidebarItem("unidades", "Unidades", <Building2 size={14} />)}
                {renderSidebarItem("veiculos", "Veiculos", <Car size={14} />)}
                {renderSidebarItem("pets", "Pets", <PawPrint size={14} />)}
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
                  <span className="sidebar-item-icon">
                    <Wallet size={14} />
                  </span>
                  <span className="sidebar-item-label">Financeiro</span>
                  <span className="sidebar-item-chevron">
                    {sidebarFinanceiroOpen ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                </button>
                <div
                  className={
                    "sidebar-submenu" +
                    (sidebarFinanceiroOpen ? " sidebar-submenu--open" : "")
                  }
                >
                  {financeiroGrupos.map((grupo) => (
                    <div key={grupo.id} className="sidebar-subgroup">
                      <button
                        type="button"
                        className="sidebar-subgroup-toggle"
                        onClick={() =>
                          setSidebarFinanceiroGroupsOpen((prev) => ({
                            ...prev,
                            [grupo.id]: !prev[grupo.id]
                          }))
                        }
                      >
                        <span>{grupo.label}</span>
                        {sidebarFinanceiroGroupsOpen[grupo.id] ? (
                          <ChevronDown size={12} />
                        ) : (
                          <ChevronRight size={12} />
                        )}
                      </button>
                      <div
                        className={
                          "sidebar-subgroup-items" +
                          (sidebarFinanceiroGroupsOpen[grupo.id]
                            ? " sidebar-subgroup-items--open"
                            : "")
                        }
                      >
                        {grupo.itens.map((itemId) => {
                          const item = menuFinanceiro.find((i) => i.id === itemId);
                          if (!item) return null;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={
                                "sidebar-subitem sidebar-subitem--nested" +
                                (view === "financeiro" && financeiroAba === item.id
                                  ? " sidebar-subitem--active"
                                  : "")
                              }
                              onClick={() => {
                                setViewIfAllowed("financeiro");
                                setFinanceiroAba(item.id);
                                setSidebarFinanceiroOpen(true);
                                setSidebarMobileOpen(false);
                              }}
                              title={item.label}
                            >
                              <span className="sidebar-subitem-icon">
                                {financeiroSiglas[item.id]}
                              </span>
                              <span className="sidebar-subitem-label">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {podeOperacao && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Comunicacao</p>
                <span className="sidebar-section-subtitle">avisos e documentos</span>
                {renderSidebarItem("comunicados", "Comunicados", <Megaphone size={14} />)}
                {renderSidebarItem("documentos", "Documentos", <FolderOpen size={14} />)}
              </div>
            )}

            {podeRelatorios && (
              <div className="sidebar-section">
                <p className="sidebar-section-title">Relatorios</p>
                {renderSidebarItem("relatorios", "Relatorios", <BarChart3 size={14} />)}
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
                  <span className="sidebar-item-icon">
                    <Settings size={14} />
                  </span>
                  <span className="sidebar-item-label">Configuracoes</span>
                  <span className="sidebar-item-chevron">
                    {sidebarConfiguracoesOpen ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                </button>
                <div
                  className={
                    "sidebar-submenu" +
                    (sidebarConfiguracoesOpen ? " sidebar-submenu--open" : "")
                  }
                >
                  {configuracoesGrupos.map((grupo) => (
                    <div key={grupo.id} className="sidebar-subgroup">
                      <button
                        type="button"
                        className="sidebar-subgroup-toggle"
                        onClick={() =>
                          setSidebarConfiguracoesGroupsOpen((prev) => ({
                            ...prev,
                            [grupo.id]: !prev[grupo.id]
                          }))
                        }
                      >
                        <span>{grupo.label}</span>
                        {sidebarConfiguracoesGroupsOpen[grupo.id] ? (
                          <ChevronDown size={12} />
                        ) : (
                          <ChevronRight size={12} />
                        )}
                      </button>
                      <div
                        className={
                          "sidebar-subgroup-items" +
                          (sidebarConfiguracoesGroupsOpen[grupo.id]
                            ? " sidebar-subgroup-items--open"
                            : "")
                        }
                      >
                        {grupo.itens.map((itemId) => {
                          const item = menuConfiguracoes.find((i) => i.id === itemId);
                          if (!item) return null;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={
                                "sidebar-subitem sidebar-subitem--nested" +
                                (view === "configuracoes" && configuracoesAba === item.id
                                  ? " sidebar-subitem--active"
                                  : "")
                              }
                              onClick={() => {
                                setViewIfAllowed("configuracoes");
                                setConfiguracoesAba(item.id);
                                setSidebarConfiguracoesOpen(true);
                                setSidebarMobileOpen(false);
                              }}
                              title={item.label}
                            >
                              <span className="sidebar-subitem-icon">
                                {configuracoesSiglas[item.id]}
                              </span>
                              <span className="sidebar-subitem-label">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
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

          {viewPermitido && ajudaPassos.length > 0 && (
            <details className="quick-help-card">
              <summary>Autoajuda desta tela</summary>
              <ol className="quick-help-list">
                {ajudaPassos.map((item, index) => (
                  <li key={`${view}-ajuda-${index}`}>{item}</li>
                ))}
              </ol>
            </details>
          )}

          {!viewPermitido && (
            <NoAccessPage mensagem="Acesso restrito." />
          )}

          {viewPermitido && view === "dashboard" && (
            <Dashboard
              organizacao={organizacaoSelecionada}
              mostrarFinanceiro={podeFinanceiro}
              onAbrirDestino={(destino, abaFinanceiro) => {
                setView(destino);
                if (destino === "financeiro" && abaFinanceiro) {
                  setFinanceiroAba(abaFinanceiro);
                  setSidebarFinanceiroOpen(true);
                }
                setSidebarMobileOpen(false);
              }}
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
              filtroInadimplenciaInicial={
                financeiroFiltro?.tipo === "inadimplencia"
                  ? financeiroFiltro.termo
                  : undefined
              }
              filtroFaturasInicial={
                financeiroFiltro?.tipo === "faturas"
                  ? financeiroFiltro.termo
                  : undefined
              }
              onFiltroAplicado={() => setFinanceiroFiltro(null)}
            />
          )}

          {viewPermitido && view === "minhaUnidade" && (
            <MinhaUnidadeView
              organizacao={organizacaoSelecionada}
              unidadeId={membershipAtual?.unidadeOrganizacionalId ?? null}
              onAbrirChamados={() => setViewIfAllowed("chamados")}
              onAbrirFinanceiro={(aba, filtro) => {
                setFinanceiroAba(aba);
                setFinanceiroFiltro(filtro ?? null);
                setViewIfAllowed("financeiro");
              }}
            />
          )}

          {viewPermitido && view === "portaria" && (
            <PortariaView
              organizacao={organizacaoSelecionada}
              readOnly={!podeCriarOperacao}
            />
          )}

          {viewPermitido && view === "cartaoPonto" && (
            <CartaoPontoView
              organizacao={organizacaoSelecionada}
              readOnly={!podeCriarOperacao}
              allowManageAll={roleAtual === "PLATFORM_ADMIN" || roleAtual === "CONDO_ADMIN"}
              pessoaLogadaId={session?.pessoaId ?? null}
            />
          )}

          {viewPermitido && view === "correspondencia" && (
            <CorrespondenciaView
              organizacao={organizacaoSelecionada}
              readOnly={!podeCriarOperacao}
            />
          )}

          {viewPermitido && view === "comunicados" && (
            <ComunicadosView
              organizacao={organizacaoSelecionada}
              readOnly={!podeCriarOperacao}
            />
          )}

          {viewPermitido && view === "documentos" && (
            <DocumentosView
              organizacao={organizacaoSelecionada}
              readOnly={!podeCriarOperacao}
            />
          )}

          {viewPermitido && view === "relatorios" && (
            <RelatoriosView
              organizacao={organizacaoSelecionada}
              onAbrirFinanceiroRelatorios={() => {
                setViewIfAllowed("financeiro");
                setFinanceiroAba("relatorios");
                setSidebarFinanceiroOpen(true);
                setSidebarMobileOpen(false);
              }}
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
