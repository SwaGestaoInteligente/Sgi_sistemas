namespace Sgi.Domain.Financeiro;

public class MedidorConsumo
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid UnidadeOrganizacionalId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty; // Agua | Gas | Energia | Outro
    public string UnidadeMedida { get; set; } = string.Empty; // m3, kWh, etc.
    public string? NumeroSerie { get; set; }
    public bool Ativo { get; set; } = true;
    public string? Observacao { get; set; }
}
