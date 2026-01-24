namespace Sgi.Domain.Financeiro;

public class PlanoContas
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public int Nivel { get; set; }
    public Guid? ParentId { get; set; }
}

