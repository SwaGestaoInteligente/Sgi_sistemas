using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Auth;
using Sgi.Domain.Core;
using Sgi.Domain.Operacao;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OperacaoController : ControllerBase
{
    private readonly SgiDbContext _db;

    public OperacaoController(SgiDbContext db)
    {
        _db = db;
    }

    [HttpGet("chamados")]
    public async Task<ActionResult<IEnumerable<Chamado>>> ListarChamados([FromQuery] Guid? organizacaoId)
    {
        if (!organizacaoId.HasValue || organizacaoId.Value == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            organizacaoId.Value,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.Chamados.AsNoTracking().Where(c => c.OrganizacaoId == organizacaoId.Value);

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            var pessoaId = await _db.Usuarios.AsNoTracking()
                .Where(u => u.Id == auth.Membership.UsuarioId)
                .Select(u => u.PessoaId)
                .FirstOrDefaultAsync();

            if (pessoaId != Guid.Empty)
            {
                query = query.Where(c => c.PessoaSolicitanteId == pessoaId);
            }

            if (auth.Membership.UnidadeOrganizacionalId.HasValue)
            {
                query = query.Where(c => c.UnidadeOrganizacionalId == auth.Membership.UnidadeOrganizacionalId);
            }
        }

        var itens = await query.ToListAsync();
        return Ok(itens);
    }

    [HttpPost("chamados")]
    public async Task<ActionResult<Chamado>> CriarChamado(Chamado model)
    {
        if (model.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            model.OrganizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            var pessoaId = await _db.Usuarios.AsNoTracking()
                .Where(u => u.Id == auth.Membership.UsuarioId)
                .Select(u => u.PessoaId)
                .FirstOrDefaultAsync();

            if (pessoaId != Guid.Empty)
            {
                model.PessoaSolicitanteId = pessoaId;
            }

            if (auth.Membership.UnidadeOrganizacionalId.HasValue)
            {
                model.UnidadeOrganizacionalId = auth.Membership.UnidadeOrganizacionalId;
            }
        }

        model.Id = Guid.NewGuid();
        model.DataAbertura = DateTime.UtcNow;
        _db.Chamados.Add(model);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarChamados), new { id = model.Id }, model);
    }

    [HttpGet("reservas")]
    public async Task<ActionResult<IEnumerable<Reserva>>> ListarReservas([FromQuery] Guid? organizacaoId)
    {
        if (!organizacaoId.HasValue || organizacaoId.Value == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            organizacaoId.Value,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.Reservas.AsNoTracking().Where(r => r.OrganizacaoId == organizacaoId.Value);

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            var pessoaId = await _db.Usuarios.AsNoTracking()
                .Where(u => u.Id == auth.Membership.UsuarioId)
                .Select(u => u.PessoaId)
                .FirstOrDefaultAsync();

            if (pessoaId != Guid.Empty)
            {
                query = query.Where(r => r.PessoaSolicitanteId == pessoaId);
            }

            if (auth.Membership.UnidadeOrganizacionalId.HasValue)
            {
                query = query.Where(r => r.UnidadeOrganizacionalId == auth.Membership.UnidadeOrganizacionalId);
            }
        }

        var itens = await query.ToListAsync();
        return Ok(itens);
    }

    [HttpPost("reservas")]
    public async Task<ActionResult<Reserva>> CriarReserva(Reserva model)
    {
        if (model.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            model.OrganizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            var pessoaId = await _db.Usuarios.AsNoTracking()
                .Where(u => u.Id == auth.Membership.UsuarioId)
                .Select(u => u.PessoaId)
                .FirstOrDefaultAsync();

            if (pessoaId != Guid.Empty)
            {
                model.PessoaSolicitanteId = pessoaId;
            }

            if (auth.Membership.UnidadeOrganizacionalId.HasValue)
            {
                model.UnidadeOrganizacionalId = auth.Membership.UnidadeOrganizacionalId;
            }
        }

        model.Id = Guid.NewGuid();
        _db.Reservas.Add(model);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarReservas), new { id = model.Id }, model);
    }
}
