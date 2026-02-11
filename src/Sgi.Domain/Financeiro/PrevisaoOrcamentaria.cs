namespace Sgi.Domain.Financeiro;

public class PrevisaoOrcamentaria
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid PlanoContasId { get; set; }
    public string Tipo { get; set; } = string.Empty; // Receita | Despesa
    public int Ano { get; set; }
    public int Mes { get; set; }
    public decimal ValorPrevisto { get; set; }
    public string? Observacao { get; set; }
}
