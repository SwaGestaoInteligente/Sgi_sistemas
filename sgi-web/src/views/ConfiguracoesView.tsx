import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, NotificacaoConfig, Organizacao, UnidadeOrganizacional } from "../api";
import { useAuth } from "../hooks/useAuth";

export type ConfiguracoesTab =
  | "blocos"
  | "apartamentos"
  | "dependencias"
  | "garagens"
  | "notificacoes";

export const menuConfiguracoes: Array<{ id: ConfiguracoesTab; label: string }> = [
  { id: "blocos", label: "Blocos" },
  { id: "apartamentos", label: "Apartamentos" },
  { id: "dependencias", label: "Dependencias" },
  { id: "garagens", label: "Garagens" },
  { id: "notificacoes", label: "Notificacoes" }
];

type ConfiguracoesViewProps = {
  organizacao: Organizacao;
  abaSelecionada?: ConfiguracoesTab;
  onAbaChange?: (aba: ConfiguracoesTab) => void;
  readOnly?: boolean;
};

type EventoNotificacao = {
  id: string;
  label: string;
  email: boolean;
  app: boolean;
};

const eventosPadrao: EventoNotificacao[] = [
  { id: "acesso_novo", label: "Acesso -> Novo acesso liberado", email: false, app: true },
  { id: "acesso_chegada", label: "Acesso -> Chegada registrada", email: false, app: true },
  { id: "acesso_saida", label: "Acesso -> Saida registrada", email: false, app: false },
  { id: "aviso_novo", label: "Aviso -> Novo aviso", email: true, app: true },
  { id: "chamado_novo", label: "Chamado -> Novo chamado", email: true, app: true },
  { id: "chamado_acao", label: "Chamado -> Nova acao", email: false, app: true },
  { id: "chamado_encerrado", label: "Chamado -> Chamado encerrado", email: true, app: false },
  { id: "conta_pagar_vencendo", label: "Financeiro -> Conta a pagar vencendo", email: true, app: true },
  { id: "cobranca_unidade_vencendo", label: "Financeiro -> Cobranca de unidade vencendo", email: true, app: true }
];

type UnidadesConfigProps = {
  organizacao: Organizacao;
  tipo: string;
  titulo: string;
  codigoLabel: string;
  nomeLabel: string;
  codigoPlaceholder: string;
  nomePlaceholder: string;
  readOnly: boolean;
};

