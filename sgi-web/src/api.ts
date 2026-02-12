const normalizeApiBaseUrl = (raw?: string | null) => {
  const value = (raw ?? "").trim();
  if (!value) return null;
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const envApiBase = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);
export const API_BASE_URL = envApiBase ?? "/api";
export const AUTH_STORAGE_KEY = "swa_sgi_token";
export const AUTH_SESSION_KEY = "swa_sgi_session";
export const AUTH_UNAUTHORIZED_EVENT = "swa:auth-unauthorized";

function handleUnauthorizedResponse() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // Ignora indisponibilidade do localStorage
  }
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
}

function sanitizeHttpError(status: number, text: string): string {
  if (!text) {
    return `Erro HTTP ${status}`;
  }
  const lower = text.toLowerCase();
  const pareceStack =
    lower.includes("microsoft.") ||
    lower.includes("system.") ||
    lower.includes("stack trace") ||
    lower.includes("sqlite") ||
    lower.includes(" at ");
  if (pareceStack) {
    // Mantem o detalhe tecnico no console, mas mostra mensagem amigavel.
    console.error(text);
    return "Erro ao processar a solicitacao. Tente novamente ou contate o suporte.";
  }
  return text;
}

function throwHttpError(status: number, text: string): never {
  if (status === 401) {
    handleUnauthorizedResponse();
    throw new Error("Sessao expirada. Faca login novamente.");
  }
  throw new Error(sanitizeHttpError(status, text));
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  userId: string;
  pessoaId: string;
  isPlatformAdmin: boolean;
  memberships: Membership[];
}

export type UserRole =
  | "PLATFORM_ADMIN"
  | "CONDO_ADMIN"
  | "CONDO_STAFF"
  | "RESIDENT";

export interface Membership {
  id: string;
  condoId?: string | null;
  orgId?: string | null;
  unidadeOrganizacionalId?: string | null;
  unidadeId?: string | null;
  role: UserRole;
  isActive: boolean;
}

export interface Organizacao {
  id: string;
  nome: string;
  tipo?: string;
  modulosAtivos?: string;
}

export interface Pessoa {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  documento?: string;
  papel?: string;
  unidadeOrganizacionalId?: string | null;
  unidadeCodigo?: string | null;
  // Campos de endereço podem não vir da API em todas as situações,
  // então ficam opcionais.
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  enderecoResumo?: string;
}

export interface ContaFinanceira {
  id: string;
  nome: string;
  tipo?: string;
  banco?: string;
  agencia?: string;
  numeroConta?: string;
  saldoInicial?: number;
  moeda?: string;
  status?: string;
}

export interface PlanoContas {
  id: string;
  organizacaoId: string;
  codigo: string;
  nome: string;
  tipo: string;
  nivel: number;
  parentId?: string;
}

export interface ContaContabil {
  id: string;
  organizacaoId: string;
  codigo: string;
  nome: string;
  grupo: string;
  natureza: string;
  nivel: number;
  parentId?: string | null;
  ativa: boolean;
  codigoReferencialSped?: string | null;
}

export interface PeriodoContabil {
  id: string;
  organizacaoId: string;
  competenciaInicio: string;
  competenciaFim: string;
  status: string;
  fechadoEm?: string | null;
  fechadoPor?: string | null;
  observacao?: string | null;
}

export interface PartidaContabil {
  id: string;
  lancamentoContabilId: string;
  contaContabilId: string;
  tipo: string;
  valor: number;
  centroCustoId?: string | null;
}

export interface LancamentoContabil {
  id: string;
  organizacaoId: string;
  dataLancamento: string;
  competencia: string;
  historico: string;
  origem?: string | null;
  lancamentoFinanceiroId?: string | null;
  status: string;
  partidas?: PartidaContabil[];
}

export interface BalanceteItem {
  contaId: string;
  codigo: string;
  nome: string;
  debitos: number;
  creditos: number;
  saldo: number;
}

export interface DreResumo {
  receitas: number;
  despesas: number;
  resultado: number;
}

export interface BalancoResumo {
  ativo: number;
  passivo: number;
  patrimonio: number;
}

export interface CotaCondominial {
  id: string;
  organizacaoId: string;
  unidadeOrganizacionalId: string;
  planoContasId: string;
  valor: number;
  competenciaInicio: string; // yyyy-MM
  competenciaFim?: string | null; // yyyy-MM
  ativo: boolean;
}

export interface PrevisaoOrcamentaria {
  id: string;
  organizacaoId: string;
  planoContasId: string;
  tipo: string;
  ano: number;
  mes: number;
  valorPrevisto: number;
  observacao?: string | null;
}

export interface AbonoFinanceiro {
  id: string;
  organizacaoId: string;
  lancamentoFinanceiroId: string;
  tipo: string;
  valor: number;
  percentual?: number | null;
  motivo: string;
  observacao?: string | null;
  status: string;
  dataSolicitacao: string;
  dataAprovacao?: string | null;
}

export interface MedidorConsumo {
  id: string;
  organizacaoId: string;
  unidadeOrganizacionalId: string;
  nome: string;
  tipo: string;
  unidadeMedida: string;
  numeroSerie?: string | null;
  ativo: boolean;
  observacao?: string | null;
}

export interface LeituraConsumo {
  id: string;
  organizacaoId: string;
  medidorId: string;
  competencia: string;
  dataLeitura: string;
  leituraAtual: number;
  leituraAnterior: number;
  consumo: number;
  observacao?: string | null;
}
export interface UnidadeOrganizacional {
  id: string;
  organizacaoId: string;
  tipo: string;
  codigoInterno: string;
  nome: string;
  status: string;
  parentId?: string | null;
}

export interface VinculoPessoaOrganizacao {
  id: string;
  pessoaId: string;
  pessoaNome: string;
  pessoaDocumento?: string | null;
  organizacaoId: string;
  unidadeOrganizacionalId?: string | null;
  unidadeCodigo?: string | null;
  unidadeNome?: string | null;
  papel: string;
  dataInicio: string;
  dataFim?: string | null;
}

export interface Chamado {
  id: string;
  organizacaoId: string;
  unidadeOrganizacionalId?: string | null;
  pessoaSolicitanteId: string;
  categoria: string;
  titulo: string;
  descricao: string;
  status: string;
  prioridade?: string | null;
  responsavelPessoaId?: string | null;
  dataAbertura?: string;
  slaHoras?: number | null;
  dataPrazoSla?: string | null;
  dataFechamento?: string | null;
}

export interface Reserva {
  id: string;
  organizacaoId: string;
  recursoReservavelId: string;
  pessoaSolicitanteId: string;
  unidadeOrganizacionalId?: string | null;
  dataInicio: string;
  dataFim: string;
  status: string;
  valorTotal?: number | null;
  dataSolicitacao?: string | null;
  dataAprovacao?: string | null;
  aprovadorPessoaId?: string | null;
  observacao?: string | null;
}

export interface RecursoReservavel {
  id: string;
  organizacaoId: string;
  unidadeOrganizacionalId?: string | null;
  nome: string;
  tipo?: string;
  capacidade?: number | null;
  regrasJson?: string | null;
  limitePorUnidadePorMes?: number | null;
  exigeAprovacao?: boolean;
  janelaHorarioInicio?: string | null;
  janelaHorarioFim?: string | null;
  bloqueiosJson?: string | null;
  ativo?: boolean;
}

export interface ChamadoHistorico {
  id: string;
  organizacaoId: string;
  chamadoId: string;
  dataHora: string;
  acao: string;
  detalhes?: string | null;
  responsavelPessoaId?: string | null;
}

export interface PontoMarcacao {
  id: string;
  organizacaoId: string;
  pessoaId: string;
  unidadeOrganizacionalId?: string | null;
  nsr: number;
  dataHoraMarcacao: string;
  tipo: "ENTRADA" | "INICIO_INTERVALO" | "FIM_INTERVALO" | "SAIDA";
  origem: string;
  observacao?: string | null;
  hashComprovante: string;
  criadoEm: string;
}

export interface ComprovanteMarcacao {
  id: string;
  organizacaoId: string;
  pessoaId: string;
  unidadeOrganizacionalId?: string | null;
  nsr: number;
  tipo: string;
  origem: string;
  hashComprovante: string;
  dataHoraMarcacao: string;
  criadoEm: string;
}

export interface EspelhoPontoDia {
  data: string;
  entrada?: string | null;
  inicioIntervalo?: string | null;
  fimIntervalo?: string | null;
  saida?: string | null;
  horasTrabalhadas: number;
  totalMarcacoes: number;
}

export interface EspelhoPonto {
  organizacaoId: string;
  pessoaId: string;
  competencia: string;
  totalHoras: number;
  dias: EspelhoPontoDia[];
}

export interface PontoAjuste {
  id: string;
  organizacaoId: string;
  pessoaId: string;
  unidadeOrganizacionalId?: string | null;
  marcacaoOriginalId?: string | null;
  tipoSolicitacao: "INCLUSAO" | "CORRECAO";
  dataHoraSugerida: string;
  tipoMarcacaoSugerida: "ENTRADA" | "INICIO_INTERVALO" | "FIM_INTERVALO" | "SAIDA";
  justificativa: string;
  status: "PENDENTE" | "APROVADO" | "REPROVADO" | "CANCELADO";
  solicitadoPorPessoaId: string;
  solicitadoEm: string;
  aprovadoPorPessoaId?: string | null;
  aprovadoEm?: string | null;
  motivoDecisao?: string | null;
  marcacaoGeradaId?: string | null;
}

