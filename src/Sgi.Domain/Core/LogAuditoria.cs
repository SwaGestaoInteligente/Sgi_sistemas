namespace Sgi.Domain.Core;

public class LogAuditoria
{
    public Guid Id { get; set; }
    public Guid? UsuarioId { get; set; }
    public Guid? OrganizacaoId { get; set; }
    public string Entidade { get; set; } = string.Empty;
    public Guid EntidadeId { get; set; }
    public string Acao { get; set; } = string.Empty;
    public string? DadosAntesJson { get; set; }
    public string? DadosDepoisJson { get; set; }
    public DateTime DataHora { get; set; }
    public string? Ip { get; set; }
    public string? UserAgent { get; set; }
}

