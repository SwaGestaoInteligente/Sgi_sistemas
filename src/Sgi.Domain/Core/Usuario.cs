namespace Sgi.Domain.Core;

public class Usuario
{
    public Guid Id { get; set; }
    public Guid PessoaId { get; set; }
    public string EmailLogin { get; set; } = string.Empty;
    public string SenhaHash { get; set; } = string.Empty;
    public string Status { get; set; } = "ativo";
    public DateTime? UltimoAcesso { get; set; }
    public string? Idioma { get; set; }
    public string? TimeZone { get; set; }
}

