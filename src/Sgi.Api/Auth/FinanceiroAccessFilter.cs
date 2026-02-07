using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Auth;

public class FinanceiroAccessFilter : IAsyncActionFilter
{
    private readonly SgiDbContext _db;

    public FinanceiroAccessFilter(SgiDbContext db)
    {
        _db = db;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;
        var guard = new AuthorizationGuard(_db, user);

        var action = context.ActionDescriptor.RouteValues.TryGetValue("action", out var actionName)
            ? actionName ?? string.Empty
            : string.Empty;

        var residentActions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            nameof(Controllers.FinanceiroController.ListarCobrancasUnidade),
            nameof(Controllers.FinanceiroController.ListarPagamentosCobranca),
            nameof(Controllers.FinanceiroController.PagarCobrancaUnidade)
        };

        AuthzContext auth;
        if (residentActions.Contains(action))
        {
            if (action == nameof(Controllers.FinanceiroController.ListarCobrancasUnidade))
            {
                if (context.ActionArguments.TryGetValue("unidadeId", out var unidadeValue) &&
                    unidadeValue is Guid unidadeId &&
                    unidadeId != Guid.Empty)
                {
                    auth = await guard.RequireUnitAccess(unidadeId);
                }
                else
                {
                    context.Result = new BadRequestObjectResult("UnidadeId e obrigatorio.");
                    return;
                }
            }
            else
            {
                if (!context.ActionArguments.TryGetValue("id", out var idValue) ||
                    idValue is not Guid cobrancaId ||
                    cobrancaId == Guid.Empty)
                {
                    context.Result = new BadRequestObjectResult("Id e obrigatorio.");
                    return;
                }

                auth = await guard.RequireEntityAccess("cobranca_unidade", cobrancaId);
            }
        }
        else
        {
            var orgId = ExtractOrganizacaoId(context);
            if (!orgId.HasValue || orgId.Value == Guid.Empty)
            {
                orgId = await TryResolveOrganizacaoIdByRoute(context);
            }

            if (!orgId.HasValue || orgId.Value == Guid.Empty)
            {
                context.Result = new BadRequestObjectResult("OrganizacaoId e obrigatorio.");
                return;
            }

            auth = await guard.RequireOrgAccess(orgId.Value);
        }

        if (auth.Error is not null)
        {
            context.Result = auth.Error;
            return;
        }

        var isRead = HttpMethods.IsGet(context.HttpContext.Request.Method);
        UserRole[] roles;
        if (residentActions.Contains(action))
        {
            roles = isRead
                ? new[] { UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF, UserRole.RESIDENT }
                : new[] { UserRole.CONDO_ADMIN, UserRole.RESIDENT };
        }
        else
        {
            roles = isRead
                ? new[] { UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF }
                : new[] { UserRole.CONDO_ADMIN };
        }

        auth.RequireRole(roles);
        if (auth.Error is not null)
        {
            context.Result = auth.Error;
            return;
        }

