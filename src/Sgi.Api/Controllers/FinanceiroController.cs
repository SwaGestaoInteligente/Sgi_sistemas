using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Auth;
using Sgi.Domain.Financeiro;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[ServiceFilter(typeof(FinanceiroAccessFilter))]
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

    public class CriarTransferenciaRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid ContaOrigemId { get; set; }
        public Guid ContaDestinoId { get; set; }
        public decimal Valor { get; set; }
        public DateTime? DataTransferencia { get; set; }
        public string? Descricao { get; set; }
        public string? Referencia { get; set; }
        public string? FormaPagamento { get; set; }
    }

    public record TransferenciaResponse(
        Guid LancamentoSaidaId,
        Guid LancamentoEntradaId,
        string Referencia);

    [HttpPost("transferencias")]
    public async Task<ActionResult<TransferenciaResponse>> TransferirEntreContas(CriarTransferenciaRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        if (request.ContaOrigemId == Guid.Empty || request.ContaDestinoId == Guid.Empty)
        {
            return BadRequest("Conta de origem e destino sao obrigatorias.");
        }

        if (request.ContaOrigemId == request.ContaDestinoId)
        {
            return BadRequest("Conta de origem e destino devem ser diferentes.");
        }

        if (request.Valor <= 0)
        {
            return BadRequest("Valor da transferencia deve ser maior que zero.");
        }

        var contas = await _db.ContasFinanceiras
            .Where(c => c.Id == request.ContaOrigemId || c.Id == request.ContaDestinoId)
            .ToListAsync();

        var contaOrigem = contas.FirstOrDefault(c => c.Id == request.ContaOrigemId);
        if (contaOrigem is null)
        {
            return NotFound("Conta de origem nao encontrada.");
        }

        var contaDestino = contas.FirstOrDefault(c => c.Id == request.ContaDestinoId);
        if (contaDestino is null)
        {
            return NotFound("Conta de destino nao encontrada.");
        }

        if (contaOrigem.OrganizacaoId != request.OrganizacaoId || contaDestino.OrganizacaoId != request.OrganizacaoId)
        {
            return BadRequest("As contas informadas nao pertencem a organizacao.");
        }

        if (!string.Equals(contaOrigem.Status, "ativo", StringComparison.OrdinalIgnoreCase)
            || !string.Equals(contaDestino.Status, "ativo", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Transferencia permitida apenas entre contas ativas.");
        }

        var dataTransferencia = request.DataTransferencia?.Date ?? DateTime.UtcNow.Date;
        var referencia = string.IsNullOrWhiteSpace(request.Referencia)
            ? $"TRF-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}"[..30]
            : request.Referencia.Trim();
        var descricaoBase = string.IsNullOrWhiteSpace(request.Descricao)
            ? "Transferencia entre contas"
            : request.Descricao.Trim();
        var formaPagamento = string.IsNullOrWhiteSpace(request.FormaPagamento)
            ? "transferencia"
            : request.FormaPagamento.Trim();

        var lancamentoSaida = new LancamentoFinanceiro
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            Tipo = "pagar",
            Situacao = "pago",
            PlanoContasId = Guid.Empty,
            CentroCustoId = null,
            ContaFinanceiraId = contaOrigem.Id,
            PessoaId = Guid.Empty,
            Descricao = $"{descricaoBase}: {contaOrigem.Nome} -> {contaDestino.Nome}",
            Valor = request.Valor,
            DataCompetencia = dataTransferencia,
            DataVencimento = dataTransferencia,
            DataPagamento = dataTransferencia,
            FormaPagamento = formaPagamento,
            ParcelaNumero = null,
            ParcelaTotal = null,
            Referencia = referencia
        };

        var lancamentoEntrada = new LancamentoFinanceiro
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            Tipo = "receber",
            Situacao = "pago",
            PlanoContasId = Guid.Empty,
            CentroCustoId = null,
            ContaFinanceiraId = contaDestino.Id,
            PessoaId = Guid.Empty,
            Descricao = $"{descricaoBase}: {contaOrigem.Nome} -> {contaDestino.Nome}",
            Valor = request.Valor,
            DataCompetencia = dataTransferencia,
            DataVencimento = dataTransferencia,
            DataPagamento = dataTransferencia,
            FormaPagamento = formaPagamento,
            ParcelaNumero = null,
            ParcelaTotal = null,
            Referencia = referencia
        };

        _db.LancamentosFinanceiros.Add(lancamentoSaida);
        _db.LancamentosFinanceiros.Add(lancamentoEntrada);
        await _db.SaveChangesAsync();

        return Ok(new TransferenciaResponse(
            lancamentoSaida.Id,
            lancamentoEntrada.Id,
            referencia));
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
    // Cotas condominiais
    // ---------------------------

    [HttpGet("cotas")]
    public async Task<ActionResult<IEnumerable<CotaCondominial>>> ListarCotas(
        [FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizaÃ§Ã£o Ã© obrigatÃ³ria.");
        }

        var cotas = await _db.CotasCondominio
            .AsNoTracking()
            .Where(c => c.OrganizacaoId == organizacaoId && c.Ativo)
            .OrderBy(c => c.CompetenciaInicio)
            .ToListAsync();

        return Ok(cotas);
    }

    public class CriarCotaCondominialRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid UnidadeOrganizacionalId { get; set; }
        public Guid PlanoContasId { get; set; }
        public decimal Valor { get; set; }
        public string CompetenciaInicio { get; set; } = string.Empty; // yyyy-MM
        public string? CompetenciaFim { get; set; } // yyyy-MM ou null
    }

    [HttpPost("cotas")]
    public async Task<ActionResult<CotaCondominial>> CriarCotaCondominial(
        CriarCotaCondominialRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizaÃ§Ã£o Ã© obrigatÃ³ria.");
        }

        if (request.UnidadeOrganizacionalId == Guid.Empty)
        {
            return BadRequest("Unidade Ã© obrigatÃ³ria.");
        }

        if (request.PlanoContasId == Guid.Empty)
        {
            return BadRequest("Categoria financeira Ã© obrigatÃ³ria.");
        }

        if (request.Valor <= 0)
        {
            return BadRequest("Valor da cota deve ser maior que zero.");
        }

        if (string.IsNullOrWhiteSpace(request.CompetenciaInicio))
        {
            return BadRequest("CompetÃªncia inicial Ã© obrigatÃ³ria.");
        }

        var cota = new CotaCondominial
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            UnidadeOrganizacionalId = request.UnidadeOrganizacionalId,
            PlanoContasId = request.PlanoContasId,
            Valor = request.Valor,
            CompetenciaInicio = request.CompetenciaInicio,
            CompetenciaFim = request.CompetenciaFim,
            Ativo = true
        };

        _db.CotasCondominio.Add(cota);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ListarCotas), new { organizacaoId = cota.OrganizacaoId }, cota);
    }

    // ---------------------------
    // Faturas (DocumentoCobranca)
    // ---------------------------

    public class CriarFaturaRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid LancamentoFinanceiroId { get; set; }
        public string Tipo { get; set; } = "boleto";
        public string? IdentificadorExterno { get; set; }
        public string? LinhaDigitavel { get; set; }
        public string? QrCode { get; set; }
        public string? UrlPagamento { get; set; }
        public DateTime? DataVencimento { get; set; }
    }

    public class AtualizarStatusFaturaRequest
    {
        public string Status { get; set; } = string.Empty;
        public DateTime? DataBaixa { get; set; }
    }

    [HttpGet("faturas")]
    public async Task<ActionResult<IEnumerable<DocumentoCobranca>>> ListarFaturas(
        [FromQuery] Guid? organizacaoId,
        [FromQuery] string? status)
    {
        var query = _db.DocumentosCobranca.AsNoTracking().AsQueryable();

        if (organizacaoId.HasValue)
        {
            query = query.Where(f => f.OrganizacaoId == organizacaoId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusNormalizado = status.Trim().ToLowerInvariant();
            query = query.Where(f => f.Status == statusNormalizado);
        }

        var itens = await query
            .OrderByDescending(f => f.DataEmissao)
            .ThenByDescending(f => f.DataVencimento)
            .ToListAsync();

        return Ok(itens);
    }

    [HttpGet("faturas/{id:guid}")]
    public async Task<ActionResult<DocumentoCobranca>> ObterFatura(
        Guid id,
        [FromQuery] Guid? organizacaoId)
    {
        var item = await _db.DocumentosCobranca
            .AsNoTracking()
            .FirstOrDefaultAsync(f =>
                f.Id == id &&
                (!organizacaoId.HasValue || f.OrganizacaoId == organizacaoId.Value));

        if (item is null)
        {
            return NotFound();
        }

        return Ok(item);
    }

    [HttpPost("faturas")]
    public async Task<ActionResult<DocumentoCobranca>> CriarFatura(CriarFaturaRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        if (request.LancamentoFinanceiroId == Guid.Empty)
        {
            return BadRequest("Lancamento financeiro e obrigatorio.");
        }

        var lancamento = await _db.LancamentosFinanceiros
            .FirstOrDefaultAsync(l =>
                l.Id == request.LancamentoFinanceiroId &&
                l.OrganizacaoId == request.OrganizacaoId);

        if (lancamento is null)
        {
            return NotFound("Lancamento financeiro nao encontrado.");
        }

        if (!string.Equals(lancamento.Tipo, "receber", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Faturas so podem ser geradas para lancamentos do tipo receber.");
        }

        var existeFaturaAtiva = await _db.DocumentosCobranca
            .AsNoTracking()
            .AnyAsync(f =>
                f.LancamentoFinanceiroId == request.LancamentoFinanceiroId &&
                f.Status != "cancelada");

        if (existeFaturaAtiva)
        {
            return BadRequest("Ja existe fatura ativa para este lancamento.");
        }

        var dataVencimento = request.DataVencimento?.Date
            ?? lancamento.DataVencimento?.Date
            ?? DateTime.UtcNow.Date;

        var statusInicial = string.Equals(lancamento.Situacao, "pago", StringComparison.OrdinalIgnoreCase)
            ? "paga"
            : (dataVencimento < DateTime.UtcNow.Date ? "vencida" : "emitida");

        var fatura = new DocumentoCobranca
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            LancamentoFinanceiroId = request.LancamentoFinanceiroId,
            Tipo = string.IsNullOrWhiteSpace(request.Tipo) ? "boleto" : request.Tipo.Trim().ToLowerInvariant(),
            IdentificadorExterno = string.IsNullOrWhiteSpace(request.IdentificadorExterno)
                ? null
                : request.IdentificadorExterno.Trim(),
            LinhaDigitavel = string.IsNullOrWhiteSpace(request.LinhaDigitavel)
                ? null
                : request.LinhaDigitavel.Trim(),
            QrCode = string.IsNullOrWhiteSpace(request.QrCode) ? null : request.QrCode.Trim(),
            UrlPagamento = string.IsNullOrWhiteSpace(request.UrlPagamento)
                ? null
                : request.UrlPagamento.Trim(),
            Status = statusInicial,
            DataEmissao = DateTime.UtcNow,
            DataVencimento = dataVencimento,
            DataBaixa = statusInicial == "paga"
                ? (lancamento.DataPagamento ?? DateTime.UtcNow)
                : null
        };

        _db.DocumentosCobranca.Add(fatura);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ObterFatura), new { id = fatura.Id }, fatura);
    }

    [HttpPatch("faturas/{id:guid}/status")]
    public async Task<IActionResult> AtualizarStatusFatura(Guid id, AtualizarStatusFaturaRequest request)
    {
        var fatura = await _db.DocumentosCobranca.FindAsync(id);
        if (fatura is null)
        {
            return NotFound();
        }

        var status = request.Status?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(status))
        {
            return BadRequest("Status e obrigatorio.");
        }

        if (status is not ("emitida" or "vencida" or "paga" or "cancelada"))
        {
            return BadRequest("Status invalido. Use emitida, vencida, paga ou cancelada.");
        }

        if (status == "paga")
        {
            var dataBaixa = request.DataBaixa?.Date ?? DateTime.UtcNow;
            var lancamento = await _db.LancamentosFinanceiros.FindAsync(fatura.LancamentoFinanceiroId);
            if (lancamento is not null)
            {
                if (string.Equals(lancamento.Situacao, "cancelado", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest("Nao e possivel dar baixa em fatura com lancamento cancelado.");
                }

                lancamento.Situacao = "pago";
                lancamento.DataPagamento = dataBaixa;
            }

            fatura.DataBaixa = dataBaixa;
        }
        else
        {
            fatura.DataBaixa = null;
        }

        fatura.Status = status;
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