export interface PontoFechamento {
  id: string;
  organizacaoId: string;
  pessoaId: string;
  competencia: string;
  fechadoEm: string;
  fechadoPorPessoaId?: string | null;
}

export interface Veiculo {
  id: string;
  organizacaoId: string;
  unidadeOrganizacionalId?: string | null;
  pessoaId?: string | null;
  placa: string;
  marca: string;
  modelo: string;
  cor: string;
  status: string;
}

export interface Pet {
  id: string;
  organizacaoId: string;
  unidadeOrganizacionalId?: string | null;
  pessoaId?: string | null;
  nome: string;
  especie: string;
  raca?: string | null;
  porte: string;
  status: string;
}

export interface ChargeItem {
  id: string;
  organizacaoId: string;
  nome: string;
  tipo: string;
  financeCategoryId: string;
  valorPadrao?: number;
  permiteAlterarValor: boolean;
  exigeReserva: boolean;
  geraCobrancaAutomatica: boolean;
  descricaoOpcional?: string;
  ativo: boolean;
}

export interface LancamentoFinanceiro {
  id: string;
  organizacaoId: string;
  tipo: string; // "pagar" | "receber"
  situacao: string; // "aberto" | "aprovado" | "pago" | "conciliado" | "fechado" | "cancelado"
  planoContasId: string;
  centroCustoId?: string;
  contaFinanceiraId?: string;
  pessoaId: string;
  descricao: string;
  valor: number;
  dataCompetencia: string;
  dataVencimento?: string;
  dataPagamento?: string;
  formaPagamento: string;
  parcelaNumero?: number;
  parcelaTotal?: number;
  referencia?: string;
}

export interface LancamentoPagamento {
  id: string;
  organizacaoId: string;
  lancamentoFinanceiroId: string;
  valorPago: number;
  dataPagamento: string;
  contaFinanceiraId?: string | null;
  formaPagamento?: string | null;
  referencia?: string | null;
  estornadoEm?: string | null;
  estornoMotivo?: string | null;
}

export interface RegraRateio {
  id: string;
  organizacaoId: string;
  nome: string;
  tipoBase: string;
  configuracaoJson?: string;
}

export interface LancamentoRateado {
  id: string;
  lancamentoOriginalId: string;
  unidadeOrganizacionalId?: string | null;
  centroCustoId?: string | null;
  valorRateado: number;
}

export interface TransferenciaResponse {
  lancamentoSaidaId: string;
  lancamentoEntradaId: string;
  referencia: string;
}

export interface DocumentoCobranca {
  id: string;
  organizacaoId: string;
  lancamentoFinanceiroId: string;
  tipo: string;
  identificadorExterno?: string;
  linhaDigitavel?: string;
  qrCode?: string;
  urlPagamento?: string;
  status: string;
  dataEmissao: string;
  dataVencimento: string;
  dataBaixa?: string;
}

export interface FinanceUploadResponse {
  nomeArquivo: string;
  caminho: string;
  tipo: string;
}

export interface Anexo {
  id: string;
  organizacaoId: string;
  tipoEntidade: string;
  entidadeId: string;
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
  caminho: string;
  criadoEm: string;
  criadoPorUserId?: string | null;
}

export interface NotificacaoConfig {
  id: string;
  organizacaoId: string;
  tipo: string;
  canal: string;
  ativo: boolean;
  diasAntesVencimento?: number | null;
  limiteValor?: number | null;
  destinatariosJson?: string | null;
}

export interface NotificacaoEvento {
  id: string;
  organizacaoId: string;
  tipo: string;
  canal: string;
  titulo: string;
  mensagem: string;
  criadoEm: string;
  lidoEm?: string | null;
  destinatariosJson?: string | null;
}

export interface NotificacaoProcessamentoResumo {
  organizacaoId?: string | null;
  configuracoesAtivas: number;
  contasAnalisadas: number;
  cobrancasAnalisadas: number;
  eventosGerados: number;
  processadoEmUtc: string;
}

export interface UnidadeCobranca {
  id: string;
  organizacaoId: string;
  unidadeOrganizacionalId: string;
  competencia: string;
  descricao: string;
  categoriaId?: string | null;
  centroCustoId?: string | null;
  valor: number;
  vencimento: string;
  status: string;
  pagoEm?: string | null;
  formaPagamento?: string | null;
  contaBancariaId?: string | null;
  acordoId?: string | null;
  parcelaNumero?: number | null;
  parcelaTotal?: number | null;
  valorAtualizado?: number | null;
  multa?: number | null;
  juros?: number | null;
  correcao?: number | null;
  diasAtraso?: number | null;
  creditoDisponivel?: number | null;
}

export interface UnidadeCreditoMovimento {
  id: string;
  organizacaoId: string;
  unidadeOrganizacionalId: string;
  cobrancaId?: string | null;
  pagamentoId?: string | null;
  tipo: string;
  valor: number;
  dataMovimento: string;
  observacao?: string | null;
  estornadoEm?: string | null;
  estornoMotivo?: string | null;
}

export interface CreditoUnidadeResponse {
  saldo: number;
  movimentos: UnidadeCreditoMovimento[];
}

export interface PoliticaCobranca {
  id: string;
  organizacaoId: string;
  multaPercentual: number;
  jurosMensalPercentual: number;
  correcaoMensalPercentual: number;
  correcaoTipo: string;
  correcaoIndice?: string | null;
  diasCarencia: number;
  ativo: boolean;
  atualizadoEm: string;
}

export interface IndiceEconomico {
  tipo: string;
  ano: number;
  mes: number;
  valorPercentual: number;
  fonte: string;
  atualizadoEm: string;
}

export interface RemessaCobrancaItem {
  id: string;
  identificador?: string | null;
  tipo: string;
  valor: number;
  vencimento: string;
  status: string;
  linhaDigitavel?: string | null;
  qrCode?: string | null;
  urlPagamento?: string | null;
}

export interface GerarBoletosAcordoResumo {
  criadas: number;
  ignoradas: number;
}

export interface BoletoBanco {
  nome: string;
  codigo: string;
  agencia?: string | null;
  conta?: string | null;
}

export interface BoletoPessoa {
  nome: string;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
}

export interface BoletoEndereco {
  logradouro: string;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

export interface BoletoFatura {
  id: string;
  tipo: string;
  identificador: string;
  descricao: string;
  valor: number;
  emissao: string;
  vencimento: string;
  status: string;
  linhaDigitavel?: string | null;
  qrCode?: string | null;
  urlPagamento?: string | null;
  banco: BoletoBanco;
  cedente: BoletoPessoa;
  enderecoCedente?: BoletoEndereco | null;
  sacado: BoletoPessoa;
  enderecoSacado?: BoletoEndereco | null;
  instrucoes: string[];
}

export interface AcordoCobranca {
  id: string;
  organizacaoId: string;
  unidadeOrganizacionalId: string;
  totalOriginal: number;
  desconto: number;
  totalAcordo: number;
  numeroParcelas: number;
  dataPrimeiraParcela: string;
  status: string;
  observacao?: string | null;
  criadoEm: string;
}

export interface AcordoParcela {
  id: string;
  acordoId: string;
  cobrancaId?: string | null;
  numero: number;
  valor: number;
  vencimento: string;
  status: string;
  pagoEm?: string | null;
}

export interface CobrancaOrganizacaoResumo extends UnidadeCobranca {
  unidadeCodigo: string;
  unidadeNome: string;
}

export interface UnidadePagamento {
  id: string;
  organizacaoId: string;
  cobrancaId: string;
  valorPago: number;
  dataPagamento: string;
  contaBancariaId?: string | null;
  comprovanteAnexoId?: string | null;
  observacao?: string | null;
}

export interface MovimentoBancario {
  id: string;
  organizacaoId: string;
  contaBancariaId: string;
  data: string;
  descricao: string;
  valor: number;
  status: string;
  lancamentoFinanceiroId?: string | null;
  unidadePagamentoId?: string | null;
}

export interface ConciliacaoExtratoItem {
  index: number;
  data: string;
  descricao: string;
  valor: number;
  documento?: string;
  movimentoId?: string;
  sugestaoLancamentoId?: string;
  sugestaoCobrancaId?: string;
  sugestaoDescricao?: string;
  sugestaoTipo?: string;
}

export interface ConciliacaoImportResponse {
  arquivo: string;
  total: number;
  itens: ConciliacaoExtratoItem[];
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    const origemAtual =
      typeof window !== "undefined" ? window.location.origin : "origem atual";
    const detalhe =
      error instanceof Error && error.message
        ? ` Detalhe tecnico: ${error.message}.`
        : "";
    throw new Error(
      `Nao foi possivel conectar com a API (${API_BASE_URL}). Verifique se o backend esta ativo e se o CORS permite ${origemAtual}.${detalhe}`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throwHttpError(res.status, text);
  }

  // Algumas rotas (ex.: PATCH/POST sem corpo) retornam 204 ou corpo vazio.
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

async function requestBlob(path: string, token?: string): Promise<Blob> {
  const headers: HeadersInit = {
    "ngrok-skip-browser-warning": "true"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { headers });
  } catch (error) {
    const origemAtual =
      typeof window !== "undefined" ? window.location.origin : "origem atual";
    const detalhe =
      error instanceof Error && error.message
        ? ` Detalhe tecnico: ${error.message}.`
        : "";
    throw new Error(
      `Nao foi possivel conectar com a API (${API_BASE_URL}). Verifique se o backend esta ativo e se o CORS permite ${origemAtual}.${detalhe}`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throwHttpError(res.status, text);
  }

  return await res.blob();
}

async function requestBlobPost(
  path: string,
  body: any,
  token?: string
): Promise<Blob> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throwHttpError(res.status, text);
  }

