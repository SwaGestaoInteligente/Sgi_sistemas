using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Domain.Core;
using Sgi.Domain.Operacao;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Auth;

public sealed class AuthzContext
{
    public Guid UserId { get; }
    public Guid? PessoaId { get; }
    public bool IsPlatformAdmin { get; }
    public UserCondoMembership? Membership { get; }
    public Guid? OrganizacaoId { get; }
    public ActionResult? Error { get; private set; }

    private AuthzContext(ActionResult error)
    {
        Error = error;
    }

    public AuthzContext(
        Guid userId,
        Guid? pessoaId,
        bool isPlatformAdmin,
        UserCondoMembership? membership,
        Guid? organizacaoId)
    {
        UserId = userId;
        PessoaId = pessoaId;
        IsPlatformAdmin = isPlatformAdmin;
        Membership = membership;
        OrganizacaoId = organizacaoId;
    }

    public static AuthzContext Fail(ActionResult error) => new(error);

    public AuthzContext RequireRole(params UserRole[] roles)
    {
        if (Error is not null || IsPlatformAdmin || roles.Length == 0)
        {
            return this;
        }

        if (Membership is null || !roles.Contains(Membership.Role))
        {
            Error = new ForbidResult();
        }

        return this;
    }

    public AuthzContext Forbid()
    {
        if (Error is null)
        {
            Error = new ForbidResult();
        }

        return this;
    }
}

public sealed class AuthorizationGuard
{
    private readonly SgiDbContext _db;
    private readonly ClaimsPrincipal _user;
    private AuthzContext? _context;

    public AuthorizationGuard(SgiDbContext db, ClaimsPrincipal user)
    {
        _db = db;
        _user = user;
    }

    public async Task<AuthzContext> RequireOrgAccess(Guid organizacaoId)
    {
        var auth = await Authz.EnsureMembershipAsync(_db, _user, organizacaoId);
        if (auth.Error is not null)
        {
            return Cache(AuthzContext.Fail(auth.Error));
        }

        var userId = Authz.GetUserId(_user);
        if (!userId.HasValue)
        {
            return Cache(AuthzContext.Fail(new UnauthorizedResult()));
        }

        var pessoaId = await ResolvePessoaIdAsync(userId.Value, Authz.GetPessoaId(_user));
        var ctx = new AuthzContext(
            userId.Value,
            pessoaId,
            auth.IsPlatformAdmin,
            auth.Membership,
            organizacaoId);
        return Cache(ctx);
    }

    public async Task<AuthzContext> RequirePlatformAdmin()
    {
        var userId = Authz.GetUserId(_user);
        if (!userId.HasValue)
        {
            return Cache(AuthzContext.Fail(new UnauthorizedResult()));
        }

        var isPlatformAdmin = await _db.UserCondoMemberships
            .AsNoTracking()
            .AnyAsync(m =>
                m.UsuarioId == userId.Value &&
                m.IsActive &&
                m.Role == UserRole.PLATFORM_ADMIN);

        if (!isPlatformAdmin)
        {
            return Cache(AuthzContext.Fail(new ForbidResult()));
        }

        var pessoaId = await ResolvePessoaIdAsync(userId.Value, Authz.GetPessoaId(_user));
        var ctx = new AuthzContext(userId.Value, pessoaId, true, null, null);
        return Cache(ctx);
    }

    public AuthzContext RequireRole(params UserRole[] roles)
    {
        if (_context is null)
        {
            return Cache(AuthzContext.Fail(new ForbidResult()));
        }

        _context.RequireRole(roles);
        return _context;
    }

    public async Task<AuthzContext> RequireUnitAccess(Guid unidadeId)
    {
        if (unidadeId == Guid.Empty)
        {
            return Cache(AuthzContext.Fail(new BadRequestObjectResult("UnidadeId e obrigatorio.")));
        }

        var unidadeInfo = await _db.UnidadesOrganizacionais.AsNoTracking()
            .Where(u => u.Id == unidadeId)
            .Select(u => new { u.Id, u.OrganizacaoId })
            .FirstOrDefaultAsync();

        if (unidadeInfo is null)
        {
            return Cache(AuthzContext.Fail(new NotFoundResult()));
        }

        var ctx = await RequireOrgAccess(unidadeInfo.OrganizacaoId);
        if (ctx.Error is not null)
        {
            return ctx;
        }

        if (!ctx.IsPlatformAdmin && ctx.Membership?.Role == UserRole.RESIDENT)
        {
            if (!ctx.Membership.UnidadeOrganizacionalId.HasValue ||
                ctx.Membership.UnidadeOrganizacionalId.Value != unidadeId)
            {
                ctx.Forbid();
            }
        }

        return ctx;
    }

