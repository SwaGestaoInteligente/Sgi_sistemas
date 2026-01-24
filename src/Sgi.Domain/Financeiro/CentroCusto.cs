namespace Sgi.Domain.Financeiro;

public class CentroCusto
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public Guid? ParentId { get; set; }
}

