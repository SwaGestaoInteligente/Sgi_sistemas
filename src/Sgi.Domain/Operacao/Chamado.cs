namespace Sgi.Domain.Operacao;

public class Chamado
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid? UnidadeOrganizacionalId { get; set; }
    public Guid PessoaSolicitanteId { get; set; }
    public string Categoria { get; set; } = string.Empty;
    public string Titulo { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Prioridade { get; set; }
    public Guid? ResponsavelUsuarioId { get; set; }
    public DateTime DataAbertura { get; set; }
    public DateTime? DataFechamento { get; set; }
}

