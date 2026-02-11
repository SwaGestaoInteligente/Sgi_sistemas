namespace Sgi.Domain.Financeiro;

public class LeituraConsumo
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid MedidorId { get; set; }
    public string Competencia { get; set; } = string.Empty; // yyyy-MM
    public DateTime DataLeitura { get; set; }
    public decimal LeituraAtual { get; set; }
    public decimal LeituraAnterior { get; set; }
    public decimal Consumo { get; set; }
    public string? Observacao { get; set; }
}
