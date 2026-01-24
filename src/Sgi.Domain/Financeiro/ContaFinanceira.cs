namespace Sgi.Domain.Financeiro;

public class ContaFinanceira
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string? Banco { get; set; }
    public string? Agencia { get; set; }
    public string? NumeroConta { get; set; }
    public decimal SaldoInicial { get; set; }
    public string Moeda { get; set; } = "BRL";
    public string Status { get; set; } = "ativo";
}

