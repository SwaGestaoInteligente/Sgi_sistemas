namespace Sgi.Domain.Financeiro;

public class FinanceAudit
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid? UsuarioId { get; set; }
    public string Acao { get; set; } = string.Empty;
    public string Entidade { get; set; } = string.Empty;
    public Guid EntidadeId { get; set; }
    public string? Detalhes { get; set; }
    public DateTime DataHora { get; set; }
}
