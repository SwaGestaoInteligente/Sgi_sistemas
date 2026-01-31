namespace Sgi.Domain.Financeiro;

public class CotaCondominial
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid UnidadeOrganizacionalId { get; set; }
    public Guid PlanoContasId { get; set; }
    public decimal Valor { get; set; }
    /// <summary>
    /// Competência inicial da cota no formato yyyy-MM (ex.: 2026-01).
    /// </summary>
    public string CompetenciaInicio { get; set; } = string.Empty;
    /// <summary>
    /// Competência final opcional da cota no formato yyyy-MM (ex.: 2026-12).
    /// </summary>
    public string? CompetenciaFim { get; set; }
    public bool Ativo { get; set; } = true;
}

