namespace Sgi.Domain.Core;

public class Pet
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid? UnidadeOrganizacionalId { get; set; }
    public Guid? PessoaId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Especie { get; set; } = string.Empty;
    public string? Raca { get; set; }
    public string Porte { get; set; } = string.Empty;
    public string Status { get; set; } = "ativo";
}
