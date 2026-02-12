namespace Sgi.Domain.Operacao;

public class PontoMarcacao
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid PessoaId { get; set; }
    public Guid? UnidadeOrganizacionalId { get; set; }
    public long Nsr { get; set; }
    public DateTime DataHoraMarcacao { get; set; }
    public string Tipo { get; set; } = "ENTRADA";
    public string Origem { get; set; } = "WEB";
    public string? Observacao { get; set; }
    public string HashComprovante { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
}
