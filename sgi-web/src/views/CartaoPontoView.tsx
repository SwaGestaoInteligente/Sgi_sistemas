import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  ComprovanteMarcacao,
  EspelhoPonto,
  Organizacao,
  Pessoa,
  PontoAjuste,
  PontoFechamento,
  PontoMarcacao
} from "../api";
import { useAuth } from "../hooks/useAuth";

type CartaoPontoViewProps = {
  organizacao: Organizacao;
  readOnly?: boolean;
  allowManageAll?: boolean;
  pessoaLogadaId?: string | null;
};

type TipoMarcacao = "ENTRADA" | "INICIO_INTERVALO" | "FIM_INTERVALO" | "SAIDA";
type TipoSolicitacao = "INCLUSAO" | "CORRECAO";

const tipoLabel: Record<TipoMarcacao, string> = {
  ENTRADA: "Entrada",
  INICIO_INTERVALO: "Inicio intervalo",
  FIM_INTERVALO: "Fim intervalo",
  SAIDA: "Saida"
};

const formatarDataHora = (valor?: string | null) => {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatarData = (valor?: string | null) => {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR");
};

const isHoje = (valor?: string | null) => {
  if (!valor) return false;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return false;
  const hoje = new Date();
  return (
    data.getFullYear() === hoje.getFullYear() &&
    data.getMonth() === hoje.getMonth() &&
    data.getDate() === hoje.getDate()
  );
};

const competenciaAtual = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
};

