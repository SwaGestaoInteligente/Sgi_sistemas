export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
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

export interface Chamado {
  id: string;
  titulo: string;
  status: string;
}

export interface Reserva {
  id: string;
  status: string;
}

export interface LancamentoFinanceiro {
  id: string;
  organizacaoId: string;
  tipo: string; // "pagar" | "receber"
  situacao: string; // "pendente" | "pago" | "cancelado"
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

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Erro HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export const api = {
  async login(email: string, senha: string): Promise<LoginResponse> {
    return request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha })
    });
  },

  async listarOrganizacoes(): Promise<Organizacao[]> {
    return request<Organizacao[]>("/api/Organizacoes");
  },

  async criarOrganizacao(dados: {
    nome: string;
    tipo?: string;
    modulosAtivos?: string;
  }): Promise<Organizacao> {
    return request<Organizacao>("/api/Organizacoes", {
      method: "POST",
      body: JSON.stringify(dados)
    });
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
      "Content-Type": "application/json"
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
      throw new Error(text || `Erro HTTP ${res.status}`);
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

  async listarChamados(token: string): Promise<Chamado[]> {
    return request<Chamado[]>("/api/operacao/chamados", {}, token);
  },

  async listarReservas(token: string): Promise<Reserva[]> {
    return request<Reserva[]>("/api/operacao/reservas", {}, token);
  },

  async listarLancamentos(
    token: string,
    organizacaoId: string,
    contaId?: string
  ): Promise<LancamentoFinanceiro[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("organizacaoId", organizacaoId);
    if (contaId) {
      searchParams.set("contaId", contaId);
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

  async removerContaFinanceira(
    token: string,
    id: string
  ): Promise<void> {
    const headers: HeadersInit = {
      "Content-Type": "application/json"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/api/financeiro/contas/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Erro HTTP ${res.status}`);
    }
  },

  async atualizarStatusContaFinanceira(
    token: string,
    id: string,
    status: string
  ): Promise<void> {
    const headers: HeadersInit = {
      "Content-Type": "application/json"
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
      throw new Error(text || `Erro HTTP ${res.status}`);
    }
  }
};
