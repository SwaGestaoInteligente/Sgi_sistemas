namespace Sgi.Domain.Core;

public class NotificacaoEvento
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string Canal { get; set; } = string.Empty;
    public string Titulo { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
    public DateTime? LidoEm { get; set; }
    public string? DestinatariosJson { get; set; }
}
