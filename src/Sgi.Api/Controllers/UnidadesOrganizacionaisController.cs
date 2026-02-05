using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Auth;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/unidades")]
[Authorize]
public class UnidadesOrganizacionaisController : ControllerBase
{
    private readonly SgiDbContext _db;

    public UnidadesOrganizacionaisController(SgiDbContext db)
    {
        _db = db;
    }

    // GET /api/unidades?organizacaoId=...
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UnidadeOrganizacional>>> Listar(
        [FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            organizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.UnidadesOrganizacionais
            .AsNoTracking()
            .Where(u => u.OrganizacaoId == organizacaoId && u.Status == "ativo");

        if (!auth.IsPlatformAdmin &&
            auth.Membership?.Role == UserRole.RESIDENT &&
            auth.Membership.UnidadeOrganizacionalId.HasValue)
        {
            query = query.Where(u => u.Id == auth.Membership.UnidadeOrganizacionalId.Value);
        }

        var unidades = await query
            .OrderBy(u => u.CodigoInterno)
            .ThenBy(u => u.Nome)
            .ToListAsync();

        return Ok(unidades);
    }

    public class CriarUnidadeRequest
    {
        public Guid OrganizacaoId { get; set; }
        public string Tipo { get; set; } = string.Empty;          // ex.: "Bloco", "Apartamento"
        public string CodigoInterno { get; set; } = string.Empty; // ex.: "1", "101", "1-101"
        public string Nome { get; set; } = string.Empty;          // ex.: "Bloco 1 - Apto 101"
    }

    // POST /api/unidades
    [HttpPost]
    public async Task<ActionResult<UnidadeOrganizacional>> Criar(CriarUnidadeRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            request.OrganizacaoId,
            UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome da unidade e obrigatorio.");
        }

        var unidade = new UnidadeOrganizacional
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            Tipo = request.Tipo?.Trim() ?? string.Empty,
            CodigoInterno = request.CodigoInterno?.Trim() ?? string.Empty,
            Nome = request.Nome.Trim(),
            Status = "ativo"
        };

        _db.UnidadesOrganizacionais.Add(unidade);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Listar), new { organizacaoId = unidade.OrganizacaoId }, unidade);
    }

    public class AtualizarUnidadeRequest
    {
        public string Nome { get; set; } = string.Empty;
        public string? CodigoInterno { get; set; }
        public string? Tipo { get; set; }
    }

    // PUT /api/unidades/{id}
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UnidadeOrganizacional>> Atualizar(
        Guid id,
        AtualizarUnidadeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome da unidade e obrigatorio.");
        }

        var unidade = await _db.UnidadesOrganizacionais
            .FirstOrDefaultAsync(u => u.Id == id);

        if (unidade == null)
        {
            return NotFound("Unidade nao encontrada.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            unidade.OrganizacaoId,
            UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        unidade.Nome = request.Nome.Trim();
        unidade.CodigoInterno = request.CodigoInterno?.Trim() ?? string.Empty;
        unidade.Tipo = request.Tipo?.Trim() ?? string.Empty;

        await _db.SaveChangesAsync();

        return Ok(unidade);
    }

    // PATCH /api/unidades/{id}/arquivar
    [HttpPatch("{id:guid}/arquivar")]
    public async Task<ActionResult> Arquivar(Guid id)
    {
        var unidade = await _db.UnidadesOrganizacionais
            .FirstOrDefaultAsync(u => u.Id == id);

        if (unidade == null)
        {
            return NotFound("Unidade nao encontrada.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            unidade.OrganizacaoId,
            UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (unidade.Status == "arquivado")
        {
            return Ok();
        }

        unidade.Status = "arquivado";
        await _db.SaveChangesAsync();

        return Ok();
    }
}
