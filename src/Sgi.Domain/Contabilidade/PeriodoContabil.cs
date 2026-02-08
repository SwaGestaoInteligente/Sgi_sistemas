namespace Sgi.Domain.Contabilidade;

public class PeriodoContabil
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public DateTime CompetenciaInicio { get; set; }
    public DateTime CompetenciaFim { get; set; }
    public string Status { get; set; } = "aberto";
    public DateTime? FechadoEm { get; set; }
    public Guid? FechadoPor { get; set; }
    public string? Observacao { get; set; }
}