    public async Task<AuthzContext> RequireEntityAccess(string tipoEntidade, Guid entidadeId)
    {
        if (string.IsNullOrWhiteSpace(tipoEntidade))
        {
            return Cache(AuthzContext.Fail(new BadRequestObjectResult("TipoEntidade e obrigatorio.")));
        }

        if (entidadeId == Guid.Empty)
        {
            return Cache(AuthzContext.Fail(new BadRequestObjectResult("EntidadeId e obrigatorio.")));
        }

        var tipo = NormalizeTipo(tipoEntidade);
        switch (tipo)
        {
            case "chamado":
            {
                var chamado = await _db.Chamados.AsNoTracking()
                    .Where(c => c.Id == entidadeId)
                    .Select(c => new
                    {
                        c.OrganizacaoId,
                        c.UnidadeOrganizacionalId,
                        c.PessoaSolicitanteId
                    })
                    .FirstOrDefaultAsync();
                if (chamado is null)
                {
                    return Cache(AuthzContext.Fail(new NotFoundResult()));
                }

                var ctx = await RequireOrgAccess(chamado.OrganizacaoId);
                if (ctx.Error is not null)
                {
                    return ctx;
                }

                ApplyResidentScope(ctx, chamado.UnidadeOrganizacionalId, chamado.PessoaSolicitanteId);
                return ctx;
            }
            case "reserva":
            {
                var reserva = await _db.Reservas.AsNoTracking()
                    .Where(r => r.Id == entidadeId)
                    .Select(r => new
                    {
                        r.OrganizacaoId,
                        r.UnidadeOrganizacionalId,
                        r.PessoaSolicitanteId
                    })
                    .FirstOrDefaultAsync();
                if (reserva is null)
                {
                    return Cache(AuthzContext.Fail(new NotFoundResult()));
                }

                var ctx = await RequireOrgAccess(reserva.OrganizacaoId);
                if (ctx.Error is not null)
                {
                    return ctx;
                }

                ApplyResidentScope(ctx, reserva.UnidadeOrganizacionalId, reserva.PessoaSolicitanteId);
                return ctx;
            }
            case "cobranca-unidade":
            case "cobranca_unidade":
            {
                var cobranca = await _db.UnidadesCobrancas.AsNoTracking()
                    .Where(c => c.Id == entidadeId)
                    .Select(c => new
                    {
                        c.OrganizacaoId,
                        c.UnidadeOrganizacionalId
                    })
                    .FirstOrDefaultAsync();
                if (cobranca is null)
                {
                    return Cache(AuthzContext.Fail(new NotFoundResult()));
                }

                var ctx = await RequireOrgAccess(cobranca.OrganizacaoId);
                if (ctx.Error is not null)
                {
                    return ctx;
                }

                if (!ctx.IsPlatformAdmin && ctx.Membership?.Role == UserRole.RESIDENT)
                {
                    if (!ctx.Membership.UnidadeOrganizacionalId.HasValue ||
                        ctx.Membership.UnidadeOrganizacionalId.Value != cobranca.UnidadeOrganizacionalId)
                    {
                        ctx.Forbid();
                    }
                }

                return ctx;
            }
        }

        return Cache(AuthzContext.Fail(new BadRequestObjectResult("TipoEntidade invalido.")));
    }

    private AuthzContext Cache(AuthzContext ctx)
    {
        _context = ctx;
        return ctx;
    }

    private void ApplyResidentScope(AuthzContext ctx, Guid? unidadeId, Guid pessoaId)
    {
        if (ctx.IsPlatformAdmin || ctx.Membership?.Role != UserRole.RESIDENT)
        {
            return;
        }

        var pessoaMatch = ctx.PessoaId.HasValue && ctx.PessoaId.Value == pessoaId;
        var unidadeMatch = unidadeId.HasValue &&
                           ctx.Membership.UnidadeOrganizacionalId.HasValue &&
                           ctx.Membership.UnidadeOrganizacionalId.Value == unidadeId.Value;

        if (!pessoaMatch && !unidadeMatch)
        {
            ctx.Forbid();
        }
    }

    private async Task<Guid?> ResolvePessoaIdAsync(Guid userId, Guid? claimPessoaId)
    {
        if (claimPessoaId.HasValue && claimPessoaId.Value != Guid.Empty)
        {
            return claimPessoaId.Value;
        }

        return await _db.Usuarios.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (Guid?)u.PessoaId)
            .FirstOrDefaultAsync();
    }

    private static string NormalizeTipo(string tipoEntidade)
    {
        return tipoEntidade
            .Trim()
            .ToLowerInvariant()
            .Replace("/", "-")
            .Replace("_", "-");
    }
}
