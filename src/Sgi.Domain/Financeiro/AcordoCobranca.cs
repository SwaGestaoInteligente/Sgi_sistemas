namespace Sgi.Domain.Financeiro;

public class AcordoCobranca
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid UnidadeOrganizacionalId { get; set; }
    public decimal TotalOriginal { get; set; }
    public decimal Desconto { get; set; }
    public decimal TotalAcordo { get; set; }
    public int NumeroParcelas { get; set; }
    public DateTime DataPrimeiraParcela { get; set; }
    public string Status { get; set; } = string.Empty; // ativo | concluido | cancelado
    public string? Observacao { get; set; }
    public DateTime CriadoEm { get; set; }
}
