namespace Sgi.Domain.Contabilidade;

public class LancamentoContabil
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public DateTime DataLancamento { get; set; }
    public DateTime Competencia { get; set; }
    public string Historico { get; set; } = string.Empty;
    public string? Origem { get; set; } // manual, financeiro, ajuste
    public Guid? LancamentoFinanceiroId { get; set; }
    public string Status { get; set; } = "aberto";
    public ICollection<PartidaContabil> Partidas { get; set; } = new List<PartidaContabil>();
}
