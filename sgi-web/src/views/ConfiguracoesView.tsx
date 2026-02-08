import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, NotificacaoConfig, Organizacao, UnidadeOrganizacional } from "../api";
import { useAuth } from "../hooks/useAuth";

export type ConfiguracoesTab =
  | "cadastros-base"
  | "estrutura-condominio"
  | "pessoas-papeis"
  | "financeiro-base";

export const menuConfiguracoes: Array<{ id: ConfiguracoesTab; label: string }> = [
  { id: "cadastros-base", label: "Cadastros base" },
  { id: "estrutura-condominio", label: "Estrutura do condominio" },
  { id: "pessoas-papeis", label: "Pessoas & papeis" },
  { id: "financeiro-base", label: "Financeiro (base)" }
];

type CadastroBaseTipo =
  | "tipo_receita"
  | "tipo_despesa"
  | "tipo_acordo"
  | "tipo_inadimplencia"
  | "tipo_documento"
  | "tipo_aviso"
  | "tipo_campanha"
  | "tipo_cobranca"
  | "tipo_notificacao"
  | "tag_generica"
  | "categoria_financeira"
  | "centro_custo"
  | "forma_pagamento"
  | "status_financeiro";

type CadastroBaseRegistro = {
  id: string;
  tipo: CadastroBaseTipo;
  codigo: string;
  nome: string;
  descricao: string;
  parent: string;
  status: "ativo" | "arquivado";
};

const cadastroBaseConfig: Record<
  CadastroBaseTipo,
  {
    label: string;
    descricao: string;
    codigoLabel: string;
    nomeLabel: string;
    codigoPlaceholder: string;
    nomePlaceholder: string;
  }
> = {
  tipo_receita: {
    label: "Tipos de receita",
    descricao: "Vocabulário de receitas que o sistema aceita.",
    codigoLabel: "Codigo",
    nomeLabel: "Nome do tipo",
    codigoPlaceholder: "Ex.: COND",
    nomePlaceholder: "Ex.: Condomínio"
  },
  tipo_despesa: {
    label: "Tipos de despesa",
    descricao: "Classificações de despesas e custos.",
    codigoLabel: "Codigo",
    nomeLabel: "Nome do tipo",
    codigoPlaceholder: "Ex.: MANUT",
    nomePlaceholder: "Ex.: Manutenção"
  },
  tipo_acordo: {
    label: "Tipos de acordo",
    descricao: "Modelos de acordo flexíveis e reutilizáveis.",
    codigoLabel: "Codigo",
    nomeLabel: "Nome do tipo",
    codigoPlaceholder: "Ex.: AC-01",
    nomePlaceholder: "Ex.: Acordo padrão"
  },
  tipo_inadimplencia: {
    label: "Tipos de inadimplência",
    descricao: "Classificações de inadimplência e cobrança.",
    codigoLabel: "Codigo",
    nomeLabel: "Nome do tipo",
    codigoPlaceholder: "Ex.: INAD-01",
    nomePlaceholder: "Ex.: Inadimplência leve"
  },
  tipo_documento: {
    label: "Tipos de documento",
    descricao: "Modelos de documentos usados no sistema.",
    codigoLabel: "Codigo",
    nomeLabel: "Nome do tipo",
    codigoPlaceholder: "Ex.: DOC-01",
    nomePlaceholder: "Ex.: Ata de reunião"
  },
  tipo_aviso: {
    label: "Tipos de aviso",
    descricao: "Avisos e comunicados organizados por tipo.",
    codigoLabel: "Codigo",
    nomeLabel: "Nome do tipo",
    codigoPlaceholder: "Ex.: AV-01",
    nomePlaceholder: "Ex.: Aviso de manutenção"
  },
  tipo_campanha: {
    label: "Tipos de campanha",
    descricao: "Campanhas e comunicações recorrentes.",
    codigoLabel: "Codigo",
    nomeLabel: "Nome do tipo",
    codigoPlaceholder: "Ex.: CP-01",
    nomePlaceholder: "Ex.: Campanha de economia"
  },
  tipo_cobranca: {
    label: "Tipos de cobrança",
    descricao: "Cobrancas diferenciadas por tipo.",
    codigoLabel: "Codigo",
    nomeLabel: "Nome do tipo",
    codigoPlaceholder: "Ex.: COB-01",
    nomePlaceholder: "Ex.: Cobrança avulsa"
  },
  tipo_notificacao: {
    label: "Tipos de notificação",
    descricao: "Canais e categorias de notificação.",
    codigoLabel: "Codigo",
    nomeLabel: "Nome do tipo",
    codigoPlaceholder: "Ex.: NOT-01",
    nomePlaceholder: "Ex.: Notificação de vencimento"
  },
  tag_generica: {
    label: "Tags genéricas",
    descricao: "Rótulos livres usados em qualquer módulo.",
    codigoLabel: "Codigo",
    nomeLabel: "Nome da tag",
    codigoPlaceholder: "Ex.: PRIOR",
    nomePlaceholder: "Ex.: Prioridade alta"
  },
  categoria_financeira: {
    label: "Categorias financeiras",
    descricao: "Hierarquia pai/filho para agrupar receitas e despesas.",
    codigoLabel: "Categoria",
    nomeLabel: "Nome da categoria",
    codigoPlaceholder: "Ex.: MANUT",
    nomePlaceholder: "Ex.: Manutenção"
  },
  centro_custo: {
    label: "Centros de custo",
    descricao: "Organização flexível para relatórios e controle.",
    codigoLabel: "Centro",
    nomeLabel: "Nome do centro",
    codigoPlaceholder: "Ex.: CC-01",
    nomePlaceholder: "Ex.: Administrativo"
  },
  forma_pagamento: {
    label: "Formas de pagamento",
    descricao: "Métodos e meios de pagamento aceitos.",
    codigoLabel: "Forma",
    nomeLabel: "Nome da forma",
    codigoPlaceholder: "Ex.: PIX",
    nomePlaceholder: "Ex.: Pix"
  },
  status_financeiro: {
    label: "Status financeiros",
    descricao: "Status usados em todo o financeiro.",
    codigoLabel: "Status",
    nomeLabel: "Nome do status",
    codigoPlaceholder: "Ex.: ABERTO",
    nomePlaceholder: "Ex.: Aberto"
  }
};

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
  voltarLabel?: string;
  onVoltar?: () => void;
};

