namespace Sgi.Domain.Financeiro;

public class AbonoFinanceiro
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid LancamentoFinanceiroId { get; set; }
    public string Tipo { get; set; } = string.Empty; // valor | percentual
    public decimal Valor { get; set; }
    public decimal? Percentual { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public string? Observacao { get; set; }
    public string Status { get; set; } = "pendente"; // pendente | em_analise | aprovado | cancelado
    public DateTime DataSolicitacao { get; set; }
    public DateTime? DataAprovacao { get; set; }
}
