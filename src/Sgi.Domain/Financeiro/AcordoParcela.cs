namespace Sgi.Domain.Financeiro;

public class AcordoParcela
{
    public Guid Id { get; set; }
    public Guid AcordoId { get; set; }
    public Guid? CobrancaId { get; set; }
    public int Numero { get; set; }
    public decimal Valor { get; set; }
    public DateTime Vencimento { get; set; }
    public string Status { get; set; } = string.Empty; // aberto | pago | cancelado
    public DateTime? PagoEm { get; set; }
}