type CadastrosBaseProps = {
  organizacao: Organizacao;
  tipo: CadastroBaseTipo;
  registros: CadastroBaseRegistro[];
  onCreate: (registro: CadastroBaseRegistro) => void;
  onUpdate: (registro: CadastroBaseRegistro) => void;
  onArchive: (registro: CadastroBaseRegistro) => void;
  onVoltar: () => void;
  onTipoChange?: (tipo: CadastroBaseTipo) => void;
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
  readOnly,
  voltarLabel,
  onVoltar
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
  const [filtroStatus, setFiltroStatus] = useState("ativo");

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
          {onVoltar && (
            <button type="button" className="button-secondary" onClick={onVoltar}>
              {voltarLabel ?? "Voltar"}
            </button>
          )}
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

const CadastrosBaseTable: React.FC<CadastrosBaseProps> = ({
  organizacao,
  tipo,
  registros,
  onCreate,
  onUpdate,
  onArchive,
  onVoltar,
  onTipoChange,
  readOnly
}) => {
  const config = cadastroBaseConfig[tipo];
  const [formAberto, setFormAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [parent, setParent] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [filtroCodigo, setFiltroCodigo] = useState("");
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("ativo");

  const registrosTipo = useMemo(
    () => registros.filter((registro) => registro.tipo === tipo),
    [registros, tipo]
  );

  const total = registrosTipo.length;
  const ativos = registrosTipo.filter((registro) => registro.status === "ativo").length;
  const arquivados = total - ativos;

  const registrosFiltrados = useMemo(() => {
    return registrosTipo.filter((registro) => {
      if (filtroStatus !== "todos" && registro.status !== filtroStatus) return false;
      if (filtroCodigo.trim() && !registro.codigo.includes(filtroCodigo.trim())) {
        return false;
      }
      if (
        filtroNome.trim() &&
        !registro.nome.toLowerCase().includes(filtroNome.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [filtroCodigo, filtroNome, filtroStatus, registrosTipo]);

  useEffect(() => {
    setFormAberto(false);
    setCodigo("");
    setNome("");
    setDescricao("");
    setParent("");
    setErro(null);
    setFiltroCodigo("");
    setFiltroNome("");
    setFiltroStatus("ativo");
  }, [tipo]);

  const gerarId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const salvarRegistro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Preencha o nome.");
      return;
    }
    const codigoNormalizado = codigo.trim().toLowerCase();
    const nomeNormalizado = nome.trim().toLowerCase();
    if (
      codigoNormalizado &&
      registrosTipo.some((item) => item.codigo.toLowerCase() === codigoNormalizado)
    ) {
      setErro("Codigo ja existe para este tipo.");
      return;
    }
    if (registrosTipo.some((item) => item.nome.toLowerCase() === nomeNormalizado)) {
      setErro("Nome ja existe para este tipo.");
      return;
    }
    setErro(null);
    onCreate({
      id: gerarId(),
      tipo,
      codigo: codigo.trim(),
      nome: nome.trim(),
      descricao: descricao.trim(),
      parent: parent.trim(),
      status: "ativo"
    });
    setCodigo("");
    setNome("");
    setDescricao("");
    setParent("");
  };

  const editarRegistro = (registro: CadastroBaseRegistro) => {
    if (readOnly) return;
    const novoCodigo =
      window.prompt("Novo codigo:", registro.codigo) ?? registro.codigo;
    const novoNome = window.prompt("Novo nome:", registro.nome) ?? registro.nome;
    const novaDescricao =
      window.prompt("Nova descricao:", registro.descricao) ?? registro.descricao;
    const novoParent =
      window.prompt("Categoria pai (opcional):", registro.parent) ??
      registro.parent;
    onUpdate({
      ...registro,
      codigo: novoCodigo.trim(),
      nome: novoNome.trim(),
      descricao: novaDescricao.trim(),
      parent: novoParent.trim()
    });
  };

  const arquivarRegistro = (registro: CadastroBaseRegistro) => {
    if (readOnly) return;
    if (!window.confirm(`Arquivar "${registro.nome}"?`)) return;
    onArchive({ ...registro, status: "arquivado" });
  };

  const reativarRegistro = (registro: CadastroBaseRegistro) => {
    if (readOnly) return;
    onUpdate({ ...registro, status: "ativo" });
  };

  const parentOptionsId = `cadastro-base-parent-${tipo}`;

  return (
    <div className="config-page">
      <header className="config-header">
        <div>
          <div className="config-type-row">
            <h2>{config.label}</h2>
            <span className="config-type-pill">Cadastros base</span>
          </div>
          <p className="config-subtitle">{config.descricao}</p>
          <p className="config-helper">
            Organizacao: <strong>{organizacao.nome}</strong>
          </p>
          <div className="config-stats">
            <span className="config-stat">Total: {total}</span>
            <span className="config-stat config-stat--active">Ativos: {ativos}</span>
            <span className="config-stat">Arquivados: {arquivados}</span>
          </div>
          {onTipoChange && (
            <label className="config-type-switch">
              <span>Tipo</span>
              <select
                value={tipo}
                onChange={(e) => onTipoChange(e.target.value as CadastroBaseTipo)}
              >
                {Object.entries(cadastroBaseConfig).map(([id, item]) => (
                  <option key={id} value={id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="config-actions">
          <button type="button" className="button-secondary" onClick={onVoltar}>
            Voltar
          </button>
          {!readOnly && (
            <button type="button" onClick={() => setFormAberto((prev) => !prev)}>
              {formAberto ? "Fechar" : "Inserir"}
            </button>
          )}
        </div>
      </header>

      <section className="finance-table-card">
        {formAberto && !readOnly && (
          <form onSubmit={salvarRegistro} className="form config-form">
            <div className="finance-form-grid">
              <label>
                {config.codigoLabel}
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder={config.codigoPlaceholder}
                />
              </label>
              <label>
                {config.nomeLabel}
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={config.nomePlaceholder}
                />
              </label>
              <label>
                Categoria pai (opcional)
                <input
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                  placeholder="Ex.: Grupo principal"
                  list={parentOptionsId}
                />
              </label>
              <label>
                Descricao (opcional)
                <input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Detalhes do cadastro"
                />
              </label>
            </div>
            <button type="submit">Salvar</button>
          </form>
        )}

        <datalist id={parentOptionsId}>
          {registrosTipo.map((registro) => (
            <option key={registro.id} value={registro.nome} />
          ))}
        </datalist>

        <div className="config-filters">
          <label>
            <span>{config.codigoLabel}</span>
            <input
              value={filtroCodigo}
              onChange={(e) => setFiltroCodigo(e.target.value)}
              placeholder={config.codigoPlaceholder}
            />
          </label>
          <label>
            <span>{config.nomeLabel}</span>
            <input
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              placeholder={config.nomePlaceholder}
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
              <th>{config.codigoLabel}</th>
              <th>{config.nomeLabel}</th>
              <th>Categoria pai</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {registrosFiltrados.map((registro) => (
              <tr key={registro.id}>
                <td className="finance-actions-cell">
                  {!readOnly && (
                    <div className="table-actions">
                      <button
                        type="button"
                        className="action-primary"
                        onClick={() => editarRegistro(registro)}
                      >
                        Editar
                      </button>
                      {registro.status === "ativo" ? (
                        <button
                          type="button"
                          className="action-secondary"
                          onClick={() => arquivarRegistro(registro)}
                        >
                          Arquivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="action-primary"
                          onClick={() => reativarRegistro(registro)}
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td>{registro.codigo || "-"}</td>
                <td>
                  <strong>{registro.nome}</strong>
                  {registro.descricao && (
                    <div className="config-subtext">{registro.descricao}</div>
                  )}
                </td>
                <td>{registro.parent || "-"}</td>
                <td>
                  <span
                    className={
                      "badge-status " +
                      (registro.status === "ativo"
                        ? "badge-status--ativo"
                        : "badge-status--inativo")
                    }
                  >
                    {registro.status === "ativo" ? "Ativo" : "Arquivado"}
                  </span>
                </td>
              </tr>
            ))}
            {!registrosFiltrados.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center" }}>
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

type EstruturaSubTab =
  | "visao"
  | "blocos"
  | "unidades"
  | "dependencias"
  | "garagens";

type CadastrosSubTab = "visao" | "notificacoes" | "cadastro";

export default function ConfiguracoesView(props: ConfiguracoesViewProps) {
  const { organizacao, abaSelecionada, readOnly = false } = props;
  const { token } = useAuth();
  const [notificacoes, setNotificacoes] = useState<NotificacaoConfig[]>([]);
  const [loadingNotificacoes, setLoadingNotificacoes] = useState(false);
  const [erroNotificacoes, setErroNotificacoes] = useState<string | null>(null);
  const [estruturaAba, setEstruturaAba] = useState<EstruturaSubTab>("visao");
  const [cadastrosAba, setCadastrosAba] = useState<CadastrosSubTab>("visao");
  const [cadastroBaseTipo, setCadastroBaseTipo] =
    useState<CadastroBaseTipo | null>(null);
  const [cadastrosBase, setCadastrosBase] = useState<CadastroBaseRegistro[]>([]);

  const abaAtual: ConfiguracoesTab = abaSelecionada ?? "cadastros-base";
  const acaoGerenciar = readOnly ? "Visualizar" : "Gerenciar";

  useEffect(() => {
    setEstruturaAba("visao");
    setCadastrosAba("visao");
    setCadastroBaseTipo(null);
  }, [abaAtual]);

  useEffect(() => {
    setCadastrosBase([]);
  }, [organizacao.id]);

  const estruturaConfig = useMemo(() => {
    return {
      blocos: {
        titulo: "Blocos",
        tipo: "Bloco",
        codigoLabel: "Bloco",
        nomeLabel: "Nome do bloco",
        codigoPlaceholder: "Ex.: 01",
        nomePlaceholder: "Ex.: Bloco A"
      },
      unidades: {
        titulo: "Unidades",
        tipo: "Apartamento",
        codigoLabel: "Unidade",
        nomeLabel: "Responsavel financeiro",
        codigoPlaceholder: "Ex.: A101",
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
      }
    } as const;
  }, []);

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
    if (abaAtual === "cadastros-base" && cadastrosAba === "notificacoes") {
      void carregarNotificacoes();
    }
  }, [abaAtual, cadastrosAba, carregarNotificacoes]);

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

  if (abaAtual === "estrutura-condominio" && estruturaAba !== "visao") {
    const config = estruturaConfig[estruturaAba];
    return (
      <ConfiguracoesUnidadesTable
        organizacao={organizacao}
        tipo={config.tipo}
        titulo={config.titulo}
        codigoLabel={config.codigoLabel}
        nomeLabel={config.nomeLabel}
        codigoPlaceholder={config.codigoPlaceholder}
        nomePlaceholder={config.nomePlaceholder}
        readOnly={readOnly}
        onVoltar={() => setEstruturaAba("visao")}
        voltarLabel="Voltar para Estrutura"
      />
    );
  }

  if (
    abaAtual === "cadastros-base" &&
    cadastrosAba === "cadastro" &&
    cadastroBaseTipo
  ) {
    return (
      <CadastrosBaseTable
        organizacao={organizacao}
        tipo={cadastroBaseTipo}
        registros={cadastrosBase}
        onCreate={(registro) => setCadastrosBase((prev) => [...prev, registro])}
        onUpdate={(registro) =>
          setCadastrosBase((prev) =>
            prev.map((item) => (item.id === registro.id ? registro : item))
          )
        }
        onArchive={(registro) =>
          setCadastrosBase((prev) =>
            prev.map((item) => (item.id === registro.id ? registro : item))
          )
        }
        onVoltar={() => {
          setCadastrosAba("visao");
          setCadastroBaseTipo(null);
        }}
        onTipoChange={(novoTipo) => {
          setCadastroBaseTipo(novoTipo);
          setCadastrosAba("cadastro");
        }}
        readOnly={readOnly}
      />
    );
  }

  if (abaAtual === "cadastros-base" && cadastrosAba === "notificacoes") {
    return (
      <div className="config-page">
        <header className="config-header">
          <div>
            <h2>Notificacoes</h2>
            <p className="config-subtitle">Alertas e comunicacoes do sistema.</p>
          </div>
          <div className="config-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setCadastrosAba("visao")}
            >
              Voltar
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => void restaurarPadrao()}
            >
              Restaurar padrao
            </button>
          </div>
        </header>

        <section className="finance-table-card">
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
                  appCfg?.diasAntesVencimento ??
                  emailCfg?.diasAntesVencimento ??
                  "";
                const limite = appCfg?.limiteValor ?? emailCfg?.limiteValor ?? "";
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

  const renderCards = (
    titulo: string,
    descricao: string,
    cards: Array<{
      id: string;
      title: string;
      description: string;
      actionLabel: string;
      disabled?: boolean;
      tag?: string;
      onClick?: () => void;
      active?: boolean;
    }>
  ) => (
    <div className="config-page">
      <header className="config-hero">
        <div>
          <h2>{titulo}</h2>
          <p className="config-subtitle">{descricao}</p>
        </div>
        <div className="config-hero-actions">
          <span className="config-pill">Tudo editavel</span>
          <span className="config-pill">Sem hardcode</span>
        </div>
      </header>

      <div className="config-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className={
              "config-card" +
              (card.disabled ? " config-card--disabled" : "") +
              (card.active ? " config-card--active" : "")
            }
          >
            <div className="config-card-header">
              <h3>{card.title}</h3>
              {card.tag && <span className="config-tag">{card.tag}</span>}
            </div>
            <p className="config-card-desc">{card.description}</p>
            <div className="config-card-actions">
              <button
                type="button"
                className="button-secondary"
                disabled={card.disabled}
                onClick={card.onClick}
              >
                {card.actionLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (abaAtual === "cadastros-base") {
    return renderCards("Cadastros base", "Tudo que alimenta o sistema.", [
      {
        id: "tipos-receita",
        title: "Tipos de receita",
        description: "Defina receitas genericas sem valores fixos.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("tipo_receita");
          setCadastrosAba("cadastro");
        },
        tag: "Base",
        active: true
      },
      {
        id: "tipos-despesa",
        title: "Tipos de despesa",
        description: "Classifique despesas e custos recorrentes.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("tipo_despesa");
          setCadastrosAba("cadastro");
        },
        tag: "Base",
        active: true
      },
      {
        id: "tipos-acordo",
        title: "Tipos de acordo",
        description: "Modelos de acordo flexiveis e reutilizaveis.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("tipo_acordo");
          setCadastrosAba("cadastro");
        },
        active: true
      },
      {
        id: "tipos-inadimplencia",
        title: "Tipos de inadimplencia",
        description: "Classificacoes de inadimplencia e cobranca.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("tipo_inadimplencia");
          setCadastrosAba("cadastro");
        },
        active: true
      },
      {
        id: "categorias",
        title: "Categorias financeiras",
        description: "Hierarquia pai/filho para agrupar receitas e despesas.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("categoria_financeira");
          setCadastrosAba("cadastro");
        },
        active: true
      },
      {
        id: "centros-custo",
        title: "Centros de custo",
        description: "Organizacao flexivel para relatórios e controle.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("centro_custo");
          setCadastrosAba("cadastro");
        },
        active: true
      },
      {
        id: "formas-pagamento",
        title: "Formas de pagamento",
        description: "PIX, boleto, cartao, transferencia, etc.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("forma_pagamento");
          setCadastrosAba("cadastro");
        },
        active: true
      },
      {
        id: "status-financeiros",
        title: "Status financeiros",
        description: "Padronize status usados em toda a operacao.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("status_financeiro");
          setCadastrosAba("cadastro");
        },
        active: true
      },
      {
        id: "tipos-documento",
        title: "Tipos de documento",
        description: "Modelos de documentos usados no sistema.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("tipo_documento");
          setCadastrosAba("cadastro");
        }
      },
      {
        id: "tipos-aviso",
        title: "Tipos de aviso",
        description: "Avisos e comunicados organizados por tipo.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("tipo_aviso");
          setCadastrosAba("cadastro");
        }
      },
      {
        id: "tipos-campanha",
        title: "Tipos de campanha",
        description: "Campanhas e comunicacoes recorrentes.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("tipo_campanha");
          setCadastrosAba("cadastro");
        }
      },
      {
        id: "tipos-cobranca",
        title: "Tipos de cobranca",
        description: "Cobrancas diferenciadas por tipo.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("tipo_cobranca");
          setCadastrosAba("cadastro");
        }
      },
      {
        id: "tipos-notificacao",
        title: "Tipos de notificacao",
        description: "Categorias de notificacao do sistema.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("tipo_notificacao");
          setCadastrosAba("cadastro");
        }
      },
      {
        id: "tags-genericas",
        title: "Tags genericas",
        description: "Rotulos reutilizaveis em qualquer modulo.",
        actionLabel: "Abrir cadastro",
        onClick: () => {
          setCadastroBaseTipo("tag_generica");
          setCadastrosAba("cadastro");
        }
      },
      {
        id: "notificacoes",
        title: "Notificacoes (eventos)",
        description: "Configure alertas e canais do sistema.",
        actionLabel: "Configurar",
        onClick: () => setCadastrosAba("notificacoes"),
        tag: "Ativo",
        active: true
      }
    ]);
  }

  if (abaAtual === "estrutura-condominio") {
    return renderCards(
      "Estrutura do condominio",
      "Estrutura fisica e organizacional do cliente.",
      [
        {
          id: "condominios",
          title: "Condominios",
          description: "Cadastre e organize condominios.",
          actionLabel: "Em breve",
          disabled: true
        },
        {
          id: "blocos",
          title: "Blocos",
          description: "Organize blocos e setores do condominio.",
          actionLabel: acaoGerenciar,
          onClick: () => setEstruturaAba("blocos"),
          tag: "Ativo",
          active: true
        },
        {
          id: "unidades",
          title: "Unidades",
          description: "Apartamentos, salas, casas ou lotes.",
          actionLabel: acaoGerenciar,
          onClick: () => setEstruturaAba("unidades"),
          tag: "Ativo",
          active: true
        },
        {
          id: "tipos-unidade",
          title: "Tipos de unidade",
          description: "Defina categorias de unidades (apto, sala, casa).",
          actionLabel: "Em breve",
          disabled: true
        },
        {
          id: "areas-comuns",
          title: "Areas comuns",
          description: "Salas, churrasqueiras, vagas e recursos.",
          actionLabel: "Em breve",
          disabled: true
        },
        {
          id: "dependencias",
          title: "Dependencias",
          description: "Ambientes e recursos do condominio.",
          actionLabel: acaoGerenciar,
          onClick: () => setEstruturaAba("dependencias"),
          active: true
        },
        {
          id: "garagens",
          title: "Garagens",
          description: "Controle de vagas e responsaveis.",
          actionLabel: acaoGerenciar,
          onClick: () => setEstruturaAba("garagens"),
          active: true
        }
      ]
    );
  }

  if (abaAtual === "pessoas-papeis") {
    return renderCards("Pessoas & papeis", "Quem e quem no sistema.", [
      {
        id: "pessoas",
        title: "Pessoas",
        description: "Cadastro unico de pessoas e documentos.",
        actionLabel: "Em breve",
        disabled: true
      },
      {
        id: "tipos-pessoa",
        title: "Tipos de pessoa",
        description: "Morador, funcionario, fornecedor, sindico, etc.",
        actionLabel: "Em breve",
        disabled: true
      },
      {
        id: "papeis",
        title: "Papeis e funcoes",
        description: "Funcoes flexiveis ligadas ao dia a dia.",
        actionLabel: "Em breve",
        disabled: true
      },
      {
        id: "vinculos",
        title: "Vinculos",
        description: "Vinculos entre pessoa, unidade e condominio.",
        actionLabel: "Em breve",
        disabled: true
      },
      {
        id: "perfis-acesso",
        title: "Perfis de acesso",
        description: "Perfis ligados a permissoes do sistema.",
        actionLabel: "Em breve",
        disabled: true
      },
      {
        id: "vinculos-padrao",
        title: "Vinculos padrao",
        description: "Relacoes base entre pessoa, unidade e condominio.",
        actionLabel: "Em breve",
        disabled: true
      }
    ]);
  }

  return renderCards("Financeiro (base)", "Definicoes do financeiro vivo.", [
    {
      id: "plano-contas",
      title: "Plano de contas",
      description: "Estrutura pai/filho para receitas e despesas.",
      actionLabel: "Em breve",
      disabled: true
    },
    {
      id: "tipos-receita",
      title: "Vinculo de receita",
      description: "Pessoa, unidade, bloco e categoria.",
      actionLabel: "Em breve",
      disabled: true
    },
    {
      id: "tipos-despesa",
      title: "Vinculo de despesa",
      description: "Fornecedor, categoria e centro de custo.",
      actionLabel: "Em breve",
      disabled: true
    },
    {
      id: "tipos-lancamento",
      title: "Tipos de lancamento",
      description: "Fixos, variaveis e recorrentes.",
      actionLabel: "Em breve",
      disabled: true
    },
    {
      id: "inadimplencia",
      title: "Regras de inadimplencia",
      description: "Configuracoes futuras de cobrança.",
      actionLabel: "Em breve",
      disabled: true
    },
    {
      id: "indices",
      title: "Indices (IGPM/IPCA)",
      description: "Indices opcionais para reajustes.",
      actionLabel: "Em breve",
      disabled: true
    }
  ]);
}
