namespace Sgi.Domain.Financeiro;

public class UnidadePagamento
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid CobrancaId { get; set; }
    public decimal ValorPago { get; set; }
    public DateTime DataPagamento { get; set; }
    public Guid? ContaBancariaId { get; set; }
    public Guid? ComprovanteAnexoId { get; set; }
    public string? Observacao { get; set; }
}
