import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  NotificacaoConfig,
  Organizacao,
  Pessoa,
  UnidadeOrganizacional,
  VinculoPessoaOrganizacao
} from "../api";
import { useAuth } from "../hooks/useAuth";
import PessoasView from "./PessoasView";

export type ConfiguracoesTab =
  | "cadastros-base"
  | "estrutura-condominio"
  | "pessoas-papeis"
  | "financeiro-base";

export const menuConfiguracoes: Array<{ id: ConfiguracoesTab; label: string }> = [
  { id: "cadastros-base", label: "Cadastros base" },
  { id: "estrutura-condominio", label: "Estrutura do condominio" },
  { id: "pessoas-papeis", label: "Pessoas & papeis" },
  { id: "financeiro-base", label: "Financeiro - Configuracoes" }
];

const normalizarTipo = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

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
  parentConfig?: {
    label: string;
    placeholder: string;
    tipos: string[];
    required?: boolean;
  };
};

type VinculosConfigProps = {
  organizacao: Organizacao;
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
  onVoltar,
  parentConfig
}) => {
  const { token } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [codigoInterno, setCodigoInterno] = useState("");
  const [nome, setNome] = useState("");
  const [parentId, setParentId] = useState("");
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

  const parentLookup = useMemo(() => {
    return new Map(unidades.map((u) => [u.id, u]));
  }, [unidades]);

  const parentOptions = useMemo(() => {
    if (!parentConfig) return [];
    return unidades
      .filter((u) =>
        parentConfig.tipos.some(
          (t) => normalizarTipo(u.tipo) === normalizarTipo(t)
        )
      )
      .sort((a, b) =>
        `${a.codigoInterno} ${a.nome}`.localeCompare(
          `${b.codigoInterno} ${b.nome}`,
          "pt-BR",
          { sensitivity: "base" }
        )
      );
  }, [parentConfig, unidades]);

  const salvarUnidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !organizacao) return;
    if (!nome.trim() || !codigoInterno.trim()) {
      setErro("Preencha codigo e nome.");
      return;
    }
    if (parentConfig?.required && !parentId) {
      setErro(`Selecione ${parentConfig.label.toLowerCase()}.`);
      return;
    }

    try {
      setErro(null);
      setLoading(true);
      const criada = await api.criarUnidade(token, {
        organizacaoId: organizacao.id,
        tipo,
        codigoInterno: codigoInterno.trim(),
        nome: nome.trim(),
        parentId: parentId || null
      });
      setUnidades((prev) => [...prev, criada]);
      setCodigoInterno("");
      setNome("");
      setParentId("");
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
        tipo: unidade.tipo,
        parentId: unidade.parentId ?? null
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

      <div className="config-stats">
        <span className="config-stat">{resumoVinculos.total} vinculos</span>
        <span className="config-stat config-stat--active">
          {resumoVinculos.ativos} ativos
        </span>
        <span className="config-stat">{resumoVinculos.inativos} inativos</span>
        <span
          className={
            "config-stat" + (resumoVinculos.semUnidade ? " config-stat--alert" : "")
          }
        >
          {resumoVinculos.semUnidade} sem unidade
        </span>
      </div>

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
              {parentConfig && (
                <label>
                  {parentConfig.label}
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    {!parentConfig.required && (
                      <option value="">{parentConfig.placeholder}</option>
                    )}
                    {parentConfig.required && (
                      <option value="">Selecione...</option>
                    )}
                    {parentOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.codigoInterno} - {item.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
              {parentConfig && <th>{parentConfig.label}</th>}
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
                {parentConfig && (
                  <td>
                    {unidade.parentId
                      ? `${parentLookup.get(unidade.parentId)?.codigoInterno ?? ""} ${
                          parentLookup.get(unidade.parentId)?.nome ?? ""
                        }`.trim()
                      : "-"}
                  </td>
                )}
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
                <td colSpan={parentConfig ? 5 : 4} style={{ textAlign: "center" }}>
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

const ConfiguracoesVinculosTable: React.FC<VinculosConfigProps> = ({
  organizacao,
  readOnly,
  voltarLabel,
  onVoltar
}) => {
  const { token } = useAuth();
  const [vinculos, setVinculos] = useState<VinculoPessoaOrganizacao[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [unidades, setUnidades] = useState<UnidadeOrganizacional[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [pessoaId, setPessoaId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [papel, setPapel] = useState("morador");
  const [dataFim, setDataFim] = useState("");

  const [filtroPessoa, setFiltroPessoa] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroPapel, setFiltroPapel] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("ativos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState("pessoa");

  const papeisPadrao = [
    "morador",
    "proprietario",
    "sindico",
    "subsindico",
    "conselheiro",
    "colaborador",
    "fornecedor",
    "membro",
    "outro"
  ];

  const carregarDados = useCallback(async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const [listaVinculos, listaPessoas, listaUnidades] = await Promise.all([
        api.listarVinculos(token, organizacao.id),
        api.listarPessoas(token, organizacao.id),
        api.listarUnidades(token, organizacao.id)
      ]);
      setVinculos(listaVinculos);
      setPessoas(listaPessoas);
      setUnidades(listaUnidades);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar vinculos");
    } finally {
      setLoading(false);
    }
  }, [organizacao.id, token]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const pessoasOrdenadas = useMemo(() => {
    return [...pessoas].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
    );
  }, [pessoas]);

  const unidadesOrdenadas = useMemo(() => {
    return [...unidades].sort((a, b) =>
      `${a.codigoInterno} ${a.nome}`.localeCompare(
        `${b.codigoInterno} ${b.nome}`,
        "pt-BR",
        { sensitivity: "base" }
      )
    );
  }, [unidades]);

  const limparFormulario = () => {
    setEditId(null);
    setPessoaId("");
    setUnidadeId("");
    setPapel("morador");
    setDataFim("");
  };

  const abrirNovo = () => {
    limparFormulario();
    setFormAberto(true);
  };

  const editarVinculo = (v: VinculoPessoaOrganizacao) => {
    setEditId(v.id);
    setPessoaId(v.pessoaId);
    setUnidadeId(v.unidadeOrganizacionalId ?? "");
    setPapel(v.papel ?? "morador");
    setDataFim(v.dataFim ? v.dataFim.slice(0, 10) : "");
    setFormAberto(true);
  };

  const salvarVinculo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!pessoaId) {
      setErro("Selecione uma pessoa.");
      return;
    }
    if (!papel.trim()) {
      setErro("Informe o papel.");
      return;
    }

    try {
      setErro(null);
      setLoading(true);
      if (editId) {
        const atualizada = await api.atualizarVinculo(token, editId, {
          organizacaoId: organizacao.id,
          unidadeOrganizacionalId: unidadeId || null,
          papel: papel.trim(),
          dataFim: dataFim || null
        });
        setVinculos((prev) =>
          prev.map((v) => (v.id === atualizada.id ? atualizada : v))
        );
      } else {
        const criada = await api.criarVinculo(token, {
          organizacaoId: organizacao.id,
          pessoaId,
          unidadeOrganizacionalId: unidadeId || null,
          papel: papel.trim(),
          dataFim: dataFim || null
        });
        setVinculos((prev) => [...prev, criada]);
      }

      limparFormulario();
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar vinculo");
    } finally {
      setLoading(false);
    }
  };

  const removerVinculo = async (v: VinculoPessoaOrganizacao) => {
    if (!token) return;
    if (!window.confirm(`Remover vinculo de ${v.pessoaNome}?`)) return;
    try {
      setErro(null);
      setLoading(true);
      await api.removerVinculo(token, v.id, organizacao.id);
      setVinculos((prev) => prev.filter((item) => item.id !== v.id));
      if (editId === v.id) {
        limparFormulario();
      }
    } catch (e: any) {
      setErro(e.message || "Erro ao remover vinculo");
    } finally {
      setLoading(false);
    }
  };

  const isAtivo = (v: VinculoPessoaOrganizacao) => {
    if (!v.dataFim) return true;
    const fim = new Date(v.dataFim);
    if (Number.isNaN(fim.getTime())) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return fim >= hoje;
  };

  const obterClassePapel = (value: string) => {
    const normalizado = normalizarTipo(value).replace(/[^a-z0-9]+/g, "-");
    if (normalizado.includes("sindico")) return "role-pill--brand";
    if (normalizado.includes("morador") || normalizado.includes("residente")) {
      return "role-pill--info";
    }
    if (normalizado.includes("proprietario")) return "role-pill--success";
    if (
      normalizado.includes("porteiro") ||
      normalizado.includes("colaborador") ||
      normalizado.includes("funcionario")
    ) {
      return "role-pill--warning";
    }
    if (normalizado.includes("fornecedor")) return "role-pill--danger";
    return "role-pill--neutral";
  };

  const resumoVinculos = useMemo(() => {
    const total = vinculos.length;
    const ativos = vinculos.filter(isAtivo).length;
    const inativos = total - ativos;
    const semUnidade = vinculos.filter((v) => !v.unidadeOrganizacionalId).length;
    return { total, ativos, inativos, semUnidade };
  }, [vinculos]);

  const vinculosFiltrados = useMemo(() => {
    const termo = normalizarTipo(filtroBusca);
    return vinculos.filter((v) => {
      if (filtroPessoa && v.pessoaId !== filtroPessoa) return false;
      if (filtroUnidade && v.unidadeOrganizacionalId !== filtroUnidade) return false;
      if (filtroPapel && v.papel !== filtroPapel) return false;
      if (filtroStatus === "ativos" && !isAtivo(v)) return false;
      if (filtroStatus === "inativos" && isAtivo(v)) return false;
      if (termo) {
        const alvo = normalizarTipo(
          `${v.pessoaNome} ${v.pessoaDocumento ?? ""} ${v.unidadeCodigo ?? ""} ${v.unidadeNome ?? ""} ${v.papel ?? ""}`
        );
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [filtroPessoa, filtroUnidade, filtroPapel, filtroStatus, filtroBusca, vinculos]);

  const vinculosOrdenados = useMemo(() => {
    const lista = [...vinculosFiltrados];
    const byPessoa = (a: VinculoPessoaOrganizacao, b: VinculoPessoaOrganizacao) =>
      a.pessoaNome.localeCompare(b.pessoaNome, "pt-BR", { sensitivity: "base" });
    const byPapel = (a: VinculoPessoaOrganizacao, b: VinculoPessoaOrganizacao) =>
      a.papel.localeCompare(b.papel, "pt-BR", { sensitivity: "base" });
    const byUnidade = (a: VinculoPessoaOrganizacao, b: VinculoPessoaOrganizacao) =>
      `${a.unidadeCodigo ?? ""} ${a.unidadeNome ?? ""}`.localeCompare(
        `${b.unidadeCodigo ?? ""} ${b.unidadeNome ?? ""}`,
        "pt-BR",
        { sensitivity: "base" }
      );
    const byInicio = (a: VinculoPessoaOrganizacao, b: VinculoPessoaOrganizacao) =>
      new Date(b.dataInicio ?? "").getTime() - new Date(a.dataInicio ?? "").getTime();

    switch (ordenacao) {
      case "papel":
        return lista.sort((a, b) => byPapel(a, b) || byPessoa(a, b));
      case "unidade":
        return lista.sort((a, b) => byUnidade(a, b) || byPessoa(a, b));
      case "status":
        return lista.sort(
          (a, b) => Number(isAtivo(b)) - Number(isAtivo(a)) || byPessoa(a, b)
        );
      case "inicio":
        return lista.sort((a, b) => byInicio(a, b) || byPessoa(a, b));
      case "pessoa":
      default:
        return lista.sort(byPessoa);
    }
  }, [ordenacao, vinculosFiltrados]);

  return (
    <div className="config-page">
      <header className="config-header">
        <div>
          <h2>Vinculos</h2>
          <p className="config-subtitle">{organizacao.nome}</p>
        </div>
        <div className="config-actions">
          {onVoltar && (
            <button type="button" className="button-secondary" onClick={onVoltar}>
              {voltarLabel ?? "Voltar"}
            </button>
          )}
          <button type="button" onClick={() => void carregarDados()}>
            {loading ? "Carregando..." : "Atualizar"}
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
          <form onSubmit={salvarVinculo} className="form config-form">
            <div className="finance-form-grid">
              <label>
                Pessoa
                <select
                  value={pessoaId}
                  onChange={(e) => setPessoaId(e.target.value)}
                  disabled={Boolean(editId)}
                >
                  <option value="">Selecione...</option>
                  {pessoasOrdenadas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Papel
                <select value={papel} onChange={(e) => setPapel(e.target.value)}>
                  {papeisPadrao.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Unidade (opcional)
                <select
                  value={unidadeId}
                  onChange={(e) => setUnidadeId(e.target.value)}
                >
                  <option value="">Sem unidade</option>
                  {unidadesOrdenadas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.codigoInterno} - {u.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data fim (opcional)
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </label>
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "Salvando..." : editId ? "Atualizar" : "Salvar"}
            </button>
          </form>
        )}

        <div className="config-filters">
          <label>
            <span>Busca rapida</span>
            <input
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              placeholder="Nome, documento ou unidade"
            />
          </label>
          <label>
            <span>Pessoa</span>
            <select
              value={filtroPessoa}
              onChange={(e) => setFiltroPessoa(e.target.value)}
            >
              <option value="">Todas</option>
              {pessoasOrdenadas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Unidade</span>
            <select
              value={filtroUnidade}
              onChange={(e) => setFiltroUnidade(e.target.value)}
            >
              <option value="">Todas</option>
              {unidadesOrdenadas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.codigoInterno} - {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Papel</span>
            <select value={filtroPapel} onChange={(e) => setFiltroPapel(e.target.value)}>
              <option value="">Todos</option>
              {papeisPadrao.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </select>
          </label>
          <label>
            <span>Ordenar</span>
            <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)}>
              <option value="pessoa">Pessoa</option>
              <option value="papel">Papel</option>
              <option value="unidade">Unidade</option>
              <option value="status">Status</option>
              <option value="inicio">Inicio</option>
            </select>
          </label>
        </div>

        {erro && <p className="error">{erro}</p>}

        <table className="table finance-table config-table">
          <thead>
            <tr>
              <th />
              <th>Pessoa</th>
              <th>Papel</th>
              <th>Unidade</th>
              <th>Inicio</th>
              <th>Fim</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {vinculosOrdenados.map((v) => (
              <tr key={v.id} className={isAtivo(v) ? "" : "table-row--inactive"}>
                <td className="finance-actions-cell">
                  {!readOnly && (
                    <div className="table-actions">
                      <button
                        type="button"
                        className="action-primary"
                        onClick={() => editarVinculo(v)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="action-secondary"
                        onClick={() => void removerVinculo(v)}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </td>
                <td>
                  <strong>{v.pessoaNome}</strong>
                  {v.pessoaDocumento && (
                    <div className="config-subtext">{v.pessoaDocumento}</div>
                  )}
                </td>
                <td>
                  <span className={`role-pill ${obterClassePapel(v.papel ?? "")}`}>
                    {v.papel}
                  </span>
                </td>
                <td>
                  {v.unidadeCodigo ? `${v.unidadeCodigo} - ${v.unidadeNome ?? ""}` : "-"}
                </td>
                <td>{v.dataInicio ? new Date(v.dataInicio).toLocaleDateString("pt-BR") : "-"}</td>
                <td>{v.dataFim ? new Date(v.dataFim).toLocaleDateString("pt-BR") : "-"}</td>
                <td>
                  <span
                    className={
                      "badge-status " + (isAtivo(v) ? "badge-status--ativo" : "badge-status--inativo")
                    }
                  >
                    {isAtivo(v) ? "Ativo" : "Inativo"}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && vinculosOrdenados.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center" }}>
                  Nenhum vinculo encontrado.
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
  const [ordenacao, setOrdenacao] = useState("nome-asc");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const registrosOrdenados = useMemo(() => {
    const lista = [...registrosFiltrados];
    const byNome = (a: CadastroBaseRegistro, b: CadastroBaseRegistro) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
    const byCodigo = (a: CadastroBaseRegistro, b: CadastroBaseRegistro) =>
      a.codigo.localeCompare(b.codigo, "pt-BR", { sensitivity: "base" });
    switch (ordenacao) {
      case "nome-desc":
        return lista.sort((a, b) => -byNome(a, b));
      case "codigo-asc":
        return lista.sort(byCodigo);
      case "codigo-desc":
        return lista.sort((a, b) => -byCodigo(a, b));
      case "status":
        return lista.sort((a, b) => a.status.localeCompare(b.status));
      case "nome-asc":
      default:
        return lista.sort(byNome);
    }
  }, [ordenacao, registrosFiltrados]);

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
    setOrdenacao("nome-asc");
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

  const exportarJson = () => {
    const payload = {
      tipo,
      registros: registrosTipo
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cadastros-base-${tipo}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importarJson = async (arquivo: File) => {
    try {
      const texto = await arquivo.text();
      const data = JSON.parse(texto);
      const lista: CadastroBaseRegistro[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.registros)
        ? data.registros
        : [];

      if (!lista.length) {
        setErro("Arquivo sem registros validos.");
        return;
      }

      const existentesCodigo = new Set(
        registrosTipo.map((item) => item.codigo.toLowerCase())
      );
      const existentesNome = new Set(
        registrosTipo.map((item) => item.nome.toLowerCase())
      );

      const novos: CadastroBaseRegistro[] = [];

      for (const item of lista) {
        const nomeItem = String(item.nome ?? "").trim();
        if (!nomeItem) continue;
        const codigoItem = String(item.codigo ?? "").trim();
        const codigoKey = codigoItem.toLowerCase();
        const nomeKey = nomeItem.toLowerCase();
        if (codigoKey && existentesCodigo.has(codigoKey)) continue;
        if (existentesNome.has(nomeKey)) continue;
        existentesCodigo.add(codigoKey);
        existentesNome.add(nomeKey);
        novos.push({
          id: String(item.id ?? gerarId()),
          tipo,
          codigo: codigoItem,
          nome: nomeItem,
          descricao: String(item.descricao ?? ""),
          parent: String(item.parent ?? ""),
          status: item.status === "arquivado" ? "arquivado" : "ativo"
        });
      }

      if (!novos.length) {
        setErro("Nenhum registro novo para importar.");
        return;
      }

      novos.forEach((registro) => onCreate(registro));
      setErro(null);
    } catch (e: any) {
      setErro(e?.message || "Erro ao importar JSON.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

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
          <button type="button" className="button-secondary" onClick={exportarJson}>
            Exportar
          </button>
          {!readOnly && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Importar
            </button>
          )}
          {!readOnly && (
            <button type="button" onClick={() => setFormAberto((prev) => !prev)}>
              {formAberto ? "Fechar" : "Inserir"}
            </button>
          )}
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) {
            void importarJson(arquivo);
          }
        }}
        style={{ display: "none" }}
      />

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
            <span>Ordenar</span>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
            >
              <option value="nome-asc">Nome (A-Z)</option>
              <option value="nome-desc">Nome (Z-A)</option>
              <option value="codigo-asc">Codigo (A-Z)</option>
              <option value="codigo-desc">Codigo (Z-A)</option>
              <option value="status">Status</option>
            </select>
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
            {registrosOrdenados.map((registro) => (
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
            {!registrosOrdenados.length && (
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
type PessoasSubTab = "visao" | "pessoas" | "vinculos";

export default function ConfiguracoesView(props: ConfiguracoesViewProps) {
  const { organizacao, abaSelecionada, readOnly = false } = props;
  const { token } = useAuth();
  const [notificacoes, setNotificacoes] = useState<NotificacaoConfig[]>([]);
  const [loadingNotificacoes, setLoadingNotificacoes] = useState(false);
  const [erroNotificacoes, setErroNotificacoes] = useState<string | null>(null);
  const [estruturaAba, setEstruturaAba] = useState<EstruturaSubTab>("visao");
  const [cadastrosAba, setCadastrosAba] = useState<CadastrosSubTab>("visao");
  const [pessoasAba, setPessoasAba] = useState<PessoasSubTab>("visao");
  const [cadastroBaseTipo, setCadastroBaseTipo] =
    useState<CadastroBaseTipo | null>(null);
  const [cadastrosBase, setCadastrosBase] = useState<CadastroBaseRegistro[]>([]);

  const abaAtual: ConfiguracoesTab = abaSelecionada ?? "cadastros-base";
  const acaoGerenciar = readOnly ? "Visualizar" : "Gerenciar";

  useEffect(() => {
    setEstruturaAba("visao");
    setCadastrosAba("visao");
    setPessoasAba("visao");
    setCadastroBaseTipo(null);
  }, [abaAtual]);

  useEffect(() => {
    setCadastrosBase([]);
  }, [organizacao.id]);

  const storageKey = `sgi:cadastros-base:${organizacao.id}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCadastrosBase(parsed as CadastroBaseRegistro[]);
      }
    } catch {
      setCadastrosBase([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(cadastrosBase));
  }, [cadastrosBase, storageKey]);

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
        nomePlaceholder: "Nome do responsavel",
        parentConfig: {
          label: "Bloco",
          placeholder: "Selecione o bloco",
          tipos: ["Bloco"],
          required: true
        }
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
        nomePlaceholder: "Nome do responsavel",
        parentConfig: {
          label: "Unidade",
          placeholder: "Sem unidade vinculada",
          tipos: ["Apartamento", "Unidade"]
        }
      }
    } as const;
  }, []);

  const [estruturaResumo, setEstruturaResumo] = useState<{
    loading: boolean;
    erro: string | null;
    blocos: UnidadeOrganizacional[];
    unidades: UnidadeOrganizacional[];
    dependencias: UnidadeOrganizacional[];
    garagens: UnidadeOrganizacional[];
    unidadesSemBloco: number;
    blocosSemUnidade: number;
    garagensSemUnidade: number;
  }>({
    loading: false,
    erro: null,
    blocos: [],
    unidades: [],
    dependencias: [],
    garagens: [],
    unidadesSemBloco: 0,
    blocosSemUnidade: 0,
    garagensSemUnidade: 0
  });

  const [pessoasResumo, setPessoasResumo] = useState<{
    loading: boolean;
    erro: string | null;
    totalPessoas: number;
    totalVinculos: number;
    pessoasSemVinculo: number;
  }>({
    loading: false,
    erro: null,
    totalPessoas: 0,
    totalVinculos: 0,
    pessoasSemVinculo: 0
  });

  const carregarEstrutura = useCallback(async () => {
    if (!token) return;
    try {
      setEstruturaResumo((prev) => ({ ...prev, loading: true, erro: null }));
      const lista = await api.listarUnidades(token, organizacao.id);
      const blocos = lista.filter(
        (item) => normalizarTipo(item.tipo) === "bloco"
      );
      const dependencias = lista.filter(
        (item) => normalizarTipo(item.tipo) === "dependencia"
      );
      const garagens = lista.filter(
        (item) => normalizarTipo(item.tipo) === "garagem"
      );
      const unidades = lista.filter((item) => {
        const tipo = normalizarTipo(item.tipo);
        return tipo !== "bloco" && tipo !== "dependencia" && tipo !== "garagem";
      });
      const blocosIds = new Set(blocos.map((item) => item.id));
      const unidadesIds = new Set(unidades.map((item) => item.id));
      const unidadesSemBloco = unidades.filter(
        (item) => !item.parentId || !blocosIds.has(item.parentId)
      ).length;
      const blocosComUnidade = new Set(
        unidades
          .map((item) => item.parentId)
          .filter((id): id is string => Boolean(id) && blocosIds.has(id))
      );
      const blocosSemUnidade = blocos.filter((item) => !blocosComUnidade.has(item.id))
        .length;
      const garagensSemUnidade = garagens.filter(
        (item) => !item.parentId || !unidadesIds.has(item.parentId)
      ).length;
      setEstruturaResumo({
        loading: false,
        erro: null,
        blocos,
        unidades,
        dependencias,
        garagens,
        unidadesSemBloco,
        blocosSemUnidade,
        garagensSemUnidade
      });
    } catch (e: any) {
      setEstruturaResumo((prev) => ({
        ...prev,
        loading: false,
        erro: e?.message || "Erro ao carregar estrutura"
      }));
    }
  }, [organizacao.id, token]);

  const carregarPessoasResumo = useCallback(async () => {
    if (!token) return;
    try {
      setPessoasResumo((prev) => ({ ...prev, loading: true, erro: null }));
      const [pessoas, vinculos] = await Promise.all([
        api.listarPessoas(token, organizacao.id),
        api.listarVinculos(token, organizacao.id)
      ]);
      const totalPessoas = new Set(pessoas.map((p) => p.id)).size;
      const pessoasComVinculo = new Set(vinculos.map((v) => v.pessoaId));
      const pessoasSemVinculo = pessoas.filter((p) => !pessoasComVinculo.has(p.id)).length;
      setPessoasResumo({
        loading: false,
        erro: null,
        totalPessoas,
        totalVinculos: vinculos.length,
        pessoasSemVinculo
      });
    } catch (e: any) {
      setPessoasResumo((prev) => ({
        ...prev,
        loading: false,
        erro: e?.message || "Erro ao carregar pessoas"
      }));
    }
  }, [organizacao.id, token]);

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

  useEffect(() => {
    if (abaAtual === "estrutura-condominio") {
      void carregarEstrutura();
      void carregarPessoasResumo();
    }
  }, [abaAtual, carregarEstrutura, carregarPessoasResumo]);

  useEffect(() => {
    if (abaAtual === "pessoas-papeis") {
      void carregarPessoasResumo();
    }
  }, [abaAtual, carregarPessoasResumo]);

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
        parentConfig={config.parentConfig}
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
    const blocosPreview = estruturaResumo.blocos.slice(0, 3);
    const unidadesPreview = estruturaResumo.unidades.slice(0, 3);
    const dependenciasPreview = estruturaResumo.dependencias.slice(0, 3);
    const garagensPreview = estruturaResumo.garagens.slice(0, 3);

    return (
      <div className="config-page">
        <header className="config-hero">
          <div>
            <h2>Estrutura do condominio</h2>
            <p className="config-subtitle">
              Mapa visual da estrutura fisica, com vinculos claros entre niveis.
            </p>
          </div>
          <div className="config-hero-actions">
            <span className="config-pill">Estrutura</span>
            <span className="config-pill">Vinculos</span>
          </div>
        </header>

        <section className="structure-map">
          <div className="structure-root">
            <div className="structure-card structure-card--root">
              <span className="structure-eyebrow">Condominio (nivel raiz)</span>
              <h3>{organizacao.nome}</h3>
              <p>Vinculo principal da estrutura. Tudo herda deste nivel.</p>
            </div>
            <div className="structure-breadcrumbs">
              <span>Condominio</span>
              <span className="structure-arrow">→</span>
              <span>Bloco</span>
              <span className="structure-arrow">→</span>
              <span>Unidade</span>
            </div>
          </div>

          <div className="structure-flow" aria-hidden="true">
            <span className="structure-node">Condominio</span>
            <span className="structure-connector" />
            <span className="structure-node">Blocos</span>
            <span className="structure-connector" />
            <span className="structure-node">Unidades</span>
          </div>

          <div className="structure-info">
            <div className="structure-info-card">
              <span className="structure-info-title">Vinculo principal</span>
              <p>
                Todo bloco pertence ao Condominio{" "}
                <strong>{organizacao.nome}</strong>.
              </p>
            </div>
            <div className="structure-info-card">
              <span className="structure-info-title">Heranca de unidade</span>
              <p>Unidades herdam do bloco e do condominio.</p>
            </div>
            <div className="structure-info-card">
              <span className="structure-info-title">Mapa ativo</span>
              <p>Estrutura carregada direto da base, com hierarquia validada.</p>
            </div>
          </div>

          <div className="structure-alerts">
            <div
              className={
                "structure-alert " +
                (estruturaResumo.unidadesSemBloco ? "structure-alert--warn" : "structure-alert--ok")
              }
            >
              <span>Unidades sem bloco</span>
              <strong>{estruturaResumo.unidadesSemBloco}</strong>
            </div>
            <div
              className={
                "structure-alert " +
                (estruturaResumo.blocosSemUnidade ? "structure-alert--warn" : "structure-alert--ok")
              }
            >
              <span>Blocos sem unidade</span>
              <strong>{estruturaResumo.blocosSemUnidade}</strong>
            </div>
            <div
              className={
                "structure-alert " +
                (estruturaResumo.garagensSemUnidade ? "structure-alert--warn" : "structure-alert--ok")
              }
            >
              <span>Garagens sem unidade</span>
              <strong>{estruturaResumo.garagensSemUnidade}</strong>
            </div>
          </div>

          {estruturaResumo.loading && (
            <div className="structure-loading">Carregando estrutura...</div>
          )}

          {estruturaResumo.erro && (
            <p className="error">{estruturaResumo.erro}</p>
          )}

          <div className="structure-columns">
            <div className="structure-column">
              <div className="structure-column-header">
                <div>
                  <h4>Blocos</h4>
                  <p>Este bloco pertence ao Condominio {organizacao.nome}.</p>
                </div>
                <div className="structure-column-actions">
                  <span className="structure-count">
                    {estruturaResumo.blocos.length}
                  </span>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setEstruturaAba("blocos")}
                  >
                    Abrir
                  </button>
                </div>
              </div>
              <div className="structure-items">
                {blocosPreview.map((item) => (
                  <div key={item.id} className="structure-item">
                    <strong>{item.nome}</strong>
                    <span>Vinculo: Condominio → Bloco</span>
                  </div>
                ))}
                {!blocosPreview.length && (
                  <div className="structure-empty">
                    Nenhum bloco cadastrado.
                  </div>
                )}
              </div>
            </div>

            <div className="structure-column">
              <div className="structure-column-header">
                <div>
                  <h4>Unidades</h4>
                  <p>Vinculo: Condominio → Bloco → Unidade.</p>
                </div>
                <div className="structure-column-actions">
                  <span className="structure-count">
                    {estruturaResumo.unidades.length}
                  </span>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setEstruturaAba("unidades")}
                  >
                    Abrir
                  </button>
                </div>
              </div>
              <div className="structure-items">
                {unidadesPreview.map((item) => (
                  <div key={item.id} className="structure-item">
                    <strong>{item.nome}</strong>
                    <span>Vinculo: Condominio → Bloco (a definir) → Unidade</span>
                  </div>
                ))}
                {!unidadesPreview.length && (
                  <div className="structure-empty">
                    Nenhuma unidade cadastrada.
                  </div>
                )}
              </div>
            </div>

            <div className="structure-column">
              <div className="structure-column-header">
                <div>
                  <h4>Dependencias</h4>
                  <p>Recurso vinculado ao Condominio.</p>
                </div>
                <div className="structure-column-actions">
                  <span className="structure-count">
                    {estruturaResumo.dependencias.length}
                  </span>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setEstruturaAba("dependencias")}
                  >
                    Abrir
                  </button>
                </div>
              </div>
              <div className="structure-items">
                {dependenciasPreview.map((item) => (
                  <div key={item.id} className="structure-item">
                    <strong>{item.nome}</strong>
                    <span>Vinculo: Condominio → Dependencia</span>
                  </div>
                ))}
                {!dependenciasPreview.length && (
                  <div className="structure-empty">
                    Nenhuma dependencia cadastrada.
                  </div>
                )}
              </div>
            </div>

            <div className="structure-column">
              <div className="structure-column-header">
                <div>
                  <h4>Garagens</h4>
                  <p>Recursos vinculados ao Condominio.</p>
                </div>
                <div className="structure-column-actions">
                  <span className="structure-count">
                    {estruturaResumo.garagens.length}
                  </span>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setEstruturaAba("garagens")}
                  >
                    Abrir
                  </button>
                </div>
              </div>
              <div className="structure-items">
                {garagensPreview.map((item) => (
                  <div key={item.id} className="structure-item">
                    <strong>{item.nome}</strong>
                    <span>Vinculo: Condominio → Garagem</span>
                  </div>
                ))}
                {!garagensPreview.length && (
                  <div className="structure-empty">
                    Nenhuma garagem cadastrada.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="structure-people">
            <div>
              <h4>Pessoas e vinculos</h4>
              <p>
                {pessoasResumo.loading
                  ? "Carregando pessoas e vinculos..."
                  : `${pessoasResumo.totalPessoas} pessoas e ${pessoasResumo.totalVinculos} vinculos ativos.`}
              </p>
              {!pessoasResumo.loading && pessoasResumo.pessoasSemVinculo > 0 && (
                <p className="config-subtext">
                  {pessoasResumo.pessoasSemVinculo} pessoas sem vinculo ativo.
                </p>
              )}
            </div>
            <div className="structure-chips">
              <span>Pessoas: {pessoasResumo.totalPessoas}</span>
              <span>Vinculos: {pessoasResumo.totalVinculos}</span>
              <span
                className={
                  pessoasResumo.pessoasSemVinculo ? "structure-chip--alert" : undefined
                }
              >
                Sem vinculo: {pessoasResumo.pessoasSemVinculo}
              </span>
            </div>
          </div>
        </section>

        <div className="config-grid">
          {[
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
          ].map((card) => (
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
  }

  if (abaAtual === "pessoas-papeis" && pessoasAba === "pessoas") {
    return (
      <div className="config-page">
        <header className="config-header">
          <div>
            <h2>Pessoas</h2>
            <p className="config-subtitle">{organizacao.nome}</p>
          </div>
          <div className="config-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setPessoasAba("visao");
                void carregarPessoasResumo();
              }}
            >
              Voltar
            </button>
          </div>
        </header>
        <PessoasView organizacao={organizacao} readOnly={readOnly} />
      </div>
    );
  }

  if (abaAtual === "pessoas-papeis" && pessoasAba === "vinculos") {
    return (
      <ConfiguracoesVinculosTable
        organizacao={organizacao}
        readOnly={readOnly}
        onVoltar={() => {
          setPessoasAba("visao");
          void carregarPessoasResumo();
        }}
        voltarLabel="Voltar para Pessoas"
      />
    );
  }

  if (abaAtual === "pessoas-papeis") {
    return (
      <div className="config-page">
        <header className="config-hero">
          <div>
            <h2>Pessoas & papeis</h2>
            <p className="config-subtitle">
              Cadastros e vinculos da organizacao.
            </p>
          </div>
          <div className="config-hero-actions">
            <span className="config-pill">
              {pessoasResumo.loading ? "Carregando..." : `${pessoasResumo.totalPessoas} pessoas`}
            </span>
            <span className="config-pill">
              {pessoasResumo.loading ? "..." : `${pessoasResumo.totalVinculos} vinculos`}
            </span>
            <span
              className={
                "config-pill" +
                (pessoasResumo.pessoasSemVinculo ? " config-pill--alert" : "")
              }
            >
              {pessoasResumo.loading
                ? "..."
                : `${pessoasResumo.pessoasSemVinculo} sem vinculo`}
            </span>
          </div>
        </header>

        {pessoasResumo.erro && <p className="error">{pessoasResumo.erro}</p>}

        <div className="config-grid">
          {[
            {
              id: "pessoas",
              title: "Pessoas",
              description: "Cadastro unico de pessoas e documentos.",
              actionLabel: acaoGerenciar,
              onClick: () => setPessoasAba("pessoas"),
              active: true
            },
            {
              id: "vinculos",
              title: "Vinculos",
              description: "Vinculos entre pessoa, unidade e condominio.",
              actionLabel: acaoGerenciar,
              onClick: () => setPessoasAba("vinculos"),
              active: true
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
          ].map((card) => (
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
                {card.active && <span className="config-tag">Ativo</span>}
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
  }

  return renderCards(
    "Financeiro - Configuracoes",
    "Parametros que sustentam o financeiro.",
    [
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
