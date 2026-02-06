namespace Sgi.Domain.Core;

public class Veiculo
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid? UnidadeOrganizacionalId { get; set; }
    public Guid? PessoaId { get; set; }
    public string Placa { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public string Cor { get; set; } = string.Empty;
    public string Status { get; set; } = "ativo";
}
