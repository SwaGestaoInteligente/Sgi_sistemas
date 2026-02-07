using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Auth;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrganizacoesController : ControllerBase
{
    private readonly SgiDbContext _db;

    public OrganizacoesController(SgiDbContext db)
    {
        _db = db;
    }

    private AuthorizationGuard Guard() => new(_db, User);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Organizacao>>> GetAll()
    {
        var userId = Authz.GetUserId(User);
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var memberships = await _db.UserCondoMemberships
            .AsNoTracking()
            .Where(m => m.UsuarioId == userId.Value && m.IsActive)
            .ToListAsync();

        if (memberships.Any(m => m.Role == UserRole.PLATFORM_ADMIN))
        {
            var items = await _db.Organizacoes.AsNoTracking().ToListAsync();
            return Ok(items);
        }

        var orgIds = memberships
            .Where(m => m.OrganizacaoId.HasValue)
            .Select(m => m.OrganizacaoId!.Value)
            .Distinct()
            .ToList();

        var lista = await _db.Organizacoes.AsNoTracking()
            .Where(o => orgIds.Contains(o.Id))
            .ToListAsync();
        return Ok(lista);
    }

    [HttpGet("minhas")]
    public async Task<ActionResult<IEnumerable<Organizacao>>> GetMinhas()
    {
        var userId = Authz.GetUserId(User);
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var memberships = await _db.UserCondoMemberships
            .AsNoTracking()
            .Where(m => m.UsuarioId == userId.Value && m.IsActive)
            .ToListAsync();

        if (memberships.Any(m => m.Role == UserRole.PLATFORM_ADMIN))
        {
            var items = await _db.Organizacoes.AsNoTracking().ToListAsync();
            return Ok(items);
        }

        var orgIds = memberships
            .Where(m => m.OrganizacaoId.HasValue)
            .Select(m => m.OrganizacaoId!.Value)
            .Distinct()
            .ToList();

        var lista = await _db.Organizacoes.AsNoTracking()
            .Where(o => orgIds.Contains(o.Id))
            .ToListAsync();
        return Ok(lista);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Organizacao>> GetById(Guid id)
    {
        var auth = await Guard().RequireOrgAccess(id);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var item = await _db.Organizacoes.FindAsync(id);
        if (item == null)
        {
            return NotFound();
        }

        return Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<Organizacao>> Create(Organizacao model)
    {
        var auth = await Guard().RequirePlatformAdmin();
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        model.Id = Guid.NewGuid();
        _db.Organizacoes.Add(model);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = model.Id }, model);
    }

    public class AtualizarOrganizacaoRequest
    {
        public string Nome { get; set; } = string.Empty;
        public string? Tipo { get; set; }
        public string? ModulosAtivos { get; set; }
        public string? Status { get; set; }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Organizacao>> Update(Guid id, AtualizarOrganizacaoRequest request)
    {
        var auth = await Guard().RequirePlatformAdmin();
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var item = await _db.Organizacoes.FindAsync(id);
        if (item == null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome é obrigatório.");
        }

        item.Nome = request.Nome.Trim();
        item.Tipo = request.Tipo;
        if (!string.IsNullOrWhiteSpace(request.ModulosAtivos))
        {
            item.ModulosAtivos = request.ModulosAtivos;
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            item.Status = request.Status;
        }

        await _db.SaveChangesAsync();

        return Ok(item);
    }
}
