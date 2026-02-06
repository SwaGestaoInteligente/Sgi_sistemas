const rawApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";
export const API_BASE_URL = rawApiBaseUrl.trim().replace(/\/+$/, "");
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

function throwHttpError(status: number, text: string): never {
  if (status === 401) {
    handleUnauthorizedResponse();
    throw new Error("Sessao expirada. Faca login novamente.");
  }
  throw new Error(text || `Erro HTTP ${status}`);
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
  unidadeOrganizacionalId?: string | null;
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
export interface UnidadeOrganizacional {
  id: string;
  organizacaoId: string;
  tipo: string;
  codigoInterno: string;
  nome: string;
  status: string;
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
}

export interface RecursoReservavel {
  id: string;
  organizacaoId: string;
  unidadeOrganizacionalId?: string | null;
  nome: string;
  tipo?: string;
  capacidade?: number | null;
  regrasJson?: string | null;
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

export interface ConciliacaoExtratoItem {
  index: number;
  data: string;
  descricao: string;
  valor: number;
  documento?: string;
  sugestaoLancamentoId?: string;
  sugestaoDescricao?: string;
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

export const api = {
  async login(email: string, senha: string): Promise<LoginResponse> {
    return request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha })
    });
  },

  async listarOrganizacoes(token: string): Promise<Organizacao[]> {
    return request<Organizacao[]>("/api/Organizacoes", {}, token);
  },

  async listarMinhasOrganizacoes(token: string): Promise<Organizacao[]> {
    return request<Organizacao[]>("/api/Organizacoes/minhas", {}, token);
  },

  async criarOrganizacao(token: string, dados: {
    nome: string;
    tipo?: string;
    modulosAtivos?: string;
  }): Promise<Organizacao> {
    return request<Organizacao>("/api/Organizacoes", {
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
    const path = `/api/Organizacoes/${encodeURIComponent(id)}`;
    return request<Organizacao>(path, {
      method: "PUT",
      body: JSON.stringify(dados)
    }, token);
  },
  async listarUnidades(
    token: string,
    organizacaoId: string
  ): Promise<UnidadeOrganizacional[]> {
    const path = `/api/unidades?organizacaoId=${encodeURIComponent(
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
    }
  ): Promise<UnidadeOrganizacional> {
    return request<UnidadeOrganizacional>(
      "/api/unidades",
      {
        method: "POST",
        body: JSON.stringify({
          organizacaoId: payload.organizacaoId,
          tipo: payload.tipo,
          codigoInterno: payload.codigoInterno,
          nome: payload.nome
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
    }
  ): Promise<UnidadeOrganizacional> {
    const path = `/api/unidades/${encodeURIComponent(id)}`;
    return request<UnidadeOrganizacional>(
      path,
      {
        method: "PUT",
        body: JSON.stringify({
          nome: payload.nome,
          codigoInterno: payload.codigoInterno ?? "",
          tipo: payload.tipo ?? ""
        })
      },
      token
    );
  },

  async listarPessoas(
    token: string,
    organizacaoId: string
  ): Promise<Pessoa[]> {
    const path = `/api/Pessoas?organizacaoId=${encodeURIComponent(
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
      "/api/Pessoas",
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
    const path = `/api/Pessoas/${encodeURIComponent(
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
    const path = `/api/Pessoas/${encodeURIComponent(
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
      ? `/api/financeiro/contas?organizacaoId=${encodeURIComponent(
          organizacaoId
        )}`
      : "/api/financeiro/contas";
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
      "/api/financeiro/contas",
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
    return request<Chamado[]>(`/api/operacao/chamados${suffix}`, {}, token);
  },

  async criarChamado(token: string, payload: Chamado): Promise<Chamado> {
    return request<Chamado>(
      "/api/operacao/chamados",
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
      `/api/operacao/chamados/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      },
      token
    );
  },

  async listarHistoricoChamado(
    token: string,
    id: string
  ): Promise<ChamadoHistorico[]> {
    return request<ChamadoHistorico[]>(
      `/api/operacao/chamados/${encodeURIComponent(id)}/historico`,
      {},
      token
    );
  },

  async listarRecursos(
    token: string,
    organizacaoId: string
  ): Promise<RecursoReservavel[]> {
    const suffix = `?organizacaoId=${encodeURIComponent(organizacaoId)}`;
    return request<RecursoReservavel[]>(`/api/operacao/recursos${suffix}`, {}, token);
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
      ativo?: boolean;
    }
  ): Promise<RecursoReservavel> {
    return request<RecursoReservavel>(
      "/api/operacao/recursos",
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
      ativo?: boolean;
    }
  ): Promise<RecursoReservavel> {
    return request<RecursoReservavel>(
      `/api/operacao/recursos/${encodeURIComponent(id)}`,
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
    await request<void>(`/api/operacao/recursos/${encodeURIComponent(id)}${suffix}`, {
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
      `/api/operacao/reservas${suffix ? `?${suffix}` : ""}`,
      {},
      token
    );
  },

  async criarReserva(token: string, payload: Reserva): Promise<Reserva> {
    return request<Reserva>(
      "/api/operacao/reservas",
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
    payload: { status: string }
  ): Promise<Reserva> {
    return request<Reserva>(
      `/api/operacao/reservas/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      },
      token
    );
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
      `/api/veiculos?${searchParams.toString()}`,
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
      "/api/veiculos",
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
      `/api/veiculos/${encodeURIComponent(id)}`,
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
      `/api/veiculos/${encodeURIComponent(id)}${suffix}`,
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
      `/api/pets?${searchParams.toString()}`,
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
      "/api/pets",
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
      `/api/pets/${encodeURIComponent(id)}`,
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
      `/api/pets/${encodeURIComponent(id)}${suffix}`,
      { method: "DELETE" },
      token
    );
  },

  async seedDemoFull(): Promise<any> {
    return request<any>(
      "/api/dev/seed-demo-full",
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
    const path = `/api/financeiro/planos-contas${suffix ? `?${suffix}` : ""}`;
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
      "/api/financeiro/planos-contas",
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
    const path = `/api/financeiro/planos-contas/${encodeURIComponent(id)}`;
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
    const path = `/api/financeiro/planos-contas/${encodeURIComponent(id)}`;
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
    const path = `/api/financeiro/cotas?organizacaoId=${encodeURIComponent(
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
      "/api/financeiro/cotas",
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
    const path = `/api/financeiro/faturas?${searchParams.toString()}`;
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
      "/api/financeiro/faturas",
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
      `/api/financeiro/faturas/${encodeURIComponent(id)}/status`,
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
    const path = `/api/financeiro/itens-cobrados${suffix ? `?${suffix}` : ""}`;
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
      "/api/financeiro/itens-cobrados",
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
      `/api/financeiro/itens-cobrados/${encodeURIComponent(id)}`,
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
      `/api/financeiro/itens-cobrados/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ ativo })
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

    const path = `/api/financeiro/lancamentos?${searchParams.toString()}`;
    return request<LancamentoFinanceiro[]>(path, {}, token);
  },

  async criarLancamento(
    token: string,
    payload: Omit<LancamentoFinanceiro, "id">
  ): Promise<LancamentoFinanceiro> {
    return request<LancamentoFinanceiro>(
      "/api/financeiro/lancamentos",
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
      `/api/financeiro/lancamentos/${encodeURIComponent(id)}/pagar`,
      {
        method: "POST"
      },
      token
    );
  },

  async cancelarLancamento(
    token: string,
    id: string
  ): Promise<void> {
    await request<void>(
      `/api/financeiro/lancamentos/${encodeURIComponent(id)}/cancelar`,
      {
        method: "POST"
      },
      token
    );
  },

  async arquivarUnidade(token: string, id: string): Promise<void> {
    const path = `/api/unidades/${encodeURIComponent(id)}/arquivar`;
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
      `/api/financeiro/lancamentos/${encodeURIComponent(id)}/aprovar`,
      { method: "POST" },
      token
    );
  },

  async conciliarLancamento(token: string, id: string): Promise<void> {
    await request<void>(
      `/api/financeiro/lancamentos/${encodeURIComponent(id)}/conciliar`,
      { method: "POST" },
      token
    );
  },

  async fecharLancamento(token: string, id: string): Promise<void> {
    await request<void>(
      `/api/financeiro/lancamentos/${encodeURIComponent(id)}/fechar`,
      { method: "POST" },
      token
    );
  },

  async reabrirLancamento(token: string, id: string): Promise<void> {
    await request<void>(
      `/api/financeiro/lancamentos/${encodeURIComponent(id)}/reabrir`,
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

    const res = await fetch(`${API_BASE_URL}/api/financeiro/uploads`, {
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
    arquivo: File
  ): Promise<ConciliacaoImportResponse> {
    const formData = new FormData();
    formData.append("organizacaoId", organizacaoId);
    formData.append("arquivo", arquivo);

    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/api/financeiro/conciliacao/importar`, {
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
    payload?: { dataConciliacao?: string; referencia?: string; documento?: string }
  ): Promise<void> {
    await request<void>(
      `/api/financeiro/conciliacao/${encodeURIComponent(lancamentoId)}/confirmar`,
      {
        method: "POST",
        body: JSON.stringify({
          organizacaoId,
          dataConciliacao: payload?.dataConciliacao,
          referencia: payload?.referencia,
          documento: payload?.documento
        })
      },
      token
    );
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
      "/api/financeiro/transferencias",
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
      `${API_BASE_URL}/api/financeiro/contas/${encodeURIComponent(id)}`,
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
      `${API_BASE_URL}/api/financeiro/contas/${encodeURIComponent(
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
  }
};
