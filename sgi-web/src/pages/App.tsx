import React from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { LoginPage } from "./LoginPage";
import PessoasView from "../views/PessoasView";
import UnidadesView from "../views/UnidadesView";

function AppConteudo() {
  const { token, organizacaoSelecionada } = useAuth();

  if (!token) {
    return <LoginPage />;
  }

  if (!organizacaoSelecionada) {
    return <div>Selecione uma organização</div>;
  }

  return (
    <PessoasView organizacao={organizacaoSelecionada} />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppConteudo />
    </AuthProvider>
  );
}
