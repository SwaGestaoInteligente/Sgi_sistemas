namespace Sgi.Domain.Contabilidade;

public class MapeamentoPlanoContasContabil
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid PlanoContasId { get; set; }
    public string TipoLancamento { get; set; } = string.Empty; // pagar/receber
    public Guid ContaDebitoId { get; set; }
    public Guid ContaCreditoId { get; set; }
    public string? Observacao { get; set; }
}
