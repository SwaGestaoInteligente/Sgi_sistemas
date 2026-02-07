using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Auth;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/config/notificacoes")]
[Authorize]
public class NotificacoesController : ControllerBase
{
    private readonly SgiDbContext _db;
    private readonly ILogger<NotificacoesController> _logger;

    public NotificacoesController(SgiDbContext db, ILogger<NotificacoesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    private AuthorizationGuard Guard() => new(_db, User);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<NotificacaoConfig>>> Listar([FromQuery] Guid organizacaoId)
    {
        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var itens = await _db.NotificacoesConfig.AsNoTracking()
            .Where(n => n.OrganizacaoId == organizacaoId)
            .OrderBy(n => n.Tipo)
            .ToListAsync();
        return Ok(itens);
    }

    [HttpPost]
    public async Task<ActionResult<NotificacaoConfig>> Criar(NotificacaoConfig model)
    {
        if (model.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Guard().RequireOrgAccess(model.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        model.Id = Guid.NewGuid();
        model.Tipo = model.Tipo.Trim();
        model.Canal = model.Canal.Trim();
        _db.NotificacoesConfig.Add(model);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Notificacao config criada {ConfigId}", model.Id);
        return CreatedAtAction(nameof(Listar), new { organizacaoId = model.OrganizacaoId }, model);
    }

    public record AtualizarNotificacaoRequest(
        string? Tipo,
        string? Canal,
        bool? Ativo,
        int? DiasAntesVencimento,
        decimal? LimiteValor,
        string? DestinatariosJson);

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<NotificacaoConfig>> Atualizar(Guid id, AtualizarNotificacaoRequest request)
    {
        var config = await _db.NotificacoesConfig.FindAsync(id);
        if (config is null)
        {
            return NotFound();
        }

        var auth = await Guard().RequireOrgAccess(config.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!string.IsNullOrWhiteSpace(request.Tipo))
        {
            config.Tipo = request.Tipo.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Canal))
        {
            config.Canal = request.Canal.Trim();
        }

        if (request.Ativo.HasValue)
        {
            config.Ativo = request.Ativo.Value;
        }

        if (request.DiasAntesVencimento.HasValue)
        {
            config.DiasAntesVencimento = request.DiasAntesVencimento.Value;
        }

        if (request.LimiteValor.HasValue)
        {
            config.LimiteValor = request.LimiteValor.Value;
        }

        if (request.DestinatariosJson is not null)
        {
            config.DestinatariosJson = request.DestinatariosJson;
        }

        await _db.SaveChangesAsync();
        return Ok(config);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remover(Guid id)
    {
        var config = await _db.NotificacoesConfig.FindAsync(id);
        if (config is null)
        {
            return NotFound();
        }

        var auth = await Guard().RequireOrgAccess(config.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        _db.NotificacoesConfig.Remove(config);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("eventos")]
    public async Task<ActionResult<IEnumerable<NotificacaoEvento>>> ListarEventos(
        [FromQuery] Guid organizacaoId,
        [FromQuery] int? limit)
    {
        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var take = limit is > 0 and <= 100 ? limit.Value : 50;
        var itens = await _db.NotificacoesEventos.AsNoTracking()
            .Where(n => n.OrganizacaoId == organizacaoId)
            .OrderByDescending(n => n.CriadoEm)
            .Take(take)
            .ToListAsync();
        return Ok(itens);
    }

    [HttpPatch("eventos/{id:guid}/lido")]
    public async Task<ActionResult<NotificacaoEvento>> MarcarLido(Guid id)
    {
        var evento = await _db.NotificacoesEventos.FindAsync(id);
        if (evento is null)
        {
            return NotFound();
        }

        var auth = await Guard().RequireOrgAccess(evento.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        evento.LidoEm ??= DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(evento);
    }
}
