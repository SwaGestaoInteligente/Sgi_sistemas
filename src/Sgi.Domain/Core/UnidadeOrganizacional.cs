namespace Sgi.Domain.Core;

public class UnidadeOrganizacional
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string CodigoInterno { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string? AtributosExtrasJson { get; set; }
    public string Status { get; set; } = "ativo";
    public Guid? ParentId { get; set; }
}

