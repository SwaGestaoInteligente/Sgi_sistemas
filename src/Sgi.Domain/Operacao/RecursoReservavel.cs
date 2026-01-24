namespace Sgi.Domain.Operacao;

public class RecursoReservavel
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid UnidadeOrganizacionalId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public int? Capacidade { get; set; }
    public string? RegrasJson { get; set; }
    public bool Ativo { get; set; } = true;
}

