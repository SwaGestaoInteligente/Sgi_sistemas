import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Anexo, api } from "../api";
import { useAuth } from "../hooks/useAuth";

type AnexosPanelProps = {
  organizacaoId: string;
  tipoEntidade: string;
  entidadeId?: string | null;
  titulo?: string;
  readOnly?: boolean;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
];
const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "-";
  const sizes = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < sizes.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${sizes[index]}`;
};

const validarArquivo = (file: File) => {
  if (!file) return "Selecione um arquivo.";
  if (file.size > MAX_FILE_SIZE) {
    return "Arquivo excede o limite de 10MB.";
  }
  const ext = file.name ? `.${file.name.split(".").pop()}`.toLowerCase() : "";
  const hasExt = ALLOWED_EXT.includes(ext);
  const hasType = file.type ? ALLOWED_TYPES.includes(file.type) : false;
  if (!hasExt && !hasType) {
    return "Tipo de arquivo nao permitido. Use PDF ou imagens (JPG/PNG/WEBP).";
  }
  return null;
};

export default function AnexosPanel({
  organizacaoId,
  tipoEntidade,
  entidadeId,
  titulo = "Anexos",
  readOnly = false
}: AnexosPanelProps) {
  const { token } = useAuth();
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);

  const podeCarregar = useMemo(
    () => Boolean(token && organizacaoId && entidadeId),
    [token, organizacaoId, entidadeId]
  );

  const carregar = useCallback(async () => {
    if (!podeCarregar || !entidadeId) {
      setAnexos([]);
      return;
    }
    try {
      setErro(null);
      const lista = await api.listarAnexos(
        token!,
        organizacaoId,
        tipoEntidade,
        entidadeId
      );
      setAnexos(lista);
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar anexos.");
    }
  }, [entidadeId, organizacaoId, podeCarregar, tipoEntidade, token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const enviar = async () => {
    if (!token || !entidadeId || !arquivo) return;
    const erroValidacao = validarArquivo(arquivo);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }
    try {
      setErro(null);
      setLoading(true);
      await api.uploadAnexo(token, {
        organizacaoId,
        tipoEntidade,
        entidadeId,
        arquivo
      });
      setArquivo(null);
      await carregar();
    } catch (e: any) {
      setErro(e?.message || "Erro ao enviar anexo.");
    } finally {
      setLoading(false);
    }
  };

  const baixar = async (anexo: Anexo) => {
    if (!token) return;
    try {
      const blob = await api.baixarAnexo(token, anexo.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) {
      setErro(e?.message || "Erro ao baixar anexo.");
    }
  };

  const remover = async (anexo: Anexo) => {
    if (!token) return;
    if (!window.confirm(`Remover o anexo "${anexo.nomeArquivo}"?`)) return;
    try {
      setErro(null);
      setLoading(true);
      await api.removerAnexo(token, anexo.id);
      await carregar();
    } catch (e: any) {
      setErro(e?.message || "Erro ao remover anexo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="finance-table-header">
        <h4>{titulo}</h4>
      </div>

      {!entidadeId && (
        <p className="finance-form-sub">Selecione um item para ver anexos.</p>
      )}

      {entidadeId && !readOnly && (
        <div className="finance-form-inline" style={{ marginBottom: 8 }}>
          <input
            type="file"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="button-secondary"
            onClick={enviar}
            disabled={!arquivo || loading}
          >
            {loading ? "Enviando..." : "Enviar"}
          </button>
        </div>
      )}

      {erro && <p className="error">{erro}</p>}

      {entidadeId && (
        <ul className="list">
          {anexos.map((anexo) => (
            <li
              key={anexo.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => void baixar(anexo)}
                >
                  {anexo.nomeArquivo}
                </button>
                <span className="finance-item-sub">
                  {formatBytes(anexo.tamanho)} •{" "}
                  {new Date(anexo.criadoEm).toLocaleString("pt-BR")}
                </span>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() => void remover(anexo)}
                  disabled={loading}
                >
                  Remover
                </button>
              )}
            </li>
          ))}
          {anexos.length === 0 && (
            <li className="empty">Nenhum anexo encontrado.</li>
          )}
        </ul>
      )}
    </div>
  );
}
