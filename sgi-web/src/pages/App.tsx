import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { listarOrganizacoes } from "../api";
import { LoginPage } from "./LoginPage";

type Organizacao = {
  id: string;
  nome: string;
  tipo?: string | null;
  status?: string | null;
};

const InnerApp: React.FC = () => {
  const { token, setToken, setSession } = useAuth();
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarOrganizacoes = async () => {
    if (!token) return;
    setLoading(true);
    setErro(null);

    try {
      const data = await listarOrganizacoes();
      setOrganizacoes(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar organizacoes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarOrganizacoes();
  }, [token]);

  if (!token) {
    return <LoginPage />;
  }

  return (
    <div className="container org-page">
      <div className="org-header-row">
        <div>
          <h1>Organizacoes</h1>
          <p className="page-header-subtitle">
            Selecione uma organizacao para continuar.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={carregarOrganizacoes}
            disabled={loading}
          >
            {loading ? "Carregando..." : "Atualizar organizacoes"}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setToken(null);
              setSession(null);
            }}
          >
            Sair
          </button>
        </div>
      </div>

      {erro && <p className="error">{erro}</p>}

      {!loading && organizacoes.length === 0 && (
        <p className="org-empty">Nenhuma organizacao encontrada.</p>
      )}

      {organizacoes.length > 0 && (
        <div className="org-list-grid">
          {organizacoes.map((org) => (
            <div key={org.id} className="org-card">
              <div className="org-card-main">
                <div className="org-card-title">{org.nome}</div>
                {org.tipo && <div className="org-card-sub">{org.tipo}</div>}
                {org.status && <div className="org-card-sub">{org.status}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <InnerApp />
  </AuthProvider>
);

export default App;