const ConfiguracoesUnidadesTable: React.FC<UnidadesConfigProps> = ({
  organizacao,
  tipo,
  titulo,
  codigoLabel,
  nomeLabel,
  codigoPlaceholder,
  nomePlaceholder,
  readOnly
}) => {
  const { token } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [codigoInterno, setCodigoInterno] = useState("");
  const [nome, setNome] = useState("");
  const [filtroCodigo, setFiltroCodigo] = useState("");
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("ativos");

  const carregarUnidades = useCallback(async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarUnidades(token, organizacao.id);
      setUnidades(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar unidades");
    } finally {
      setLoading(false);
    }
  }, [organizacao.id, token]);

  useEffect(() => {
    void carregarUnidades();
  }, [carregarUnidades]);

  const unidadesFiltradas = useMemo(() => {
    return unidades.filter((u) => {
      if (u.tipo !== tipo) return false;
      if (filtroStatus !== "todos" && u.status !== filtroStatus) return false;
      if (filtroCodigo.trim() && !u.codigoInterno.includes(filtroCodigo.trim())) {
        return false;
      }
      if (
        filtroNome.trim() &&
        !u.nome.toLowerCase().includes(filtroNome.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [filtroCodigo, filtroNome, filtroStatus, tipo, unidades]);

  const salvarUnidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !organizacao) return;
    if (!nome.trim() || !codigoInterno.trim()) {
      setErro("Preencha codigo e nome.");
      return;
    }

    try {
      setErro(null);
      setLoading(true);
      const criada = await api.criarUnidade(token, {
        organizacaoId: organizacao.id,
        tipo,
        codigoInterno: codigoInterno.trim(),
        nome: nome.trim()
      });
      setUnidades((prev) => [...prev, criada]);
      setCodigoInterno("");
      setNome("");
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar unidade");
    } finally {
      setLoading(false);
    }
  };

  const editarUnidade = async (unidade: UnidadeOrganizacional) => {
    if (!token) return;
    const novoCodigo =
      window.prompt("Novo codigo interno:", unidade.codigoInterno) ??
      unidade.codigoInterno;
    const novoNome = window.prompt("Novo nome:", unidade.nome) ?? unidade.nome;
    if (!novoNome.trim()) return;

    try {
      setErro(null);
      setLoading(true);
      const atualizada = await api.atualizarUnidade(token, unidade.id, {
        nome: novoNome.trim(),
        codigoInterno: novoCodigo.trim(),
        tipo: unidade.tipo
      });
      setUnidades((prev) =>
        prev.map((u) => (u.id === atualizada.id ? atualizada : u))
      );
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar unidade");
    } finally {
      setLoading(false);
    }
  };

  const arquivarUnidade = async (unidade: UnidadeOrganizacional) => {
    if (!token) return;
    if (!window.confirm(`Arquivar "${unidade.nome}"?`)) return;
    try {
      setErro(null);
      setLoading(true);
      await api.arquivarUnidade(token, unidade.id);
      setUnidades((prev) => prev.filter((u) => u.id !== unidade.id));
    } catch (e: any) {
      setErro(e.message || "Erro ao arquivar unidade");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="config-page">
      <header className="config-header">
        <div>
          <h2>{titulo}</h2>
          <p className="config-subtitle">{organizacao.nome}</p>
        </div>
        <div className="config-actions">
          <button type="button" onClick={() => void carregarUnidades()}>
            {loading ? "Carregando..." : "Atualizar"}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setErro("Relatorio em desenvolvimento.")}
          >
            Relatorio
          </button>
          {!readOnly && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => setFormAberto((prev) => !prev)}
            >
              {formAberto ? "Fechar" : "Inserir"}
            </button>
          )}
        </div>
      </header>

      <section className="finance-table-card">
        {formAberto && !readOnly && (
          <form onSubmit={salvarUnidade} className="form config-form">
            <div className="finance-form-grid">
              <label>
                {codigoLabel}
                <input
                  value={codigoInterno}
                  onChange={(e) => setCodigoInterno(e.target.value)}
                  placeholder={codigoPlaceholder}
                />
              </label>
              <label>
                {nomeLabel}
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={nomePlaceholder}
                />
              </label>
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </form>
        )}

        <div className="config-filters">
          <label>
            <span>{codigoLabel}</span>
            <input
              value={filtroCodigo}
              onChange={(e) => setFiltroCodigo(e.target.value)}
              placeholder={codigoPlaceholder}
            />
          </label>
          <label>
            <span>{nomeLabel}</span>
            <input
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              placeholder={nomePlaceholder}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </label>
        </div>

        {erro && <p className="error">{erro}</p>}

        <table className="table finance-table config-table">
          <thead>
            <tr>
              <th />
              <th>{codigoLabel}</th>
              <th>{nomeLabel}</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {unidadesFiltradas.map((unidade) => (
              <tr key={unidade.id}>
                <td className="finance-actions-cell">
                  {!readOnly && (
                    <div className="table-actions">
                      <button
                        type="button"
                        className="action-primary"
                        onClick={() => void editarUnidade(unidade)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="action-secondary"
                        onClick={() => void arquivarUnidade(unidade)}
                      >
                        Arquivar
                      </button>
                    </div>
                  )}
                </td>
                <td>{unidade.codigoInterno}</td>
                <td>{unidade.nome}</td>
                <td>
                  <span
                    className={
                      "badge-status " +
                      (unidade.status === "ativo"
                        ? "badge-status--ativo"
                        : "badge-status--inativo")
                    }
                  >
                    {unidade.status === "ativo" ? "Ativo" : "Arquivado"}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && unidadesFiltradas.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center" }}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default function ConfiguracoesView(props: ConfiguracoesViewProps) {
  const { organizacao, abaSelecionada, readOnly = false } = props;
  const { token } = useAuth();
  const [notificacoes, setNotificacoes] = useState<NotificacaoConfig[]>([]);
  const [loadingNotificacoes, setLoadingNotificacoes] = useState(false);
  const [erroNotificacoes, setErroNotificacoes] = useState<string | null>(null);

  const abaAtual: ConfiguracoesTab = abaSelecionada ?? "blocos";

  const unidadesConfig = useMemo(() => {
    const mapa: Record<
      ConfiguracoesTab,
      {
        titulo: string;
        tipo: string;
        codigoLabel: string;
        nomeLabel: string;
        codigoPlaceholder: string;
        nomePlaceholder: string;
      }
    > = {
      blocos: {
        titulo: "Blocos",
        tipo: "Bloco",
        codigoLabel: "Bloco",
        nomeLabel: "Nome do bloco",
        codigoPlaceholder: "Ex.: 01",
        nomePlaceholder: "Ex.: Bloco A"
      },
      apartamentos: {
        titulo: "Apartamentos",
        tipo: "Apartamento",
        codigoLabel: "Apartamento",
        nomeLabel: "Responsavel financeiro",
        codigoPlaceholder: "Ex.: 101",
        nomePlaceholder: "Nome do responsavel"
      },
      dependencias: {
        titulo: "Dependencias",
        tipo: "Dependencia",
        codigoLabel: "Dependencia",
        nomeLabel: "Descricao/Disponibilidade",
        codigoPlaceholder: "Ex.: Quadra",
        nomePlaceholder: "Ex.: Horarios"
      },
      garagens: {
        titulo: "Garagens",
        tipo: "Garagem",
        codigoLabel: "Garagem",
        nomeLabel: "Proprietario/Locatario",
        codigoPlaceholder: "Ex.: G01",
        nomePlaceholder: "Nome do responsavel"
      },
      notificacoes: {
        titulo: "Notificacoes",
        tipo: "",
        codigoLabel: "Codigo",
        nomeLabel: "Nome",
        codigoPlaceholder: "",
        nomePlaceholder: ""
      }
    };
    return mapa[abaAtual];
  }, [abaAtual]);

  const carregarNotificacoes = useCallback(async () => {
    if (!token) return;
    try {
      setErroNotificacoes(null);
      setLoadingNotificacoes(true);
      const lista = await api.listarNotificacoesConfig(token, organizacao.id);
      if (lista.length === 0) {
        const criadas: NotificacaoConfig[] = [];
        for (const evento of eventosPadrao) {
          if (evento.email) {
            criadas.push(
              await api.criarNotificacaoConfig(token, {
                organizacaoId: organizacao.id,
                tipo: evento.id,
                canal: "email",
                ativo: true
              })
            );
          }
          if (evento.app) {
            criadas.push(
              await api.criarNotificacaoConfig(token, {
                organizacaoId: organizacao.id,
                tipo: evento.id,
                canal: "app",
                ativo: true,
                diasAntesVencimento:
                  evento.id === "conta_pagar_vencendo"
                    ? 5
                    : evento.id === "cobranca_unidade_vencendo"
                    ? 3
                    : undefined
              })
            );
          }
        }
        setNotificacoes(criadas);
      } else {
        setNotificacoes(lista);
      }
    } catch (e: any) {
      setErroNotificacoes(e.message || "Erro ao carregar notificacoes");
    } finally {
      setLoadingNotificacoes(false);
    }
  }, [organizacao.id, token]);

  useEffect(() => {
    if (abaAtual === "notificacoes") {
      void carregarNotificacoes();
    }
  }, [abaAtual, carregarNotificacoes]);

  const getConfig = (tipo: string, canal: "email" | "app") =>
    notificacoes.find((n) => n.tipo === tipo && n.canal === canal);

  const toggleNotificacao = async (tipo: string, canal: "email" | "app") => {
    if (!token) return;
    const existente = getConfig(tipo, canal);
    try {
      setErroNotificacoes(null);
      setLoadingNotificacoes(true);
      if (existente) {
        const atualizada = await api.atualizarNotificacaoConfig(
          token,
          existente.id,
          { ativo: !existente.ativo }
        );
        setNotificacoes((prev) =>
          prev.map((n) => (n.id === atualizada.id ? atualizada : n))
        );
      } else {
        const criada = await api.criarNotificacaoConfig(token, {
          organizacaoId: organizacao.id,
          tipo,
          canal,
          ativo: true
        });
        setNotificacoes((prev) => [...prev, criada]);
      }
    } catch (e: any) {
      setErroNotificacoes(e.message || "Erro ao salvar notificacao");
    } finally {
      setLoadingNotificacoes(false);
    }
  };

  const atualizarCampoNotificacao = async (
    tipo: string,
    canal: "email" | "app",
    campo: "diasAntesVencimento" | "limiteValor",
    valor: number
  ) => {
    if (!token) return;
    const existente = getConfig(tipo, canal);
    if (!existente) return;
    try {
      const atualizada = await api.atualizarNotificacaoConfig(token, existente.id, {
        [campo]: valor
      });
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === atualizada.id ? atualizada : n))
      );
    } catch (e: any) {
      setErroNotificacoes(e.message || "Erro ao atualizar notificacao");
    }
  };

  const restaurarPadrao = async () => {
    if (!token) return;
    try {
      setErroNotificacoes(null);
      setLoadingNotificacoes(true);
      for (const cfg of notificacoes) {
        if (cfg.ativo) {
          await api.atualizarNotificacaoConfig(token, cfg.id, { ativo: false });
        }
      }
      setNotificacoes([]);
      await carregarNotificacoes();
    } catch (e: any) {
      setErroNotificacoes(e.message || "Erro ao restaurar notificacoes");
    } finally {
      setLoadingNotificacoes(false);
    }
  };

  if (abaAtual !== "notificacoes") {
    return (
      <ConfiguracoesUnidadesTable
        organizacao={organizacao}
        tipo={unidadesConfig.tipo}
        titulo={unidadesConfig.titulo}
        codigoLabel={unidadesConfig.codigoLabel}
        nomeLabel={unidadesConfig.nomeLabel}
        codigoPlaceholder={unidadesConfig.codigoPlaceholder}
        nomePlaceholder={unidadesConfig.nomePlaceholder}
        readOnly={readOnly}
      />
    );
  }

  return (
    <div className="people-page">
      <section className="finance-table-card">
        <div className="finance-table-header">
          <h3>Configurar notificacoes</h3>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void restaurarPadrao()}
          >
            Restaurar padrao
          </button>
        </div>

        {erroNotificacoes && (
          <p className="error" style={{ marginBottom: 12 }}>
            {erroNotificacoes}
          </p>
        )}

        <table className="table finance-table">
          <thead>
            <tr>
              <th>Evento</th>
              <th>Enviar e-mail</th>
              <th>Enviar notificacao no app</th>
              <th>Dias antes</th>
              <th>Limite (R$)</th>
            </tr>
          </thead>
          <tbody>
            {eventosPadrao.map((evento) => {
              const emailCfg = getConfig(evento.id, "email");
              const appCfg = getConfig(evento.id, "app");
              const dias =
                appCfg?.diasAntesVencimento ?? emailCfg?.diasAntesVencimento ?? "";
              const limite =
                appCfg?.limiteValor ?? emailCfg?.limiteValor ?? "";
              const permiteAjuste =
                evento.id === "conta_pagar_vencendo" ||
                evento.id === "cobranca_unidade_vencendo";

              return (
                <tr key={evento.id}>
                  <td>{evento.label}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={emailCfg?.ativo ?? false}
                      disabled={loadingNotificacoes}
                      onChange={() => toggleNotificacao(evento.id, "email")}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={appCfg?.ativo ?? false}
                      disabled={loadingNotificacoes}
                      onChange={() => toggleNotificacao(evento.id, "app")}
                    />
                  </td>
                  <td>
                    {permiteAjuste ? (
                      <input
                        type="number"
                        min={0}
                        value={dias}
                        onChange={(e) =>
                          atualizarCampoNotificacao(
                            evento.id,
                            "app",
                            "diasAntesVencimento",
                            Number(e.target.value)
                          )
                        }
                        style={{ maxWidth: 90 }}
                      />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {permiteAjuste ? (
                      <input
                        type="number"
                        min={0}
                        value={limite}
                        onChange={(e) =>
                          atualizarCampoNotificacao(
                            evento.id,
                            "app",
                            "limiteValor",
                            Number(e.target.value)
                          )
                        }
                        style={{ maxWidth: 120 }}
                      />
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
