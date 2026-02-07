namespace Sgi.Domain.Core;

public class NotificacaoConfig
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string Canal { get; set; } = string.Empty;
    public bool Ativo { get; set; } = true;
    public int? DiasAntesVencimento { get; set; }
    public decimal? LimiteValor { get; set; }
    public string? DestinatariosJson { get; set; }
}
