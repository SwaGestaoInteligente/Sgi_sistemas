namespace Sgi.Domain.Core;

public class Pessoa
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Tipo { get; set; } = "fisica";
    public string? Documento { get; set; }
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    public DateTime? DataNascimentoAbertura { get; set; }
    public string? Observacoes { get; set; }
}

