import axios from "axios";

const API_BASE_URL = "http://localhost:7000/api";
const AUTH_STORAGE_KEY = "swa:auth:token";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

const applyAuthHeader = () => {
  try {
    const token = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  } catch {
    // Ignore localStorage failures
  }
};

export async function login(email: string, senha: string) {
  const { data } = await api.post("/auth/login", {
    email,
    senha
  });

  if (data?.accessToken) {
    api.defaults.headers.common["Authorization"] = `Bearer ${data.accessToken}`;
  }

  return data;
}

export async function listarOrganizacoes() {
  applyAuthHeader();
  const { data } = await api.get("/organizacoes");
  return data;
}
