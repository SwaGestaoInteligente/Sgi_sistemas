namespace Sgi.Domain.Financeiro;

public class MovimentoBancario
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid ContaBancariaId { get; set; }
    public DateTime Data { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string Hash { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDENTE";
    public Guid? LancamentoFinanceiroId { get; set; }
    public Guid? UnidadePagamentoId { get; set; }
}
