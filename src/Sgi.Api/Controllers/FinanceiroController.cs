using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Domain.Financeiro;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FinanceiroController : ControllerBase
{
    private readonly SgiDbContext _db;

    public FinanceiroController(SgiDbContext db)
    {
        _db = db;
    }

    [HttpGet("contas")]
    public async Task<ActionResult<IEnumerable<ContaFinanceira>>> ListarContas([FromQuery] Guid? organizacaoId)
    {
        var query = _db.ContasFinanceiras.AsNoTracking().AsQueryable();
        if (organizacaoId.HasValue)
        {
            query = query.Where(c => c.OrganizacaoId == organizacaoId.Value);
        }

        var contas = await query.ToListAsync();
        return Ok(contas);
    }

    [HttpPost("contas")]
    public async Task<ActionResult<ContaFinanceira>> CriarConta(ContaFinanceira model)
    {
        model.Id = Guid.NewGuid();
        _db.ContasFinanceiras.Add(model);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarContas), new { id = model.Id }, model);
    }

    [HttpDelete("contas/{id:guid}")]
    public async Task<IActionResult> RemoverConta(Guid id)
    {
        var conta = await _db.ContasFinanceiras.FindAsync(id);
        if (conta is null)
        {
            return NotFound();
        }

        var temLancamentos = await _db.LancamentosFinanceiros
            .AsNoTracking()
            .AnyAsync(l => l.ContaFinanceiraId == id);

        if (temLancamentos)
        {
            return BadRequest("Não é possível excluir a conta porque ela já possui lançamentos. Desative a conta em vez de excluir.");
        }

        _db.ContasFinanceiras.Remove(conta);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    public class AtualizarStatusContaRequest
    {
        public string Status { get; set; } = string.Empty;
    }

    [HttpPatch("contas/{id:guid}/status")]
    public async Task<IActionResult> AtualizarStatusConta(Guid id, AtualizarStatusContaRequest request)
    {
        var conta = await _db.ContasFinanceiras.FindAsync(id);
        if (conta is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Status))
        {
            return BadRequest("Status é obrigatório.");
        }

        conta.Status = request.Status;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("lancamentos")]
    public async Task<ActionResult<IEnumerable<LancamentoFinanceiro>>> ListarLancamentos(
        [FromQuery] Guid? organizacaoId,
        [FromQuery] Guid? contaId)
    {
        var query = _db.LancamentosFinanceiros.AsNoTracking().AsQueryable();
        if (organizacaoId.HasValue)
        {
            query = query.Where(l => l.OrganizacaoId == organizacaoId.Value);
        }

        if (contaId.HasValue)
        {
            query = query.Where(l => l.ContaFinanceiraId == contaId.Value);
        }

        // Ordem padrão: vencimento (quando existir), depois data de competência
        query = query
            .OrderBy(l => l.DataVencimento ?? l.DataCompetencia);

        var itens = await query.ToListAsync();
        return Ok(itens);
    }

    [HttpPost("lancamentos")]
    public async Task<ActionResult<LancamentoFinanceiro>> CriarLancamento(LancamentoFinanceiro model)
    {
        model.Id = Guid.NewGuid();
        _db.LancamentosFinanceiros.Add(model);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarLancamentos), new { id = model.Id }, model);
    }

    public record ResumoFinanceiro(
        int TotalLancamentos,
        decimal TotalPagar,
        decimal TotalReceber);

    [HttpGet("resumo")]
    public async Task<ActionResult<ResumoFinanceiro>> ObterResumo([FromQuery] Guid? organizacaoId)
    {
        var query = _db.LancamentosFinanceiros.AsNoTracking().AsQueryable();
        if (organizacaoId.HasValue)
        {
            query = query.Where(l => l.OrganizacaoId == organizacaoId.Value);
        }

        var itens = await query.ToListAsync();

        var totalLanc = itens.Count;
        var totalPagar = itens
            .Where(l => l.Tipo == "pagar" && l.Situacao != "cancelado")
            .Sum(l => l.Valor);
        var totalReceber = itens
            .Where(l => l.Tipo == "receber" && l.Situacao != "cancelado")
            .Sum(l => l.Valor);

        var resumo = new ResumoFinanceiro(totalLanc, totalPagar, totalReceber);
        return Ok(resumo);
    }
}
