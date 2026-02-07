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
public class PetsController : ControllerBase
{
    private readonly SgiDbContext _db;

    public PetsController(SgiDbContext db)
    {
        _db = db;
    }

    private AuthorizationGuard Guard() => new(_db, User);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Pet>>> Listar(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? unidadeId,
        [FromQuery] Guid? pessoaId,
        [FromQuery] string? status)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.Pets.AsNoTracking().Where(p => p.OrganizacaoId == organizacaoId);

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            if (!auth.Membership.UnidadeOrganizacionalId.HasValue && !auth.PessoaId.HasValue)
            {
                return Forbid();
            }

            var unidadeFiltro = auth.Membership.UnidadeOrganizacionalId;
            var pessoaFiltro = auth.PessoaId;
            query = query.Where(p =>
                (unidadeFiltro.HasValue && p.UnidadeOrganizacionalId == unidadeFiltro.Value) ||
                (pessoaFiltro.HasValue && p.PessoaId == pessoaFiltro.Value));
        }

        if (unidadeId.HasValue && unidadeId.Value != Guid.Empty)
        {
            query = query.Where(p => p.UnidadeOrganizacionalId == unidadeId.Value);
        }

        if (pessoaId.HasValue && pessoaId.Value != Guid.Empty)
        {
            query = query.Where(p => p.PessoaId == pessoaId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusFiltro = status.Trim().ToLowerInvariant();
            query = query.Where(p => (p.Status ?? string.Empty).ToLower() == statusFiltro);
        }

        var itens = await query.OrderBy(p => p.Nome).ToListAsync();
        return Ok(itens);
    }

    public class CriarPetRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid? UnidadeOrganizacionalId { get; set; }
        public Guid? PessoaId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Especie { get; set; } = string.Empty;
        public string? Raca { get; set; }
        public string Porte { get; set; } = string.Empty;
        public string? Status { get; set; }
    }

    [HttpPost]
    public async Task<ActionResult<Pet>> Criar(CriarPetRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Guard().RequireOrgAccess(request.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var pet = new Pet
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            UnidadeOrganizacionalId = request.UnidadeOrganizacionalId,
            PessoaId = request.PessoaId,
            Nome = request.Nome.Trim(),
            Especie = request.Especie.Trim(),
            Raca = string.IsNullOrWhiteSpace(request.Raca) ? null : request.Raca.Trim(),
            Porte = request.Porte.Trim(),
            Status = string.IsNullOrWhiteSpace(request.Status) ? "ativo" : request.Status.Trim().ToLowerInvariant()
        };

        _db.Pets.Add(pet);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Listar), new { organizacaoId = pet.OrganizacaoId }, pet);
    }

    public class AtualizarPetRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid? UnidadeOrganizacionalId { get; set; }
        public Guid? PessoaId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Especie { get; set; } = string.Empty;
        public string? Raca { get; set; }
        public string Porte { get; set; } = string.Empty;
        public string? Status { get; set; }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Pet>> Atualizar(Guid id, AtualizarPetRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var pet = await _db.Pets.FindAsync(id);
        if (pet is null)
        {
            return NotFound();
        }

        if (pet.OrganizacaoId != request.OrganizacaoId)
        {
            return BadRequest("OrganizacaoId invalido.");
        }

        var auth = await Guard().RequireOrgAccess(pet.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        pet.UnidadeOrganizacionalId = request.UnidadeOrganizacionalId;
        pet.PessoaId = request.PessoaId;
        pet.Nome = request.Nome.Trim();
        pet.Especie = request.Especie.Trim();
        pet.Raca = string.IsNullOrWhiteSpace(request.Raca) ? null : request.Raca.Trim();
        pet.Porte = request.Porte.Trim();
        pet.Status = string.IsNullOrWhiteSpace(request.Status) ? pet.Status : request.Status.Trim().ToLowerInvariant();

        await _db.SaveChangesAsync();
        return Ok(pet);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remover(Guid id, [FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var pet = await _db.Pets.FindAsync(id);
        if (pet is null)
        {
            return NotFound();
        }

        if (pet.OrganizacaoId != organizacaoId)
        {
            return BadRequest("OrganizacaoId invalido.");
        }

        var auth = await Guard().RequireOrgAccess(pet.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        _db.Pets.Remove(pet);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
