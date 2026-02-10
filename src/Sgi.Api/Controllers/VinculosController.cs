using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Auth;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/vinculos")]
[Authorize]
public class VinculosController : ControllerBase
{
    private readonly SgiDbContext _db;

    public VinculosController(SgiDbContext db)
    {
        _db = db;
    }

    private AuthorizationGuard Guard() => new(_db, User);

    public record VinculoDto(
        Guid Id,
        Guid PessoaId,
        string PessoaNome,
        string? PessoaDocumento,
        Guid OrganizacaoId,
        Guid? UnidadeOrganizacionalId,
        string? UnidadeCodigo,
        string? UnidadeNome,
        string Papel,
        DateTime DataInicio,
        DateTime? DataFim);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<VinculoDto>>> Listar(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? pessoaId,
        [FromQuery] Guid? unidadeId)
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

        var baseQuery =
            from v in _db.VinculosPessoaOrganizacao.AsNoTracking()
            join p in _db.Pessoas.AsNoTracking() on v.PessoaId equals p.Id
            join u in _db.UnidadesOrganizacionais.AsNoTracking()
                on v.UnidadeOrganizacionalId equals u.Id into unidades
            from u in unidades.DefaultIfEmpty()
            where v.OrganizacaoId == organizacaoId
            select new { v, p, u };

        if (pessoaId.HasValue && pessoaId.Value != Guid.Empty)
        {
            baseQuery = baseQuery.Where(x => x.v.PessoaId == pessoaId.Value);
        }

        if (unidadeId.HasValue && unidadeId.Value != Guid.Empty)
        {
            baseQuery = baseQuery.Where(x => x.v.UnidadeOrganizacionalId == unidadeId.Value);
        }

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            if (!auth.Membership.UnidadeOrganizacionalId.HasValue && !auth.PessoaId.HasValue)
            {
                return Forbid();
            }

