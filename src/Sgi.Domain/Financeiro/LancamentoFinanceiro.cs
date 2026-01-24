namespace Sgi.Domain.Financeiro;

public class LancamentoFinanceiro
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string Situacao { get; set; } = string.Empty;
    public Guid PlanoContasId { get; set; }
    public Guid? CentroCustoId { get; set; }
    public Guid? ContaFinanceiraId { get; set; }
    public Guid PessoaId { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateTime DataCompetencia { get; set; }
    public DateTime? DataVencimento { get; set; }
    public DateTime? DataPagamento { get; set; }
    public string FormaPagamento { get; set; } = string.Empty;
    public int? ParcelaNumero { get; set; }
    public int? ParcelaTotal { get; set; }
    public string? Referencia { get; set; }
}

