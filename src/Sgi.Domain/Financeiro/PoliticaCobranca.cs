namespace Sgi.Domain.Financeiro;

public class PoliticaCobranca
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public decimal MultaPercentual { get; set; }
    public decimal JurosMensalPercentual { get; set; }
    public decimal CorrecaoMensalPercentual { get; set; }
    public int DiasCarencia { get; set; }
    public bool Ativo { get; set; } = true;
    public DateTime AtualizadoEm { get; set; }
}
