namespace Sgi.Domain.Contabilidade;

public class PartidaContabil
{
    public Guid Id { get; set; }
    public Guid LancamentoContabilId { get; set; }
    public Guid ContaContabilId { get; set; }
    public string Tipo { get; set; } = string.Empty; // debito/credito
    public decimal Valor { get; set; }
    public Guid? CentroCustoId { get; set; }
}
