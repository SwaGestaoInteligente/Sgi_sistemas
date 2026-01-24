namespace Sgi.Domain.Operacao;

public class Reserva
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid RecursoReservavelId { get; set; }
    public Guid PessoaSolicitanteId { get; set; }
    public Guid? UnidadeOrganizacionalId { get; set; }
    public DateTime DataInicio { get; set; }
    public DateTime DataFim { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal? ValorTotal { get; set; }
    public Guid? LancamentoFinanceiroId { get; set; }
}

