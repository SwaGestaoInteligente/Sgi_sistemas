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

    [HttpGet("lancamentos/filtrados")]
    public async Task<ActionResult<IEnumerable<LancamentoFinanceiro>>> ListarLancamentosFiltrados(
        [FromQuery] Guid? organizacaoId,
        [FromQuery] Guid? contaId,
        [FromQuery] string? tipo,
        [FromQuery] string? situacao,
        [FromQuery] DateTime? competenciaInicio,
        [FromQuery] DateTime? competenciaFim,
        [FromQuery] DateTime? vencimentoInicio,
        [FromQuery] DateTime? vencimentoFim)
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

        if (!string.IsNullOrWhiteSpace(tipo))
        {
            query = query.Where(l => l.Tipo == tipo);
        }

        if (!string.IsNullOrWhiteSpace(situacao))
        {
            query = query.Where(l => l.Situacao == situacao);
        }

        if (competenciaInicio.HasValue)
        {
            query = query.Where(l => l.DataCompetencia >= competenciaInicio.Value);
        }

        if (competenciaFim.HasValue)
        {
            query = query.Where(l => l.DataCompetencia <= competenciaFim.Value);
        }

        if (vencimentoInicio.HasValue)
        {
            query = query.Where(l => l.DataVencimento.HasValue && l.DataVencimento.Value >= vencimentoInicio.Value);
        }

        if (vencimentoFim.HasValue)
        {
            query = query.Where(l => l.DataVencimento.HasValue && l.DataVencimento.Value <= vencimentoFim.Value);
        }

        query = query.OrderBy(l => l.DataVencimento ?? l.DataCompetencia);

        var itens = await query.ToListAsync();
        return Ok(itens);
    }

    [HttpPost("lancamentos")]
    public async Task<ActionResult<LancamentoFinanceiro>> CriarLancamento(LancamentoFinanceiro model)
    {
        if (model.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organização é obrigatória.");
        }

        if (model.Valor <= 0)
        {
            return BadRequest("Valor deve ser maior que zero.");
        }

        if (string.IsNullOrWhiteSpace(model.Tipo) || (model.Tipo != "pagar" && model.Tipo != "receber"))
        {
            return BadRequest("Tipo deve ser 'pagar' ou 'receber'.");
        }

        if (model.DataCompetencia == default)
        {
            return BadRequest("Data de competência é obrigatória.");
        }

        if (model.DataVencimento.HasValue && model.DataVencimento.Value.Date < model.DataCompetencia.Date)
        {
            return BadRequest("Data de vencimento não pode ser anterior à data de competência.");
        }

        if (string.IsNullOrWhiteSpace(model.Situacao))
        {
            model.Situacao = "pendente";
        }
        else
        {
            var situacaoNormalizada = model.Situacao.Trim().ToLowerInvariant();
            if (situacaoNormalizada is not ("pendente" or "pago" or "cancelado"))
            {
                return BadRequest("SituaÃ§Ã£o deve ser 'pendente', 'pago' ou 'cancelado'.");
            }

            model.Situacao = situacaoNormalizada;
        }

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

    [HttpPost("lancamentos/{id:guid}/pagar")]
    public async Task<IActionResult> MarcarLancamentoComoPago(Guid id)
    {
        var lancamento = await _db.LancamentosFinanceiros.FindAsync(id);
        if (lancamento is null)
        {
            return NotFound();
        }

        if (lancamento.Situacao == "cancelado")
        {
            return BadRequest("Não é possível pagar um lançamento cancelado.");
        }

        if (lancamento.Situacao == "pago")
        {
            return BadRequest("Lançamento já está marcado como pago.");
        }

        lancamento.Situacao = "pago";
        if (!lancamento.DataPagamento.HasValue)
        {
            lancamento.DataPagamento = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("lancamentos/{id:guid}/cancelar")]
    public async Task<IActionResult> CancelarLancamento(Guid id)
    {
        var lancamento = await _db.LancamentosFinanceiros.FindAsync(id);
        if (lancamento is null)
        {
            return NotFound();
        }

        if (lancamento.Situacao == "pago")
        {
            return BadRequest("Não é possível cancelar um lançamento já pago.");
        }

        if (lancamento.Situacao == "cancelado")
        {
            return BadRequest("Lançamento já está cancelado.");
        }

        lancamento.Situacao = "cancelado";
        lancamento.DataPagamento = null;

        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ---------------------------
    // Plano de contas
    // ---------------------------

    [HttpGet("planos-contas")]
    public async Task<ActionResult<IEnumerable<PlanoContas>>> ListarPlanosContas(
        [FromQuery] Guid? organizacaoId,
        [FromQuery] string? tipo)
    {
        var query = _db.PlanosContas.AsNoTracking().AsQueryable();

        if (organizacaoId.HasValue)
        {
            query = query.Where(p => p.OrganizacaoId == organizacaoId.Value);
        }

        if (!string.IsNullOrWhiteSpace(tipo))
        {
            query = query.Where(p => p.Tipo == tipo);
        }

        var itens = await query
            .OrderBy(p => p.Codigo)
            .ThenBy(p => p.Nome)
            .ToListAsync();

        return Ok(itens);
    }

    public class CriarPlanoContasRequest
    {
        public Guid OrganizacaoId { get; set; }
        public string Codigo { get; set; } = string.Empty;
        public string Nome { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public int Nivel { get; set; }
        public Guid? ParentId { get; set; }
    }

    [HttpPost("planos-contas")]
    public async Task<ActionResult<PlanoContas>> CriarPlanoContas(CriarPlanoContasRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organização é obrigatória.");
        }

        if (string.IsNullOrWhiteSpace(request.Codigo))
        {
            return BadRequest("Código é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(request.Tipo))
        {
            return BadRequest("Tipo é obrigatório.");
        }

        var plano = new PlanoContas
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            Codigo = request.Codigo.Trim(),
            Nome = request.Nome.Trim(),
            Tipo = request.Tipo.Trim(),
            Nivel = request.Nivel,
            ParentId = request.ParentId
        };

        _db.PlanosContas.Add(plano);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ListarPlanosContas), new { id = plano.Id }, plano);
    }

    public class AtualizarPlanoContasRequest
    {
        public string Codigo { get; set; } = string.Empty;
        public string Nome { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public int Nivel { get; set; }
        public Guid? ParentId { get; set; }
    }

    [HttpPut("planos-contas/{id:guid}")]
    public async Task<ActionResult<PlanoContas>> AtualizarPlanoContas(Guid id, AtualizarPlanoContasRequest request)
    {
        var plano = await _db.PlanosContas.FindAsync(id);
        if (plano is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Codigo))
        {
            return BadRequest("Código é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome é obrigatório.");
        }

        if (string.IsNullOrWhiteSpace(request.Tipo))
        {
            return BadRequest("Tipo é obrigatório.");
        }

        plano.Codigo = request.Codigo.Trim();
        plano.Nome = request.Nome.Trim();
        plano.Tipo = request.Tipo.Trim();
        plano.Nivel = request.Nivel;
        plano.ParentId = request.ParentId;

        await _db.SaveChangesAsync();

        return Ok(plano);
    }

    [HttpDelete("planos-contas/{id:guid}")]
    public async Task<IActionResult> RemoverPlanoContas(Guid id)
    {
        var plano = await _db.PlanosContas.FindAsync(id);
        if (plano is null)
        {
            return NotFound();
        }

        var possuiLancamentos = await _db.LancamentosFinanceiros
            .AsNoTracking()
            .AnyAsync(l => l.PlanoContasId == id);

        if (possuiLancamentos)
        {
            return BadRequest("Não é possível remover a categoria porque já possui lançamentos vinculados.");
        }

        _db.PlanosContas.Remove(plano);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ---------------------------
    // Itens cobrados (ChargeItem)
    // ---------------------------

    [HttpGet("itens-cobrados")]
    public async Task<ActionResult<IEnumerable<ChargeItem>>> ListarItensCobrados(
        [FromQuery] Guid? organizacaoId,
        [FromQuery] bool? apenasAtivos)
    {
        var query = _db.ItensCobrados.AsNoTracking().AsQueryable();

        if (organizacaoId.HasValue)
        {
            query = query.Where(i => i.OrganizacaoId == organizacaoId.Value);
        }

        if (apenasAtivos == true)
        {
            query = query.Where(i => i.Ativo);
        }

        var itens = await query
            .OrderBy(i => i.Nome)
            .ToListAsync();

        return Ok(itens);
    }

    [HttpGet("itens-cobrados/{id:guid}")]
    public async Task<ActionResult<ChargeItem>> ObterItemCobrado(Guid id, [FromQuery] Guid? organizacaoId)
    {
        var item = await _db.ItensCobrados
            .AsNoTracking()
            .FirstOrDefaultAsync(i =>
                i.Id == id &&
                (!organizacaoId.HasValue || i.OrganizacaoId == organizacaoId.Value));

        if (item is null)
        {
            return NotFound();
        }

        return Ok(item);
    }

    public class CriarItemCobradoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public Guid FinanceCategoryId { get; set; }
        public decimal? ValorPadrao { get; set; }
        public bool PermiteAlterarValor { get; set; }
        public bool ExigeReserva { get; set; }
        public bool GeraCobrancaAutomatica { get; set; }
        public string? DescricaoOpcional { get; set; }
    }

    [HttpPost("itens-cobrados")]
    public async Task<ActionResult<ChargeItem>> CriarItemCobrado(CriarItemCobradoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organização é obrigatória.");
        }

        if (request.FinanceCategoryId == Guid.Empty)
        {
            return BadRequest("Categoria financeira é obrigatória.");
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome é obrigatório.");
        }

        var item = new ChargeItem
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            Nome = request.Nome.Trim(),
            Tipo = request.Tipo?.Trim() ?? string.Empty,
            FinanceCategoryId = request.FinanceCategoryId,
            ValorPadrao = request.ValorPadrao,
            PermiteAlterarValor = request.PermiteAlterarValor,
            ExigeReserva = request.ExigeReserva,
            GeraCobrancaAutomatica = request.GeraCobrancaAutomatica,
            DescricaoOpcional = string.IsNullOrWhiteSpace(request.DescricaoOpcional)
                ? null
                : request.DescricaoOpcional.Trim(),
            Ativo = true
        };

        _db.ItensCobrados.Add(item);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ObterItemCobrado), new { id = item.Id }, item);
    }

    public class AtualizarItemCobradoRequest
    {
        public string Nome { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public Guid FinanceCategoryId { get; set; }
        public decimal? ValorPadrao { get; set; }
        public bool PermiteAlterarValor { get; set; }
        public bool ExigeReserva { get; set; }
        public bool GeraCobrancaAutomatica { get; set; }
        public string? DescricaoOpcional { get; set; }
        public bool Ativo { get; set; }
    }

    [HttpPut("itens-cobrados/{id:guid}")]
    public async Task<IActionResult> AtualizarItemCobrado(Guid id, AtualizarItemCobradoRequest request)
    {
        var item = await _db.ItensCobrados.FindAsync(id);
        if (item is null)
        {
            return NotFound();
        }

        if (request.FinanceCategoryId == Guid.Empty)
        {
            return BadRequest("Categoria financeira é obrigatória.");
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome é obrigatório.");
        }

        item.Nome = request.Nome.Trim();
        item.Tipo = request.Tipo?.Trim() ?? string.Empty;
        item.FinanceCategoryId = request.FinanceCategoryId;
        item.ValorPadrao = request.ValorPadrao;
        item.PermiteAlterarValor = request.PermiteAlterarValor;
        item.ExigeReserva = request.ExigeReserva;
        item.GeraCobrancaAutomatica = request.GeraCobrancaAutomatica;
        item.DescricaoOpcional = string.IsNullOrWhiteSpace(request.DescricaoOpcional)
            ? null
            : request.DescricaoOpcional.Trim();
        item.Ativo = request.Ativo;

        await _db.SaveChangesAsync();

        return NoContent();
    }

    public class AtualizarStatusItemCobradoRequest
    {
        public bool Ativo { get; set; }
    }

    [HttpPatch("itens-cobrados/{id:guid}/status")]
    public async Task<IActionResult> AtualizarStatusItemCobrado(Guid id, AtualizarStatusItemCobradoRequest request)
    {
        var item = await _db.ItensCobrados.FindAsync(id);
        if (item is null)
        {
            return NotFound();
        }

        item.Ativo = request.Ativo;
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
