namespace Sgi.Domain.Core;

public class Organizacao
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Tipo { get; set; }
    public string? Documento { get; set; }
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    public string? Site { get; set; }
    public string? Observacoes { get; set; }
    public string Status { get; set; } = "ativo";
    // Lista simples de módulos ativos, separados por vírgula (ex.: "core,financeiro,reservas").
    public string ModulosAtivos { get; set; } = "core,financeiro";
}
