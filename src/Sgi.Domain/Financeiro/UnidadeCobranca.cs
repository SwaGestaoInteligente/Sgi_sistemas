namespace Sgi.Domain.Financeiro;

public class UnidadeCobranca
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid UnidadeOrganizacionalId { get; set; }
    public string Competencia { get; set; } = string.Empty; // yyyy-MM
    public string Descricao { get; set; } = string.Empty;
    public Guid? CategoriaId { get; set; }
    public Guid? CentroCustoId { get; set; }
    public decimal Valor { get; set; }
    public DateTime Vencimento { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? PagoEm { get; set; }
    public string? FormaPagamento { get; set; }
    public Guid? ContaBancariaId { get; set; }
}
