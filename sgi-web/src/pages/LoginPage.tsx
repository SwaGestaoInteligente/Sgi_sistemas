import React, { useState } from "react";
import { api } from "../api";
import { useAuth } from "../hooks/useAuth";

export const LoginPage: React.FC = () => {
  const { setToken, setSession } = useAuth();

  const [email, setEmail] = useState("admin@teste.com");
  const [senha, setSenha] = useState("Admin@123");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setLoading(true);

    try {
      const res = await api.login(email, senha);

      setToken(res.accessToken);

      setSession({
        userId: res.userId,
        pessoaId: res.pessoaId,
        isPlatformAdmin: res.isPlatformAdmin,
        memberships: res.memberships,
      });
    } catch (err: any) {
      setErro(err?.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-wrapper">
          <img
            src={`${import.meta.env.BASE_URL}swa1.jpeg`}
            alt="Logo SWA"
            className="brand-logo"
          />
        </div>

        <h1 className="auth-title">Bem-vindo!</h1>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Seu e-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            Sua senha
            <div className="auth-password-field">
              <input
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setMostrarSenha((prev) => !prev)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? (
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path
                      d="M3.2 4.6a1 1 0 0 1 1.4 0l14.8 14.8a1 1 0 0 1-1.4 1.4l-2.5-2.5A12.5 12.5 0 0 1 12 19c-5 0-9.4-3-11.3-7.5a1 1 0 0 1 0-.8A12.4 12.4 0 0 1 5.9 5.8L3.2 3.2a1 1 0 0 1 0-1.4zm6.1 6.1a3 3 0 0 0 4.1 4.1l-4.1-4.1zm1.7-1.7 4.7 4.7a3 3 0 0 0-4.7-4.7zm5.7 5.7-1.4-1.4a3 3 0 0 1-4.3-4.3L8.9 7.5A10.5 10.5 0 0 0 2.8 11c1.7 3.6 5.2 6 9.2 6 1.7 0 3.3-.4 4.7-1.2zm1-5.2a10.5 10.5 0 0 1 3.5 4.5c-.6 1.2-1.4 2.3-2.4 3.2l-1.4-1.4a8.4 8.4 0 0 0 2-2.8 10.5 10.5 0 0 0-4.7-4.8 10.8 10.8 0 0 0-5.6-1.6c-1 0-2 .1-2.9.4L6.1 5.2A12.9 12.9 0 0 1 12 4c2 0 4 .5 5.7 1.5a12.7 12.7 0 0 1 3.5 3.8 1 1 0 0 1 0 .8c-.2.4-.4.7-.6 1.1-1-1.8-2.4-3.3-4.2-4.5z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 5c-5 0-9.4 3-11.3 7.5a1 1 0 0 0 0 .8C2.6 17 7 20 12 20s9.4-3 11.3-7.5a1 1 0 0 0 0-.8C21.4 8 17 5 12 5zm0 13c-4 0-7.4-2.3-9.1-6 1.7-3.7 5.1-6 9.1-6s7.4 2.3 9.1 6c-1.7 3.7-5.1 6-9.1 6zm0-9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {erro && <p className="error">{erro}</p>}

          <div className="auth-links-row">
            <button type="button" className="link-button">
              Esqueceu sua senha?
            </button>
            <button type="button" className="link-button">
              Criar conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

