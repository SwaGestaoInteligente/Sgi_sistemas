using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Auth;

public record AuthzResult(bool IsPlatformAdmin, UserCondoMembership? Membership, ActionResult? Error);
public record MembershipClaim(Guid? OrgId, Guid? UnidadeId, UserRole Role);

public static class Authz
{
    public static Guid? GetUserId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("uid")
                  ?? user.FindFirstValue("userId")
                  ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    public static Guid? GetPessoaId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("pid") ?? user.FindFirstValue("pessoaId");
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    public static bool GetIsPlatformAdmin(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("isPlatformAdmin");
        return bool.TryParse(raw, out var isAdmin) && isAdmin;
    }

    public static IReadOnlyList<MembershipClaim> GetMembershipClaims(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("memberships");
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Array.Empty<MembershipClaim>();
        }

        try
        {
            var result = JsonSerializer.Deserialize<List<MembershipClaim>>(
                raw,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return result ?? Array.Empty<MembershipClaim>();
        }
        catch
        {
            return Array.Empty<MembershipClaim>();
        }
    }

    public static MembershipClaim? GetActiveMembershipClaim(ClaimsPrincipal user, Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return null;
        }

        return GetMembershipClaims(user)
            .FirstOrDefault(m => m.OrgId.HasValue && m.OrgId.Value == organizacaoId);
    }

    public static UserRole? GetActiveRoleFromClaims(ClaimsPrincipal user, Guid organizacaoId)
    {
        if (GetIsPlatformAdmin(user))
        {
            return UserRole.PLATFORM_ADMIN;
        }

        return GetActiveMembershipClaim(user, organizacaoId)?.Role;
    }

    public static async Task<AuthzResult> EnsureMembershipAsync(
        SgiDbContext db,
        ClaimsPrincipal user,
        Guid organizacaoId,
        params UserRole[] allowedRoles)
    {
        if (organizacaoId == Guid.Empty)
        {
            return new AuthzResult(false, null, new BadRequestObjectResult("OrganizacaoId é obrigatorio."));
        }

        var userId = GetUserId(user);
        if (!userId.HasValue)
        {
            return new AuthzResult(false, null, new UnauthorizedResult());
        }

        var memberships = await db.UserCondoMemberships
            .AsNoTracking()
            .Where(m => m.UsuarioId == userId.Value && m.IsActive)
            .ToListAsync();

        var isPlatformAdmin = memberships.Any(m => m.Role == UserRole.PLATFORM_ADMIN);
        if (isPlatformAdmin)
        {
            return new AuthzResult(true, null, null);
        }

        var membership = memberships.FirstOrDefault(m => m.OrganizacaoId == organizacaoId);
        if (membership is null)
        {
            return new AuthzResult(false, null, new ForbidResult());
        }

        if (allowedRoles.Length > 0 && !allowedRoles.Contains(membership.Role))
        {
            return new AuthzResult(false, membership, new ForbidResult());
        }

        return new AuthzResult(false, membership, null);
    }
}
