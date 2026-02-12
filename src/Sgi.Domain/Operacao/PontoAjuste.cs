namespace Sgi.Domain.Operacao;

public class PontoAjuste
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid PessoaId { get; set; }
    public Guid? UnidadeOrganizacionalId { get; set; }
    public Guid? MarcacaoOriginalId { get; set; }
    public string TipoSolicitacao { get; set; } = "INCLUSAO";
    public DateTime DataHoraSugerida { get; set; }
    public string TipoMarcacaoSugerida { get; set; } = "ENTRADA";
    public string Justificativa { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDENTE";
    public Guid SolicitadoPorPessoaId { get; set; }
    public DateTime SolicitadoEm { get; set; }
    public Guid? AprovadoPorPessoaId { get; set; }
    public DateTime? AprovadoEm { get; set; }
    public string? MotivoDecisao { get; set; }
    public Guid? MarcacaoGeradaId { get; set; }
}