        await next();
    }

    private static Guid? ExtractOrganizacaoId(ActionExecutingContext context)
    {
        foreach (var pair in context.ActionArguments)
        {
            if (pair.Key.Contains("organizacao", StringComparison.OrdinalIgnoreCase))
            {
                if (pair.Value != null &&
                    Guid.TryParse(pair.Value.ToString(), out var parsedValue))
                {
                    return parsedValue;
                }
            }

            if (pair.Value is null)
            {
                continue;
            }

            var prop = pair.Value.GetType().GetProperty("OrganizacaoId");
            if (prop is null)
            {
                continue;
            }

            var propValue = prop.GetValue(pair.Value);
            if (propValue != null &&
                Guid.TryParse(propValue.ToString(), out var parsedPropValue))
            {
                return parsedPropValue;
            }
        }

        var query = context.HttpContext.Request.Query;
        if (query.TryGetValue("organizacaoId", out var raw) && Guid.TryParse(raw, out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private async Task<Guid?> TryResolveOrganizacaoIdByRoute(ActionExecutingContext context)
    {
        var action = context.ActionDescriptor.RouteValues.TryGetValue("action", out var actionName)
            ? actionName ?? string.Empty
            : string.Empty;

        if (context.ActionArguments.TryGetValue("unidadeId", out var unidadeValue) &&
            unidadeValue is Guid unidadeId &&
            unidadeId != Guid.Empty)
        {
            if (action is nameof(Controllers.FinanceiroController.ListarCobrancasUnidade) ||
                action is nameof(Controllers.FinanceiroController.CriarCobrancaUnidade))
            {
                return await _db.UnidadesOrganizacionais.AsNoTracking()
                    .Where(u => u.Id == unidadeId)
                    .Select(u => (Guid?)u.OrganizacaoId)
                    .FirstOrDefaultAsync();
            }
        }

        if (!context.ActionArguments.TryGetValue("id", out var idValue))
        {
            return null;
        }

        if (idValue is not Guid id || id == Guid.Empty)
        {
            return null;
        }

        return action switch
        {
            nameof(Controllers.FinanceiroController.RemoverConta) =>
                await _db.ContasFinanceiras.AsNoTracking()
                    .Where(c => c.Id == id)
                    .Select(c => (Guid?)c.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.AtualizarStatusConta) =>
                await _db.ContasFinanceiras.AsNoTracking()
                    .Where(c => c.Id == id)
                    .Select(c => (Guid?)c.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.RemoverPlanoContas) =>
                await _db.PlanosContas.AsNoTracking()
                    .Where(p => p.Id == id)
                    .Select(p => (Guid?)p.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.AtualizarStatusFatura) =>
                await _db.DocumentosCobranca.AsNoTracking()
                    .Where(d => d.Id == id)
                    .Select(d => (Guid?)d.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.AtualizarStatusItemCobrado) =>
                await _db.ItensCobrados.AsNoTracking()
                    .Where(i => i.Id == id)
                    .Select(i => (Guid?)i.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.MarcarLancamentoComoPago) =>
                await _db.LancamentosFinanceiros.AsNoTracking()
                    .Where(l => l.Id == id)
                    .Select(l => (Guid?)l.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.CancelarLancamento) =>
                await _db.LancamentosFinanceiros.AsNoTracking()
                    .Where(l => l.Id == id)
                    .Select(l => (Guid?)l.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.AprovarLancamento) =>
                await _db.LancamentosFinanceiros.AsNoTracking()
                    .Where(l => l.Id == id)
                    .Select(l => (Guid?)l.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.ConciliarLancamento) =>
                await _db.LancamentosFinanceiros.AsNoTracking()
                    .Where(l => l.Id == id)
                    .Select(l => (Guid?)l.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.FecharLancamento) =>
                await _db.LancamentosFinanceiros.AsNoTracking()
                    .Where(l => l.Id == id)
                    .Select(l => (Guid?)l.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.ReabrirLancamento) =>
                await _db.LancamentosFinanceiros.AsNoTracking()
                    .Where(l => l.Id == id)
                    .Select(l => (Guid?)l.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.ConfirmarConciliacao) =>
                await _db.LancamentosFinanceiros.AsNoTracking()
                    .Where(l => l.Id == id)
                    .Select(l => (Guid?)l.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.AtualizarCobrancaUnidade) =>
                await _db.UnidadesCobrancas.AsNoTracking()
                    .Where(c => c.Id == id)
                    .Select(c => (Guid?)c.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.PagarCobrancaUnidade) =>
                await _db.UnidadesCobrancas.AsNoTracking()
                    .Where(c => c.Id == id)
                    .Select(c => (Guid?)c.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            nameof(Controllers.FinanceiroController.ListarPagamentosCobranca) =>
                await _db.UnidadesCobrancas.AsNoTracking()
                    .Where(c => c.Id == id)
                    .Select(c => (Guid?)c.OrganizacaoId)
                    .FirstOrDefaultAsync(),
            _ => null
        };
    }
}
