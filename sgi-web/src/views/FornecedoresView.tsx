import { useState } from "react";
import { Organizacao } from "../api";
import PessoasView from "./PessoasView";

type FornecedoresViewProps = {
  organizacao: Organizacao;
  readOnly?: boolean;
};

type Aba = "fornecedores" | "prestadores";

const abas: Array<{ id: Aba; label: string; papel: string }> = [
  { id: "fornecedores", label: "Fornecedores", papel: "fornecedor" },
  { id: "prestadores", label: "Prestadores", papel: "prestador" }
];

export default function FornecedoresView({
  organizacao,
  readOnly
}: FornecedoresViewProps) {
  const [aba, setAba] = useState<Aba>("fornecedores");
  const abaAtual = abas.find((item) => item.id === aba) ?? abas[0];

  return (
    <div className="people-page">
      <div className="people-header-row" style={{ marginBottom: 12 }}>
        <div>
          <h2>Fornecedores</h2>
          <p className="people-header-sub">Base de parceiros e prestadores.</p>
        </div>
        <div className="people-actions" style={{ display: "flex", gap: 8 }}>
          {abas.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === aba ? "primary-button" : "button-secondary"}
              onClick={() => setAba(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <PessoasView
        organizacao={organizacao}
        papelFixo={abaAtual.papel}
        titulo={abaAtual.label}
        readOnly={readOnly}
      />
    </div>
  );
}
