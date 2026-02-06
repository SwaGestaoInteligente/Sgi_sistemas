using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Auth;
using Sgi.Domain.Core;
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
    private readonly IWebHostEnvironment _env;

    private const string SituacaoAberto = "aberto";
    private const string SituacaoAprovado = "aprovado";
    private const string SituacaoPago = "pago";
    private const string SituacaoConciliado = "conciliado";
    private const string SituacaoFechado = "fechado";
    private const string SituacaoCancelado = "cancelado";

    public FinanceiroController(SgiDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    private static string NormalizarSituacao(string? situacao)
    {
        if (string.IsNullOrWhiteSpace(situacao))
        {
            return string.Empty;
        }

        var normalizada = situacao.Trim().ToLowerInvariant();
        return normalizada == "pendente" ? SituacaoAberto : normalizada;
    }

    private void RegistrarAudit(Guid organizacaoId, Guid entidadeId, string entidade, string acao, object? detalhes = null)
    {
        var userId = Authz.GetUserId(User);
        _db.FinanceAudits.Add(new FinanceAudit
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = organizacaoId,
            UsuarioId = userId,
            Entidade = entidade,
            EntidadeId = entidadeId,
            Acao = acao,
            Detalhes = detalhes is null ? null : JsonSerializer.Serialize(detalhes),
            DataHora = DateTime.UtcNow
        });
    }

    private async Task<AuthzResult> EnsureRoleAsync(Guid organizacaoId, params UserRole[] roles)
        => await Authz.EnsureMembershipAsync(_db, User, organizacaoId, roles);

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
        RegistrarAudit(model.OrganizacaoId, model.Id, "ContaFinanceira", "CRIAR_CONTA", new
        {
            model.Nome,
            model.Tipo,
            model.Banco,
            model.Agencia,
            model.NumeroConta
        });
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
        var auth = await EnsureRoleAsync(conta.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var temLancamentos = await _db.LancamentosFinanceiros
            .AsNoTracking()
            .AnyAsync(l => l.ContaFinanceiraId == id);

        if (temLancamentos)
        {
            return BadRequest("Não é possível excluir a conta porque ela já possui lançamentos. Desative a conta em vez de excluir.");
        }

        _db.ContasFinanceiras.Remove(conta);
        RegistrarAudit(conta.OrganizacaoId, conta.Id, "ContaFinanceira", "REMOVER_CONTA", new
        {
            conta.Nome,
            conta.NumeroConta
        });
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
        var auth = await EnsureRoleAsync(conta.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Status))
        {
            return BadRequest("Status é obrigatório.");
        }

        conta.Status = request.Status;
        RegistrarAudit(conta.OrganizacaoId, conta.Id, "ContaFinanceira", "ATUALIZAR_STATUS_CONTA", new
        {
            Status = request.Status
        });
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
        RegistrarAudit(request.OrganizacaoId, lancamentoSaida.Id, "LancamentoFinanceiro", "TRANSFERENCIA", new
        {
            LancamentoSaidaId = lancamentoSaida.Id,
            LancamentoEntradaId = lancamentoEntrada.Id,
            request.ContaOrigemId,
            request.ContaDestinoId,
            request.Valor,
            Referencia = referencia
        });
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
            var situacaoNormalizada = NormalizarSituacao(situacao);
            if (situacaoNormalizada == SituacaoAberto)
            {
                query = query.Where(l => l.Situacao == SituacaoAberto || l.Situacao == "pendente");
            }
            else
            {
                query = query.Where(l => l.Situacao == situacaoNormalizada);
            }
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

        var situacaoInicial = NormalizarSituacao(model.Situacao);
        if (string.IsNullOrWhiteSpace(situacaoInicial))
        {
            situacaoInicial = SituacaoAberto;
        }

        if (situacaoInicial is not (SituacaoAberto or SituacaoAprovado or SituacaoPago or SituacaoConciliado or SituacaoFechado or SituacaoCancelado))
        {
            return BadRequest("Situação inválida. Use aberto, aprovado, pago, conciliado, fechado ou cancelado.");
        }

        if (situacaoInicial == SituacaoFechado)
        {
            return BadRequest("Não é possível criar lançamento já fechado.");
        }

        model.Situacao = situacaoInicial;

        if (model.Situacao == SituacaoPago && !model.DataPagamento.HasValue)
        {
            model.DataPagamento = DateTime.UtcNow;
        }

        model.Id = Guid.NewGuid();
        _db.LancamentosFinanceiros.Add(model);
        RegistrarAudit(model.OrganizacaoId, model.Id, "LancamentoFinanceiro", "CRIAR_LANCAMENTO", new
        {
            model.Tipo,
            model.Situacao,
            model.Descricao,
            model.Valor
        });
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
            .Where(l => l.Tipo == "pagar" && NormalizarSituacao(l.Situacao) is SituacaoAberto or SituacaoAprovado)
            .Sum(l => l.Valor);
        var totalReceber = itens
            .Where(l => l.Tipo == "receber" && NormalizarSituacao(l.Situacao) is SituacaoAberto or SituacaoAprovado)
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

        var situacaoAtual = NormalizarSituacao(lancamento.Situacao);

        if (situacaoAtual == SituacaoFechado)
        {
            return BadRequest("Não é possível pagar um lançamento fechado.");
        }

        if (situacaoAtual == SituacaoCancelado)
        {
            return BadRequest("Não é possível pagar um lançamento cancelado.");
        }

        if (situacaoAtual == SituacaoPago)
        {
            return BadRequest("Lançamento já está marcado como pago.");
        }

        if (situacaoAtual != SituacaoAprovado)
        {
            return BadRequest("Aprovação é obrigatória antes do pagamento.");
        }

        lancamento.Situacao = SituacaoPago;
        if (!lancamento.DataPagamento.HasValue)
        {
            lancamento.DataPagamento = DateTime.UtcNow;
        }

        RegistrarAudit(lancamento.OrganizacaoId, lancamento.Id, "LancamentoFinanceiro", "PAGAR_LANCAMENTO", new
        {
            lancamento.Descricao,
            lancamento.Valor
        });
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

        var situacaoAtual = NormalizarSituacao(lancamento.Situacao);

        if (situacaoAtual == SituacaoFechado)
        {
            return BadRequest("Não é possível cancelar um lançamento fechado.");
        }

        if (situacaoAtual == SituacaoPago)
        {
            return BadRequest("Não é possível cancelar um lançamento já pago.");
        }

        if (situacaoAtual == SituacaoCancelado)
        {
            return BadRequest("Lançamento já está cancelado.");
        }

        if (situacaoAtual is not (SituacaoAberto or SituacaoAprovado))
        {
            return BadRequest("Lançamento não pode ser cancelado nesta etapa.");
        }

        lancamento.Situacao = SituacaoCancelado;
        lancamento.DataPagamento = null;

        RegistrarAudit(lancamento.OrganizacaoId, lancamento.Id, "LancamentoFinanceiro", "CANCELAR_LANCAMENTO", new
        {
            lancamento.Descricao,
            lancamento.Valor
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("lancamentos/{id:guid}/aprovar")]
    public async Task<IActionResult> AprovarLancamento(Guid id)
    {
        var lancamento = await _db.LancamentosFinanceiros.FindAsync(id);
        if (lancamento is null)
        {
            return NotFound();
        }

        var auth = await EnsureRoleAsync(lancamento.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var situacaoAtual = NormalizarSituacao(lancamento.Situacao);
        if (situacaoAtual == SituacaoFechado)
        {
            return BadRequest("Não é possível aprovar um lançamento fechado.");
        }

        if (situacaoAtual == SituacaoCancelado)
        {
            return BadRequest("Não é possível aprovar um lançamento cancelado.");
        }

        if (situacaoAtual != SituacaoAberto)
        {
            return BadRequest("Apenas lançamentos em aberto podem ser aprovados.");
        }

        lancamento.Situacao = SituacaoAprovado;
        RegistrarAudit(lancamento.OrganizacaoId, lancamento.Id, "LancamentoFinanceiro", "APROVAR_LANCAMENTO", new
        {
            lancamento.Descricao,
            lancamento.Valor
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("lancamentos/{id:guid}/conciliar")]
    public async Task<IActionResult> ConciliarLancamento(Guid id)
    {
        var lancamento = await _db.LancamentosFinanceiros.FindAsync(id);
        if (lancamento is null)
        {
            return NotFound();
        }

        var auth = await EnsureRoleAsync(
            lancamento.OrganizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var situacaoAtual = NormalizarSituacao(lancamento.Situacao);
        if (situacaoAtual == SituacaoFechado)
        {
            return BadRequest("Não é possível conciliar um lançamento fechado.");
        }

        if (situacaoAtual == SituacaoCancelado)
        {
            return BadRequest("Não é possível conciliar um lançamento cancelado.");
        }

        if (situacaoAtual != SituacaoPago)
        {
            return BadRequest("Somente lançamentos pagos podem ser conciliados.");
        }

        lancamento.Situacao = SituacaoConciliado;
        RegistrarAudit(lancamento.OrganizacaoId, lancamento.Id, "LancamentoFinanceiro", "CONCILIAR_LANCAMENTO", new
        {
            lancamento.Descricao,
            lancamento.Valor
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("lancamentos/{id:guid}/fechar")]
    public async Task<IActionResult> FecharLancamento(Guid id)
    {
        var lancamento = await _db.LancamentosFinanceiros.FindAsync(id);
        if (lancamento is null)
        {
            return NotFound();
        }

        var auth = await EnsureRoleAsync(lancamento.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var situacaoAtual = NormalizarSituacao(lancamento.Situacao);
        if (situacaoAtual == SituacaoFechado)
        {
            return BadRequest("Lançamento já está fechado.");
        }

        if (situacaoAtual != SituacaoConciliado)
        {
            return BadRequest("Somente lançamentos conciliados podem ser fechados.");
        }

        lancamento.Situacao = SituacaoFechado;
        RegistrarAudit(lancamento.OrganizacaoId, lancamento.Id, "LancamentoFinanceiro", "FECHAR_LANCAMENTO", new
        {
            lancamento.Descricao,
            lancamento.Valor
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("lancamentos/{id:guid}/reabrir")]
    public async Task<IActionResult> ReabrirLancamento(Guid id)
    {
        var lancamento = await _db.LancamentosFinanceiros.FindAsync(id);
        if (lancamento is null)
        {
            return NotFound();
        }

        var auth = await EnsureRoleAsync(lancamento.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!auth.IsPlatformAdmin)
        {
            return Forbid();
        }

        var situacaoAtual = NormalizarSituacao(lancamento.Situacao);
        if (situacaoAtual != SituacaoFechado)
        {
            return BadRequest("Apenas lançamentos fechados podem ser reabertos.");
        }

        lancamento.Situacao = SituacaoAberto;
        RegistrarAudit(lancamento.OrganizacaoId, lancamento.Id, "LancamentoFinanceiro", "REABRIR_LANCAMENTO", new
        {
            lancamento.Descricao,
            lancamento.Valor
        });
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

        var situacaoLancamento = NormalizarSituacao(lancamento.Situacao);
        var statusInicial = situacaoLancamento is SituacaoPago or SituacaoConciliado or SituacaoFechado
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
                var situacaoAtual = NormalizarSituacao(lancamento.Situacao);
                if (situacaoAtual == SituacaoCancelado)
                {
                    return BadRequest("Nao e possivel dar baixa em fatura com lancamento cancelado.");
                }

                if (situacaoAtual == SituacaoFechado)
                {
                    return BadRequest("Nao e possivel dar baixa em fatura com lancamento fechado.");
                }

                if (situacaoAtual == SituacaoAberto)
                {
                    lancamento.Situacao = SituacaoAprovado;
                }

                lancamento.Situacao = SituacaoPago;
                lancamento.DataPagamento = dataBaixa;
                RegistrarAudit(lancamento.OrganizacaoId, lancamento.Id, "LancamentoFinanceiro", "PAGAR_LANCAMENTO", new
                {
                    lancamento.Descricao,
                    lancamento.Valor
                });
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

    // ---------------------------
    // Uploads e conciliação bancária
    // ---------------------------

    public class UploadFinanceiroResponse
    {
        public string NomeArquivo { get; set; } = string.Empty;
        public string Caminho { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
    }

    [HttpPost("uploads")]
    [RequestSizeLimit(25_000_000)]
    public async Task<ActionResult<UploadFinanceiroResponse>> UploadFinanceiro(
        [FromForm] Guid organizacaoId,
        [FromForm] string tipo,
        [FromForm] IFormFile arquivo)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organização é obrigatória.");
        }

        if (arquivo is null || arquivo.Length == 0)
        {
            return BadRequest("Arquivo é obrigatório.");
        }

        var tipoNormalizado = string.IsNullOrWhiteSpace(tipo) ? "geral" : tipo.Trim().ToLowerInvariant();
        var uploadsRoot = Path.Combine(_env.ContentRootPath, "Uploads", "Financeiro", organizacaoId.ToString(), tipoNormalizado);
        Directory.CreateDirectory(uploadsRoot);

        var safeFileName = Path.GetFileName(arquivo.FileName);
        var uniqueName = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}-{safeFileName}";
        var filePath = Path.Combine(uploadsRoot, uniqueName);

        await using (var stream = System.IO.File.Create(filePath))
        {
            await arquivo.CopyToAsync(stream);
        }

        RegistrarAudit(organizacaoId, Guid.NewGuid(), "FinanceUpload", "UPLOAD_FINANCEIRO", new
        {
            Arquivo = safeFileName,
            Tipo = tipoNormalizado
        });
        await _db.SaveChangesAsync();

        return Ok(new UploadFinanceiroResponse
        {
            NomeArquivo = safeFileName,
            Caminho = filePath,
            Tipo = tipoNormalizado
        });
    }

    public record ExtratoItemDto(
        int Index,
        DateTime Data,
        string Descricao,
        decimal Valor,
        string? Documento,
        Guid? SugestaoLancamentoId,
        string? SugestaoDescricao);

    public record ConciliacaoImportResponse(
        string Arquivo,
        int Total,
        IEnumerable<ExtratoItemDto> Itens);

    [HttpPost("conciliacao/importar")]
    [RequestSizeLimit(25_000_000)]
    public async Task<ActionResult<ConciliacaoImportResponse>> ImportarExtrato(
        [FromForm] Guid organizacaoId,
        [FromForm] IFormFile arquivo)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organização é obrigatória.");
        }

        if (arquivo is null || arquivo.Length == 0)
        {
            return BadRequest("Arquivo é obrigatório.");
        }

        string content;
        await using (var stream = arquivo.OpenReadStream())
        using (var reader = new StreamReader(stream, Encoding.UTF8, true))
        {
            content = await reader.ReadToEndAsync();
        }

        var itensBase = Path.GetExtension(arquivo.FileName).Equals(".ofx", StringComparison.OrdinalIgnoreCase)
            ? ParseOfx(content)
            : ParseCsv(content);

        var itens = await SugerirLancamentosAsync(organizacaoId, itensBase);

        RegistrarAudit(organizacaoId, Guid.NewGuid(), "ConciliacaoBancaria", "IMPORTAR_EXTRATO", new
        {
            Arquivo = arquivo.FileName,
            Total = itens.Count
        });
        await _db.SaveChangesAsync();

        return Ok(new ConciliacaoImportResponse(arquivo.FileName, itens.Count, itens));
    }

    public class ConfirmarConciliacaoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public DateTime? DataConciliacao { get; set; }
        public string? Referencia { get; set; }
        public string? Documento { get; set; }
    }

    [HttpPost("conciliacao/{id:guid}/confirmar")]
    public async Task<IActionResult> ConfirmarConciliacao(Guid id, ConfirmarConciliacaoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organização é obrigatória.");
        }

        var auth = await EnsureRoleAsync(
            request.OrganizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var lancamento = await _db.LancamentosFinanceiros.FindAsync(id);
        if (lancamento is null || lancamento.OrganizacaoId != request.OrganizacaoId)
        {
            return NotFound();
        }

        var situacaoAtual = NormalizarSituacao(lancamento.Situacao);
        if (situacaoAtual == SituacaoFechado)
        {
            return BadRequest("Não é possível conciliar um lançamento fechado.");
        }

        if (situacaoAtual == SituacaoCancelado)
        {
            return BadRequest("Não é possível conciliar um lançamento cancelado.");
        }

        if (situacaoAtual != SituacaoPago)
        {
            return BadRequest("Somente lançamentos pagos podem ser conciliados.");
        }

        lancamento.Situacao = SituacaoConciliado;
        if (!lancamento.DataPagamento.HasValue)
        {
            lancamento.DataPagamento = request.DataConciliacao ?? DateTime.UtcNow;
        }

        if (!string.IsNullOrWhiteSpace(request.Referencia))
        {
            lancamento.Referencia = request.Referencia.Trim();
        }

        RegistrarAudit(lancamento.OrganizacaoId, lancamento.Id, "LancamentoFinanceiro", "CONCILIAR_LANCAMENTO", new
        {
            lancamento.Descricao,
            lancamento.Valor,
            request.Documento
        });

        await _db.SaveChangesAsync();

        return NoContent();
    }

    private record ExtratoItemBase(
        int Index,
        DateTime Data,
        string Descricao,
        decimal Valor,
        string? Documento);

    private static List<ExtratoItemBase> ParseCsv(string content)
    {
        var lines = content
            .Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)
            .Select(l => l.Trim())
            .Where(l => !string.IsNullOrWhiteSpace(l))
            .ToList();

        if (lines.Count == 0)
        {
            return new List<ExtratoItemBase>();
        }

        var delimiter = lines[0].Count(c => c == ';') >= lines[0].Count(c => c == ',') ? ';' : ',';
        var header = lines[0].ToLowerInvariant();
        var hasHeader = header.Contains("data") || header.Contains("valor") || header.Contains("descricao") || header.Contains("hist");

        var startIndex = hasHeader ? 1 : 0;
        var headers = hasHeader ? lines[0].Split(delimiter) : Array.Empty<string>();

        int ColIndex(string[] cols, params string[] keys)
        {
            for (var i = 0; i < cols.Length; i++)
            {
                var h = cols[i].ToLowerInvariant();
                if (keys.Any(k => h.Contains(k)))
                {
                    return i;
                }
            }
            return -1;
        }

        var idxData = hasHeader ? ColIndex(headers, "data") : 0;
        var idxDesc = hasHeader ? ColIndex(headers, "descricao", "hist", "memo", "descricao") : 1;
        var idxValor = hasHeader ? ColIndex(headers, "valor", "montante", "amount") : -1;
        var idxDoc = hasHeader ? ColIndex(headers, "documento", "doc", "id") : -1;

        var itens = new List<ExtratoItemBase>();
        for (var i = startIndex; i < lines.Count; i++)
        {
            var parts = lines[i].Split(delimiter);
            if (parts.Length < 2)
            {
                continue;
            }

            var dataRaw = idxData >= 0 && idxData < parts.Length ? parts[idxData] : parts[0];
            var descRaw = idxDesc >= 0 && idxDesc < parts.Length ? parts[idxDesc] : parts.Length > 1 ? parts[1] : "";
            var valorRaw = idxValor >= 0 && idxValor < parts.Length ? parts[idxValor] : parts[^1];
            var docRaw = idxDoc >= 0 && idxDoc < parts.Length ? parts[idxDoc] : null;

            if (!TryParseDate(dataRaw, out var data))
            {
                continue;
            }

            if (!TryParseDecimal(valorRaw ?? string.Empty, out var valor))
            {
                continue;
            }

            itens.Add(new ExtratoItemBase(i - startIndex + 1, data, descRaw.Trim(), valor, docRaw?.Trim()));
        }

        return itens;
    }

    private static List<ExtratoItemBase> ParseOfx(string content)
    {
        var itens = new List<ExtratoItemBase>();
        var blocks = content.Split("<STMTTRN>", StringSplitOptions.RemoveEmptyEntries);
        var index = 1;

        foreach (var block in blocks)
        {
            if (!block.Contains("<TRNAMT>", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var dataRaw = ExtractTag(block, "DTPOSTED");
            var valorRaw = ExtractTag(block, "TRNAMT");
            var memo = ExtractTag(block, "MEMO") ?? ExtractTag(block, "NAME") ?? "Movimento bancário";
            var doc = ExtractTag(block, "FITID");

            if (!TryParseOfxDate(dataRaw, out var data))
            {
                continue;
            }

            if (!TryParseDecimal(valorRaw ?? string.Empty, out var valor))
            {
                continue;
            }

            itens.Add(new ExtratoItemBase(index++, data, memo.Trim(), valor, doc?.Trim()));
        }

        return itens;
    }

    private async Task<List<ExtratoItemDto>> SugerirLancamentosAsync(Guid organizacaoId, List<ExtratoItemBase> itens)
    {
        if (itens.Count == 0)
        {
            return new List<ExtratoItemDto>();
        }

        var minDate = itens.Min(i => i.Data).AddDays(-5);
        var maxDate = itens.Max(i => i.Data).AddDays(5);

        var candidatos = await _db.LancamentosFinanceiros
            .AsNoTracking()
            .Where(l => l.OrganizacaoId == organizacaoId)
            .Where(l => l.DataCompetencia >= minDate && l.DataCompetencia <= maxDate)
            .ToListAsync();

        var resposta = new List<ExtratoItemDto>();
        foreach (var item in itens)
        {
            var tipoEsperado = item.Valor < 0 ? "pagar" : "receber";
            var valorAbs = Math.Abs(item.Valor);

            var sugestao = candidatos
                .Select(c => new
                {
                    Lancamento = c,
                    Situacao = NormalizarSituacao(c.Situacao),
                    DataBase = c.DataPagamento ?? c.DataCompetencia
                })
                .Where(c => c.Situacao == SituacaoPago)
                .Where(c => string.Equals(c.Lancamento.Tipo, tipoEsperado, StringComparison.OrdinalIgnoreCase))
                .Where(c => Math.Abs(c.Lancamento.Valor - valorAbs) <= 0.01m)
                .OrderBy(c => Math.Abs((c.DataBase.Date - item.Data.Date).TotalDays))
                .FirstOrDefault();

            resposta.Add(new ExtratoItemDto(
                item.Index,
                item.Data,
                item.Descricao,
                item.Valor,
                item.Documento,
                sugestao?.Lancamento.Id,
                sugestao?.Lancamento.Descricao));
        }

        return resposta;
    }

    private static bool TryParseDate(string raw, out DateTime data)
    {
        raw = raw.Trim();
        var formats = new[] { "dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy", "dd-MM-yyyy" };
        return DateTime.TryParseExact(raw, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out data)
               || DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out data);
    }

    private static bool TryParseOfxDate(string? raw, out DateTime data)
    {
        data = default;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        raw = raw.Trim();
        if (raw.Length >= 8 && DateTime.TryParseExact(raw.Substring(0, 8), "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out data))
        {
            return true;
        }

        return DateTime.TryParse(raw, out data);
    }

    private static bool TryParseDecimal(string raw, out decimal value)
    {
        value = 0;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var sanitized = raw
            .Replace("R$", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace(" ", string.Empty)
            .Replace("\t", string.Empty);

        if (sanitized.Contains(',') && sanitized.Contains('.'))
        {
            sanitized = sanitized.Replace(".", string.Empty).Replace(",", ".");
        }
        else if (sanitized.Contains(','))
        {
            sanitized = sanitized.Replace(",", ".");
        }

        return decimal.TryParse(sanitized, NumberStyles.Any, CultureInfo.InvariantCulture, out value);
    }

    private static string? ExtractTag(string block, string tag)
    {
        var open = $"<{tag}>";
        var start = block.IndexOf(open, StringComparison.OrdinalIgnoreCase);
        if (start < 0)
        {
            return null;
        }

        start += open.Length;
        var end = block.IndexOf('<', start);
        if (end < 0)
        {
            end = block.Length;
        }

        return block.Substring(start, end - start).Trim();
    }
}