const agoraLocalInput = () => {
  const data = new Date();
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  const hh = String(data.getHours()).padStart(2, "0");
  const mm = String(data.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

const baixarBlob = (blob: Blob, nome: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export default function CartaoPontoView({
  organizacao,
  readOnly,
  allowManageAll,
  pessoaLogadaId
}: CartaoPontoViewProps) {
  const { token } = useAuth();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [pessoaId, setPessoaId] = useState("");
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [marcacoes, setMarcacoes] = useState<PontoMarcacao[]>([]);
  const [espelho, setEspelho] = useState<EspelhoPonto | null>(null);
  const [comprovante, setComprovante] = useState<ComprovanteMarcacao | null>(null);
  const [ajustes, setAjustes] = useState<PontoAjuste[]>([]);
  const [fechamentos, setFechamentos] = useState<PontoFechamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvandoTipo, setSalvandoTipo] = useState<TipoMarcacao | null>(null);
  const [ajusteTipoSolicitacao, setAjusteTipoSolicitacao] =
    useState<TipoSolicitacao>("INCLUSAO");
  const [ajusteTipoMarcacao, setAjusteTipoMarcacao] = useState<TipoMarcacao>("ENTRADA");
  const [ajusteDataHora, setAjusteDataHora] = useState(agoraLocalInput);
  const [ajusteJustificativa, setAjusteJustificativa] = useState("");
  const [ajusteOriginalId, setAjusteOriginalId] = useState("");
  const [ajusteLoading, setAjusteLoading] = useState(false);
  const [fechamentoLoading, setFechamentoLoading] = useState(false);
  const [exportando, setExportando] = useState<"afd" | "aej" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const podeGerirPessoas = !!allowManageAll;
  const pessoaTravada = !podeGerirPessoas && !!pessoaLogadaId;

  const carregarPessoas = useCallback(async () => {
    if (!token) return;

    try {
      const lista = await api.listarPessoas(token, organizacao.id);
      const ordenada = [...lista].sort((a, b) => a.nome.localeCompare(b.nome));
      setPessoas(ordenada);

      if (pessoaTravada && pessoaLogadaId) {
        setPessoaId(pessoaLogadaId);
        return;
      }

      setPessoaId((atual) => {
        if (atual && ordenada.some((item) => item.id === atual)) return atual;
        if (pessoaLogadaId && ordenada.some((item) => item.id === pessoaLogadaId)) {
          return pessoaLogadaId;
        }
        return ordenada[0]?.id ?? "";
      });
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar pessoas para o cartao de ponto.");
    }
  }, [token, organizacao.id, pessoaTravada, pessoaLogadaId]);

  const carregarDados = useCallback(async () => {
    if (!token || !pessoaId) return;
    try {
      setLoading(true);
      setErro(null);
      const [listaMarcacoes, espelhoAtual, listaAjustes, listaFechamentos] = await Promise.all([
        api.listarPontoMarcacoes(token, {
          organizacaoId: organizacao.id,
          pessoaId
        }),
        api.obterEspelhoPonto(token, {
          organizacaoId: organizacao.id,
          pessoaId,
          competencia
        }),
        api.listarPontoAjustes(token, {
          organizacaoId: organizacao.id,
          pessoaId
        }),
        api.listarPontoFechamentos(token, {
          organizacaoId: organizacao.id,
          pessoaId,
          competencia
        })
      ]);
      setMarcacoes(listaMarcacoes);
      setEspelho(espelhoAtual);
      setAjustes(listaAjustes);
      setFechamentos(listaFechamentos);
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar cartao de ponto.");
    } finally {
      setLoading(false);
    }
  }, [token, organizacao.id, pessoaId, competencia]);

  useEffect(() => {
    void carregarPessoas();
  }, [carregarPessoas]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const registrar = async (tipo: TipoMarcacao) => {
    if (!token || !pessoaId) return;

    try {
      setErro(null);
      setMensagem(null);
      setSalvandoTipo(tipo);
      const marcacao = await api.registrarPontoMarcacao(token, {
        organizacaoId: organizacao.id,
        pessoaId,
        tipo,
        origem: "WEB"
      });
      const comprovanteMarcacao = await api.obterComprovanteMarcacao(token, marcacao.id);
      setComprovante(comprovanteMarcacao);
      setMensagem(`Marcacao registrada: ${tipoLabel[tipo]}.`);
      await carregarDados();
    } catch (e: any) {
      setErro(e?.message || "Erro ao registrar marcacao.");
    } finally {
      setSalvandoTipo(null);
    }
  };

  const solicitarAjuste = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !pessoaId) return;
    if (!ajusteJustificativa.trim()) {
      setErro("Informe a justificativa do ajuste.");
      return;
    }

    try {
      setErro(null);
      setMensagem(null);
      setAjusteLoading(true);
      await api.solicitarPontoAjuste(token, {
        organizacaoId: organizacao.id,
        pessoaId,
        marcacaoOriginalId: ajusteTipoSolicitacao === "CORRECAO" ? ajusteOriginalId || null : null,
        tipoSolicitacao: ajusteTipoSolicitacao,
        dataHoraSugerida: new Date(ajusteDataHora).toISOString(),
        tipoMarcacaoSugerida: ajusteTipoMarcacao,
        justificativa: ajusteJustificativa.trim()
      });
      setMensagem("Ajuste solicitado para aprovacao.");
      setAjusteJustificativa("");
      setAjusteOriginalId("");
      setAjusteDataHora(agoraLocalInput());
      await carregarDados();
    } catch (e: any) {
      setErro(e?.message || "Erro ao solicitar ajuste.");
    } finally {
      setAjusteLoading(false);
    }
  };

  const decidirAjuste = async (ajusteId: string, aprovar: boolean) => {
    if (!token) return;
    const motivo = window.prompt(
      aprovar ? "Motivo da aprovacao (opcional):" : "Motivo da reprovacao:",
      ""
    );

    try {
      setErro(null);
      setMensagem(null);
      setAjusteLoading(true);
      await api.decidirPontoAjuste(token, ajusteId, {
        aprovar,
        motivoDecisao: motivo || undefined
      });
      setMensagem(aprovar ? "Ajuste aprovado." : "Ajuste reprovado.");
      await carregarDados();
    } catch (e: any) {
      setErro(e?.message || "Erro ao decidir ajuste.");
    } finally {
      setAjusteLoading(false);
    }
  };

  const exportar = async (tipo: "afd" | "aej") => {
    if (!token || !pessoaId) return;
    try {
      setErro(null);
      setExportando(tipo);
      const blob =
        tipo === "afd"
          ? await api.exportarPontoAfd(token, {
              organizacaoId: organizacao.id,
              pessoaId
            })
          : await api.exportarPontoAej(token, {
              organizacaoId: organizacao.id,
              pessoaId,
              competencia
            });
      const nome = `${tipo}-${pessoaId}-${competencia}.csv`;
      baixarBlob(blob, nome);
    } catch (e: any) {
      setErro(e?.message || "Erro ao exportar arquivo.");
    } finally {
      setExportando(null);
    }
  };

  const fecharCompetencia = async () => {
    if (!token || !pessoaId) return;
    if (!window.confirm(`Fechar competencia ${competencia} para este colaborador?`)) {
      return;
    }
    try {
      setErro(null);
      setMensagem(null);
      setFechamentoLoading(true);
      await api.fecharPontoCompetencia(token, {
        organizacaoId: organizacao.id,
        pessoaId,
        competencia
      });
      setMensagem(`Competencia ${competencia} fechada com sucesso.`);
      await carregarDados();
    } catch (e: any) {
      setErro(e?.message || "Erro ao fechar competencia.");
    } finally {
      setFechamentoLoading(false);
    }
  };

  const pessoaAtual = useMemo(
    () => pessoas.find((item) => item.id === pessoaId) ?? null,
    [pessoas, pessoaId]
  );

  const marcacoesHoje = useMemo(
    () => marcacoes.filter((item) => isHoje(item.dataHoraMarcacao)),
    [marcacoes]
  );

  const ultimaMarcacao = marcacoes[0] ?? null;
  const competenciaFechada = fechamentos.some((item) => item.competencia === competencia);

  return (
    <div className="ponto-page">
      <section className="card ponto-card">
        <div className="ponto-header">
          <div>
            <h2>Cartao de ponto</h2>
            <p>Registro de jornada por colaborador com comprovante por marcacao.</p>
          </div>
          <div className="ponto-header-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => void carregarDados()}
              disabled={loading || !pessoaId}
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => void exportar("afd")}
              disabled={!pessoaId || exportando !== null}
            >
              {exportando === "afd" ? "Gerando..." : "Exportar AFD"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => void exportar("aej")}
              disabled={!pessoaId || exportando !== null}
            >
              {exportando === "aej" ? "Gerando..." : "Exportar AEJ"}
            </button>
            {podeGerirPessoas && (
              <button
                type="button"
                className="button-secondary"
                onClick={() => void fecharCompetencia()}
                disabled={!pessoaId || fechamentoLoading}
              >
                {fechamentoLoading ? "Fechando..." : "Fechar competencia"}
              </button>
            )}
          </div>
        </div>

        <div className="ponto-filters">
          <label>
            Colaborador
            <select
              value={pessoaId}
              onChange={(event) => setPessoaId(event.target.value)}
              disabled={loading || pessoaTravada}
            >
              <option value="">Selecione</option>
              {pessoas.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Competencia
            <input
              type="month"
              value={competencia}
              onChange={(event) => setCompetencia(event.target.value)}
            />
          </label>
        </div>

        {erro && <p className="error">{erro}</p>}
        {mensagem && <p className="success">{mensagem}</p>}
        {competenciaFechada && (
          <p className="error">
            Competencia {competencia} fechada para este colaborador. Novas marcacoes e ajustes
            retroativos estao bloqueados.
          </p>
        )}

        <div className="ponto-stats">
          <div className="ponto-stat">
            <span className="ponto-stat-label">Hoje</span>
            <strong>{marcacoesHoje.length} marcacoes</strong>
          </div>
          <div className="ponto-stat">
            <span className="ponto-stat-label">Ultima marcacao</span>
            <strong>
              {ultimaMarcacao
                ? `${tipoLabel[ultimaMarcacao.tipo]} - ${formatarDataHora(
                    ultimaMarcacao.dataHoraMarcacao
                  )}`
                : "Sem registros"}
            </strong>
          </div>
          <div className="ponto-stat">
            <span className="ponto-stat-label">Horas na competencia</span>
            <strong>{(espelho?.totalHoras ?? 0).toFixed(2)} h</strong>
          </div>
        </div>

        <div className="ponto-actions">
          {(["ENTRADA", "INICIO_INTERVALO", "FIM_INTERVALO", "SAIDA"] as TipoMarcacao[]).map(
            (tipo) => (
              <button
                key={tipo}
                type="button"
                className="button-secondary"
                onClick={() => void registrar(tipo)}
                disabled={
                  readOnly ||
                  !pessoaId ||
                  salvandoTipo !== null ||
                  !token ||
                  loading ||
                  competenciaFechada
                }
              >
                {salvandoTipo === tipo ? "Registrando..." : tipoLabel[tipo]}
              </button>
            )
          )}
        </div>
      </section>

      <section className="card ponto-card">
        <h3>Ajustes de ponto</h3>
        <p className="muted-text">
          A marcacao original nao e editada. Ajustes aprovados geram uma nova marcacao com
          trilha de auditoria.
        </p>
        <form className="form" onSubmit={solicitarAjuste}>
          <div className="ponto-filters">
            <label>
              Tipo solicitacao
              <select
                value={ajusteTipoSolicitacao}
                onChange={(event) =>
                  setAjusteTipoSolicitacao(event.target.value as TipoSolicitacao)
                }
              >
                <option value="INCLUSAO">Inclusao</option>
                <option value="CORRECAO">Correcao</option>
              </select>
            </label>
            <label>
              Tipo marcacao sugerida
              <select
                value={ajusteTipoMarcacao}
                onChange={(event) => setAjusteTipoMarcacao(event.target.value as TipoMarcacao)}
              >
                <option value="ENTRADA">Entrada</option>
                <option value="INICIO_INTERVALO">Inicio intervalo</option>
                <option value="FIM_INTERVALO">Fim intervalo</option>
                <option value="SAIDA">Saida</option>
              </select>
            </label>
            <label>
              Data/Hora sugerida
              <input
                type="datetime-local"
                value={ajusteDataHora}
                onChange={(event) => setAjusteDataHora(event.target.value)}
              />
            </label>
            {ajusteTipoSolicitacao === "CORRECAO" && (
              <label>
                Marcacao original
                <select
                  value={ajusteOriginalId}
                  onChange={(event) => setAjusteOriginalId(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {marcacoes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatarDataHora(item.dataHoraMarcacao)} - {tipoLabel[item.tipo]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label>
            Justificativa
            <textarea
              value={ajusteJustificativa}
              onChange={(event) => setAjusteJustificativa(event.target.value)}
              rows={3}
              placeholder="Descreva o motivo do ajuste."
            />
          </label>
          <button
            type="submit"
            disabled={!pessoaId || ajusteLoading || readOnly || competenciaFechada}
          >
            {ajusteLoading ? "Enviando..." : "Solicitar ajuste"}
          </button>
        </form>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Solicitado em</th>
                <th>Tipo</th>
                <th>Data sugerida</th>
                <th>Status</th>
                <th>Justificativa</th>
                <th>Acao</th>
              </tr>
            </thead>
            <tbody>
              {ajustes.map((item) => (
                <tr key={item.id}>
                  <td>{formatarDataHora(item.solicitadoEm)}</td>
                  <td>
                    {item.tipoSolicitacao} / {tipoLabel[item.tipoMarcacaoSugerida]}
                  </td>
                  <td>{formatarDataHora(item.dataHoraSugerida)}</td>
                  <td>{item.status}</td>
                  <td>{item.justificativa}</td>
                  <td>
                    {podeGerirPessoas && item.status === "PENDENTE" ? (
                      <div className="table-actions">
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => void decidirAjuste(item.id, true)}
                          disabled={ajusteLoading}
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => void decidirAjuste(item.id, false)}
                          disabled={ajusteLoading}
                        >
                          Reprovar
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
              {ajustes.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    Nenhum ajuste no periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {comprovante && (
        <section className="card ponto-card">
          <h3>Ultimo comprovante</h3>
          <div className="ponto-proof-grid">
            <p>
              <strong>NSR:</strong> {comprovante.nsr}
            </p>
            <p>
              <strong>Tipo:</strong> {comprovante.tipo}
            </p>
            <p>
              <strong>Data/Hora:</strong> {formatarDataHora(comprovante.dataHoraMarcacao)}
            </p>
            <p>
              <strong>Hash:</strong> {comprovante.hashComprovante}
            </p>
          </div>
        </section>
      )}

      <section className="card ponto-card">
        <h3>Espelho da competencia ({competencia})</h3>
        {pessoaAtual && <p className="muted-text">Colaborador: {pessoaAtual.nome}</p>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Entrada</th>
                <th>Inicio intervalo</th>
                <th>Fim intervalo</th>
                <th>Saida</th>
                <th>Horas</th>
                <th>Marcacoes</th>
              </tr>
            </thead>
            <tbody>
              {(espelho?.dias ?? []).map((dia) => (
                <tr key={dia.data}>
                  <td>{formatarData(dia.data)}</td>
                  <td>{dia.entrada || "-"}</td>
                  <td>{dia.inicioIntervalo || "-"}</td>
                  <td>{dia.fimIntervalo || "-"}</td>
                  <td>{dia.saida || "-"}</td>
                  <td>{dia.horasTrabalhadas.toFixed(2)}</td>
                  <td>{dia.totalMarcacoes}</td>
                </tr>
              ))}
              {(espelho?.dias ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    Nenhuma marcacao para esta competencia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
