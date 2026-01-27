using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrganizacoesController : ControllerBase
{
    private readonly SgiDbContext _db;

    public OrganizacoesController(SgiDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Organizacao>>> GetAll()
    {
        var items = await _db.Organizacoes.AsNoTracking().ToListAsync();
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Organizacao>> GetById(Guid id)
    {
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
