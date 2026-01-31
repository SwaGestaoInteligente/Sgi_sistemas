using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/unidades")]
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
            return BadRequest("Organização é obrigatória.");
        }

        var unidades = await _db.UnidadesOrganizacionais
            .AsNoTracking()
            .Where(u => u.OrganizacaoId == organizacaoId && u.Status == "ativo")
            .OrderBy(u => u.CodigoInterno)
            .ThenBy(u => u.Nome)
            .ToListAsync();

        return Ok(unidades);
    }

    public class CriarUnidadeRequest
    {
        public Guid OrganizacaoId { get; set; }
        public string Tipo { get; set; } = string.Empty;          // ex.: "Bloco", "Apartamento"
        public string CodigoInterno { get; set; } = string.Empty; // ex.: "A", "101", "A-101"
        public string Nome { get; set; } = string.Empty;          // ex.: "Bloco A", "Ap 101"
    }

    // POST /api/unidades
    [HttpPost]
    public async Task<ActionResult<UnidadeOrganizacional>> Criar(CriarUnidadeRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organização é obrigatória.");
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome da unidade é obrigatório.");
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
}
