namespace Sgi.Domain.Financeiro;

public class LancamentoPagamento
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid LancamentoFinanceiroId { get; set; }
    public decimal ValorPago { get; set; }
    public DateTime DataPagamento { get; set; }
    public Guid? ContaFinanceiraId { get; set; }
    public string? FormaPagamento { get; set; }
    public string? Referencia { get; set; }
    public DateTime? EstornadoEm { get; set; }
    public string? EstornoMotivo { get; set; }
}
