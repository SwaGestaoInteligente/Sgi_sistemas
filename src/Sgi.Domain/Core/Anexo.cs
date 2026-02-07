namespace Sgi.Domain.Core;

public class Anexo
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public string TipoEntidade { get; set; } = string.Empty;
    public Guid EntidadeId { get; set; }
    public string NomeArquivo { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long Tamanho { get; set; }
    public string Caminho { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
    public Guid? CriadoPorUserId { get; set; }
}
