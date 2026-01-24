namespace Sgi.Domain.Financeiro;

public class RegraRateio
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string TipoBase { get; set; } = string.Empty;
    public string ConfiguracaoJson { get; set; } = string.Empty;
}

