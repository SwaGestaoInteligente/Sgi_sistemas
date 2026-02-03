import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  api,
  ChargeItem,
  ContaFinanceira,
  LancamentoFinanceiro,
  Organizacao,
  PlanoContas
} from "../api";
import { useAuth } from "../hooks/useAuth";

type FinanceiroViewProps = {
  organizacao: Organizacao;
};

export default function FinanceiroView({
  organizacao
}: FinanceiroViewProps) {
  const { token } = useAuth();
  const [aba, setAba] =
    useState<
      | "contas"
      | "contasPagar"
      | "contasReceber"
      | "itensCobrados"
      | "categorias"
      | "relatorios"
    >("contas");
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Contas
  const [nomeConta, setNomeConta] = useState("");
  const [tipoConta, setTipoConta] = useState("Bancária");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [numeroConta, setNumeroConta] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [moeda, setMoeda] = useState("BRL");

  // Contas a pagar (lançamentos)
  const [despesas, setDespesas] = useState<LancamentoFinanceiro[]>([]);
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoVencimento, setNovoVencimento] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novaDespesaCategoriaId, setNovaDespesaCategoriaId] = useState("");

  // Contas a receber (lançamentos)
  const [receitas, setReceitas] = useState<LancamentoFinanceiro[]>([]);
  const [novaReceitaDescricao, setNovaReceitaDescricao] = useState("");
  const [novaReceitaVencimento, setNovaReceitaVencimento] = useState("");
  const [novaReceitaValor, setNovaReceitaValor] = useState("");
  const [novaReceitaCategoriaId, setNovaReceitaCategoriaId] = useState("");

  // Itens cobrados (salão, tags, multas, etc.)
  const [itensCobrados, setItensCobrados] = useState<ChargeItem[]>([]);
  const [novoItemNome, setNovoItemNome] = useState("");
  const [novoItemTipo, setNovoItemTipo] = useState("AreaComum");
  const [novoItemCategoriaId, setNovoItemCategoriaId] = useState("");
  const [categoriasReceita, setCategoriasReceita] = useState<PlanoContas[]>([]);
  const [categoriasDespesa, setCategoriasDespesa] = useState<PlanoContas[]>([]);
  const [novoItemValorPadrao, setNovoItemValorPadrao] = useState("");
  const [novoItemPermiteAlterar, setNovoItemPermiteAlterar] = useState(true);
  const [novoItemExigeReserva, setNovoItemExigeReserva] = useState(false);
  const [novoItemGeraCobrancaAuto, setNovoItemGeraCobrancaAuto] =
    useState(true);
  const [novoItemDescricao, setNovoItemDescricao] = useState("");

  // Plano de contas (categorias financeiras)
  const [novaCategoriaCodigo, setNovaCategoriaCodigo] = useState("");
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [novaCategoriaTipo, setNovaCategoriaTipo] =
    useState<"Receita" | "Despesa">("Receita");

  const organizacaoId = organizacao.id;

  const carregarContas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarContas(token, organizacaoId);
      setContas(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar contas financeiras");
    } finally {
      setLoading(false);
    }
  };

  const carregarDespesas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const data = await api.listarLancamentos(token, organizacaoId, {
        tipo: "pagar"
      });
      setDespesas(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar lançamentos a pagar");
    } finally {
      setLoading(false);
    }
  };

  const carregarItensCobrados = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarItensCobrados(
        token,
        organizacaoId,
        true // apenas ativos
      );
      setItensCobrados(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar itens cobrados");
    } finally {
      setLoading(false);
    }
  };

  const carregarReceitas = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const data = await api.listarLancamentos(token, organizacaoId, {
        tipo: "receber"
      });
      setReceitas(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar lançamentos a receber");
    } finally {
      setLoading(false);
    }
  };

  const carregarCategoriasReceita = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarPlanosContas(
        token,
        organizacaoId,
        "Receita"
      );
      setCategoriasReceita(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar categorias financeiras");
    } finally {
      setLoading(false);
    }
  };

  const carregarCategoriasDespesa = async () => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const lista = await api.listarPlanosContas(
        token,
        organizacaoId,
        "Despesa"
      );
      setCategoriasDespesa(lista);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar categorias financeiras");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarContas();
    void carregarDespesas();
    void carregarReceitas();
    void carregarCategoriasReceita();
    void carregarCategoriasDespesa();
    // Itens cobrados serão carregados sob demanda ao abrir a aba
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizacaoId]);

  const criarConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      const saldoNumero = saldoInicial ? Number(saldoInicial) : undefined;

      const criada = await api.criarContaFinanceira(token, {
        organizacaoId,
        nome: nomeConta,
        tipo: tipoConta,
        banco: banco || undefined,
        agencia: agencia || undefined,
        numeroConta: numeroConta || undefined,
        saldoInicial: saldoNumero,
        moeda,
        status: "ativo"
      });

      setContas((prev) => [...prev, criada]);
      setNomeConta("");
      setTipoConta("Bancária");
      setBanco("");
      setAgencia("");
      setNumeroConta("");
      setSaldoInicial("");
      setMoeda("BRL");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar conta financeira");
    } finally {
      setLoading(false);
    }
  };

  const removerConta = async (conta: ContaFinanceira) => {
    if (!token) return;
    if (
      !window.confirm(
        `Tem certeza que deseja excluir a conta "${conta.nome}"?`
      )
    ) {
      return;
    }

    try {
      setErro(null);
      setLoading(true);
      await api.removerContaFinanceira(token, conta.id);
      setContas((prev) => prev.filter((c) => c.id !== conta.id));
    } catch (e: any) {
      setErro(e.message || "Erro ao remover conta financeira");
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatusConta = async (
    conta: ContaFinanceira,
    novoStatus: string
  ) => {
    if (!token) return;
    try {
      setErro(null);
      setLoading(true);
      await api.atualizarStatusContaFinanceira(token, conta.id, novoStatus);
      setContas((prev) =>
        prev.map((c) =>
          c.id === conta.id ? { ...c, status: novoStatus } : c
        )
      );
    } catch (e: any) {
      setErro(e.message || "Erro ao atualizar status da conta");
    } finally {
      setLoading(false);
    }
  };

  const criarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !token ||
      !novaDescricao.trim() ||
      !novoVencimento ||
      !novoValor ||
      !novaDespesaCategoriaId
    ) {
      return;
    }

    const conta = contas[0];
    try {
      setErro(null);
      setLoading(true);
      const payload: Omit<LancamentoFinanceiro, "id"> = {
        organizacaoId,
        tipo: "pagar",
        situacao: "pendente",
        planoContasId: novaDespesaCategoriaId,
        centroCustoId: undefined,
        contaFinanceiraId: conta?.id,
        pessoaId: "00000000-0000-0000-0000-000000000000",
        descricao: novaDescricao.trim(),
        valor: Number(novoValor.replace(/\./g, "").replace(",", ".")),
        dataCompetencia: novoVencimento,
        dataVencimento: novoVencimento,
        dataPagamento: undefined,
        formaPagamento: "indefinido",
        parcelaNumero: undefined,
        parcelaTotal: undefined,
        referencia: undefined
      };

      const lanc = await api.criarLancamento(token, payload);
      setDespesas((prev) => [...prev, lanc]);
      setNovaDescricao("");
      setNovoVencimento("");
      setNovoValor("");
      setNovaDespesaCategoriaId("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar despesa");
    } finally {
      setLoading(false);
    }
  };

  const criarReceita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !token ||
      !novaReceitaDescricao.trim() ||
      !novaReceitaVencimento ||
      !novaReceitaValor ||
      !novaReceitaCategoriaId
    ) {
      return;
    }

    const conta = contas[0];

    try {
      setErro(null);
      setLoading(true);
      const payload: Omit<LancamentoFinanceiro, "id"> = {
        organizacaoId,
        tipo: "receber",
        situacao: "pendente",
        planoContasId: novaReceitaCategoriaId,
        centroCustoId: undefined,
        contaFinanceiraId: conta?.id,
        pessoaId: "00000000-0000-0000-0000-000000000000",
        descricao: novaReceitaDescricao.trim(),
        valor: Number(novaReceitaValor.replace(/\./g, "").replace(",", ".")),
        dataCompetencia: novaReceitaVencimento,
        dataVencimento: novaReceitaVencimento,
        dataPagamento: undefined,
        formaPagamento: "indefinido",
        parcelaNumero: undefined,
        parcelaTotal: undefined,
        referencia: undefined
      };

      const lanc = await api.criarLancamento(token, payload);
      setReceitas((prev) => [...prev, lanc]);
      setNovaReceitaDescricao("");
      setNovaReceitaVencimento("");
      setNovaReceitaValor("");
      setNovaReceitaCategoriaId("");
    } catch (e: any) {
      setErro(e.message || "Erro ao criar receita");
    } finally {
      setLoading(false);
    }
  };

  const totalContas = contas.length;
  const contasAtivas = contas.filter((c) => c.status === "ativo").length;
  const contasInativas = contas.filter((c) => c.status === "inativo").length;
  const saldoInicialTotal = contas.reduce(
    (sum, c) => sum + (c.saldoInicial ?? 0),
    0
  );
  const totalAPagar = despesas
    .filter((d) => d.situacao === "pendente")
    .reduce((sum, d) => sum + d.valor, 0);
  const totalPagas = despesas
    .filter((d) => d.situacao === "pago")
    .reduce((sum, d) => sum + d.valor, 0);

  const categoriasDespesaPorId = Object.fromEntries(
    categoriasDespesa.map((c) => [c.id, `${c.codigo} - ${c.nome}`])
  );
  const categoriasReceitaPorId = Object.fromEntries(
    categoriasReceita.map((c) => [c.id, `${c.codigo} - ${c.nome}`])
  );

  const despesasValidas = despesas.filter(
    (d) => d.situacao !== "cancelado"
  );
  const receitasValidas = receitas.filter(
    (r) => r.situacao !== "cancelado"
  );
  const totalReceitasPorCategoria = receitasValidas.reduce(
    (acc, r) => {
      const key = r.planoContasId || "sem-categoria";
      acc[key] = (acc[key] ?? 0) + r.valor;
      return acc;
    },
    {} as Record<string, number>
  );
  const totalDespesasPorCategoria = despesasValidas.reduce(
    (acc, d) => {
      const key = d.planoContasId || "sem-categoria";
      acc[key] = (acc[key] ?? 0) + d.valor;
      return acc;
    },
    {} as Record<string, number>
  );
  const totalReceitas = receitasValidas.reduce(
    (sum, r) => sum + r.valor,
    0
  );
  const totalDespesas = despesasValidas.reduce(
    (sum, d) => sum + d.valor,
    0
  );
  const saldoPeriodo = totalReceitas - totalDespesas;

  const carregarLogoBase64 = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}swa1.jpeg`);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const gerarRelatorioPdf = async () => {
    const doc = new jsPDF();
    const logo = await carregarLogoBase64();
    const titulo = `Relatorio Financeiro - ${organizacao.nome}`;
    doc.setFontSize(14);
    if (logo) {
      const pageWidth = doc.internal.pageSize.getWidth();
      const logoSize = 32;
      const logoX = (pageWidth - logoSize) / 2;
      doc.addImage(logo, "JPEG", logoX, 8, logoSize, logoSize);
    }
    const titleX = 14;
    const startY = logo ? 48 : 16;
    doc.text(titulo, titleX, startY);
    doc.setFontSize(11);
    doc.text(
      `Total receitas: ${totalReceitas.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      })}`,
      titleX,
      startY + 10
    );
    doc.text(
      `Total despesas: ${totalDespesas.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      })}`,
      titleX,
      startY + 18
    );
    doc.text(
      `Saldo do periodo: ${saldoPeriodo.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      })}`,
      titleX,
      startY + 26
    );

    const receitasRows = Object.entries(totalReceitasPorCategoria).map(
      ([id, total]) => [
        categoriasReceitaPorId[id] ?? "Sem categoria",
        total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      ]
    );
    autoTable(doc, {
      startY: startY + 36,
      head: [["Receitas por categoria", "Total"]],
      body: receitasRows.length ? receitasRows : [["Nenhuma receita", "-"]]
    });

    const despesasRows = Object.entries(totalDespesasPorCategoria).map(
      ([id, total]) => [
        categoriasDespesaPorId[id] ?? "Sem categoria",
        total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      ]
    );
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Despesas por categoria", "Total"]],
      body: despesasRows.length ? despesasRows : [["Nenhuma despesa", "-"]]
    });

    const arquivo = `relatorio_financeiro_${organizacao.nome
      .replace(/[^a-z0-9]+/gi, "_")
      .toLowerCase()}.pdf`;
    doc.save(arquivo);
  };

  const gerarRelatorioExcel = () => {
    const wb = XLSX.utils.book_new();

    const resumo = [
      ["Relatorio Financeiro", organizacao.nome],
      ["Total receitas", totalReceitas],
      ["Total despesas", totalDespesas],
      ["Saldo do periodo", saldoPeriodo]
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    const receitasSheet = [
      ["Categoria", "Total"],
      ...Object.entries(totalReceitasPorCategoria).map(([id, total]) => [
        categoriasReceitaPorId[id] ?? "Sem categoria",
        total
      ])
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(receitasSheet),
      "Receitas"
    );

    const despesasSheet = [
      ["Categoria", "Total"],
      ...Object.entries(totalDespesasPorCategoria).map(([id, total]) => [
        categoriasDespesaPorId[id] ?? "Sem categoria",
        total
      ])
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(despesasSheet),
      "Despesas"
    );

    const arquivo = `relatorio_financeiro_${organizacao.nome
      .replace(/[^a-z0-9]+/gi, "_")
      .toLowerCase()}.xlsx`;
    XLSX.writeFile(wb, arquivo);
  };

  // TODO: corpo completo do FinanceiroView (funções + render)
  return (
    <div className="finance-page">
      <div className="finance-header-row">
        <div>
          <h2>Financeiro</h2>
        </div>
        <div className="finance-header-badges">
          <span>Contas: {totalContas}</span>
          <span>Ativas: {contasAtivas}</span>
          <span>Inativas: {contasInativas}</span>
        </div>
      </div>

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <div className="finance-summary-label">Saldo inicial total</div>
          <div className="finance-summary-value">
            R$ {saldoInicialTotal.toFixed(2)}
          </div>
        </div>
        <div className="finance-summary-card">
          <div className="finance-summary-label">Total a pagar</div>
          <div className="finance-summary-value">
            R$ {totalAPagar.toFixed(2)}
          </div>
        </div>
        <div className="finance-summary-card">
          <div className="finance-summary-label">Total já pago</div>
          <div className="finance-summary-value">
            R$ {totalPagas.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="finance-tabs">
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "contas" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("contas")}
        >
          Contas
        </button>
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "contasPagar" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("contasPagar")}
        >
          Contas a pagar
        </button>
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "contasReceber" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("contasReceber")}
        >
          Contas a receber
        </button>
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "itensCobrados" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("itensCobrados")}
        >
          Itens de cobrança
        </button>
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "categorias" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("categorias")}
        >
          Cadastro de categorias
        </button>
        <button
          type="button"
          className={
            "finance-tab" +
            (aba === "relatorios" ? " finance-tab--active" : "")
          }
          onClick={() => setAba("relatorios")}
        >
          Relatorios
        </button>
      </div>

      {aba === "contas" && (
        <div className="finance-layout">
          {/* Formulário de conta */}
          <section className="finance-form-card">
            <h3>Nova conta</h3>
            <form onSubmit={criarConta} className="form">
              <label>
                Nome da conta
                <input
                  value={nomeConta}
                  onChange={(e) => setNomeConta(e.target.value)}
                  required
                />
              </label>
              <label>
                Tipo de conta
                <select
                  value={tipoConta}
                  onChange={(e) => setTipoConta(e.target.value)}
                >
                  <option value="Bancária">Bancária</option>
                  <option value="Caixa">Caixa</option>
                  <option value="Digital">Conta digital</option>
                  <option value="Outros">Outros</option>
                </select>
              </label>

              <div className="finance-form-grid">
                <label>
                  Banco
                  <input
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                  />
                </label>
                <label>
                  Agência
                  <input
                    value={agencia}
                    onChange={(e) => setAgencia(e.target.value)}
                  />
                </label>
              </div>

              <div className="finance-form-grid">
                <label>
                  Número da conta
                  <input
                    value={numeroConta}
                    onChange={(e) => setNumeroConta(e.target.value)}
                  />
                </label>
                <label>
                  Saldo inicial
                  <input
                    value={saldoInicial}
                    onChange={(e) => setSaldoInicial(e.target.value)}
                    placeholder="Ex.: 0,00"
                  />
                </label>
              </div>

              <label>
                Moeda
                <select
                  value={moeda}
                  onChange={(e) => setMoeda(e.target.value)}
                >
                  <option value="BRL">Real (BRL)</option>
                  <option value="USD">Dólar (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </label>

              <button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Adicionar conta"}
              </button>
              {erro && <p className="error">{erro}</p>}
            </form>
          </section>

          {/* Tabela de contas */}
          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Contas financeiras</h3>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Banco</th>
                  <th>Agência</th>
                  <th>Número</th>
                  <th>Saldo inicial</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {contas.map((conta) => (
                  <tr key={conta.id}>
                    <td>{conta.nome}</td>
                    <td>{conta.tipo}</td>
                    <td>{conta.banco || "-"}</td>
                    <td>{conta.agencia || "-"}</td>
                    <td>{conta.numeroConta || "-"}</td>
                    <td>
                      {conta.saldoInicial?.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: conta.moeda || "BRL"
                      })}
                    </td>
                    <td>
                      {conta.status ? (
                        <span
                          className={
                            "badge-status " +
                            (conta.status === "ativo"
                              ? "badge-status--ativo"
                              : "badge-status--inativo")
                          }
                        >
                          {conta.status === "ativo" ? "Ativa" : "Inativa"}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <div className="finance-card-actions">
                        <button
                          type="button"
                          onClick={() =>
                            atualizarStatusConta(
                              conta,
                              conta.status === "ativo" ? "inativo" : "ativo"
                            )
                          }
                          style={{
                            backgroundColor:
                              conta.status === "ativo"
                                ? "#f97316"
                                : "#22c55e"
                          }}
                        >
                          {conta.status === "ativo" ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removerConta(conta)}
                          style={{
                            backgroundColor: "#ef4444",
                            color: "#ffffff"
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {aba === "contasPagar" && (
        <div className="finance-table-card" style={{ marginTop: 12 }}>
          <h3>Contas a pagar</h3>

          <form
            onSubmit={criarDespesa}
            className="form"
            style={{ marginTop: 12, marginBottom: 12 }}
          >
            <label>
              Descrição
              <input
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Ex.: Conta de energia"
              />
            </label>
            <div className="finance-form-grid">
              <label>
                Vencimento
                <input
                  type="date"
                  value={novoVencimento}
                  onChange={(e) => setNovoVencimento(e.target.value)}
                />
              </label>
              <label>
                Valor
                <input
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  placeholder="Ex.: 150,00"
                />
              </label>
            </div>
            <label>
              Categoria de despesa
              <select
                value={novaDespesaCategoriaId}
                onChange={(e) => setNovaDespesaCategoriaId(e.target.value)}
                required
              >
                <option value="">Selecione uma categoria</option>
                {categoriasDespesa.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.codigo} - {cat.nome}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={
                loading ||
                !novaDescricao.trim() ||
                !novoVencimento ||
                !novoValor ||
                !novaDespesaCategoriaId
              }
            >
              {loading ? "Salvando..." : "Criar despesa"}
            </button>
          </form>

          <button
            type="button"
            onClick={carregarDespesas}
            disabled={loading}
            style={{ marginBottom: 12 }}
          >
            {loading ? "Carregando..." : "Atualizar lista"}
          </button>

          {erro && <p className="error">{erro}</p>}

          <table className="table finance-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th className="finance-value-header">Valor</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {despesas
                .filter((d) => d.situacao !== "cancelado")
                .map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="finance-desc">{d.descricao}</div>
                    </td>
                    <td>
                      {categoriasDespesaPorId[d.planoContasId] ?? "-"}
                    </td>
                    <td>
                      {d.dataVencimento
                        ? new Date(d.dataVencimento).toLocaleDateString(
                            "pt-BR"
                          )
                        : "-"}
                    </td>
                    <td className="finance-value-cell">
                      <span className="finance-value">
                        {d.valor.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        })}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          "badge-status " +
                          (d.situacao === "pago"
                            ? "badge-status--pago"
                            : "badge-status--pendente")
                        }
                      >
                        {d.situacao === "pago" ? "Pago" : "Pendente"}
                      </span>
                    </td>
                    <td className="finance-actions-cell">
                      <div className="table-actions">
                        <button
                          type="button"
                          className="action-primary"
                          title="Marcar como pago"
                          disabled={loading || d.situacao === "pago"}
                          onClick={async () => {
                            if (!token) return;
                            try {
                              setErro(null);
                              setLoading(true);
                              await api.pagarLancamento(token, d.id);
                              await carregarDespesas();
                            } catch (e: any) {
                              setErro(
                                e.message || "Erro ao marcar como pago"
                              );
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          Marcar como pago
                        </button>
                        <details className="action-menu">
                          <summary title="Mais ações" aria-label="Mais ações">
                            ⋮
                          </summary>
                          <div className="action-menu-panel">
                            <button
                              type="button"
                              className="action-secondary"
                              title="Cancelar despesa"
                              disabled={loading}
                              onClick={async () => {
                                if (!token) return;
                                if (!window.confirm("Cancelar esta despesa?"))
                                  return;
                                try {
                                  setErro(null);
                                  setLoading(true);
                                  await api.cancelarLancamento(token, d.id);
                                  await carregarDespesas();
                                } catch (e: any) {
                                  setErro(
                                    e.message || "Erro ao cancelar despesa"
                                  );
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === "contasReceber" && (
        <div className="finance-table-card" style={{ marginTop: 12 }}>
          <h3>Contas a receber</h3>

          <form
            onSubmit={criarReceita}
            className="form"
            style={{ marginTop: 12, marginBottom: 12 }}
          >
            <label>
              Descrição
              <input
                value={novaReceitaDescricao}
                onChange={(e) =>
                  setNovaReceitaDescricao(e.target.value)
                }
                placeholder="Ex.: Taxa condominial janeiro"
              />
            </label>
            <div className="finance-form-grid">
              <label>
                Vencimento
                <input
                  type="date"
                  value={novaReceitaVencimento}
                  onChange={(e) =>
                    setNovaReceitaVencimento(e.target.value)
                  }
                />
              </label>
              <label>
                Valor
                <input
                  value={novaReceitaValor}
                  onChange={(e) =>
                    setNovaReceitaValor(e.target.value)
                  }
                  placeholder="Ex.: 300,00"
                />
              </label>
            </div>
            <label>
              Categoria de receita
              <select
                value={novaReceitaCategoriaId}
                onChange={(e) => setNovaReceitaCategoriaId(e.target.value)}
                required
              >
                <option value="">Selecione uma categoria</option>
                {categoriasReceita.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.codigo} - {cat.nome}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={
                loading ||
                !novaReceitaDescricao.trim() ||
                !novaReceitaVencimento ||
                !novaReceitaValor ||
                !novaReceitaCategoriaId
              }
            >
              {loading ? "Salvando..." : "Criar receita"}
            </button>
          </form>

          <button
            type="button"
            onClick={carregarReceitas}
            disabled={loading}
            style={{ marginBottom: 12 }}
          >
            {loading ? "Carregando..." : "Atualizar lista"}
          </button>

          {erro && <p className="error">{erro}</p>}

          <table className="table finance-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th className="finance-value-header">Valor</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {receitas.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="finance-desc">{r.descricao}</div>
                  </td>
                  <td>
                    {categoriasReceitaPorId[r.planoContasId] ?? "-"}
                  </td>
                  <td>
                    {r.dataVencimento
                      ? new Date(r.dataVencimento).toLocaleDateString(
                          "pt-BR"
                        )
                      : "-"}
                  </td>
                  <td className="finance-value-cell">
                    <span className="finance-value">
                      {r.valor.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      })}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        "badge-status " +
                        (r.situacao === "pago"
                          ? "badge-status--pago"
                          : r.situacao === "cancelado"
                          ? "badge-status--inativo"
                          : "badge-status--pendente")
                      }
                    >
                      {r.situacao === "pago"
                        ? "Pago"
                        : r.situacao === "cancelado"
                        ? "Cancelado"
                        : "Pendente"}
                    </span>
                  </td>
                  <td className="finance-actions-cell">
                    <div className="table-actions">
                      <button
                        type="button"
                        className="action-primary"
                        title="Marcar como pago"
                        disabled={loading || r.situacao === "pago"}
                        onClick={async () => {
                          if (!token) return;
                          try {
                            setErro(null);
                            setLoading(true);
                            await api.pagarLancamento(token, r.id);
                            await carregarReceitas();
                          } catch (e: any) {
                            setErro(e.message || "Erro ao marcar como pago");
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Marcar como pago
                      </button>
                      <details className="action-menu">
                        <summary title="Mais ações" aria-label="Mais ações">
                          ⋮
                        </summary>
                        <div className="action-menu-panel">
                          <button
                            type="button"
                            className="action-secondary"
                            title="Cancelar receita"
                            disabled={loading}
                            onClick={async () => {
                              if (!token) return;
                              if (!window.confirm("Cancelar esta receita?"))
                                return;
                              try {
                                setErro(null);
                                setLoading(true);
                                await api.cancelarLancamento(token, r.id);
                                await carregarReceitas();
                              } catch (e: any) {
                                setErro(e.message || "Erro ao cancelar receita");
                              } finally {
                                setLoading(false);
                              }
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === "itensCobrados" && (
        <div className="finance-layout">
          <section className="finance-form-card">
            <h3>Novo item cobrado</h3>

            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!token || !novoItemNome.trim()) return;
                try {
                  setErro(null);
                  setLoading(true);
                  const valor =
                    novoItemValorPadrao.trim().length > 0
                      ? Number(
                          novoItemValorPadrao
                            .replace(/\./g, "")
                            .replace(",", ".")
                        )
                      : undefined;
                  const criado = await api.criarItemCobrado(token, {
                    organizacaoId,
                    nome: novoItemNome.trim(),
                    tipo: novoItemTipo,
                    financeCategoryId:
                      novoItemCategoriaId ||
                      "00000000-0000-0000-0000-000000000000",
                    valorPadrao: valor,
                    permiteAlterarValor: novoItemPermiteAlterar,
                    exigeReserva: novoItemExigeReserva,
                    geraCobrancaAutomatica: novoItemGeraCobrancaAuto,
                    descricaoOpcional:
                      novoItemDescricao.trim().length > 0
                        ? novoItemDescricao.trim()
                        : undefined
                  });
                  setItensCobrados((prev) => [...prev, criado]);
                  setNovoItemNome("");
                  setNovoItemTipo("AreaComum");
                  setNovoItemCategoriaId("");
                  setNovoItemValorPadrao("");
                  setNovoItemPermiteAlterar(true);
                  setNovoItemExigeReserva(false);
                  setNovoItemGeraCobrancaAuto(true);
                  setNovoItemDescricao("");
                } catch (e: any) {
                  setErro(e.message || "Erro ao criar item cobrado");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <label>
                Nome do item
                <input
                  value={novoItemNome}
                  onChange={(e) => setNovoItemNome(e.target.value)}
                  placeholder="Ex.: Reserva salão de festas"
                  required
                />
              </label>

              <div className="finance-form-grid">
                <label>
                  Tipo
                  <select
                    value={novoItemTipo}
                    onChange={(e) => setNovoItemTipo(e.target.value)}
                  >
                    <option value="AreaComum">Área comum</option>
                    <option value="TagAcesso">Tag / acesso</option>
                    <option value="Multa">Multa</option>
                    <option value="Outros">Outros</option>
                  </select>
                </label>
                <label>
                  Valor padrão
                  <input
                    value={novoItemValorPadrao}
                    onChange={(e) =>
                      setNovoItemValorPadrao(e.target.value)
                    }
                    placeholder="Ex.: 250,00"
                  />
                </label>
              </div>

              <label>
                Categoria financeira
                <select
                  value={novoItemCategoriaId}
                  onChange={(e) =>
                    setNovoItemCategoriaId(e.target.value)
                  }
                >
                  <option value="">Selecione uma categoria</option>
                  {categoriasReceita.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.codigo} - {cat.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Descrição
                <textarea
                  value={novoItemDescricao}
                  onChange={(e) =>
                    setNovoItemDescricao(e.target.value)
                  }
                  rows={3}
                />
              </label>

              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={novoItemPermiteAlterar}
                  onChange={(e) =>
                    setNovoItemPermiteAlterar(e.target.checked)
                  }
                />{" "}
                Permite alterar valor na hora
              </label>

              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={novoItemExigeReserva}
                  onChange={(e) =>
                    setNovoItemExigeReserva(e.target.checked)
                  }
                />{" "}
                Exige reserva aprovada (salão, churrasqueira, etc.)
              </label>

              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={novoItemGeraCobrancaAuto}
                  onChange={(e) =>
                    setNovoItemGeraCobrancaAuto(e.target.checked)
                  }
                />{" "}
                Gerar cobrança automática no financeiro
              </label>

              <button
                type="submit"
                disabled={loading || !novoItemNome.trim()}
              >
                {loading ? "Salvando..." : "Salvar item"}
              </button>
            </form>
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Itens cadastrados</h3>
              </div>
              <button
                type="button"
                onClick={carregarItensCobrados}
                disabled={loading}
              >
                {loading ? "Carregando..." : "Atualizar lista"}
              </button>
            </div>

            {erro && <p className="error">{erro}</p>}

            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Valor padrão</th>
                  <th>Ativo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {itensCobrados.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nome}</td>
                    <td>{item.tipo}</td>
                    <td>
                      {item.financeCategoryId
                        ? categoriasReceitaPorId[item.financeCategoryId] ?? "-"
                        : "-"}
                    </td>
                    <td>
                      {item.valorPadrao != null
                        ? item.valorPadrao.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL"
                          })
                        : "-"}
                    </td>
                    <td>
                      <span
                        className={
                          "badge-status " +
                          (item.ativo
                            ? "badge-status--ativo"
                            : "badge-status--inativo")
                        }
                      >
                        {item.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!token) return;
                          const novoNome = window.prompt(
                            "Nome do item:",
                            item.nome
                          );
                          if (!novoNome || !novoNome.trim()) return;

                          const novoValorStr = window.prompt(
                            "Valor padrão (ex.: 150,00):",
                            item.valorPadrao != null
                              ? item.valorPadrao.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2
                                })
                              : ""
                          );
                          const novoValor =
                            novoValorStr && novoValorStr.trim().length > 0
                              ? Number(
                                  novoValorStr
                                    .replace(/\./g, "")
                                    .replace(",", ".")
                                )
                              : undefined;

                          const novaDescricao =
                            window.prompt(
                              "Descrição (opcional):",
                              item.descricaoOpcional ?? ""
                            ) ?? item.descricaoOpcional ?? "";

                          const tipoEscolhido =
                            window.prompt(
                              'Tipo (AreaComum, TagAcesso, Multa, Outros):',
                              item.tipo || "AreaComum"
                            ) ?? item.tipo;

                          try {
                            setErro(null);
                            setLoading(true);
                            await api.atualizarItemCobrado(token, item.id, {
                              nome: novoNome.trim(),
                              tipo: tipoEscolhido || "AreaComum",
                              financeCategoryId: item.financeCategoryId,
                              valorPadrao: novoValor,
                              permiteAlterarValor: item.permiteAlterarValor,
                              exigeReserva: item.exigeReserva,
                              geraCobrancaAutomatica:
                                item.geraCobrancaAutomatica,
                              descricaoOpcional:
                                novaDescricao.trim().length > 0
                                  ? novaDescricao.trim()
                                  : undefined,
                              ativo: item.ativo
                            });

                            setItensCobrados((prev) =>
                              prev.map((i) =>
                                i.id === item.id
                                  ? {
                                      ...i,
                                      nome: novoNome.trim(),
                                      tipo: tipoEscolhido || "AreaComum",
                                      valorPadrao: novoValor ?? i.valorPadrao,
                                      descricaoOpcional:
                                        novaDescricao.trim().length > 0
                                          ? novaDescricao.trim()
                                          : undefined
                                    }
                                  : i
                              )
                            );
                          } catch (e: any) {
                            setErro(
                              e.message || "Erro ao atualizar item cobrado"
                            );
                          } finally {
                            setLoading(false);
                          }
                        }}
                        style={{
                          marginRight: 8,
                          backgroundColor: "#e5e7eb",
                          color: "#111827"
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!token) return;
                          const novoAtivo = !item.ativo;
                          try {
                            setErro(null);
                            setLoading(true);
                            await api.atualizarStatusItemCobrado(
                              token,
                              item.id,
                              novoAtivo
                            );
                            setItensCobrados((prev) =>
                              prev.map((i) =>
                                i.id === item.id
                                  ? { ...i, ativo: novoAtivo }
                                  : i
                              )
                            );
                          } catch (e: any) {
                            setErro(
                              e.message ||
                                "Erro ao atualizar item cobrado"
                            );
                          } finally {
                            setLoading(false);
                          }
                        }}
                        style={{
                          backgroundColor: item.ativo
                            ? "#f97316"
                            : "#22c55e"
                        }}
                      >
                        {item.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {aba === "categorias" && (
        <div className="finance-layout">
          <section className="finance-form-card">
            <h3>Nova categoria financeira</h3>

            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!token) return;
                if (!novaCategoriaCodigo.trim() || !novaCategoriaNome.trim()) {
                  return;
                }

                try {
                  setErro(null);
                  setLoading(true);
                  const criada = await api.criarPlanoContas(token, {
                    organizacaoId: organizacao.id,
                    codigo: novaCategoriaCodigo.trim(),
                    nome: novaCategoriaNome.trim(),
                    tipo: novaCategoriaTipo,
                    nivel: 1
                  });

                  if (criada.tipo === "Receita") {
                    setCategoriasReceita((prev) => [...prev, criada]);
                  } else {
                    setCategoriasDespesa((prev) => [...prev, criada]);
                  }

                  setNovaCategoriaCodigo("");
                  setNovaCategoriaNome("");
                  setNovaCategoriaTipo("Receita");
                } catch (e: any) {
                  setErro(e.message || "Erro ao criar categoria financeira");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="finance-form-grid">
                <label>
                  Código
                  <input
                    value={novaCategoriaCodigo}
                    onChange={(e) => setNovaCategoriaCodigo(e.target.value)}
                    placeholder="Ex.: 1.01.01"
                    required
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={novaCategoriaTipo}
                    onChange={(e) =>
                      setNovaCategoriaTipo(
                        e.target.value === "Despesa" ? "Despesa" : "Receita"
                      )
                    }
                  >
                    <option value="Receita">Receita</option>
                    <option value="Despesa">Despesa</option>
                  </select>
                </label>
              </div>

              <label>
                Nome da categoria
                <input
                  value={novaCategoriaNome}
                  onChange={(e) => setNovaCategoriaNome(e.target.value)}
                  placeholder="Ex.: Receitas de condomínio"
                  required
                />
              </label>
              <button type="submit" disabled={loading || !token}>
                {loading ? "Salvando..." : "Adicionar categoria"}
              </button>
            </form>
          </section>

          <section className="finance-table-card">
            <div className="finance-table-header">
              <div>
                <h3>Plano de contas</h3>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!token) return;
                  try {
                    setErro(null);
                    setLoading(true);
                    const [receitas, despesas] = await Promise.all([
                      api.listarPlanosContas(token, organizacao.id, "Receita"),
                      api.listarPlanosContas(token, organizacao.id, "Despesa")
                    ]);
                    setCategoriasReceita(receitas);
                    setCategoriasDespesa(despesas);
                  } catch (e: any) {
                    setErro(
                      e.message || "Erro ao carregar categorias financeiras"
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !token}
              >
                {loading ? "Carregando..." : "Atualizar lista"}
              </button>
            </div>

            {erro && <p className="error">{erro}</p>}

            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Nível</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...categoriasReceita, ...categoriasDespesa]
                  .sort((a, b) => a.codigo.localeCompare(b.codigo))
                  .map((cat) => (
                    <tr key={cat.id}>
                      <td>{cat.codigo}</td>
                      <td>{cat.nome}</td>
                      <td>{cat.tipo}</td>
                      <td>{cat.nivel}</td>
                      <td>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!token) return;
                            const novoNome = window.prompt(
                              "Novo nome da categoria:",
                              cat.nome
                            );
                            if (!novoNome || !novoNome.trim()) return;
                            try {
                              setErro(null);
                              setLoading(true);
                              const atualizada = await api.atualizarPlanoContas(
                                token,
                                cat.id,
                                {
                                  codigo: cat.codigo,
                                  nome: novoNome.trim(),
                                  tipo: cat.tipo,
                                  nivel: cat.nivel,
                                  parentId: cat.parentId
                                }
                              );

                              if (atualizada.tipo === "Receita") {
                                setCategoriasReceita((prev) =>
                                  prev.map((c) =>
                                    c.id === atualizada.id ? atualizada : c
                                  )
                                );
                              } else {
                                setCategoriasDespesa((prev) =>
                                  prev.map((c) =>
                                    c.id === atualizada.id ? atualizada : c
                                  )
                                );
                              }
                            } catch (e: any) {
                              setErro(
                                e.message ||
                                  "Erro ao atualizar categoria financeira"
                              );
                            } finally {
                              setLoading(false);
                            }
                          }}
                          style={{
                            marginRight: 8,
                            backgroundColor: "#e5e7eb",
                            color: "#111827"
                          }}
                        >
                          Renomear
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!token) return;
                            if (
                              !window.confirm(
                                `Remover categoria "${cat.nome}"? (só é possível se não tiver lançamentos)`
                              )
                            ) {
                              return;
                            }
                            try {
                              setErro(null);
                              setLoading(true);
                              await api.removerPlanoContas(token, cat.id);

                              if (cat.tipo === "Receita") {
                                setCategoriasReceita((prev) =>
                                  prev.filter((c) => c.id !== cat.id)
                                );
                              } else {
                                setCategoriasDespesa((prev) =>
                                  prev.filter((c) => c.id !== cat.id)
                                );
                              }
                            } catch (e: any) {
                              setErro(
                                e.message ||
                                  "Erro ao remover categoria financeira"
                              );
                            } finally {
                              setLoading(false);
                            }
                          }}
                          style={{
                            backgroundColor: "#ef4444",
                            color: "#ffffff"
                          }}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {aba === "relatorios" && (
        <div className="finance-table-card" style={{ marginTop: 12 }}>
          <div className="finance-table-header">
            <div>
              <h3>Relatorios - Balancete simples</h3>
            </div>
            <div className="finance-card-actions">
              <button type="button" onClick={() => void gerarRelatorioPdf()}>
                PDF
              </button>
              <button type="button" onClick={gerarRelatorioExcel}>
                Excel
              </button>
              <button type="button" onClick={() => setAba("contas")}>
                Voltar
              </button>
            </div>
          </div>

          <div className="finance-card-grid" style={{ marginTop: 12 }}>
            <div className="finance-card">
              <div className="finance-card-header-row">
                <strong>Total de receitas</strong>
              </div>
              <div>
                {totalReceitas.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                })}
              </div>
            </div>
            <div className="finance-card">
              <div className="finance-card-header-row">
                <strong>Total de despesas</strong>
              </div>
              <div>
                {totalDespesas.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                })}
              </div>
            </div>
            <div className="finance-card">
              <div className="finance-card-header-row">
                <strong>Saldo do periodo</strong>
              </div>
              <div>
                {saldoPeriodo.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                })}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <h4>Receitas por categoria</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(totalReceitasPorCategoria).map(
                  ([id, total]) => (
                    <tr key={id}>
                      <td>{categoriasReceitaPorId[id] ?? "Sem categoria"}</td>
                      <td>
                        {total.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        })}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16 }}>
            <h4>Despesas por categoria</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(totalDespesasPorCategoria).map(
                  ([id, total]) => (
                    <tr key={id}>
                      <td>{categoriasDespesaPorId[id] ?? "Sem categoria"}</td>
                      <td>
                        {total.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        })}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