            var unidadeFiltro = auth.Membership.UnidadeOrganizacionalId;
            var pessoaFiltro = auth.PessoaId;
            baseQuery = baseQuery.Where(x =>
                (unidadeFiltro.HasValue && x.v.UnidadeOrganizacionalId == unidadeFiltro.Value) ||
                (pessoaFiltro.HasValue && x.v.PessoaId == pessoaFiltro.Value));
        }

        var itens = await baseQuery
            .OrderBy(x => x.p.Nome)
            .ThenBy(x => x.v.Papel)
            .Select(x => new VinculoDto(
                x.v.Id,
                x.v.PessoaId,
                x.p.Nome,
                x.p.Documento,
                x.v.OrganizacaoId,
                x.v.UnidadeOrganizacionalId,
                x.u != null ? x.u.CodigoInterno : null,
                x.u != null ? x.u.Nome : null,
                x.v.Papel,
                x.v.DataInicio,
                x.v.DataFim))
            .ToListAsync();

        return Ok(itens);
    }

    public class CriarVinculoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid PessoaId { get; set; }
        public Guid? UnidadeOrganizacionalId { get; set; }
        public string Papel { get; set; } = string.Empty;
        public DateTime? DataInicio { get; set; }
        public DateTime? DataFim { get; set; }
    }

    [HttpPost]
    public async Task<ActionResult<VinculoDto>> Criar(CriarVinculoRequest request)
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

        if (request.PessoaId == Guid.Empty)
        {
            return BadRequest("PessoaId e obrigatorio.");
        }

        if (string.IsNullOrWhiteSpace(request.Papel))
        {
            return BadRequest("Papel e obrigatorio.");
        }

        var pessoaExiste = await _db.Pessoas.AsNoTracking()
            .AnyAsync(p => p.Id == request.PessoaId);
        if (!pessoaExiste)
        {
            return BadRequest("PessoaId invalido.");
        }

        if (request.UnidadeOrganizacionalId.HasValue && request.UnidadeOrganizacionalId.Value != Guid.Empty)
        {
            var unidadeOk = await _db.UnidadesOrganizacionais.AsNoTracking()
                .AnyAsync(u => u.Id == request.UnidadeOrganizacionalId.Value &&
                               u.OrganizacaoId == request.OrganizacaoId);
            if (!unidadeOk)
            {
                return BadRequest("UnidadeOrganizacionalId invalido.");
            }
        }

        var papelNormalizado = request.Papel.Trim().ToLowerInvariant();
        var existe = await _db.VinculosPessoaOrganizacao.AsNoTracking()
            .AnyAsync(v =>
                v.OrganizacaoId == request.OrganizacaoId &&
                v.PessoaId == request.PessoaId &&
                v.UnidadeOrganizacionalId == request.UnidadeOrganizacionalId &&
                v.Papel.ToLower() == papelNormalizado &&
                v.DataFim == null);
        if (existe)
        {
            return Conflict("Vinculo ja existe.");
        }

        var vinculo = new VinculoPessoaOrganizacao
        {
            Id = Guid.NewGuid(),
            PessoaId = request.PessoaId,
            OrganizacaoId = request.OrganizacaoId,
            UnidadeOrganizacionalId = request.UnidadeOrganizacionalId,
            Papel = request.Papel.Trim().ToLowerInvariant(),
            DataInicio = request.DataInicio?.Date ?? DateTime.UtcNow.Date,
            DataFim = request.DataFim?.Date
        };

        _db.VinculosPessoaOrganizacao.Add(vinculo);
        await _db.SaveChangesAsync();

        var dto = await (
                from v in _db.VinculosPessoaOrganizacao.AsNoTracking()
                join p in _db.Pessoas.AsNoTracking() on v.PessoaId equals p.Id
                join u in _db.UnidadesOrganizacionais.AsNoTracking()
                    on v.UnidadeOrganizacionalId equals u.Id into unidades
                from u in unidades.DefaultIfEmpty()
                where v.Id == vinculo.Id
                select new VinculoDto(
                    v.Id,
                    v.PessoaId,
                    p.Nome,
                    p.Documento,
                    v.OrganizacaoId,
                    v.UnidadeOrganizacionalId,
                    u != null ? u.CodigoInterno : null,
                    u != null ? u.Nome : null,
                    v.Papel,
                    v.DataInicio,
                    v.DataFim))
            .FirstAsync();

        return CreatedAtAction(nameof(Listar), new { organizacaoId = vinculo.OrganizacaoId }, dto);
    }

    public class AtualizarVinculoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid? UnidadeOrganizacionalId { get; set; }
        public string? Papel { get; set; }
        public DateTime? DataFim { get; set; }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<VinculoDto>> Atualizar(Guid id, AtualizarVinculoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var vinculo = await _db.VinculosPessoaOrganizacao.FindAsync(id);
        if (vinculo is null)
        {
            return NotFound();
        }

        if (vinculo.OrganizacaoId != request.OrganizacaoId)
        {
            return BadRequest("OrganizacaoId invalido.");
        }

        var auth = await Guard().RequireOrgAccess(vinculo.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (request.UnidadeOrganizacionalId.HasValue && request.UnidadeOrganizacionalId.Value != Guid.Empty)
        {
            var unidadeOk = await _db.UnidadesOrganizacionais.AsNoTracking()
                .AnyAsync(u => u.Id == request.UnidadeOrganizacionalId.Value &&
                               u.OrganizacaoId == request.OrganizacaoId);
            if (!unidadeOk)
            {
                return BadRequest("UnidadeOrganizacionalId invalido.");
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Papel))
        {
            vinculo.Papel = request.Papel.Trim().ToLowerInvariant();
        }

        vinculo.UnidadeOrganizacionalId = request.UnidadeOrganizacionalId;
        vinculo.DataFim = request.DataFim?.Date;

        await _db.SaveChangesAsync();

        var dto = await (
                from v in _db.VinculosPessoaOrganizacao.AsNoTracking()
                join p in _db.Pessoas.AsNoTracking() on v.PessoaId equals p.Id
                join u in _db.UnidadesOrganizacionais.AsNoTracking()
                    on v.UnidadeOrganizacionalId equals u.Id into unidades
                from u in unidades.DefaultIfEmpty()
                where v.Id == vinculo.Id
                select new VinculoDto(
                    v.Id,
                    v.PessoaId,
                    p.Nome,
                    p.Documento,
                    v.OrganizacaoId,
                    v.UnidadeOrganizacionalId,
                    u != null ? u.CodigoInterno : null,
                    u != null ? u.Nome : null,
                    v.Papel,
                    v.DataInicio,
                    v.DataFim))
            .FirstAsync();

        return Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remover(Guid id, [FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var vinculo = await _db.VinculosPessoaOrganizacao.FindAsync(id);
        if (vinculo is null)
        {
            return NotFound();
        }

        if (vinculo.OrganizacaoId != organizacaoId)
        {
            return BadRequest("OrganizacaoId invalido.");
        }

        var auth = await Guard().RequireOrgAccess(vinculo.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        _db.VinculosPessoaOrganizacao.Remove(vinculo);
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
