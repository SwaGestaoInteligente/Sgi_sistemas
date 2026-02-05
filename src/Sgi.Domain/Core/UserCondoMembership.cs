namespace Sgi.Domain.Core;

public class UserCondoMembership
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public Guid? OrganizacaoId { get; set; }
    public Guid? UnidadeOrganizacionalId { get; set; }
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
