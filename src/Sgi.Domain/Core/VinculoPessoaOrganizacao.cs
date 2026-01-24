namespace Sgi.Domain.Core;

public class VinculoPessoaOrganizacao
{
    public Guid Id { get; set; }
    public Guid PessoaId { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid? UnidadeOrganizacionalId { get; set; }
    public string Papel { get; set; } = string.Empty;
    public DateTime DataInicio { get; set; }
    public DateTime? DataFim { get; set; }
}

