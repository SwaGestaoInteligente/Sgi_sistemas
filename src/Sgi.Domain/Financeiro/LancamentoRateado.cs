namespace Sgi.Domain.Financeiro;

public class LancamentoRateado
{
    public Guid Id { get; set; }
    public Guid LancamentoOriginalId { get; set; }
    public Guid? UnidadeOrganizacionalId { get; set; }
    public Guid? CentroCustoId { get; set; }
    public decimal ValorRateado { get; set; }
}

