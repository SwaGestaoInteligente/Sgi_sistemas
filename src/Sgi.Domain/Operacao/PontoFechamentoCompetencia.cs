namespace Sgi.Domain.Operacao;

public class PontoFechamentoCompetencia
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid PessoaId { get; set; }
    public string Competencia { get; set; } = string.Empty;
    public DateTime FechadoEm { get; set; }
    public Guid? FechadoPorPessoaId { get; set; }
}
