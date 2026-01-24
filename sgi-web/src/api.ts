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

  async listarContas(token: string): Promise<ContaFinanceira[]> {
    return request<ContaFinanceira[]>("/api/financeiro/contas", {}, token);
  },

  async listarChamados(token: string): Promise<Chamado[]> {
    return request<Chamado[]>("/api/operacao/chamados", {}, token);
  },

  async listarReservas(token: string): Promise<Reserva[]> {
    return request<Reserva[]>("/api/operacao/reservas", {}, token);
  }
};
