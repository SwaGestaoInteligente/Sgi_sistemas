import React, { useState } from "react";
import { api } from "../api";
import { useAuth } from "../hooks/useAuth";

export const LoginPage: React.FC = () => {
  const { setToken, setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
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
        memberships: res.memberships
      });
    } catch (err: any) {
      setErro(err.message || "Falha no login");
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
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
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
