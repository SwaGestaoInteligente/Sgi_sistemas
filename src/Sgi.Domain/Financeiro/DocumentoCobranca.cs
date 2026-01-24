namespace Sgi.Domain.Financeiro;

public class DocumentoCobranca
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public Guid LancamentoFinanceiroId { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string? IdentificadorExterno { get; set; }
    public string? LinhaDigitavel { get; set; }
    public string? QrCode { get; set; }
    public string? UrlPagamento { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime DataEmissao { get; set; }
    public DateTime DataVencimento { get; set; }
    public DateTime? DataBaixa { get; set; }
}

