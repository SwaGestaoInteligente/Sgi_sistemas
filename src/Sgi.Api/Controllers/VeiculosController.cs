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
public class VeiculosController : ControllerBase
{
    private readonly SgiDbContext _db;

    public VeiculosController(SgiDbContext db)
    {
        _db = db;
    }

    private AuthorizationGuard Guard() => new(_db, User);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Veiculo>>> Listar(
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

        var query = _db.Veiculos.AsNoTracking().Where(v => v.OrganizacaoId == organizacaoId);

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            if (!auth.Membership.UnidadeOrganizacionalId.HasValue && !auth.PessoaId.HasValue)
            {
                return Forbid();
            }

            var unidadeFiltro = auth.Membership.UnidadeOrganizacionalId;
            var pessoaFiltro = auth.PessoaId;
            query = query.Where(v =>
                (unidadeFiltro.HasValue && v.UnidadeOrganizacionalId == unidadeFiltro.Value) ||
                (pessoaFiltro.HasValue && v.PessoaId == pessoaFiltro.Value));
        }

        if (unidadeId.HasValue && unidadeId.Value != Guid.Empty)
        {
            query = query.Where(v => v.UnidadeOrganizacionalId == unidadeId.Value);
        }

        if (pessoaId.HasValue && pessoaId.Value != Guid.Empty)
        {
            query = query.Where(v => v.PessoaId == pessoaId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusFiltro = status.Trim().ToLowerInvariant();
            query = query.Where(v => (v.Status ?? string.Empty).ToLower() == statusFiltro);
        }

        var itens = await query.OrderBy(v => v.Placa).ToListAsync();
        return Ok(itens);
    }

    public class CriarVeiculoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid? UnidadeOrganizacionalId { get; set; }
        public Guid? PessoaId { get; set; }
        public string Placa { get; set; } = string.Empty;
        public string Marca { get; set; } = string.Empty;
        public string Modelo { get; set; } = string.Empty;
        public string Cor { get; set; } = string.Empty;
        public string? Status { get; set; }
    }

    [HttpPost]
    public async Task<ActionResult<Veiculo>> Criar(CriarVeiculoRequest request)
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

        var veiculo = new Veiculo
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            UnidadeOrganizacionalId = request.UnidadeOrganizacionalId,
            PessoaId = request.PessoaId,
            Placa = request.Placa.Trim().ToUpperInvariant(),
            Marca = request.Marca.Trim(),
            Modelo = request.Modelo.Trim(),
            Cor = request.Cor.Trim(),
            Status = string.IsNullOrWhiteSpace(request.Status) ? "ativo" : request.Status.Trim().ToLowerInvariant()
        };

        _db.Veiculos.Add(veiculo);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Listar), new { organizacaoId = veiculo.OrganizacaoId }, veiculo);
    }

    public class AtualizarVeiculoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid? UnidadeOrganizacionalId { get; set; }
        public Guid? PessoaId { get; set; }
        public string Placa { get; set; } = string.Empty;
        public string Marca { get; set; } = string.Empty;
        public string Modelo { get; set; } = string.Empty;
        public string Cor { get; set; } = string.Empty;
        public string? Status { get; set; }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Veiculo>> Atualizar(Guid id, AtualizarVeiculoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var veiculo = await _db.Veiculos.FindAsync(id);
        if (veiculo is null)
        {
            return NotFound();
        }

        if (veiculo.OrganizacaoId != request.OrganizacaoId)
        {
            return BadRequest("OrganizacaoId invalido.");
        }

        var auth = await Guard().RequireOrgAccess(veiculo.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        veiculo.UnidadeOrganizacionalId = request.UnidadeOrganizacionalId;
        veiculo.PessoaId = request.PessoaId;
        veiculo.Placa = request.Placa.Trim().ToUpperInvariant();
        veiculo.Marca = request.Marca.Trim();
        veiculo.Modelo = request.Modelo.Trim();
        veiculo.Cor = request.Cor.Trim();
        veiculo.Status = string.IsNullOrWhiteSpace(request.Status) ? veiculo.Status : request.Status.Trim().ToLowerInvariant();

        await _db.SaveChangesAsync();
        return Ok(veiculo);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remover(Guid id, [FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var veiculo = await _db.Veiculos.FindAsync(id);
        if (veiculo is null)
        {
            return NotFound();
        }

        if (veiculo.OrganizacaoId != organizacaoId)
        {
            return BadRequest("OrganizacaoId invalido.");
        }

        var auth = await Guard().RequireOrgAccess(veiculo.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        _db.Veiculos.Remove(veiculo);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
