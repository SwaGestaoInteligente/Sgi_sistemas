namespace Sgi.Domain.Financeiro;

public class IndiceEconomico
{
    public Guid Id { get; set; }
    public string Tipo { get; set; } = "";
    public int Ano { get; set; }
    public int Mes { get; set; }
    public decimal ValorPercentual { get; set; }
    public string Fonte { get; set; } = "BCB-SGS";
    public DateTime AtualizadoEm { get; set; }
}
