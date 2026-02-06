namespace Sgi.Domain.Operacao;

public class ChamadoHistorico
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid ChamadoId { get; set; }
    public DateTime DataHora { get; set; }
    public string Acao { get; set; } = string.Empty;
    public string? Detalhes { get; set; }
    public Guid? ResponsavelPessoaId { get; set; }
}