  return await res.blob();
}

export const api = {
  async login(email: string, senha: string): Promise<LoginResponse> {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha })
    });
  },

  async listarOrganizacoes(token: string): Promise<Organizacao[]> {
    return request<Organizacao[]>("/Organizacoes", {}, token);
  },

  async listarMinhasOrganizacoes(token: string): Promise<Organizacao[]> {
    return request<Organizacao[]>("/Organizacoes/minhas", {}, token);
  },

  async criarOrganizacao(token: string, dados: {
    nome: string;
    tipo?: string;
    modulosAtivos?: string;
  }): Promise<Organizacao> {
    return request<Organizacao>("/Organizacoes", {
      method: "POST",
      body: JSON.stringify(dados)
    }, token);
  },

  async atualizarOrganizacao(
    token: string,
    id: string,
    dados: {
      nome: string;
      tipo?: string;
      modulosAtivos?: string;
      status?: string;
    }
  ): Promise<Organizacao> {
    const path = `/Organizacoes/${encodeURIComponent(id)}`;
    return request<Organizacao>(path, {
      method: "PUT",
      body: JSON.stringify(dados)
    }, token);
  },
  async listarUnidades(
    token: string,
    organizacaoId: string
  ): Promise<UnidadeOrganizacional[]> {
    const path = `/unidades?organizacaoId=${encodeURIComponent(
      organizacaoId
    )}`;
    return request<UnidadeOrganizacional[]>(path, {}, token);
  },

  async criarUnidade(
    token: string,
    payload: {
      organizacaoId: string;
      tipo: string;
      codigoInterno: string;
      nome: string;
      parentId?: string | null;
    }
  ): Promise<UnidadeOrganizacional> {
    return request<UnidadeOrganizacional>(
      "/unidades",
      {
        method: "POST",
        body: JSON.stringify({
          organizacaoId: payload.organizacaoId,
          tipo: payload.tipo,
          codigoInterno: payload.codigoInterno,
          nome: payload.nome,
          parentId: payload.parentId ?? null
        })
      },
      token
    );
  },

  async atualizarUnidade(
    token: string,
    id: string,
    payload: {
      nome: string;
      codigoInterno?: string;
      tipo?: string;
      parentId?: string | null;
    }
  ): Promise<UnidadeOrganizacional> {
    const path = `/unidades/${encodeURIComponent(id)}`;
    return request<UnidadeOrganizacional>(
      path,
      {
        method: "PUT",
        body: JSON.stringify({
          nome: payload.nome,
          codigoInterno: payload.codigoInterno ?? "",
          tipo: payload.tipo ?? "",
          parentId: payload.parentId ?? null
        })
      },
      token
    );
  },

  async listarVinculos(
    token: string,
    organizacaoId: string,
    params?: { pessoaId?: string; unidadeId?: string }
  ): Promise<VinculoPessoaOrganizacao[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (params?.pessoaId) {
      search.set("pessoaId", params.pessoaId);
    }
    if (params?.unidadeId) {
      search.set("unidadeId", params.unidadeId);
    }
    return request<VinculoPessoaOrganizacao[]>(
      `/vinculos?${search.toString()}`,
      {},
      token
    );
  },

  async criarVinculo(
    token: string,
    payload: {
      organizacaoId: string;
      pessoaId: string;
      unidadeOrganizacionalId?: string | null;
      papel: string;
      dataInicio?: string | null;
      dataFim?: string | null;
    }
  ): Promise<VinculoPessoaOrganizacao> {
    return request<VinculoPessoaOrganizacao>(
      "/vinculos",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarVinculo(
    token: string,
    id: string,
    payload: {
      organizacaoId: string;
      unidadeOrganizacionalId?: string | null;
      papel?: string | null;
      dataFim?: string | null;
    }
  ): Promise<VinculoPessoaOrganizacao> {
    return request<VinculoPessoaOrganizacao>(
      `/vinculos/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async removerVinculo(
    token: string,
    id: string,
    organizacaoId: string
  ): Promise<void> {
    await request<void>(
      `/vinculos/${encodeURIComponent(id)}?organizacaoId=${encodeURIComponent(
        organizacaoId
      )}`,
      { method: "DELETE" },
      token
    );
  },

  async listarPessoas(
    token: string,
    organizacaoId: string
  ): Promise<Pessoa[]> {
    const path = `/Pessoas?organizacaoId=${encodeURIComponent(
      organizacaoId
    )}`;
    return request<Pessoa[]>(path, {}, token);
  },

  async criarPessoa(
    token: string,
    payload: {
      organizacaoId: string;
      nome: string;
      tipo: "fisica" | "juridica";
      documento?: string;
      email?: string;
      telefone?: string;
      papel?: string;
      logradouro?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      cep?: string;
    }
  ): Promise<Pessoa> {
    return request<Pessoa>(
      "/Pessoas",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarPessoa(
    token: string,
    id: string,
    organizacaoId: string,
    payload: {
      nome: string;
      tipo: "fisica" | "juridica";
      documento?: string;
      email?: string;
      telefone?: string;
      papel?: string;
      logradouro?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      cep?: string;
    }
  ): Promise<Pessoa> {
    const path = `/Pessoas/${encodeURIComponent(
      id
    )}?organizacaoId=${encodeURIComponent(organizacaoId)}`;
    return request<Pessoa>(
      path,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async removerPessoa(
    token: string,
    id: string,
    organizacaoId: string
  ): Promise<void> {
    const path = `/Pessoas/${encodeURIComponent(
      id
    )}?organizacaoId=${encodeURIComponent(organizacaoId)}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      headers
    });

    if (!res.ok) {
      const text = await res.text();
      throwHttpError(res.status, text);
    }
  },

  async listarContas(
    token: string,
    organizacaoId?: string
  ): Promise<ContaFinanceira[]> {
    const path = organizacaoId
      ? `/financeiro/contas?organizacaoId=${encodeURIComponent(
          organizacaoId
        )}`
      : "/financeiro/contas";
    return request<ContaFinanceira[]>(path, {}, token);
  },

  async criarContaFinanceira(
    token: string,
    payload: {
      organizacaoId: string;
      nome: string;
      tipo?: string;
      banco?: string;
      agencia?: string;
      numeroConta?: string;
      saldoInicial?: number;
      moeda?: string;
      status?: string;
    }
  ): Promise<ContaFinanceira> {
    return request<ContaFinanceira>(
      "/financeiro/contas",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async listarChamados(
    token: string,
    organizacaoId?: string
  ): Promise<Chamado[]> {
    const suffix = organizacaoId
      ? `?organizacaoId=${encodeURIComponent(organizacaoId)}`
      : "";
    return request<Chamado[]>(`/operacao/chamados${suffix}`, {}, token);
  },

  async criarChamado(token: string, payload: Chamado): Promise<Chamado> {
    return request<Chamado>(
      "/operacao/chamados",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarChamado(
    token: string,
    id: string,
    payload: {
      status?: string;
      prioridade?: string;
      responsavelPessoaId?: string | null;
      observacao?: string;
    }
  ): Promise<Chamado> {
    return request<Chamado>(
      `/operacao/chamados/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async adicionarComentarioChamado(
    token: string,
    id: string,
    mensagem: string
  ): Promise<void> {
    await request<void>(
      `/operacao/chamados/${encodeURIComponent(id)}/comentarios`,
      {
        method: "POST",
        body: JSON.stringify({ mensagem })
      },
      token
    );
  },

  async listarHistoricoChamado(
    token: string,
    id: string
  ): Promise<ChamadoHistorico[]> {
    return request<ChamadoHistorico[]>(
      `/operacao/chamados/${encodeURIComponent(id)}/historico`,
      {},
      token
    );
  },

  async listarRecursos(
    token: string,
    organizacaoId: string
  ): Promise<RecursoReservavel[]> {
    const suffix = `?organizacaoId=${encodeURIComponent(organizacaoId)}`;
    return request<RecursoReservavel[]>(`/operacao/recursos${suffix}`, {}, token);
  },

  async criarRecurso(
    token: string,
    payload: {
      organizacaoId: string;
      unidadeOrganizacionalId?: string | null;
      nome: string;
      tipo?: string;
      capacidade?: number | null;
      regrasJson?: string | null;
      limitePorUnidadePorMes?: number | null;
      exigeAprovacao?: boolean;
      janelaHorarioInicio?: string | null;
      janelaHorarioFim?: string | null;
      bloqueiosJson?: string | null;
      ativo?: boolean;
    }
  ): Promise<RecursoReservavel> {
    return request<RecursoReservavel>(
      "/operacao/recursos",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarRecurso(
    token: string,
    id: string,
    payload: {
      organizacaoId: string;
      unidadeOrganizacionalId?: string | null;
      nome: string;
      tipo?: string;
      capacidade?: number | null;
      regrasJson?: string | null;
      limitePorUnidadePorMes?: number | null;
      exigeAprovacao?: boolean;
      janelaHorarioInicio?: string | null;
      janelaHorarioFim?: string | null;
      bloqueiosJson?: string | null;
      ativo?: boolean;
    }
  ): Promise<RecursoReservavel> {
    return request<RecursoReservavel>(
      `/operacao/recursos/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async removerRecurso(
    token: string,
    id: string,
    organizacaoId: string
  ): Promise<void> {
    const suffix = `?organizacaoId=${encodeURIComponent(organizacaoId)}`;
    await request<void>(`/operacao/recursos/${encodeURIComponent(id)}${suffix}`, {
      method: "DELETE"
    }, token);
  },

  async listarReservas(
    token: string,
    organizacaoId?: string,
    recursoId?: string
  ): Promise<Reserva[]> {
    const searchParams = new URLSearchParams();
    if (organizacaoId) {
      searchParams.set("organizacaoId", organizacaoId);
    }
    if (recursoId) {
      searchParams.set("recursoId", recursoId);
    }
    const suffix = searchParams.toString();
    return request<Reserva[]>(
      `/operacao/reservas${suffix ? `?${suffix}` : ""}`,
      {},
      token
    );
  },

  async criarReserva(token: string, payload: Reserva): Promise<Reserva> {
    return request<Reserva>(
      "/operacao/reservas",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarReserva(
    token: string,
    id: string,
    payload: { status: string; observacao?: string }
  ): Promise<Reserva> {
    return request<Reserva>(
      `/operacao/reservas/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async listarPontoMarcacoes(
    token: string,
    params: {
      organizacaoId: string;
      pessoaId?: string;
      de?: string;
      ate?: string;
    }
  ): Promise<PontoMarcacao[]> {
    const search = new URLSearchParams();
    search.set("organizacaoId", params.organizacaoId);
    if (params.pessoaId) search.set("pessoaId", params.pessoaId);
    if (params.de) search.set("de", params.de);
    if (params.ate) search.set("ate", params.ate);
    return request<PontoMarcacao[]>(`/ponto/marcacoes?${search.toString()}`, {}, token);
  },

  async registrarPontoMarcacao(
    token: string,
    payload: {
      organizacaoId: string;
      pessoaId?: string;
      unidadeOrganizacionalId?: string | null;
      tipo: "ENTRADA" | "INICIO_INTERVALO" | "FIM_INTERVALO" | "SAIDA";
      origem?: string;
      observacao?: string;
    }
  ): Promise<PontoMarcacao> {
    return request<PontoMarcacao>(
      "/ponto/marcacoes",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async obterComprovanteMarcacao(
    token: string,
    id: string
  ): Promise<ComprovanteMarcacao> {
    return request<ComprovanteMarcacao>(
      `/ponto/comprovante/${encodeURIComponent(id)}`,
      {},
      token
    );
  },

  async obterEspelhoPonto(
    token: string,
    params: {
      organizacaoId: string;
      pessoaId?: string;
      competencia?: string;
    }
  ): Promise<EspelhoPonto> {
    const search = new URLSearchParams();
    search.set("organizacaoId", params.organizacaoId);
    if (params.pessoaId) search.set("pessoaId", params.pessoaId);
    if (params.competencia) search.set("competencia", params.competencia);
    return request<EspelhoPonto>(`/ponto/espelho?${search.toString()}`, {}, token);
  },

  async listarPontoAjustes(
    token: string,
    params: {
      organizacaoId: string;
      pessoaId?: string;
      status?: string;
    }
  ): Promise<PontoAjuste[]> {
    const search = new URLSearchParams();
    search.set("organizacaoId", params.organizacaoId);
    if (params.pessoaId) search.set("pessoaId", params.pessoaId);
    if (params.status) search.set("status", params.status);
    return request<PontoAjuste[]>(`/ponto/ajustes?${search.toString()}`, {}, token);
  },

  async solicitarPontoAjuste(
    token: string,
    payload: {
      organizacaoId: string;
      pessoaId?: string;
      marcacaoOriginalId?: string | null;
      tipoSolicitacao?: "INCLUSAO" | "CORRECAO";
      dataHoraSugerida: string;
      tipoMarcacaoSugerida: "ENTRADA" | "INICIO_INTERVALO" | "FIM_INTERVALO" | "SAIDA";
      justificativa: string;
    }
  ): Promise<PontoAjuste> {
    return request<PontoAjuste>(
      "/ponto/ajustes",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async decidirPontoAjuste(
    token: string,
    ajusteId: string,
    payload: { aprovar: boolean; motivoDecisao?: string }
  ): Promise<PontoAjuste> {
    return request<PontoAjuste>(
      `/ponto/ajustes/${encodeURIComponent(ajusteId)}/decisao`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async listarPontoFechamentos(
    token: string,
    params: {
      organizacaoId: string;
      pessoaId?: string;
      competencia?: string;
    }
  ): Promise<PontoFechamento[]> {
    const search = new URLSearchParams();
    search.set("organizacaoId", params.organizacaoId);
    if (params.pessoaId) search.set("pessoaId", params.pessoaId);
    if (params.competencia) search.set("competencia", params.competencia);
    return request<PontoFechamento[]>(`/ponto/fechamentos?${search.toString()}`, {}, token);
  },

  async fecharPontoCompetencia(
    token: string,
    payload: {
      organizacaoId: string;
      pessoaId?: string;
      competencia: string;
    }
  ): Promise<{ competencia: string; fechados: number }> {
    return request<{ competencia: string; fechados: number }>(
      "/ponto/fechamentos",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async exportarPontoAfd(
    token: string,
    params: {
      organizacaoId: string;
      pessoaId?: string;
      de?: string;
      ate?: string;
    }
  ): Promise<Blob> {
    const search = new URLSearchParams();
    search.set("organizacaoId", params.organizacaoId);
    if (params.pessoaId) search.set("pessoaId", params.pessoaId);
    if (params.de) search.set("de", params.de);
    if (params.ate) search.set("ate", params.ate);
    return requestBlob(`/ponto/export/afd?${search.toString()}`, token);
  },

  async exportarPontoAej(
    token: string,
    params: {
      organizacaoId: string;
      pessoaId?: string;
      competencia?: string;
    }
  ): Promise<Blob> {
    const search = new URLSearchParams();
    search.set("organizacaoId", params.organizacaoId);
    if (params.pessoaId) search.set("pessoaId", params.pessoaId);
    if (params.competencia) search.set("competencia", params.competencia);
    return requestBlob(`/ponto/export/aej?${search.toString()}`, token);
  },

  async listarVeiculos(
    token: string,
    organizacaoId: string,
    filters?: { unidadeId?: string; pessoaId?: string; status?: string }
  ): Promise<Veiculo[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("organizacaoId", organizacaoId);
    if (filters?.unidadeId) searchParams.set("unidadeId", filters.unidadeId);
    if (filters?.pessoaId) searchParams.set("pessoaId", filters.pessoaId);
    if (filters?.status) searchParams.set("status", filters.status);
    return request<Veiculo[]>(
      `/veiculos?${searchParams.toString()}`,
      {},
      token
    );
  },

  async criarVeiculo(
    token: string,
    payload: {
      organizacaoId: string;
      unidadeOrganizacionalId?: string | null;
      pessoaId?: string | null;
      placa: string;
      marca: string;
      modelo: string;
      cor: string;
      status?: string;
    }
  ): Promise<Veiculo> {
    return request<Veiculo>(
      "/veiculos",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarVeiculo(
    token: string,
    id: string,
    payload: {
      organizacaoId: string;
      unidadeOrganizacionalId?: string | null;
      pessoaId?: string | null;
      placa: string;
      marca: string;
      modelo: string;
      cor: string;
      status?: string;
    }
  ): Promise<Veiculo> {
    return request<Veiculo>(
      `/veiculos/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async removerVeiculo(
    token: string,
    id: string,
    organizacaoId: string
  ): Promise<void> {
    const suffix = `?organizacaoId=${encodeURIComponent(organizacaoId)}`;
    await request<void>(
      `/veiculos/${encodeURIComponent(id)}${suffix}`,
      { method: "DELETE" },
      token
    );
  },

  async listarPets(
    token: string,
    organizacaoId: string,
    filters?: { unidadeId?: string; pessoaId?: string; status?: string }
  ): Promise<Pet[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("organizacaoId", organizacaoId);
    if (filters?.unidadeId) searchParams.set("unidadeId", filters.unidadeId);
    if (filters?.pessoaId) searchParams.set("pessoaId", filters.pessoaId);
    if (filters?.status) searchParams.set("status", filters.status);
    return request<Pet[]>(
      `/pets?${searchParams.toString()}`,
      {},
      token
    );
  },

  async criarPet(
    token: string,
    payload: {
      organizacaoId: string;
      unidadeOrganizacionalId?: string | null;
      pessoaId?: string | null;
      nome: string;
      especie: string;
      raca?: string | null;
      porte: string;
      status?: string;
    }
  ): Promise<Pet> {
    return request<Pet>(
      "/pets",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarPet(
    token: string,
    id: string,
    payload: {
      organizacaoId: string;
      unidadeOrganizacionalId?: string | null;
      pessoaId?: string | null;
      nome: string;
      especie: string;
      raca?: string | null;
      porte: string;
      status?: string;
    }
  ): Promise<Pet> {
    return request<Pet>(
      `/pets/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async removerPet(
    token: string,
    id: string,
    organizacaoId: string
  ): Promise<void> {
    const suffix = `?organizacaoId=${encodeURIComponent(organizacaoId)}`;
    await request<void>(
      `/pets/${encodeURIComponent(id)}${suffix}`,
      { method: "DELETE" },
      token
    );
  },

  async seedDemoFull(): Promise<any> {
    return request<any>(
      "/dev/seed-demo-full",
      {
        method: "POST"
      }
    );
  },

  async listarPlanosContas(
    token: string,
    organizacaoId?: string,
    tipo?: string
  ): Promise<PlanoContas[]> {
    const searchParams = new URLSearchParams();
    if (organizacaoId) {
      searchParams.set("organizacaoId", organizacaoId);
    }
    if (tipo) {
      searchParams.set("tipo", tipo);
    }
    const suffix = searchParams.toString();
    const path = `/financeiro/planos-contas${suffix ? `?${suffix}` : ""}`;
    return request<PlanoContas[]>(path, {}, token);
  },

  async criarPlanoContas(
    token: string,
    payload: {
      organizacaoId: string;
      codigo: string;
      nome: string;
      tipo: string;
      nivel: number;
      parentId?: string;
    }
  ): Promise<PlanoContas> {
    return request<PlanoContas>(
      "/financeiro/planos-contas",
      {
        method: "POST",
        body: JSON.stringify({
          organizacaoId: payload.organizacaoId,
          codigo: payload.codigo,
          nome: payload.nome,
          tipo: payload.tipo,
          nivel: payload.nivel,
          parentId: payload.parentId ?? null
        })
      },
      token
    );
  },

  async atualizarPlanoContas(
    token: string,
    id: string,
    payload: {
      codigo: string;
      nome: string;
      tipo: string;
      nivel: number;
      parentId?: string;
    }
  ): Promise<PlanoContas> {
    const path = `/financeiro/planos-contas/${encodeURIComponent(id)}`;
    return request<PlanoContas>(
      path,
      {
        method: "PUT",
        body: JSON.stringify({
          codigo: payload.codigo,
          nome: payload.nome,
          tipo: payload.tipo,
          nivel: payload.nivel,
          parentId: payload.parentId ?? null
        })
      },
      token
    );
  },

  async removerPlanoContas(
    token: string,
    id: string
  ): Promise<void> {
    const path = `/financeiro/planos-contas/${encodeURIComponent(id)}`;
      await request<void>(
        path,
        {
          method: "DELETE"
        },
        token
      );
    },

  async listarCotas(
    token: string,
    organizacaoId: string
  ): Promise<CotaCondominial[]> {
    const path = `/financeiro/cotas?organizacaoId=${encodeURIComponent(
      organizacaoId
    )}`;
    return request<CotaCondominial[]>(path, {}, token);
  },

  async criarCota(
    token: string,
    payload: {
      organizacaoId: string;
      unidadeOrganizacionalId: string;
      planoContasId: string;
      valor: number;
      competenciaInicio: string; // yyyy-MM
      competenciaFim?: string | null;
    }
  ): Promise<CotaCondominial> {
    return request<CotaCondominial>(
      "/financeiro/cotas",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async listarFaturas(
    token: string,
    organizacaoId: string,
    status?: string
  ): Promise<DocumentoCobranca[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("organizacaoId", organizacaoId);
    if (status) {
      searchParams.set("status", status);
    }
    const path = `/financeiro/faturas?${searchParams.toString()}`;
    return request<DocumentoCobranca[]>(path, {}, token);
  },

  async criarFatura(
    token: string,
    payload: {
      organizacaoId: string;
      lancamentoFinanceiroId: string;
      tipo: string;
      identificadorExterno?: string;
      linhaDigitavel?: string;
      qrCode?: string;
      urlPagamento?: string;
      dataVencimento?: string;
    }
  ): Promise<DocumentoCobranca> {
    return request<DocumentoCobranca>(
      "/financeiro/faturas",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarStatusFatura(
    token: string,
    id: string,
    status: string,
    dataBaixa?: string
  ): Promise<void> {
    await request<void>(
      `/financeiro/faturas/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
          dataBaixa: dataBaixa || undefined
        })
      },
      token
    );
  },

  async listarItensCobrados(
    token: string,
    organizacaoId?: string,
    apenasAtivos?: boolean
  ): Promise<ChargeItem[]> {
    const searchParams = new URLSearchParams();
    if (organizacaoId) {
      searchParams.set("organizacaoId", organizacaoId);
    }
    if (apenasAtivos === true) {
      searchParams.set("apenasAtivos", "true");
    }
    const suffix = searchParams.toString();
    const path = `/financeiro/itens-cobrados${suffix ? `?${suffix}` : ""}`;
    return request<ChargeItem[]>(path, {}, token);
  },

  async criarItemCobrado(
    token: string,
    payload: {
      organizacaoId: string;
      nome: string;
      tipo: string;
      financeCategoryId: string;
      valorPadrao?: number;
      permiteAlterarValor: boolean;
      exigeReserva: boolean;
      geraCobrancaAutomatica: boolean;
      descricaoOpcional?: string;
    }
  ): Promise<ChargeItem> {
    return request<ChargeItem>(
      "/financeiro/itens-cobrados",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarItemCobrado(
    token: string,
    id: string,
    payload: {
      nome: string;
      tipo: string;
      financeCategoryId: string;
      valorPadrao?: number;
      permiteAlterarValor: boolean;
      exigeReserva: boolean;
      geraCobrancaAutomatica: boolean;
      descricaoOpcional?: string;
      ativo: boolean;
    }
  ): Promise<void> {
    await request<void>(
      `/financeiro/itens-cobrados/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarStatusItemCobrado(
    token: string,
    id: string,
    ativo: boolean
  ): Promise<void> {
    await request<void>(
      `/financeiro/itens-cobrados/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ ativo })
      },
      token
    );
  },

  async listarPrevisoesOrcamentarias(
    token: string,
    organizacaoId: string,
    params?: { ano?: number; tipo?: string }
  ): Promise<PrevisaoOrcamentaria[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (params?.ano) {
      search.set("ano", String(params.ano));
    }
    if (params?.tipo) {
      search.set("tipo", params.tipo);
    }
    return request<PrevisaoOrcamentaria[]>(
      `/financeiro/previsao-orcamentaria?${search.toString()}`,
      {},
      token
    );
  },

  async criarPrevisaoOrcamentaria(
    token: string,
    payload: {
      organizacaoId: string;
      planoContasId: string;
      tipo: string;
      ano: number;
      mes: number;
      valorPrevisto: number;
      observacao?: string | null;
    }
  ): Promise<PrevisaoOrcamentaria> {
    return request<PrevisaoOrcamentaria>(
      "/financeiro/previsao-orcamentaria",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarPrevisaoOrcamentaria(
    token: string,
    id: string,
    payload: {
      planoContasId: string;
      tipo: string;
      ano: number;
      mes: number;
      valorPrevisto: number;
      observacao?: string | null;
    }
  ): Promise<void> {
    await request<void>(
      `/financeiro/previsao-orcamentaria/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async removerPrevisaoOrcamentaria(
    token: string,
    id: string
  ): Promise<void> {
    await request<void>(
      `/financeiro/previsao-orcamentaria/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      token
    );
  },

  async listarAbonos(
    token: string,
    organizacaoId: string,
    params?: { status?: string; lancamentoId?: string }
  ): Promise<AbonoFinanceiro[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (params?.status) {
      search.set("status", params.status);
    }
    if (params?.lancamentoId) {
      search.set("lancamentoId", params.lancamentoId);
    }
    return request<AbonoFinanceiro[]>(
      `/financeiro/abonos?${search.toString()}`,
      {},
      token
    );
  },

  async criarAbono(
    token: string,
    payload: {
      organizacaoId: string;
      lancamentoFinanceiroId: string;
      tipo: string;
      valor?: number | null;
      percentual?: number | null;
      motivo: string;
      observacao?: string | null;
    }
  ): Promise<AbonoFinanceiro> {
    return request<AbonoFinanceiro>(
      "/financeiro/abonos",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarStatusAbono(
    token: string,
    id: string,
    status: string
  ): Promise<void> {
    await request<void>(
      `/financeiro/abonos/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status })
      },
      token
    );
  },

  async removerAbono(token: string, id: string): Promise<void> {
    await request<void>(
      `/financeiro/abonos/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      token
    );
  },

  async listarMedidoresConsumo(
    token: string,
    organizacaoId: string,
    params?: { unidadeId?: string; tipo?: string; ativo?: boolean }
  ): Promise<MedidorConsumo[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (params?.unidadeId) {
      search.set("unidadeId", params.unidadeId);
    }
    if (params?.tipo) {
      search.set("tipo", params.tipo);
    }
    if (params?.ativo !== undefined) {
      search.set("ativo", String(params.ativo));
    }
    return request<MedidorConsumo[]>(
      `/financeiro/consumos/medidores?${search.toString()}`,
      {},
      token
    );
  },

  async criarMedidorConsumo(
    token: string,
    payload: {
      organizacaoId: string;
      unidadeOrganizacionalId: string;
      nome: string;
      tipo: string;
      unidadeMedida: string;
      numeroSerie?: string | null;
      ativo?: boolean;
      observacao?: string | null;
    }
  ): Promise<MedidorConsumo> {
    return request<MedidorConsumo>(
      "/financeiro/consumos/medidores",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarMedidorConsumo(
    token: string,
    id: string,
    payload: {
      unidadeOrganizacionalId: string;
      nome: string;
      tipo: string;
      unidadeMedida: string;
      numeroSerie?: string | null;
      ativo: boolean;
      observacao?: string | null;
    }
  ): Promise<void> {
    await request<void>(
      `/financeiro/consumos/medidores/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async removerMedidorConsumo(token: string, id: string): Promise<void> {
    await request<void>(
      `/financeiro/consumos/medidores/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      token
    );
  },

  async listarLeiturasConsumo(
    token: string,
    organizacaoId: string,
    medidorId: string,
    params?: { competencia?: string }
  ): Promise<LeituraConsumo[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (params?.competencia) {
      search.set("competencia", params.competencia);
    }
    return request<LeituraConsumo[]>(
      `/financeiro/consumos/medidores/${encodeURIComponent(medidorId)}/leituras?${search.toString()}`,
      {},
      token
    );
  },

  async criarLeituraConsumo(
    token: string,
    payload: {
      organizacaoId: string;
      medidorId: string;
      competencia: string;
      dataLeitura: string;
      leituraAtual: number;
      observacao?: string | null;
    }
  ): Promise<LeituraConsumo> {
    return request<LeituraConsumo>(
      "/financeiro/consumos/leituras",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarLeituraConsumo(
    token: string,
    id: string,
    payload: {
      competencia: string;
      dataLeitura: string;
      leituraAtual: number;
      observacao?: string | null;
    }
  ): Promise<void> {
    await request<void>(
      `/financeiro/consumos/leituras/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async removerLeituraConsumo(token: string, id: string): Promise<void> {
    await request<void>(
      `/financeiro/consumos/leituras/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      token
    );
  },

  async listarRegrasRateio(
    token: string,
    organizacaoId: string
  ): Promise<RegraRateio[]> {
    const path = `/financeiro/rateios?organizacaoId=${encodeURIComponent(
      organizacaoId
    )}`;
    return request<RegraRateio[]>(path, {}, token);
  },

  async criarRegraRateio(
    token: string,
    payload: {
      organizacaoId: string;
      nome: string;
      tipoBase: string;
      unidades: Array<{ unidadeId: string; percentual?: number }>;
    }
  ): Promise<RegraRateio> {
    return request<RegraRateio>(
      "/financeiro/rateios",
      {
        method: "POST",
        body: JSON.stringify({
          organizacaoId: payload.organizacaoId,
          nome: payload.nome,
          tipoBase: payload.tipoBase,
          unidades: payload.unidades
        })
      },
      token
    );
  },

  async atualizarRegraRateio(
    token: string,
    id: string,
    payload: {
      nome: string;
      tipoBase: string;
      unidades: Array<{ unidadeId: string; percentual?: number }>;
    }
  ): Promise<void> {
    await request<void>(
      `/financeiro/rateios/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async removerRegraRateio(token: string, id: string): Promise<void> {
    await request<void>(
      `/financeiro/rateios/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      token
    );
  },

  async listarRateiosLancamento(
    token: string,
    lancamentoId: string,
    organizacaoId: string
  ): Promise<LancamentoRateado[]> {
    const path = `/financeiro/lancamentos/${encodeURIComponent(
      lancamentoId
    )}/rateios?organizacaoId=${encodeURIComponent(organizacaoId)}`;
    return request<LancamentoRateado[]>(path, {}, token);
  },

  async removerRateiosLancamento(
    token: string,
    lancamentoId: string,
    organizacaoId: string
  ): Promise<void> {
    const path = `/financeiro/lancamentos/${encodeURIComponent(
      lancamentoId
    )}/rateios?organizacaoId=${encodeURIComponent(organizacaoId)}`;
    await request<void>(path, { method: "DELETE" }, token);
  },

  async aplicarRegraRateio(
    token: string,
    regraId: string,
    payload: { organizacaoId: string; lancamentoId: string }
  ): Promise<LancamentoRateado[]> {
    return request<LancamentoRateado[]>(
      `/financeiro/rateios/${encodeURIComponent(regraId)}/aplicar`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async listarLancamentos(
    token: string,
    organizacaoId: string,
    options?: {
      contaId?: string;
      tipo?: string;
      situacao?: string;
      competenciaInicio?: string;
      competenciaFim?: string;
      vencimentoInicio?: string;
      vencimentoFim?: string;
    }
  ): Promise<LancamentoFinanceiro[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("organizacaoId", organizacaoId);
    if (options?.contaId) {
      searchParams.set("contaId", options.contaId);
    }
    if (options?.tipo) {
      searchParams.set("tipo", options.tipo);
    }
    if (options?.situacao) {
      searchParams.set("situacao", options.situacao);
    }
    if (options?.competenciaInicio) {
      searchParams.set("competenciaInicio", options.competenciaInicio);
    }
    if (options?.competenciaFim) {
      searchParams.set("competenciaFim", options.competenciaFim);
    }
    if (options?.vencimentoInicio) {
      searchParams.set("vencimentoInicio", options.vencimentoInicio);
    }
    if (options?.vencimentoFim) {
      searchParams.set("vencimentoFim", options.vencimentoFim);
    }

    const path = `/financeiro/lancamentos?${searchParams.toString()}`;
    return request<LancamentoFinanceiro[]>(path, {}, token);
  },

  async criarLancamento(
    token: string,
    payload: Omit<LancamentoFinanceiro, "id">
  ): Promise<LancamentoFinanceiro> {
    return request<LancamentoFinanceiro>(
      "/financeiro/lancamentos",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async pagarLancamento(
    token: string,
    id: string
  ): Promise<void> {
    await request<void>(
      `/financeiro/lancamentos/${encodeURIComponent(id)}/pagar`,
      {
        method: "POST"
      },
      token
    );
  },

  async baixarLancamentoManual(
    token: string,
    id: string,
    payload: {
      organizacaoId: string;
      valorPago?: number;
      dataPagamento?: string;
      contaFinanceiraId?: string;
      formaPagamento?: string;
      referencia?: string;
    }
  ): Promise<void> {
    await request<void>(
      `/financeiro/lancamentos/${encodeURIComponent(id)}/baixa-manual`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async listarPagamentosLancamento(
    token: string,
    lancamentoId: string,
    organizacaoId: string
  ): Promise<LancamentoPagamento[]> {
    const search = new URLSearchParams({ organizacaoId });
    return request<LancamentoPagamento[]>(
      `/financeiro/lancamentos/${encodeURIComponent(lancamentoId)}/pagamentos?${search.toString()}`,
      {},
      token
    );
  },

  async estornarPagamentoLancamento(
    token: string,
    pagamentoId: string,
    payload: {
      organizacaoId: string;
      motivo?: string;
      dataEstorno?: string;
    }
  ): Promise<void> {
    await request<void>(
      `/financeiro/lancamentos/pagamentos/${encodeURIComponent(pagamentoId)}/estornar`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async cancelarLancamento(
    token: string,
    id: string
  ): Promise<void> {
    await request<void>(
      `/financeiro/lancamentos/${encodeURIComponent(id)}/cancelar`,
      {
        method: "POST"
      },
      token
    );
  },

  async arquivarUnidade(token: string, id: string): Promise<void> {
    const path = `/unidades/${encodeURIComponent(id)}/arquivar`;
    await request<void>(
      path,
      {
        method: "PATCH"
      },
      token
    );
  },

  async aprovarLancamento(token: string, id: string): Promise<void> {
    await request<void>(
      `/financeiro/lancamentos/${encodeURIComponent(id)}/aprovar`,
      { method: "POST" },
      token
    );
  },

  async conciliarLancamento(token: string, id: string): Promise<void> {
    await request<void>(
      `/financeiro/lancamentos/${encodeURIComponent(id)}/conciliar`,
      { method: "POST" },
      token
    );
  },

  async fecharLancamento(token: string, id: string): Promise<void> {
    await request<void>(
      `/financeiro/lancamentos/${encodeURIComponent(id)}/fechar`,
      { method: "POST" },
      token
    );
  },

  async reabrirLancamento(token: string, id: string): Promise<void> {
    await request<void>(
      `/financeiro/lancamentos/${encodeURIComponent(id)}/reabrir`,
      { method: "POST" },
      token
    );
  },

  async uploadFinanceiro(
    token: string,
    organizacaoId: string,
    tipo: string,
    arquivo: File
  ): Promise<FinanceUploadResponse> {
    const formData = new FormData();
    formData.append("organizacaoId", organizacaoId);
    formData.append("tipo", tipo);
    formData.append("arquivo", arquivo);

    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/financeiro/uploads`, {
      method: "POST",
      headers,
      body: formData
    });

    if (!res.ok) {
      const text = await res.text();
      throwHttpError(res.status, text);
    }

    return (await res.json()) as FinanceUploadResponse;
  },

  async importarExtrato(
    token: string,
    organizacaoId: string,
    arquivo: File,
    contaBancariaId?: string
  ): Promise<ConciliacaoImportResponse> {
    const formData = new FormData();
    formData.append("organizacaoId", organizacaoId);
    if (contaBancariaId) {
      formData.append("contaBancariaId", contaBancariaId);
    }
    formData.append("arquivo", arquivo);

    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/financeiro/conciliacao/importar`, {
      method: "POST",
      headers,
      body: formData
    });

    if (!res.ok) {
      const text = await res.text();
      throwHttpError(res.status, text);
    }

    return (await res.json()) as ConciliacaoImportResponse;
  },

  async confirmarConciliacao(
    token: string,
    lancamentoId: string,
    organizacaoId: string,
    payload?: {
      dataConciliacao?: string;
      referencia?: string;
      documento?: string;
      movimentoBancarioId?: string;
    }
  ): Promise<void> {
    await request<void>(
      `/financeiro/conciliacao/${encodeURIComponent(lancamentoId)}/confirmar`,
      {
        method: "POST",
        body: JSON.stringify({
          organizacaoId,
          dataConciliacao: payload?.dataConciliacao,
          referencia: payload?.referencia,
          documento: payload?.documento,
          movimentoBancarioId: payload?.movimentoBancarioId
        })
      },
      token
    );
  },

  async listarMovimentosBancarios(
    token: string,
    organizacaoId: string,
    params?: { contaBancariaId?: string; status?: string }
  ): Promise<MovimentoBancario[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (params?.contaBancariaId) {
      search.set("contaBancariaId", params.contaBancariaId);
    }
    if (params?.status) {
      search.set("status", params.status);
    }
    return request<MovimentoBancario[]>(
      `/financeiro/conciliacao/movimentos?${search.toString()}`,
      {},
      token
    );
  },

  async vincularMovimentoBancario(
    token: string,
    movimentoId: string,
    payload: {
      organizacaoId: string;
      lancamentoId?: string;
      cobrancaUnidadeId?: string;
      contaBancariaId?: string;
    }
  ): Promise<void> {
    await request<void>(
      `/financeiro/conciliacao/movimentos/${encodeURIComponent(movimentoId)}/vincular`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async relatorioChamados(
    token: string,
    organizacaoId: string,
    params: {
      de?: string;
      ate?: string;
      status?: string;
      formato: "csv" | "pdf";
    }
  ): Promise<Blob> {
    const search = new URLSearchParams({ organizacaoId, formato: params.formato });
    if (params.de) {
      search.set("de", params.de);
    }
    if (params.ate) {
      search.set("ate", params.ate);
    }
    if (params.status) {
      search.set("status", params.status);
    }
    return requestBlob(`/relatorios/chamados?${search.toString()}`, token);
  },

  async relatorioReservas(
    token: string,
    organizacaoId: string,
    params: {
      de?: string;
      ate?: string;
      recursoId?: string;
      formato: "csv" | "pdf";
    }
  ): Promise<Blob> {
    const search = new URLSearchParams({ organizacaoId, formato: params.formato });
    if (params.de) {
      search.set("de", params.de);
    }
    if (params.ate) {
      search.set("ate", params.ate);
    }
    if (params.recursoId) {
      search.set("recursoId", params.recursoId);
    }
    return requestBlob(`/relatorios/reservas?${search.toString()}`, token);
  },

  async relatorioVeiculos(
    token: string,
    organizacaoId: string,
    formato: "csv" | "pdf" = "csv"
  ): Promise<Blob> {
    const search = new URLSearchParams({ organizacaoId, formato });
    return requestBlob(`/relatorios/veiculos?${search.toString()}`, token);
  },

  async relatorioPets(
    token: string,
    organizacaoId: string,
    formato: "csv" | "pdf" = "csv"
  ): Promise<Blob> {
    const search = new URLSearchParams({ organizacaoId, formato });
    return requestBlob(`/relatorios/pets?${search.toString()}`, token);
  },

  async transferirEntreContas(
    token: string,
    payload: {
      organizacaoId: string;
      contaOrigemId: string;
      contaDestinoId: string;
      valor: number;
      dataTransferencia?: string;
      descricao?: string;
      referencia?: string;
      formaPagamento?: string;
    }
  ): Promise<TransferenciaResponse> {
    return request<TransferenciaResponse>(
      "/financeiro/transferencias",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async removerContaFinanceira(
    token: string,
    id: string
  ): Promise<void> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(
      `${API_BASE_URL}/financeiro/contas/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throwHttpError(res.status, text);
    }
  },

  async atualizarStatusContaFinanceira(
    token: string,
    id: string,
    status: string
  ): Promise<void> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(
      `${API_BASE_URL}/financeiro/contas/${encodeURIComponent(
        id
      )}/status`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status })
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throwHttpError(res.status, text);
    }
  },

  async listarCobrancasUnidade(
    token: string,
    unidadeId: string,
    competencia?: string
  ): Promise<UnidadeCobranca[]> {
    const search = new URLSearchParams();
    if (competencia) {
      search.set("competencia", competencia);
    }
    const path = `/financeiro/unidades/${encodeURIComponent(unidadeId)}/cobrancas${
      search.toString() ? `?${search.toString()}` : ""
    }`;
    return request<UnidadeCobranca[]>(path, {}, token);
  },

  async criarCobrancaUnidade(
    token: string,
    unidadeId: string,
    payload: Omit<UnidadeCobranca, "id" | "unidadeOrganizacionalId" | "pagoEm">
  ): Promise<UnidadeCobranca> {
    return request<UnidadeCobranca>(
      `/financeiro/unidades/${encodeURIComponent(unidadeId)}/cobrancas`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarCobrancaUnidade(
    token: string,
    cobrancaId: string,
    payload: {
      status?: string;
      vencimento?: string;
      valor?: number;
      formaPagamento?: string;
      contaBancariaId?: string;
    }
  ): Promise<UnidadeCobranca> {
    return request<UnidadeCobranca>(
      `/financeiro/cobrancas/${encodeURIComponent(cobrancaId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async pagarCobrancaUnidade(
    token: string,
    cobrancaId: string,
    payload: {
      valorPago: number;
      dataPagamento?: string;
      contaBancariaId?: string;
      comprovanteAnexoId?: string;
      formaPagamento?: string;
      observacao?: string;
    }
  ): Promise<UnidadePagamento> {
    return request<UnidadePagamento>(
      `/financeiro/cobrancas/${encodeURIComponent(cobrancaId)}/pagar`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async listarPagamentosCobranca(
    token: string,
    cobrancaId: string
  ): Promise<UnidadePagamento[]> {
    return request<UnidadePagamento[]>(
      `/financeiro/cobrancas/${encodeURIComponent(cobrancaId)}/pagamentos`,
      {},
      token
    );
  },

  async listarCreditosUnidade(
    token: string,
    unidadeId: string
  ): Promise<CreditoUnidadeResponse> {
    return request<CreditoUnidadeResponse>(
      `/financeiro/unidades/${encodeURIComponent(unidadeId)}/creditos`,
      {},
      token
    );
  },

  async listarCobrancasOrganizacao(
    token: string,
    organizacaoId: string,
    options?: { status?: string; competencia?: string }
  ): Promise<CobrancaOrganizacaoResumo[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (options?.status) {
      search.set("status", options.status);
    }
    if (options?.competencia) {
      search.set("competencia", options.competencia);
    }
    return request<CobrancaOrganizacaoResumo[]>(
      `/financeiro/cobrancas?${search.toString()}`,
      {},
      token
    );
  },

  async listarAcordosCobranca(
    token: string,
    organizacaoId: string,
    unidadeId?: string
  ): Promise<AcordoCobranca[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (unidadeId) {
      search.set("unidadeId", unidadeId);
    }
    return request<AcordoCobranca[]>(
      `/financeiro/cobrancas/acordos?${search.toString()}`,
      {},
      token
    );
  },

  async listarParcelasAcordo(
    token: string,
    acordoId: string
  ): Promise<AcordoParcela[]> {
    return request<AcordoParcela[]>(
      `/financeiro/cobrancas/acordos/${encodeURIComponent(acordoId)}/parcelas`,
      {},
      token
    );
  },

  async criarAcordoCobranca(
    token: string,
    payload: {
      organizacaoId: string;
      unidadeId: string;
      cobrancaIds: string[];
      numeroParcelas: number;
      dataPrimeiraParcela: string;
      desconto?: number;
      observacao?: string;
    }
  ): Promise<AcordoCobranca> {
    return request<AcordoCobranca>(
      "/financeiro/cobrancas/acordos",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async obterPoliticaCobranca(
    token: string,
    organizacaoId: string
  ): Promise<PoliticaCobranca> {
    const search = new URLSearchParams({ organizacaoId });
    return request<PoliticaCobranca>(
      `/financeiro/cobrancas/politica?${search.toString()}`,
      {},
      token
    );
  },

  async atualizarPoliticaCobranca(
    token: string,
    payload: {
      organizacaoId: string;
      multaPercentual: number;
      jurosMensalPercentual: number;
      correcaoMensalPercentual: number;
      correcaoTipo?: string;
      correcaoIndice?: string | null;
      diasCarencia: number;
      ativo: boolean;
    }
  ): Promise<PoliticaCobranca> {
    return request<PoliticaCobranca>(
      "/financeiro/cobrancas/politica",
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async obterIndiceEconomicoAtual(
    token: string,
    organizacaoId: string,
    tipo: string
  ): Promise<IndiceEconomico | null> {
    const search = new URLSearchParams({ organizacaoId, tipo });
    const indice = await request<IndiceEconomico | undefined>(
      `/financeiro/indices/ultimo?${search.toString()}`,
      {},
      token
    );
    return indice ?? null;
  },

  async gerarRemessaCobranca(
    token: string,
    payload: { organizacaoId: string; tipo?: string }
  ): Promise<Blob> {
    return requestBlobPost("/financeiro/faturas/remessa", payload, token);
  },

  async listarRemessaCobranca(
    token: string,
    payload: { organizacaoId: string; tipo?: string }
  ): Promise<RemessaCobrancaItem[]> {
    return request<RemessaCobrancaItem[]>(
      "/financeiro/faturas/remessa/dados",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async gerarBoletosAcordo(
    token: string,
    acordoId: string,
    payload: { organizacaoId: string; tipo?: string }
  ): Promise<GerarBoletosAcordoResumo> {
    return request<GerarBoletosAcordoResumo>(
      `/financeiro/cobrancas/acordos/${acordoId}/boletos`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async obterBoletoFatura(
    token: string,
    faturaId: string,
    organizacaoId: string
  ): Promise<BoletoFatura> {
    const search = new URLSearchParams({ organizacaoId });
    return request<BoletoFatura>(
      `/financeiro/faturas/${faturaId}/boleto?${search.toString()}`,
      {},
      token
    );
  },

  async importarRetornoCobranca(
    token: string,
    organizacaoId: string,
    arquivo: File
  ): Promise<{ totalLinhas: number; atualizadas: number; ignoradas: number }> {
    const formData = new FormData();
    formData.append("organizacaoId", organizacaoId);
    formData.append("arquivo", arquivo);

    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/financeiro/faturas/retorno`, {
      method: "POST",
      headers,
      body: formData
    });

    if (!res.ok) {
      const text = await res.text();
      throwHttpError(res.status, text);
    }

    return (await res.json()) as {
      totalLinhas: number;
      atualizadas: number;
      ignoradas: number;
    };
  },

  async listarNotificacoesConfig(
    token: string,
    organizacaoId: string
  ): Promise<NotificacaoConfig[]> {
    const path = `/config/notificacoes?organizacaoId=${encodeURIComponent(
      organizacaoId
    )}`;
    return request<NotificacaoConfig[]>(path, {}, token);
  },

  async criarNotificacaoConfig(
    token: string,
    payload: Omit<NotificacaoConfig, "id">
  ): Promise<NotificacaoConfig> {
    return request<NotificacaoConfig>(
      "/config/notificacoes",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarNotificacaoConfig(
    token: string,
    id: string,
    payload: Partial<NotificacaoConfig>
  ): Promise<NotificacaoConfig> {
    return request<NotificacaoConfig>(
      `/config/notificacoes/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async removerNotificacaoConfig(token: string, id: string): Promise<void> {
    await request<void>(
      `/config/notificacoes/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      token
    );
  },

  async listarNotificacoesEventos(
    token: string,
    organizacaoId: string,
    limit?: number
  ): Promise<NotificacaoEvento[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (limit) {
      search.set("limit", String(limit));
    }
    return request<NotificacaoEvento[]>(
      `/config/notificacoes/eventos?${search.toString()}`,
      {},
      token
    );
  },

  async marcarNotificacaoEventoLido(
    token: string,
    eventoId: string
  ): Promise<NotificacaoEvento> {
    return request<NotificacaoEvento>(
      `/config/notificacoes/eventos/${encodeURIComponent(eventoId)}/lido`,
      { method: "PATCH" },
      token
    );
  },

  async processarNotificacoesAgora(
    token: string,
    organizacaoId: string
  ): Promise<NotificacaoProcessamentoResumo> {
    return request<NotificacaoProcessamentoResumo>(
      "/config/notificacoes/processar-agora",
      {
        method: "POST",
        body: JSON.stringify({ organizacaoId })
      },
      token
    );
  },

  async uploadAnexo(
    token: string,
    payload: {
      organizacaoId: string;
      tipoEntidade: string;
      entidadeId: string;
      arquivo: File;
    }
  ): Promise<Anexo> {
    const formData = new FormData();
    formData.append("organizacaoId", payload.organizacaoId);
    formData.append("tipoEntidade", payload.tipoEntidade);
    formData.append("entidadeId", payload.entidadeId);
    formData.append("arquivo", payload.arquivo);

    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true"
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/anexos/upload`, {
      method: "POST",
      headers,
      body: formData
    });

    if (!res.ok) {
      const text = await res.text();
      throwHttpError(res.status, text);
    }

    return (await res.json()) as Anexo;
  },

  async listarAnexos(
    token: string,
    organizacaoId: string,
    tipoEntidade?: string,
    entidadeId?: string
  ): Promise<Anexo[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (tipoEntidade) {
      search.set("tipoEntidade", tipoEntidade);
    }
    if (entidadeId) {
      search.set("entidadeId", entidadeId);
    }
    return request<Anexo[]>(
      `/anexos?${search.toString()}`,
      {},
      token
    );
  },

  async baixarAnexo(token: string, anexoId: string): Promise<Blob> {
    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true"
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(
      `${API_BASE_URL}/anexos/${encodeURIComponent(anexoId)}/download`,
      { headers }
    );
    if (!res.ok) {
      const text = await res.text();
      throwHttpError(res.status, text);
    }
    return await res.blob();
  },

  async removerAnexo(token: string, anexoId: string): Promise<void> {
    await request<void>(
      `/anexos/${encodeURIComponent(anexoId)}`,
      { method: "DELETE" },
      token
    );
  },

  async listarContasContabeis(
    token: string,
    organizacaoId: string
  ): Promise<ContaContabil[]> {
    const path = `/Contabilidade/contas?organizacaoId=${encodeURIComponent(
      organizacaoId
    )}`;
    return request<ContaContabil[]>(path, {}, token);
  },

  async criarContaContabil(
    token: string,
    payload: {
      organizacaoId: string;
      codigo: string;
      nome: string;
      grupo: string;
      natureza: string;
      nivel?: number | null;
      parentId?: string | null;
      codigoReferencialSped?: string | null;
    }
  ): Promise<ContaContabil> {
    return request<ContaContabil>(
      "/Contabilidade/contas",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async atualizarContaContabil(
    token: string,
    id: string,
    payload: {
      codigo: string;
      nome: string;
      grupo: string;
      natureza: string;
      nivel?: number | null;
      parentId?: string | null;
      ativa: boolean;
      codigoReferencialSped?: string | null;
    }
  ): Promise<void> {
    await request<void>(
      `/Contabilidade/contas/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async listarPeriodosContabeis(
    token: string,
    organizacaoId: string
  ): Promise<PeriodoContabil[]> {
    const path = `/Contabilidade/periodos?organizacaoId=${encodeURIComponent(
      organizacaoId
    )}`;
    return request<PeriodoContabil[]>(path, {}, token);
  },

  async criarPeriodoContabil(
    token: string,
    payload: {
      organizacaoId: string;
      competenciaInicio: string;
      competenciaFim: string;
      observacao?: string | null;
    }
  ): Promise<PeriodoContabil> {
    return request<PeriodoContabil>(
      "/Contabilidade/periodos",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async fecharPeriodoContabil(token: string, id: string): Promise<void> {
    await request<void>(
      `/Contabilidade/periodos/${encodeURIComponent(id)}/fechar`,
      { method: "POST" },
      token
    );
  },

  async reabrirPeriodoContabil(token: string, id: string): Promise<void> {
    await request<void>(
      `/Contabilidade/periodos/${encodeURIComponent(id)}/reabrir`,
      { method: "POST" },
      token
    );
  },

  async listarLancamentosContabeis(
    token: string,
    organizacaoId: string,
    options?: { competenciaInicio?: string; competenciaFim?: string }
  ): Promise<LancamentoContabil[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (options?.competenciaInicio) {
      search.set("competenciaInicio", options.competenciaInicio);
    }
    if (options?.competenciaFim) {
      search.set("competenciaFim", options.competenciaFim);
    }
    return request<LancamentoContabil[]>(
      `/Contabilidade/lancamentos?${search.toString()}`,
      {},
      token
    );
  },

  async criarLancamentoContabil(
    token: string,
    payload: {
      organizacaoId: string;
      competencia: string;
      dataLancamento?: string | null;
      historico: string;
      origem?: string | null;
      lancamentoFinanceiroId?: string | null;
      partidas: Array<{
        contaContabilId: string;
        tipo: string;
        valor: number;
        centroCustoId?: string | null;
      }>;
    }
  ): Promise<LancamentoContabil> {
    return request<LancamentoContabil>(
      "/Contabilidade/lancamentos",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async integrarFinanceiroContabil(
    token: string,
    payload: {
      organizacaoId: string;
      competenciaInicio?: string | null;
      competenciaFim?: string | null;
    }
  ): Promise<{
    total: number;
    criados: number;
    ignorados: number;
    semMapeamento: number;
  }> {
    return request<{
      Total: number;
      Criados: number;
      Ignorados: number;
      SemMapeamento: number;
    }>(
      "/Contabilidade/integrar-financeiro",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    ).then((data) => ({
      total: data.Total,
      criados: data.Criados,
      ignorados: data.Ignorados,
      semMapeamento: data.SemMapeamento
    }));
  },

  async obterBalancete(
    token: string,
    organizacaoId: string,
    options?: { competenciaInicio?: string; competenciaFim?: string }
  ): Promise<BalanceteItem[]> {
    const search = new URLSearchParams({ organizacaoId });
    if (options?.competenciaInicio) {
      search.set("competenciaInicio", options.competenciaInicio);
    }
    if (options?.competenciaFim) {
      search.set("competenciaFim", options.competenciaFim);
    }
    return request<BalanceteItem[]>(
      `/Contabilidade/balancete?${search.toString()}`,
      {},
      token
    );
  },

  async obterDre(
    token: string,
    organizacaoId: string,
    options?: { competenciaInicio?: string; competenciaFim?: string }
  ): Promise<DreResumo> {
    const search = new URLSearchParams({ organizacaoId });
    if (options?.competenciaInicio) {
      search.set("competenciaInicio", options.competenciaInicio);
    }
    if (options?.competenciaFim) {
      search.set("competenciaFim", options.competenciaFim);
    }
    return request<DreResumo>(
      `/Contabilidade/dre?${search.toString()}`,
      {},
      token
    );
  },

  async obterBalanco(
    token: string,
    organizacaoId: string,
    competenciaFim?: string
  ): Promise<BalancoResumo> {
    const search = new URLSearchParams({ organizacaoId });
    if (competenciaFim) {
      search.set("competenciaFim", competenciaFim);
    }
    return request<BalancoResumo>(
      `/Contabilidade/balanco?${search.toString()}`,
      {},
      token
    );
  }
};

