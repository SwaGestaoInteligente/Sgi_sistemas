namespace Sgi.Domain.Contabilidade;

public class ContaContabil
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string Grupo { get; set; } = string.Empty; // Ativo, Passivo, Patrimonio, Resultado
    public string Natureza { get; set; } = string.Empty; // Devedora ou Credora
    public int Nivel { get; set; }
    public Guid? ParentId { get; set; }
    public bool Ativa { get; set; } = true;
    public string? CodigoReferencialSped { get; set; }
}
