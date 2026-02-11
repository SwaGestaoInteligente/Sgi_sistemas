namespace Sgi.Domain.Financeiro;

public class UnidadeCreditoMovimento
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid UnidadeOrganizacionalId { get; set; }
    public Guid? CobrancaId { get; set; }
    public Guid? PagamentoId { get; set; }
    public string Tipo { get; set; } = string.Empty; // credito | uso
    public decimal Valor { get; set; }
    public DateTime DataMovimento { get; set; }
    public string? Observacao { get; set; }
    public DateTime? EstornadoEm { get; set; }
    public string? EstornoMotivo { get; set; }
}
