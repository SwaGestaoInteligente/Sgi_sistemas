using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        var query = _db.Chamados.AsNoTracking().AsQueryable();
        if (organizacaoId.HasValue)
        {
            query = query.Where(c => c.OrganizacaoId == organizacaoId.Value);
        }

        var itens = await query.ToListAsync();
        return Ok(itens);
    }

    [HttpPost("chamados")]
    public async Task<ActionResult<Chamado>> CriarChamado(Chamado model)
    {
        model.Id = Guid.NewGuid();
        model.DataAbertura = DateTime.UtcNow;
        _db.Chamados.Add(model);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarChamados), new { id = model.Id }, model);
    }

    [HttpGet("reservas")]
    public async Task<ActionResult<IEnumerable<Reserva>>> ListarReservas([FromQuery] Guid? organizacaoId)
    {
        var query = _db.Reservas.AsNoTracking().AsQueryable();
        if (organizacaoId.HasValue)
        {
            query = query.Where(r => r.OrganizacaoId == organizacaoId.Value);
        }

        var itens = await query.ToListAsync();
        return Ok(itens);
    }

    [HttpPost("reservas")]
    public async Task<ActionResult<Reserva>> CriarReserva(Reserva model)
    {
        model.Id = Guid.NewGuid();
        _db.Reservas.Add(model);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarReservas), new { id = model.Id }, model);
    }
}
