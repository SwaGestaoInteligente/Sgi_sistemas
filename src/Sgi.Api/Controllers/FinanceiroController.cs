using System.Globalization;
using System.Security.Cryptography;
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

    private static readonly HashSet<string> StatusCobrancaValidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "ABERTA",
        "PAGA",
        "ATRASADA",
        "NEGOCIADA",
        "CANCELADA",
        "FECHADA"
    };

    private const string CorrecaoTipoPadrao = "PERCENTUAL_FIXO";

    private static readonly HashSet<string> CorrecaoTiposValidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "PERCENTUAL_FIXO",
        "IPCA",
        "IGPM",
        "INPC",
        "CDI",
        "SEM_CORRECAO",
        "OUTRO"
    };

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

    private static string NormalizarStatusCobranca(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return "ABERTA";
        }

        var normalizado = status.Trim().ToUpperInvariant();
        return StatusCobrancaValidos.Contains(normalizado) ? normalizado : "ABERTA";
    }

    private static string NormalizarCorrecaoTipo(string? tipo)
    {
        if (string.IsNullOrWhiteSpace(tipo))
        {
            return CorrecaoTipoPadrao;
        }

        var normalizado = tipo.Trim().ToUpperInvariant();
        return CorrecaoTiposValidos.Contains(normalizado) ? normalizado : CorrecaoTipoPadrao;
    }

    private static string GerarIdentificadorExternoFicticio(Guid id)
        => $"TESTE-{id.ToString("N")[..12].ToUpperInvariant()}";

    private static string GerarLinhaDigitavelFicticia(Guid id)
    {
        var digitos = GerarDigitosBase(id, 47);
        return $"{digitos[..5]}.{digitos.Substring(5, 5)} " +
               $"{digitos.Substring(10, 5)}.{digitos.Substring(15, 6)} " +
               $"{digitos.Substring(21, 5)}.{digitos.Substring(26, 6)} " +
               $"{digitos[32]} {digitos.Substring(33, 14)}";
    }

    private static string GerarQrCodePixFicticio(Guid id, decimal valor)
    {
        var chave = $"TESTE-{id.ToString("N")[..25].ToUpperInvariant()}";
        var merchantName = "SGI TESTE";
        var merchantCity = "TESTE";
        var txId = $"T{id.ToString("N")[..8].ToUpperInvariant()}";
        var valorTexto = Math.Max(0m, valor).ToString("0.00", CultureInfo.InvariantCulture);

        var payloadSemCrc = string.Concat(
            "000201",
            "010212",
            MontarCampo("26", MontarCampo("00", "BR.GOV.BCB.PIX") + MontarCampo("01", chave)),
            MontarCampo("52", "0000"),
            MontarCampo("53", "986"),
            MontarCampo("54", valorTexto),
            MontarCampo("58", "BR"),
            MontarCampo("59", merchantName),
            MontarCampo("60", merchantCity),
            MontarCampo("62", MontarCampo("05", txId)),
            "6304");

        var crc = CalcularCrc16(payloadSemCrc);
        return payloadSemCrc + crc;
    }

    private static string GerarUrlPagamentoFicticia(string tipo, Guid id)
        => $"https://pagamento.teste.local/{tipo}/{id.ToString("N")}";

    private static string MontarCampo(string id, string valor)
        => $"{id}{valor.Length:00}{valor}";

    private static string GerarDigitosBase(Guid id, int tamanho)
    {
        var raw = id.ToString("N");
        var sb = new StringBuilder(tamanho);
        foreach (var ch in raw)
        {
            if (char.IsDigit(ch))
            {
                sb.Append(ch);
            }
            else
            {
                sb.Append(((int)ch % 10).ToString(CultureInfo.InvariantCulture));
            }
        }

        while (sb.Length < tamanho)
        {
            sb.Append((sb.Length % 10).ToString(CultureInfo.InvariantCulture));
        }

        if (sb.Length > tamanho)
        {
            sb.Length = tamanho;
        }

        return sb.ToString();
    }

    private static string CalcularCrc16(string payload)
    {
        const ushort polinomio = 0x1021;
        ushort resultado = 0xFFFF;

        foreach (var ch in payload)
        {
            resultado ^= (ushort)(ch << 8);
            for (var i = 0; i < 8; i++)
            {
                if ((resultado & 0x8000) != 0)
                {
                    resultado = (ushort)((resultado << 1) ^ polinomio);
                }
                else
                {
                    resultado <<= 1;
                }
            }
        }

        return resultado.ToString("X4", CultureInfo.InvariantCulture);
    }

    private record CobrancaEncargos(
        decimal ValorAtualizado,
        decimal Multa,
        decimal Juros,
        decimal Correcao,
        int DiasAtraso);

    private static CobrancaEncargos CalcularEncargos(
        decimal valor,
        DateTime vencimento,
        PoliticaCobranca politica,
        decimal correcaoMensalPercentual)
    {
        var hoje = DateTime.UtcNow.Date;
        var diasAtraso = Math.Max(0, (int)(hoje - vencimento.Date).TotalDays);
        if (!politica.Ativo || diasAtraso <= politica.DiasCarencia)
        {
            return new CobrancaEncargos(valor, 0m, 0m, 0m, diasAtraso);
        }

        var diasAplicados = diasAtraso - politica.DiasCarencia;
        var multa = Math.Round(valor * (politica.MultaPercentual / 100m), 2, MidpointRounding.AwayFromZero);
        var juros = Math.Round(valor * (politica.JurosMensalPercentual / 100m) * (diasAplicados / 30m), 2, MidpointRounding.AwayFromZero);
        var correcao = Math.Round(valor * (correcaoMensalPercentual / 100m) * (diasAplicados / 30m), 2, MidpointRounding.AwayFromZero);
        var total = Math.Round(valor + multa + juros + correcao, 2, MidpointRounding.AwayFromZero);

        return new CobrancaEncargos(total, multa, juros, correcao, diasAtraso);
    }

    private async Task<decimal> ObterCreditoDisponivelAsync(Guid unidadeId)
    {
        var movimentos = await _db.UnidadesCreditos.AsNoTracking()
            .Where(m => m.UnidadeOrganizacionalId == unidadeId && m.EstornadoEm == null)
            .Select(m => m.Valor)
            .ToListAsync();
        return movimentos.Sum();
    }

    private async Task<PoliticaCobranca> ObterPoliticaCobrancaAsync(Guid organizacaoId)
    {
        var politica = await _db.PoliticasCobranca.AsNoTracking()
            .FirstOrDefaultAsync(p => p.OrganizacaoId == organizacaoId && p.Ativo);
        if (politica is not null)
        {
            politica.CorrecaoTipo = NormalizarCorrecaoTipo(politica.CorrecaoTipo);
            if (!string.Equals(politica.CorrecaoTipo, "OUTRO", StringComparison.OrdinalIgnoreCase))
            {
                politica.CorrecaoIndice = null;
            }
            return politica;
        }

        return new PoliticaCobranca
        {
            OrganizacaoId = organizacaoId,
            MultaPercentual = 0m,
            JurosMensalPercentual = 0m,
            CorrecaoMensalPercentual = 0m,
            CorrecaoTipo = CorrecaoTipoPadrao,
            CorrecaoIndice = null,
            DiasCarencia = 0,
            Ativo = true,
            AtualizadoEm = DateTime.UtcNow
        };
    }

    private async Task<decimal> ObterCorrecaoPercentualAsync(
        PoliticaCobranca politica,
        DateTime referencia)
    {
        var tipo = NormalizarCorrecaoTipo(politica.CorrecaoTipo);
        if (string.Equals(tipo, "SEM_CORRECAO", StringComparison.OrdinalIgnoreCase))
        {
            return 0m;
        }

        if (string.Equals(tipo, "PERCENTUAL_FIXO", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(tipo, "OUTRO", StringComparison.OrdinalIgnoreCase))
        {
            return politica.CorrecaoMensalPercentual;
        }

        var ano = referencia.Year;
        var mes = referencia.Month;

        var indice = await _db.IndicesEconomicos.AsNoTracking()
            .Where(i => i.Tipo == tipo && (i.Ano < ano || (i.Ano == ano && i.Mes <= mes)))
            .OrderByDescending(i => i.Ano)
            .ThenByDescending(i => i.Mes)
            .Select(i => (decimal?)i.ValorPercentual)
            .FirstOrDefaultAsync();

        return indice ?? politica.CorrecaoMensalPercentual;
    }

    private async Task AplicarCreditoAutomaticoAsync(UnidadeCobranca cobranca)
    {
        if (string.Equals(cobranca.Status, "PAGA", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var creditoDisponivel = await ObterCreditoDisponivelAsync(cobranca.UnidadeOrganizacionalId);
        if (creditoDisponivel <= 0)
        {
            return;
        }

        var valorAplicar = Math.Round(Math.Min(creditoDisponivel, cobranca.Valor), 2, MidpointRounding.AwayFromZero);
        if (valorAplicar <= 0)
        {
            return;
        }

        var dataPagamento = DateTime.UtcNow;
        var pagamento = new UnidadePagamento
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = cobranca.OrganizacaoId,
            CobrancaId = cobranca.Id,
            ValorPago = valorAplicar,
            DataPagamento = dataPagamento,
            Observacao = "Credito automatico"
        };
        _db.UnidadesPagamentos.Add(pagamento);

        _db.UnidadesCreditos.Add(new UnidadeCreditoMovimento
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = cobranca.OrganizacaoId,
            UnidadeOrganizacionalId = cobranca.UnidadeOrganizacionalId,
            CobrancaId = cobranca.Id,
            PagamentoId = pagamento.Id,
            Tipo = "uso",
            Valor = -valorAplicar,
            DataMovimento = dataPagamento,
            Observacao = "Aplicacao automatica de credito"
        });

        if (valorAplicar >= cobranca.Valor)
        {
            cobranca.Status = "PAGA";
            cobranca.PagoEm = dataPagamento;
        }
        else
        {
            cobranca.Status = "ABERTA";
        }
    }

    private void RegistrarAudit(Guid organizacaoId, Guid entidadeId, string entidade, string acao, object? detalhes = null)
    {
        var userId = Authz.GetUserId(User);
        var pessoaId = Authz.GetPessoaId(User);
        var now = DateTime.UtcNow;
        _db.FinanceAudits.Add(new FinanceAudit
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = organizacaoId,
            UsuarioId = userId,
            Entidade = entidade,
            EntidadeId = entidadeId,
            Acao = acao,
            Detalhes = detalhes is null ? null : JsonSerializer.Serialize(detalhes),
            DataHora = now
        });

        var payload = new
        {
            PessoaId = pessoaId,
            Detalhes = detalhes
        };

        _db.LogsAuditoria.Add(new LogAuditoria
        {
            Id = Guid.NewGuid(),
            UsuarioId = userId,
            OrganizacaoId = organizacaoId,
            Entidade = entidade,
            EntidadeId = entidadeId,
            Acao = acao,
            DadosDepoisJson = JsonSerializer.Serialize(payload),
            DataHora = now,
            Ip = HttpContext?.Connection?.RemoteIpAddress?.ToString(),
            UserAgent = HttpContext?.Request?.Headers["User-Agent"].ToString()
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

    public class BaixaManualRequest
    {
        public Guid OrganizacaoId { get; set; }
        public decimal? ValorPago { get; set; }
        public DateTime? DataPagamento { get; set; }
        public Guid? ContaFinanceiraId { get; set; }
        public string? FormaPagamento { get; set; }
        public string? Referencia { get; set; }
    }

    [HttpPost("lancamentos/{id:guid}/baixa-manual")]
    public async Task<IActionResult> BaixarLancamentoManual(Guid id, BaixaManualRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var lancamento = await _db.LancamentosFinanceiros.FindAsync(id);
        if (lancamento is null)
        {
            return NotFound();
        }

        if (lancamento.OrganizacaoId != request.OrganizacaoId)
        {
            return BadRequest("Lancamento nao pertence a organizacao informada.");
        }

        var situacaoAtual = NormalizarSituacao(lancamento.Situacao);
        if (situacaoAtual is SituacaoCancelado or SituacaoFechado or SituacaoPago or SituacaoConciliado)
        {
            return BadRequest("Lancamento nao pode receber baixa manual.");
        }

        var totalPagoAtual = (await _db.LancamentosPagamentos.AsNoTracking()
            .Where(p => p.LancamentoFinanceiroId == lancamento.Id && p.EstornadoEm == null)
            .Select(p => p.ValorPago)
            .ToListAsync())
            .Sum();
        var saldoAtual = Math.Round(lancamento.Valor - totalPagoAtual, 2, MidpointRounding.AwayFromZero);
        if (saldoAtual <= 0)
        {
            return BadRequest("Lancamento ja quitado.");
        }

        if (request.ContaFinanceiraId.HasValue && request.ContaFinanceiraId.Value != Guid.Empty)
        {
            var contaValida = await _db.ContasFinanceiras.AsNoTracking()
                .AnyAsync(c =>
                    c.Id == request.ContaFinanceiraId.Value &&
                    c.OrganizacaoId == request.OrganizacaoId &&
                    (c.Status ?? "ativo").ToLowerInvariant() == "ativo");
            if (!contaValida)
            {
                return BadRequest("Conta financeira invalida para esta organizacao.");
            }

            lancamento.ContaFinanceiraId = request.ContaFinanceiraId.Value;
        }

        if (!string.IsNullOrWhiteSpace(request.FormaPagamento))
        {
            lancamento.FormaPagamento = request.FormaPagamento.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Referencia))
        {
            lancamento.Referencia = request.Referencia.Trim();
        }

        var dataPagamento = request.DataPagamento?.Date ?? DateTime.UtcNow.Date;
        var valorPago = request.ValorPago.HasValue
            ? Math.Round(request.ValorPago.Value, 2, MidpointRounding.AwayFromZero)
            : saldoAtual;

        if (valorPago <= 0)
        {
            return BadRequest("Valor pago invalido.");
        }

        var valorExcedente = valorPago > saldoAtual
            ? Math.Round(valorPago - saldoAtual, 2, MidpointRounding.AwayFromZero)
            : 0m;

        var pagamento = new LancamentoPagamento
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            LancamentoFinanceiroId = lancamento.Id,
            ValorPago = valorPago,
            DataPagamento = dataPagamento,
            ContaFinanceiraId = request.ContaFinanceiraId,
            FormaPagamento = request.FormaPagamento,
            Referencia = request.Referencia
        };
        _db.LancamentosPagamentos.Add(pagamento);

        var totalPagoNovo = totalPagoAtual + valorPago;
        if (totalPagoNovo >= lancamento.Valor)
        {
            lancamento.DataPagamento = dataPagamento;
            lancamento.Situacao = SituacaoPago;
        }

        if (string.Equals(lancamento.Tipo, "receber", StringComparison.OrdinalIgnoreCase))
        {
            var faturas = await _db.DocumentosCobranca
                .Where(f =>
                    f.LancamentoFinanceiroId == lancamento.Id &&
                    f.Status != "cancelada")
                .ToListAsync();

            if (totalPagoNovo >= lancamento.Valor)
            {
                foreach (var fatura in faturas)
                {
                    fatura.Status = "paga";
                    fatura.DataBaixa = dataPagamento;
                }
            }
        }

        RegistrarAudit(lancamento.OrganizacaoId, lancamento.Id, "LancamentoFinanceiro", "BAIXA_MANUAL", new
        {
            lancamento.Descricao,
            lancamento.Valor,
            dataPagamento,
            valorPago,
            totalPagoNovo,
            valorExcedente
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("lancamentos/{id:guid}/pagamentos")]
    public async Task<ActionResult<IEnumerable<LancamentoPagamento>>> ListarPagamentosLancamento(
        Guid id,
        [FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(organizacaoId, UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var lancamento = await _db.LancamentosFinanceiros.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == id && l.OrganizacaoId == organizacaoId);
        if (lancamento is null)
        {
            return NotFound();
        }

        var pagamentos = await _db.LancamentosPagamentos.AsNoTracking()
            .Where(p => p.LancamentoFinanceiroId == id)
            .OrderByDescending(p => p.DataPagamento)
            .ToListAsync();

        return Ok(pagamentos);
    }

    public class EstornarPagamentoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public DateTime? DataEstorno { get; set; }
        public string? Motivo { get; set; }
    }

    [HttpPost("lancamentos/pagamentos/{id:guid}/estornar")]
    public async Task<IActionResult> EstornarPagamento(Guid id, EstornarPagamentoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var pagamento = await _db.LancamentosPagamentos.FindAsync(id);
        if (pagamento is null)
        {
            return NotFound();
        }

        if (pagamento.OrganizacaoId != request.OrganizacaoId)
        {
            return BadRequest("Pagamento nao pertence a organizacao informada.");
        }

        if (pagamento.EstornadoEm.HasValue)
        {
            return BadRequest("Pagamento ja estornado.");
        }

        var lancamento = await _db.LancamentosFinanceiros.FindAsync(pagamento.LancamentoFinanceiroId);
        if (lancamento is null)
        {
            return BadRequest("Lancamento financeiro nao encontrado.");
        }

        var situacaoAtual = NormalizarSituacao(lancamento.Situacao);
        if (situacaoAtual is SituacaoConciliado or SituacaoFechado)
        {
            return BadRequest("Lancamento conciliado/fechado nao pode ser estornado.");
        }

        pagamento.EstornadoEm = request.DataEstorno?.Date ?? DateTime.UtcNow.Date;
        pagamento.EstornoMotivo = string.IsNullOrWhiteSpace(request.Motivo)
            ? null
            : request.Motivo.Trim();

        var totalPagoAtivo = (await _db.LancamentosPagamentos.AsNoTracking()
            .Where(p =>
                p.LancamentoFinanceiroId == lancamento.Id &&
                p.EstornadoEm == null &&
                p.Id != pagamento.Id)
            .Select(p => p.ValorPago)
            .ToListAsync())
            .Sum();

        if (totalPagoAtivo < lancamento.Valor)
        {
            if (situacaoAtual == SituacaoPago)
            {
                lancamento.Situacao = SituacaoAprovado;
                lancamento.DataPagamento = null;
            }

            if (string.Equals(lancamento.Tipo, "receber", StringComparison.OrdinalIgnoreCase))
            {
                var faturas = await _db.DocumentosCobranca
                    .Where(f =>
                        f.LancamentoFinanceiroId == lancamento.Id &&
                        f.Status == "paga")
                    .ToListAsync();

                foreach (var fatura in faturas)
                {
                    fatura.Status = "emitida";
                    fatura.DataBaixa = null;
                }
            }
        }

        RegistrarAudit(lancamento.OrganizacaoId, pagamento.Id, "LancamentoPagamento", "ESTORNAR_BAIXA_MANUAL", new
        {
            pagamento.LancamentoFinanceiroId,
            pagamento.ValorPago,
            pagamento.EstornadoEm
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

        var faturaId = Guid.NewGuid();
        var tipo = string.IsNullOrWhiteSpace(request.Tipo)
            ? "boleto"
            : request.Tipo.Trim().ToLowerInvariant();
        var identificador = string.IsNullOrWhiteSpace(request.IdentificadorExterno)
            ? GerarIdentificadorExternoFicticio(faturaId)
            : request.IdentificadorExterno.Trim();
        var linhaDigitavel = string.IsNullOrWhiteSpace(request.LinhaDigitavel)
            ? null
            : request.LinhaDigitavel.Trim();
        var qrCode = string.IsNullOrWhiteSpace(request.QrCode)
            ? null
            : request.QrCode.Trim();
        var urlPagamento = string.IsNullOrWhiteSpace(request.UrlPagamento)
            ? null
            : request.UrlPagamento.Trim();

        if (string.IsNullOrWhiteSpace(linhaDigitavel) &&
            (string.Equals(tipo, "boleto", StringComparison.OrdinalIgnoreCase) ||
             string.Equals(tipo, "pix", StringComparison.OrdinalIgnoreCase)))
        {
            linhaDigitavel = GerarLinhaDigitavelFicticia(faturaId);
        }

        if (string.IsNullOrWhiteSpace(qrCode) &&
            string.Equals(tipo, "pix", StringComparison.OrdinalIgnoreCase))
        {
            qrCode = GerarQrCodePixFicticio(faturaId, lancamento.Valor);
        }

        if (string.IsNullOrWhiteSpace(urlPagamento))
        {
            urlPagamento = GerarUrlPagamentoFicticia(tipo, faturaId);
        }

        var fatura = new DocumentoCobranca
        {
            Id = faturaId,
            OrganizacaoId = request.OrganizacaoId,
            LancamentoFinanceiroId = request.LancamentoFinanceiroId,
            Tipo = tipo,
            IdentificadorExterno = identificador,
            LinhaDigitavel = linhaDigitavel,
            QrCode = qrCode,
            UrlPagamento = urlPagamento,
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

    public class AtualizarPoliticaCobrancaRequest
    {
        public Guid OrganizacaoId { get; set; }
        public decimal MultaPercentual { get; set; }
        public decimal JurosMensalPercentual { get; set; }
        public decimal CorrecaoMensalPercentual { get; set; }
        public string? CorrecaoTipo { get; set; }
        public string? CorrecaoIndice { get; set; }
        public int DiasCarencia { get; set; }
        public bool Ativo { get; set; } = true;
    }

    public record IndiceEconomicoDto(
        string Tipo,
        int Ano,
        int Mes,
        decimal ValorPercentual,
        string Fonte,
        DateTime AtualizadoEm);

    [HttpGet("cobrancas/politica")]
    public async Task<ActionResult<PoliticaCobranca>> ObterPoliticaCobranca(
        [FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(organizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var politica = await _db.PoliticasCobranca.AsNoTracking()
            .FirstOrDefaultAsync(p => p.OrganizacaoId == organizacaoId);
        if (politica is null)
        {
            politica = new PoliticaCobranca
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                MultaPercentual = 0m,
                JurosMensalPercentual = 0m,
                CorrecaoMensalPercentual = 0m,
                CorrecaoTipo = CorrecaoTipoPadrao,
                CorrecaoIndice = null,
                DiasCarencia = 0,
                Ativo = true,
                AtualizadoEm = DateTime.UtcNow
            };
        }
        else
        {
            politica.CorrecaoTipo = NormalizarCorrecaoTipo(politica.CorrecaoTipo);
            if (!string.Equals(politica.CorrecaoTipo, "OUTRO", StringComparison.OrdinalIgnoreCase))
            {
                politica.CorrecaoIndice = null;
            }
        }

        return Ok(politica);
    }

    [HttpPut("cobrancas/politica")]
    public async Task<ActionResult<PoliticaCobranca>> AtualizarPoliticaCobranca(
        AtualizarPoliticaCobrancaRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(request.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var politica = await _db.PoliticasCobranca
            .FirstOrDefaultAsync(p => p.OrganizacaoId == request.OrganizacaoId);

        if (politica is null)
        {
            politica = new PoliticaCobranca
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = request.OrganizacaoId
            };
            _db.PoliticasCobranca.Add(politica);
        }

        var correcaoTipo = NormalizarCorrecaoTipo(request.CorrecaoTipo);
        if (string.Equals(correcaoTipo, "OUTRO", StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrWhiteSpace(request.CorrecaoIndice))
        {
            return BadRequest("Informe o indice de correcao.");
        }
        politica.MultaPercentual = Math.Max(0m, request.MultaPercentual);
        politica.JurosMensalPercentual = Math.Max(0m, request.JurosMensalPercentual);
        politica.CorrecaoMensalPercentual = Math.Max(0m, request.CorrecaoMensalPercentual);
        politica.CorrecaoTipo = correcaoTipo;
        politica.CorrecaoIndice = string.Equals(correcaoTipo, "OUTRO", StringComparison.OrdinalIgnoreCase)
            ? (string.IsNullOrWhiteSpace(request.CorrecaoIndice) ? null : request.CorrecaoIndice.Trim())
            : null;
        politica.DiasCarencia = Math.Max(0, request.DiasCarencia);
        politica.Ativo = request.Ativo;
        politica.AtualizadoEm = DateTime.UtcNow;

        RegistrarAudit(politica.OrganizacaoId, politica.Id, "PoliticaCobranca", "ATUALIZAR_POLITICA_COBRANCA", new
        {
            politica.MultaPercentual,
            politica.JurosMensalPercentual,
            politica.CorrecaoMensalPercentual,
            politica.CorrecaoTipo,
            politica.CorrecaoIndice,
            politica.DiasCarencia,
            politica.Ativo
        });

        await _db.SaveChangesAsync();
        return Ok(politica);
    }

    [HttpGet("indices/ultimo")]
    public async Task<ActionResult<IndiceEconomicoDto>> ObterIndiceEconomicoAtual(
        [FromQuery] Guid organizacaoId,
        [FromQuery] string? tipo)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        if (string.IsNullOrWhiteSpace(tipo))
        {
            return BadRequest("Tipo do indice e obrigatorio.");
        }

        var auth = await EnsureRoleAsync(organizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var tipoNormalizado = tipo.Trim().ToUpperInvariant();
        var indice = await _db.IndicesEconomicos.AsNoTracking()
            .Where(i => i.Tipo == tipoNormalizado)
            .OrderByDescending(i => i.Ano)
            .ThenByDescending(i => i.Mes)
            .ThenByDescending(i => i.AtualizadoEm)
            .FirstOrDefaultAsync();

        if (indice is null)
        {
            return NoContent();
        }

        return Ok(new IndiceEconomicoDto(
            indice.Tipo,
            indice.Ano,
            indice.Mes,
            indice.ValorPercentual,
            indice.Fonte,
            indice.AtualizadoEm));
    }

    public class GerarRemessaCobrancaRequest
    {
        public Guid OrganizacaoId { get; set; }
        public string? Tipo { get; set; }
    }

    public record RetornoCobrancaResumo(int TotalLinhas, int Atualizadas, int Ignoradas);
    public record RemessaCobrancaItemDto(
        Guid Id,
        string? Identificador,
        string Tipo,
        decimal Valor,
        DateTime Vencimento,
        string Status,
        string? LinhaDigitavel,
        string? QrCode,
        string? UrlPagamento);

    [HttpPost("faturas/remessa")]
    public async Task<IActionResult> GerarRemessaCobranca(GerarRemessaCobrancaRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(request.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.DocumentosCobranca.AsNoTracking()
            .Where(f => f.OrganizacaoId == request.OrganizacaoId);

        if (!string.IsNullOrWhiteSpace(request.Tipo))
        {
            var tipo = request.Tipo.Trim().ToLowerInvariant();
            query = query.Where(f => f.Tipo == tipo);
        }

        var faturas = await query
            .Where(f => f.Status == "emitida" || f.Status == "vencida")
            .OrderBy(f => f.DataVencimento)
            .ToListAsync();

        var lancamentosIds = faturas.Select(f => f.LancamentoFinanceiroId).Distinct().ToList();
        var lancamentos = await _db.LancamentosFinanceiros.AsNoTracking()
            .Where(l => lancamentosIds.Contains(l.Id))
            .ToDictionaryAsync(l => l.Id, l => l);

        var sb = new StringBuilder();
        sb.AppendLine("id;identificador;tipo;valor;vencimento;status;linhaDigitavel;qrCode;urlPagamento");

        foreach (var fat in faturas)
        {
            lancamentos.TryGetValue(fat.LancamentoFinanceiroId, out var lancamento);
            var valor = lancamento?.Valor ?? 0m;
            sb.AppendLine(
                $"{fat.Id};{fat.IdentificadorExterno ?? string.Empty};{fat.Tipo};{valor.ToString("0.00", CultureInfo.InvariantCulture)};" +
                $"{fat.DataVencimento:yyyy-MM-dd};{fat.Status};{fat.LinhaDigitavel ?? string.Empty};{fat.QrCode ?? string.Empty};{fat.UrlPagamento ?? string.Empty}");
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var nome = $"remessa-{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
        return File(bytes, "text/csv", nome);
    }

    [HttpPost("faturas/remessa/dados")]
    public async Task<ActionResult<IEnumerable<RemessaCobrancaItemDto>>> ListarRemessaCobranca(
        GerarRemessaCobrancaRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(request.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.DocumentosCobranca.AsNoTracking()
            .Where(f => f.OrganizacaoId == request.OrganizacaoId);

        if (!string.IsNullOrWhiteSpace(request.Tipo))
        {
            var tipo = request.Tipo.Trim().ToLowerInvariant();
            query = query.Where(f => f.Tipo == tipo);
        }

        var faturas = await query
            .Where(f => f.Status == "emitida" || f.Status == "vencida")
            .OrderBy(f => f.DataVencimento)
            .ToListAsync();

        var lancamentosIds = faturas.Select(f => f.LancamentoFinanceiroId).Distinct().ToList();
        var lancamentos = await _db.LancamentosFinanceiros.AsNoTracking()
            .Where(l => lancamentosIds.Contains(l.Id))
            .ToDictionaryAsync(l => l.Id, l => l);

        var itens = faturas.Select(f =>
        {
            lancamentos.TryGetValue(f.LancamentoFinanceiroId, out var lancamento);
            return new RemessaCobrancaItemDto(
                f.Id,
                f.IdentificadorExterno,
                f.Tipo,
                lancamento?.Valor ?? 0m,
                f.DataVencimento,
                f.Status,
                f.LinhaDigitavel,
                f.QrCode,
                f.UrlPagamento);
        }).ToList();

        return Ok(itens);
    }

    [HttpPost("faturas/retorno")]
    [RequestSizeLimit(10_000_000)]
    public async Task<ActionResult<RetornoCobrancaResumo>> ImportarRetornoCobranca(
        [FromForm] Guid organizacaoId,
        [FromForm] IFormFile arquivo)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(organizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (arquivo is null || arquivo.Length == 0)
        {
            return BadRequest("Arquivo de retorno obrigatorio.");
        }

        var linhas = new List<string>();
        using (var reader = new StreamReader(arquivo.OpenReadStream()))
        {
            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync();
                if (!string.IsNullOrWhiteSpace(line))
                {
                    linhas.Add(line);
                }
            }
        }

        if (linhas.Count == 0)
        {
            return Ok(new RetornoCobrancaResumo(0, 0, 0));
        }

        var inicio = 0;
        if (linhas[0].Contains("id", StringComparison.OrdinalIgnoreCase) &&
            linhas[0].Contains("status", StringComparison.OrdinalIgnoreCase))
        {
            inicio = 1;
        }

        var atualizadas = 0;
        var ignoradas = 0;

        for (var i = inicio; i < linhas.Count; i++)
        {
            var line = linhas[i];
            var partes = line.Split(';');
            if (partes.Length < 2)
            {
                partes = line.Split(',');
            }

            if (partes.Length < 2)
            {
                ignoradas++;
                continue;
            }

            var idOrIdentificador = partes[0].Trim();
            var statusRaw = partes.Length > 1 ? partes[1].Trim().ToLowerInvariant() : string.Empty;
            var dataBaixaRaw = partes.Length > 2 ? partes[2].Trim() : string.Empty;

            if (string.IsNullOrWhiteSpace(idOrIdentificador) || string.IsNullOrWhiteSpace(statusRaw))
            {
                ignoradas++;
                continue;
            }

            DocumentoCobranca? fatura;
            if (Guid.TryParse(idOrIdentificador, out var fatId))
            {
                fatura = await _db.DocumentosCobranca.FindAsync(fatId);
            }
            else
            {
                fatura = await _db.DocumentosCobranca
                    .FirstOrDefaultAsync(f =>
                        f.OrganizacaoId == organizacaoId &&
                        f.IdentificadorExterno == idOrIdentificador);
            }

            if (fatura is null || fatura.OrganizacaoId != organizacaoId)
            {
                ignoradas++;
                continue;
            }

            if (statusRaw is not ("emitida" or "vencida" or "paga" or "cancelada"))
            {
                ignoradas++;
                continue;
            }

            DateTime? dataBaixa = null;
            if (statusRaw == "paga")
            {
                if (DateTime.TryParse(dataBaixaRaw, out var parsed))
                {
                    dataBaixa = parsed.Date;
                }
                else
                {
                    dataBaixa = DateTime.UtcNow.Date;
                }
            }

            fatura.Status = statusRaw;
            fatura.DataBaixa = statusRaw == "paga" ? dataBaixa : null;

            if (statusRaw == "paga")
            {
                var lancamento = await _db.LancamentosFinanceiros.FindAsync(fatura.LancamentoFinanceiroId);
                if (lancamento is not null)
                {
                    var situacaoAtual = NormalizarSituacao(lancamento.Situacao);
                    if (situacaoAtual is not (SituacaoCancelado or SituacaoFechado))
                    {
                        lancamento.Situacao = SituacaoPago;
                        lancamento.DataPagamento = dataBaixa ?? DateTime.UtcNow;
                    }
                }
            }

            atualizadas++;
        }

        await _db.SaveChangesAsync();
        return Ok(new RetornoCobrancaResumo(linhas.Count - inicio, atualizadas, ignoradas));
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
    // Grupos de rateio
    // ---------------------------

    public record RegraRateioUnidadeDto(Guid UnidadeId, decimal? Percentual);

    public class CriarRegraRateioRequest
    {
        public Guid OrganizacaoId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string TipoBase { get; set; } = string.Empty;
        public List<RegraRateioUnidadeDto> Unidades { get; set; } = new();
    }

    public class AtualizarRegraRateioRequest
    {
        public string Nome { get; set; } = string.Empty;
        public string TipoBase { get; set; } = string.Empty;
        public List<RegraRateioUnidadeDto> Unidades { get; set; } = new();
    }

    public class AplicarRateioRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid LancamentoId { get; set; }
    }

    private record RateioConfig(string Tipo, List<RegraRateioUnidadeDto> Unidades, int? UnidadesTotal);

    private static RateioConfig ParseRateioConfig(RegraRateio regra)
    {
        if (string.IsNullOrWhiteSpace(regra.ConfiguracaoJson))
        {
            return new RateioConfig(regra.TipoBase, new List<RegraRateioUnidadeDto>(), null);
        }

        try
        {
            using var doc = JsonDocument.Parse(regra.ConfiguracaoJson);
            var root = doc.RootElement;
            var tipo = root.TryGetProperty("tipo", out var tipoProp)
                ? (tipoProp.GetString() ?? regra.TipoBase)
                : regra.TipoBase;

            if (root.TryGetProperty("unidades", out var unidadesProp))
            {
                if (unidadesProp.ValueKind == JsonValueKind.Number &&
                    unidadesProp.TryGetInt32(out var total))
                {
                    return new RateioConfig(tipo, new List<RegraRateioUnidadeDto>(), total);
                }

                if (unidadesProp.ValueKind == JsonValueKind.Array)
                {
                    var unidades = new List<RegraRateioUnidadeDto>();
                    foreach (var item in unidadesProp.EnumerateArray())
                    {
                        if (item.ValueKind != JsonValueKind.Object)
                        {
                            continue;
                        }

                        Guid unidadeId = Guid.Empty;
                        if (item.TryGetProperty("unidadeId", out var unidadeIdProp))
                        {
                            Guid.TryParse(unidadeIdProp.ToString(), out unidadeId);
                        }
                        else if (item.TryGetProperty("unidadeOrganizacionalId", out var unidadeOrgProp))
                        {
                            Guid.TryParse(unidadeOrgProp.ToString(), out unidadeId);
                        }
                        else if (item.TryGetProperty("id", out var idProp))
                        {
                            Guid.TryParse(idProp.ToString(), out unidadeId);
                        }

                        if (unidadeId == Guid.Empty)
                        {
                            continue;
                        }

                        decimal? percentual = null;
                        if (item.TryGetProperty("percentual", out var percProp))
                        {
                            if (percProp.ValueKind == JsonValueKind.Number)
                            {
                                percentual = percProp.GetDecimal();
                            }
                            else if (decimal.TryParse(percProp.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var perc))
                            {
                                percentual = perc;
                            }
                        }

                        unidades.Add(new RegraRateioUnidadeDto(unidadeId, percentual));
                    }

                    return new RateioConfig(tipo, unidades, null);
                }
            }
        }
        catch
        {
            // Ignora configuracoes invalidas
        }

        return new RateioConfig(regra.TipoBase, new List<RegraRateioUnidadeDto>(), null);
    }

    [HttpGet("rateios")]
    public async Task<ActionResult<IEnumerable<RegraRateio>>> ListarRegrasRateio([FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(organizacaoId, UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var regras = await _db.RegrasRateio
            .AsNoTracking()
            .Where(r => r.OrganizacaoId == organizacaoId)
            .OrderBy(r => r.Nome)
            .ToListAsync();

        return Ok(regras);
    }

    [HttpPost("rateios")]
    public async Task<ActionResult<RegraRateio>> CriarRegraRateio(CriarRegraRateioRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(request.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome e obrigatorio.");
        }

        if (string.IsNullOrWhiteSpace(request.TipoBase))
        {
            return BadRequest("Tipo base e obrigatorio.");
        }

        var regra = new RegraRateio
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            Nome = request.Nome.Trim(),
            TipoBase = request.TipoBase.Trim(),
            ConfiguracaoJson = JsonSerializer.Serialize(new
            {
                tipo = request.TipoBase.Trim(),
                unidades = request.Unidades.Select(u => new { unidadeId = u.UnidadeId, percentual = u.Percentual })
            })
        };

        _db.RegrasRateio.Add(regra);
        RegistrarAudit(request.OrganizacaoId, regra.Id, "RegraRateio", "CRIAR_RATEIO", new
        {
            regra.Nome,
            regra.TipoBase
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ListarRegrasRateio), new { organizacaoId = request.OrganizacaoId }, regra);
    }

    [HttpPut("rateios/{id:guid}")]
    public async Task<IActionResult> AtualizarRegraRateio(Guid id, AtualizarRegraRateioRequest request)
    {
        var regra = await _db.RegrasRateio.FindAsync(id);
        if (regra is null)
        {
            return NotFound();
        }

        var auth = await EnsureRoleAsync(regra.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome e obrigatorio.");
        }

        if (string.IsNullOrWhiteSpace(request.TipoBase))
        {
            return BadRequest("Tipo base e obrigatorio.");
        }

        regra.Nome = request.Nome.Trim();
        regra.TipoBase = request.TipoBase.Trim();
        regra.ConfiguracaoJson = JsonSerializer.Serialize(new
        {
            tipo = regra.TipoBase,
            unidades = request.Unidades.Select(u => new { unidadeId = u.UnidadeId, percentual = u.Percentual })
        });

        RegistrarAudit(regra.OrganizacaoId, regra.Id, "RegraRateio", "ATUALIZAR_RATEIO", new
        {
            regra.Nome,
            regra.TipoBase
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("rateios/{id:guid}")]
    public async Task<IActionResult> RemoverRegraRateio(Guid id)
    {
        var regra = await _db.RegrasRateio.FindAsync(id);
        if (regra is null)
        {
            return NotFound();
        }

        var auth = await EnsureRoleAsync(regra.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        _db.RegrasRateio.Remove(regra);
        RegistrarAudit(regra.OrganizacaoId, regra.Id, "RegraRateio", "REMOVER_RATEIO", new
        {
            regra.Nome,
            regra.TipoBase
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("lancamentos/{id:guid}/rateios")]
    public async Task<ActionResult<IEnumerable<LancamentoRateado>>> ListarRateiosLancamento(
        Guid id,
        [FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(organizacaoId, UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var lancamento = await _db.LancamentosFinanceiros.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == id && l.OrganizacaoId == organizacaoId);
        if (lancamento is null)
        {
            return NotFound();
        }

        var itens = await _db.LancamentosRateados.AsNoTracking()
            .Where(r => r.LancamentoOriginalId == id)
            .ToListAsync();

        return Ok(itens);
    }

    [HttpDelete("lancamentos/{id:guid}/rateios")]
    public async Task<IActionResult> RemoverRateiosLancamento(
        Guid id,
        [FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(organizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var lancamento = await _db.LancamentosFinanceiros.FindAsync(id);
        if (lancamento is null || lancamento.OrganizacaoId != organizacaoId)
        {
            return NotFound();
        }

        var existentes = await _db.LancamentosRateados
            .Where(r => r.LancamentoOriginalId == id)
            .ToListAsync();

        if (existentes.Count > 0)
        {
            _db.LancamentosRateados.RemoveRange(existentes);
            RegistrarAudit(organizacaoId, id, "LancamentoRateado", "LIMPAR_RATEIO", new
            {
                LancamentoId = id
            });
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpPost("rateios/{id:guid}/aplicar")]
    public async Task<ActionResult<IEnumerable<LancamentoRateado>>> AplicarRateio(
        Guid id,
        AplicarRateioRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        if (request.LancamentoId == Guid.Empty)
        {
            return BadRequest("Lancamento e obrigatorio.");
        }

        var auth = await EnsureRoleAsync(request.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var regra = await _db.RegrasRateio.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id && r.OrganizacaoId == request.OrganizacaoId);
        if (regra is null)
        {
            return NotFound("Regra de rateio nao encontrada.");
        }

        var lancamento = await _db.LancamentosFinanceiros
            .FirstOrDefaultAsync(l => l.Id == request.LancamentoId && l.OrganizacaoId == request.OrganizacaoId);
        if (lancamento is null)
        {
            return NotFound("Lancamento nao encontrado.");
        }

        var config = ParseRateioConfig(regra);
        var unidadesConfig = config.Unidades.ToList();

        if (unidadesConfig.Count == 0 && config.UnidadesTotal.HasValue)
        {
            var unidades = await _db.UnidadesOrganizacionais.AsNoTracking()
                .Where(u => u.OrganizacaoId == request.OrganizacaoId)
                .OrderBy(u => u.CodigoInterno)
                .Take(config.UnidadesTotal.Value)
                .ToListAsync();

            unidadesConfig = unidades
                .Select(u => new RegraRateioUnidadeDto(u.Id, null))
                .ToList();
        }

        if (unidadesConfig.Count == 0)
        {
            return BadRequest("Regra de rateio sem unidades vinculadas.");
        }

        var tipo = string.IsNullOrWhiteSpace(config.Tipo) ? regra.TipoBase : config.Tipo;
        var total = lancamento.Valor;
        var valores = new List<decimal>();

        if (string.Equals(tipo, "percentual", StringComparison.OrdinalIgnoreCase))
        {
            var soma = unidadesConfig.Sum(u => u.Percentual ?? 0m);
            if (Math.Abs(soma - 100m) > 0.01m)
            {
                return BadRequest("Percentuais devem totalizar 100%.");
            }

            foreach (var unidade in unidadesConfig)
            {
                var perc = unidade.Percentual ?? 0m;
                var valor = Math.Round(total * perc / 100m, 2, MidpointRounding.AwayFromZero);
                valores.Add(valor);
            }
        }
        else
        {
            var baseValor = Math.Round(total / unidadesConfig.Count, 2, MidpointRounding.AwayFromZero);
            for (var i = 0; i < unidadesConfig.Count; i++)
            {
                valores.Add(baseValor);
            }
        }

        var diferenca = total - valores.Sum();
        if (valores.Count > 0 && diferenca != 0m)
        {
            valores[^1] = Math.Round(valores[^1] + diferenca, 2, MidpointRounding.AwayFromZero);
        }

        var existentes = await _db.LancamentosRateados
            .Where(r => r.LancamentoOriginalId == request.LancamentoId)
            .ToListAsync();
        if (existentes.Count > 0)
        {
            _db.LancamentosRateados.RemoveRange(existentes);
        }

        var novos = new List<LancamentoRateado>();
        for (var i = 0; i < unidadesConfig.Count; i++)
        {
            novos.Add(new LancamentoRateado
            {
                Id = Guid.NewGuid(),
                LancamentoOriginalId = request.LancamentoId,
                UnidadeOrganizacionalId = unidadesConfig[i].UnidadeId,
                CentroCustoId = null,
                ValorRateado = valores[i]
            });
        }

        _db.LancamentosRateados.AddRange(novos);
        RegistrarAudit(request.OrganizacaoId, request.LancamentoId, "LancamentoRateado", "APLICAR_RATEIO", new
        {
            regra.Id,
            regra.Nome,
            regra.TipoBase,
            Total = total,
            Unidades = unidadesConfig.Count
        });
        await _db.SaveChangesAsync();

        return Ok(novos);
    }

    // ---------------------------
    // Previsao orcamentaria
    // ---------------------------

    private static string NormalizarTipoPrevisao(string tipo)
    {
        var normalizado = (tipo ?? string.Empty).Trim();
        if (string.Equals(normalizado, "receita", StringComparison.OrdinalIgnoreCase))
        {
            return "Receita";
        }
        if (string.Equals(normalizado, "despesa", StringComparison.OrdinalIgnoreCase))
        {
            return "Despesa";
        }
        return string.Empty;
    }

    public class CriarPrevisaoOrcamentariaRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid PlanoContasId { get; set; }
        public string Tipo { get; set; } = string.Empty;
        public int Ano { get; set; }
        public int Mes { get; set; }
        public decimal ValorPrevisto { get; set; }
        public string? Observacao { get; set; }
    }

    public class AtualizarPrevisaoOrcamentariaRequest
    {
        public Guid PlanoContasId { get; set; }
        public string Tipo { get; set; } = string.Empty;
        public int Ano { get; set; }
        public int Mes { get; set; }
        public decimal ValorPrevisto { get; set; }
        public string? Observacao { get; set; }
    }

    [HttpGet("previsao-orcamentaria")]
    public async Task<ActionResult<IEnumerable<PrevisaoOrcamentaria>>> ListarPrevisoesOrcamentarias(
        [FromQuery] Guid organizacaoId,
        [FromQuery] int? ano,
        [FromQuery] string? tipo)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var query = _db.PrevisoesOrcamentarias.AsNoTracking()
            .Where(p => p.OrganizacaoId == organizacaoId);

        if (ano.HasValue)
        {
            query = query.Where(p => p.Ano == ano.Value);
        }

        if (!string.IsNullOrWhiteSpace(tipo))
        {
            var tipoNormalizado = NormalizarTipoPrevisao(tipo);
            if (!string.IsNullOrWhiteSpace(tipoNormalizado))
            {
                query = query.Where(p => p.Tipo == tipoNormalizado);
            }
        }

        var itens = await query
            .OrderBy(p => p.Ano)
            .ThenBy(p => p.Mes)
            .ThenBy(p => p.Tipo)
            .ThenBy(p => p.PlanoContasId)
            .ToListAsync();

        return Ok(itens);
    }

    [HttpPost("previsao-orcamentaria")]
    public async Task<ActionResult<PrevisaoOrcamentaria>> CriarPrevisaoOrcamentaria(
        CriarPrevisaoOrcamentariaRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        if (request.PlanoContasId == Guid.Empty)
        {
            return BadRequest("Categoria financeira e obrigatoria.");
        }

        var tipoNormalizado = NormalizarTipoPrevisao(request.Tipo);
        if (string.IsNullOrWhiteSpace(tipoNormalizado))
        {
            return BadRequest("Tipo invalido. Use Receita ou Despesa.");
        }

        if (request.Ano < 2000)
        {
            return BadRequest("Ano invalido.");
        }

        if (request.Mes < 1 || request.Mes > 12)
        {
            return BadRequest("Mes invalido.");
        }

        if (request.ValorPrevisto <= 0)
        {
            return BadRequest("Valor previsto deve ser maior que zero.");
        }

        var existente = await _db.PrevisoesOrcamentarias
            .FirstOrDefaultAsync(p =>
                p.OrganizacaoId == request.OrganizacaoId &&
                p.PlanoContasId == request.PlanoContasId &&
                p.Ano == request.Ano &&
                p.Mes == request.Mes &&
                p.Tipo == tipoNormalizado);

        if (existente is not null)
        {
            existente.ValorPrevisto = request.ValorPrevisto;
            existente.Observacao = string.IsNullOrWhiteSpace(request.Observacao)
                ? null
                : request.Observacao.Trim();

            RegistrarAudit(existente.OrganizacaoId, existente.Id, "PrevisaoOrcamentaria", "ATUALIZAR_PREVISAO", new
            {
                existente.Tipo,
                existente.Ano,
                existente.Mes,
                existente.ValorPrevisto
            });
            await _db.SaveChangesAsync();
            return Ok(existente);
        }

        var previsao = new PrevisaoOrcamentaria
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            PlanoContasId = request.PlanoContasId,
            Tipo = tipoNormalizado,
            Ano = request.Ano,
            Mes = request.Mes,
            ValorPrevisto = request.ValorPrevisto,
            Observacao = string.IsNullOrWhiteSpace(request.Observacao)
                ? null
                : request.Observacao.Trim()
        };

        _db.PrevisoesOrcamentarias.Add(previsao);
        RegistrarAudit(previsao.OrganizacaoId, previsao.Id, "PrevisaoOrcamentaria", "CRIAR_PREVISAO", new
        {
            previsao.Tipo,
            previsao.Ano,
            previsao.Mes,
            previsao.ValorPrevisto
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ListarPrevisoesOrcamentarias), new { organizacaoId = previsao.OrganizacaoId }, previsao);
    }

    [HttpPut("previsao-orcamentaria/{id:guid}")]
    public async Task<IActionResult> AtualizarPrevisaoOrcamentaria(
        Guid id,
        AtualizarPrevisaoOrcamentariaRequest request)
    {
        var previsao = await _db.PrevisoesOrcamentarias.FindAsync(id);
        if (previsao is null)
        {
            return NotFound();
        }

        if (request.PlanoContasId == Guid.Empty)
        {
            return BadRequest("Categoria financeira e obrigatoria.");
        }

        var tipoNormalizado = NormalizarTipoPrevisao(request.Tipo);
        if (string.IsNullOrWhiteSpace(tipoNormalizado))
        {
            return BadRequest("Tipo invalido. Use Receita ou Despesa.");
        }

        if (request.Ano < 2000)
        {
            return BadRequest("Ano invalido.");
        }

        if (request.Mes < 1 || request.Mes > 12)
        {
            return BadRequest("Mes invalido.");
        }

        if (request.ValorPrevisto <= 0)
        {
            return BadRequest("Valor previsto deve ser maior que zero.");
        }

        previsao.PlanoContasId = request.PlanoContasId;
        previsao.Tipo = tipoNormalizado;
        previsao.Ano = request.Ano;
        previsao.Mes = request.Mes;
        previsao.ValorPrevisto = request.ValorPrevisto;
        previsao.Observacao = string.IsNullOrWhiteSpace(request.Observacao)
            ? null
            : request.Observacao.Trim();

        RegistrarAudit(previsao.OrganizacaoId, previsao.Id, "PrevisaoOrcamentaria", "ATUALIZAR_PREVISAO", new
        {
            previsao.Tipo,
            previsao.Ano,
            previsao.Mes,
            previsao.ValorPrevisto
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("previsao-orcamentaria/{id:guid}")]
    public async Task<IActionResult> RemoverPrevisaoOrcamentaria(Guid id)
    {
        var previsao = await _db.PrevisoesOrcamentarias.FindAsync(id);
        if (previsao is null)
        {
            return NotFound();
        }

        _db.PrevisoesOrcamentarias.Remove(previsao);
        RegistrarAudit(previsao.OrganizacaoId, previsao.Id, "PrevisaoOrcamentaria", "REMOVER_PREVISAO", new
        {
            previsao.Tipo,
            previsao.Ano,
            previsao.Mes,
            previsao.ValorPrevisto
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ---------------------------
    // Abonos
    // ---------------------------

    private static string NormalizarTipoAbono(string tipo)
    {
        var normalizado = (tipo ?? string.Empty).Trim().ToLowerInvariant();
        return normalizado switch
        {
            "valor" => "valor",
            "percentual" => "percentual",
            _ => string.Empty
        };
    }

    private static string NormalizarStatusAbono(string status)
    {
        var normalizado = (status ?? string.Empty).Trim().ToLowerInvariant();
        return normalizado switch
        {
            "pendente" => "pendente",
            "em_analise" => "em_analise",
            "analise" => "em_analise",
            "aprovado" => "aprovado",
            "cancelado" => "cancelado",
            _ => string.Empty
        };
    }

    public class CriarAbonoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid LancamentoFinanceiroId { get; set; }
        public string Tipo { get; set; } = string.Empty; // valor | percentual
        public decimal? Valor { get; set; }
        public decimal? Percentual { get; set; }
        public string Motivo { get; set; } = string.Empty;
        public string? Observacao { get; set; }
    }

    public class AtualizarStatusAbonoRequest
    {
        public string Status { get; set; } = string.Empty; // pendente | em_analise | aprovado | cancelado
    }

    [HttpGet("abonos")]
    public async Task<ActionResult<IEnumerable<AbonoFinanceiro>>> ListarAbonos(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? lancamentoId,
        [FromQuery] string? status)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var query = _db.AbonosFinanceiros.AsNoTracking()
            .Where(a => a.OrganizacaoId == organizacaoId);

        if (lancamentoId.HasValue && lancamentoId.Value != Guid.Empty)
        {
            query = query.Where(a => a.LancamentoFinanceiroId == lancamentoId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusNormalizado = NormalizarStatusAbono(status);
            if (string.IsNullOrWhiteSpace(statusNormalizado))
            {
                return BadRequest("Status invalido. Use pendente, em_analise, aprovado ou cancelado.");
            }
            query = query.Where(a => a.Status == statusNormalizado);
        }

        var itens = await query
            .OrderByDescending(a => a.DataSolicitacao)
            .ToListAsync();

        return Ok(itens);
    }

    [HttpPost("abonos")]
    public async Task<ActionResult<AbonoFinanceiro>> CriarAbono(CriarAbonoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        if (request.LancamentoFinanceiroId == Guid.Empty)
        {
            return BadRequest("Lancamento financeiro e obrigatorio.");
        }

        if (string.IsNullOrWhiteSpace(request.Motivo))
        {
            return BadRequest("Motivo do abono e obrigatorio.");
        }

        var tipoNormalizado = NormalizarTipoAbono(request.Tipo);
        if (string.IsNullOrWhiteSpace(tipoNormalizado))
        {
            return BadRequest("Tipo invalido. Use valor ou percentual.");
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
            return BadRequest("Abonos so podem ser aplicados em lancamentos a receber.");
        }

        var situacao = NormalizarSituacao(lancamento.Situacao);
        if (situacao is SituacaoPago or SituacaoConciliado or SituacaoFechado or SituacaoCancelado)
        {
            return BadRequest("Lancamento ja liquidado ou cancelado, nao e possivel abonar.");
        }

        decimal valor;
        decimal? percentual = null;
        if (tipoNormalizado == "percentual")
        {
            if (!request.Percentual.HasValue)
            {
                return BadRequest("Percentual e obrigatorio.");
            }

            if (request.Percentual <= 0 || request.Percentual > 100)
            {
                return BadRequest("Percentual deve estar entre 0 e 100.");
            }

            percentual = request.Percentual.Value;
            valor = Math.Round(lancamento.Valor * (percentual.Value / 100m), 2, MidpointRounding.AwayFromZero);
            if (valor <= 0)
            {
                return BadRequest("Valor do abono invalido.");
            }
        }
        else
        {
            if (!request.Valor.HasValue)
            {
                return BadRequest("Valor do abono e obrigatorio.");
            }

            valor = Math.Round(request.Valor.Value, 2, MidpointRounding.AwayFromZero);
            if (valor <= 0)
            {
                return BadRequest("Valor do abono invalido.");
            }
        }

        if (valor > lancamento.Valor)
        {
            return BadRequest("Valor do abono nao pode ser maior que o valor do lancamento.");
        }

        var abono = new AbonoFinanceiro
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            LancamentoFinanceiroId = request.LancamentoFinanceiroId,
            Tipo = tipoNormalizado,
            Valor = valor,
            Percentual = percentual,
            Motivo = request.Motivo.Trim(),
            Observacao = string.IsNullOrWhiteSpace(request.Observacao)
                ? null
                : request.Observacao.Trim(),
            Status = "pendente",
            DataSolicitacao = DateTime.UtcNow
        };

        _db.AbonosFinanceiros.Add(abono);
        RegistrarAudit(abono.OrganizacaoId, abono.Id, "AbonoFinanceiro", "CRIAR_ABONO", new
        {
            abono.LancamentoFinanceiroId,
            abono.Tipo,
            abono.Valor
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ListarAbonos), new { organizacaoId = abono.OrganizacaoId }, abono);
    }

    [HttpPatch("abonos/{id:guid}/status")]
    public async Task<IActionResult> AtualizarStatusAbono(Guid id, AtualizarStatusAbonoRequest request)
    {
        var abono = await _db.AbonosFinanceiros.FindAsync(id);
        if (abono is null)
        {
            return NotFound();
        }

        var statusNormalizado = NormalizarStatusAbono(request.Status);
        if (string.IsNullOrWhiteSpace(statusNormalizado))
        {
            return BadRequest("Status invalido. Use pendente, em_analise, aprovado ou cancelado.");
        }

        if (abono.Status == statusNormalizado)
        {
            return NoContent();
        }

        if (statusNormalizado == "em_analise")
        {
            if (abono.Status != "pendente")
            {
                return BadRequest("Somente abonos pendentes podem ir para analise.");
            }

            abono.Status = "em_analise";
            RegistrarAudit(abono.OrganizacaoId, abono.Id, "AbonoFinanceiro", "ANALISAR_ABONO", new
            {
                abono.LancamentoFinanceiroId,
                abono.Valor
            });
        }
        else if (statusNormalizado == "aprovado")
        {
            if (abono.Status != "em_analise")
            {
                return BadRequest("Somente abonos em analise podem ser aprovados.");
            }

            var lancamento = await _db.LancamentosFinanceiros.FindAsync(abono.LancamentoFinanceiroId);
            if (lancamento is null)
            {
                return BadRequest("Lancamento financeiro nao encontrado.");
            }

            var situacao = NormalizarSituacao(lancamento.Situacao);
            if (situacao is SituacaoPago or SituacaoConciliado or SituacaoFechado or SituacaoCancelado)
            {
                return BadRequest("Lancamento ja liquidado ou cancelado, nao e possivel abonar.");
            }

            if (abono.Valor > lancamento.Valor)
            {
                return BadRequest("Valor do abono maior que o valor do lancamento.");
            }

            lancamento.Valor = Math.Round(
                lancamento.Valor - abono.Valor,
                2,
                MidpointRounding.AwayFromZero);
            abono.Status = "aprovado";
            abono.DataAprovacao = DateTime.UtcNow;

            RegistrarAudit(abono.OrganizacaoId, abono.Id, "AbonoFinanceiro", "APROVAR_ABONO", new
            {
                abono.LancamentoFinanceiroId,
                abono.Valor
            });
        }
        else if (statusNormalizado == "cancelado")
        {
            if (abono.Status == "aprovado")
            {
                return BadRequest("Nao e possivel cancelar um abono aprovado.");
            }

            abono.Status = "cancelado";
            RegistrarAudit(abono.OrganizacaoId, abono.Id, "AbonoFinanceiro", "CANCELAR_ABONO", new
            {
                abono.LancamentoFinanceiroId,
                abono.Valor
            });
        }
        else
        {
            if (abono.Status == "aprovado")
            {
                return BadRequest("Nao e possivel reabrir um abono aprovado.");
            }

            abono.Status = "pendente";
        }

        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("abonos/{id:guid}")]
    public async Task<IActionResult> RemoverAbono(Guid id)
    {
        var abono = await _db.AbonosFinanceiros.FindAsync(id);
        if (abono is null)
        {
            return NotFound();
        }

        if (abono.Status == "aprovado")
        {
            return BadRequest("Nao e possivel remover um abono aprovado.");
        }

        _db.AbonosFinanceiros.Remove(abono);
        RegistrarAudit(abono.OrganizacaoId, abono.Id, "AbonoFinanceiro", "REMOVER_ABONO", new
        {
            abono.LancamentoFinanceiroId,
            abono.Valor
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ---------------------------
    // Consumos
    // ---------------------------

    private static string NormalizarTipoConsumo(string tipo)
    {
        var normalizado = (tipo ?? string.Empty).Trim();
        if (string.Equals(normalizado, "agua", StringComparison.OrdinalIgnoreCase))
        {
            return "Agua";
        }
        if (string.Equals(normalizado, "gas", StringComparison.OrdinalIgnoreCase))
        {
            return "Gas";
        }
        if (string.Equals(normalizado, "energia", StringComparison.OrdinalIgnoreCase))
        {
            return "Energia";
        }
        if (string.Equals(normalizado, "outro", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizado, "outros", StringComparison.OrdinalIgnoreCase))
        {
            return "Outro";
        }
        return string.Empty;
    }

    private static bool CompetenciaValida(string competencia)
    {
        if (string.IsNullOrWhiteSpace(competencia))
        {
            return false;
        }

        return DateTime.TryParseExact(
            competencia,
            "yyyy-MM",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out _);
    }

    public class CriarMedidorConsumoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid UnidadeOrganizacionalId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public string UnidadeMedida { get; set; } = string.Empty;
        public string? NumeroSerie { get; set; }
        public bool Ativo { get; set; } = true;
        public string? Observacao { get; set; }
    }

    public class AtualizarMedidorConsumoRequest
    {
        public Guid UnidadeOrganizacionalId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public string UnidadeMedida { get; set; } = string.Empty;
        public string? NumeroSerie { get; set; }
        public bool Ativo { get; set; } = true;
        public string? Observacao { get; set; }
    }

    public class CriarLeituraConsumoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid MedidorId { get; set; }
        public string Competencia { get; set; } = string.Empty; // yyyy-MM
        public DateTime DataLeitura { get; set; }
        public decimal LeituraAtual { get; set; }
        public string? Observacao { get; set; }
    }

    public class AtualizarLeituraConsumoRequest
    {
        public string Competencia { get; set; } = string.Empty; // yyyy-MM
        public DateTime DataLeitura { get; set; }
        public decimal LeituraAtual { get; set; }
        public string? Observacao { get; set; }
    }

    [HttpGet("consumos/medidores")]
    public async Task<ActionResult<IEnumerable<MedidorConsumo>>> ListarMedidoresConsumo(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? unidadeId,
        [FromQuery] string? tipo,
        [FromQuery] bool? ativo)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var query = _db.MedidoresConsumo.AsNoTracking()
            .Where(m => m.OrganizacaoId == organizacaoId);

        if (unidadeId.HasValue && unidadeId.Value != Guid.Empty)
        {
            query = query.Where(m => m.UnidadeOrganizacionalId == unidadeId.Value);
        }

        if (!string.IsNullOrWhiteSpace(tipo))
        {
            var tipoNormalizado = NormalizarTipoConsumo(tipo);
            if (string.IsNullOrWhiteSpace(tipoNormalizado))
            {
                return BadRequest("Tipo invalido. Use Agua, Gas, Energia ou Outro.");
            }
            query = query.Where(m => m.Tipo == tipoNormalizado);
        }

        if (ativo.HasValue)
        {
            query = query.Where(m => m.Ativo == ativo.Value);
        }

        var itens = await query
            .OrderBy(m => m.Nome)
            .ToListAsync();

        return Ok(itens);
    }

    [HttpPost("consumos/medidores")]
    public async Task<ActionResult<MedidorConsumo>> CriarMedidorConsumo(
        CriarMedidorConsumoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        if (request.UnidadeOrganizacionalId == Guid.Empty)
        {
            return BadRequest("Unidade e obrigatoria.");
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome do medidor e obrigatorio.");
        }

        if (string.IsNullOrWhiteSpace(request.UnidadeMedida))
        {
            return BadRequest("Unidade de medida e obrigatoria.");
        }

        var unidadeValida = await _db.UnidadesOrganizacionais.AsNoTracking()
            .AnyAsync(u =>
                u.Id == request.UnidadeOrganizacionalId &&
                u.OrganizacaoId == request.OrganizacaoId);
        if (!unidadeValida)
        {
            return BadRequest("Unidade invalida para esta organizacao.");
        }

        var tipoNormalizado = NormalizarTipoConsumo(request.Tipo);
        if (string.IsNullOrWhiteSpace(tipoNormalizado))
        {
            return BadRequest("Tipo invalido. Use Agua, Gas, Energia ou Outro.");
        }

        var medidor = new MedidorConsumo
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            UnidadeOrganizacionalId = request.UnidadeOrganizacionalId,
            Nome = request.Nome.Trim(),
            Tipo = tipoNormalizado,
            UnidadeMedida = request.UnidadeMedida.Trim(),
            NumeroSerie = string.IsNullOrWhiteSpace(request.NumeroSerie)
                ? null
                : request.NumeroSerie.Trim(),
            Ativo = request.Ativo,
            Observacao = string.IsNullOrWhiteSpace(request.Observacao)
                ? null
                : request.Observacao.Trim()
        };

        _db.MedidoresConsumo.Add(medidor);
        RegistrarAudit(medidor.OrganizacaoId, medidor.Id, "MedidorConsumo", "CRIAR_MEDIDOR", new
        {
            medidor.Tipo,
            medidor.UnidadeOrganizacionalId
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ListarMedidoresConsumo), new { organizacaoId = medidor.OrganizacaoId }, medidor);
    }

    [HttpPut("consumos/medidores/{id:guid}")]
    public async Task<IActionResult> AtualizarMedidorConsumo(
        Guid id,
        AtualizarMedidorConsumoRequest request)
    {
        var medidor = await _db.MedidoresConsumo.FindAsync(id);
        if (medidor is null)
        {
            return NotFound();
        }

        if (request.UnidadeOrganizacionalId == Guid.Empty)
        {
            return BadRequest("Unidade e obrigatoria.");
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome do medidor e obrigatorio.");
        }

        if (string.IsNullOrWhiteSpace(request.UnidadeMedida))
        {
            return BadRequest("Unidade de medida e obrigatoria.");
        }

        var unidadeValida = await _db.UnidadesOrganizacionais.AsNoTracking()
            .AnyAsync(u =>
                u.Id == request.UnidadeOrganizacionalId &&
                u.OrganizacaoId == medidor.OrganizacaoId);
        if (!unidadeValida)
        {
            return BadRequest("Unidade invalida para esta organizacao.");
        }

        var tipoNormalizado = NormalizarTipoConsumo(request.Tipo);
        if (string.IsNullOrWhiteSpace(tipoNormalizado))
        {
            return BadRequest("Tipo invalido. Use Agua, Gas, Energia ou Outro.");
        }

        medidor.UnidadeOrganizacionalId = request.UnidadeOrganizacionalId;
        medidor.Nome = request.Nome.Trim();
        medidor.Tipo = tipoNormalizado;
        medidor.UnidadeMedida = request.UnidadeMedida.Trim();
        medidor.NumeroSerie = string.IsNullOrWhiteSpace(request.NumeroSerie)
            ? null
            : request.NumeroSerie.Trim();
        medidor.Ativo = request.Ativo;
        medidor.Observacao = string.IsNullOrWhiteSpace(request.Observacao)
            ? null
            : request.Observacao.Trim();

        RegistrarAudit(medidor.OrganizacaoId, medidor.Id, "MedidorConsumo", "ATUALIZAR_MEDIDOR", new
        {
            medidor.Tipo,
            medidor.UnidadeOrganizacionalId,
            medidor.Ativo
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("consumos/medidores/{id:guid}")]
    public async Task<IActionResult> RemoverMedidorConsumo(Guid id)
    {
        var medidor = await _db.MedidoresConsumo.FindAsync(id);
        if (medidor is null)
        {
            return NotFound();
        }

        var leituras = await _db.LeiturasConsumo
            .Where(l => l.MedidorId == id)
            .ToListAsync();
        if (leituras.Count > 0)
        {
            _db.LeiturasConsumo.RemoveRange(leituras);
        }

        _db.MedidoresConsumo.Remove(medidor);
        RegistrarAudit(medidor.OrganizacaoId, medidor.Id, "MedidorConsumo", "REMOVER_MEDIDOR", new
        {
            medidor.Tipo,
            medidor.UnidadeOrganizacionalId
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("consumos/medidores/{medidorId:guid}/leituras")]
    public async Task<ActionResult<IEnumerable<LeituraConsumo>>> ListarLeiturasConsumo(
        Guid medidorId,
        [FromQuery] Guid organizacaoId,
        [FromQuery] string? competencia)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        if (medidorId == Guid.Empty)
        {
            return BadRequest("Medidor e obrigatorio.");
        }

        var query = _db.LeiturasConsumo.AsNoTracking()
            .Where(l => l.OrganizacaoId == organizacaoId && l.MedidorId == medidorId);

        if (!string.IsNullOrWhiteSpace(competencia))
        {
            if (!CompetenciaValida(competencia))
            {
                return BadRequest("Competencia invalida. Use yyyy-MM.");
            }

            query = query.Where(l => l.Competencia == competencia);
        }

        var itens = await query
            .OrderByDescending(l => l.DataLeitura)
            .ThenByDescending(l => l.Competencia)
            .ToListAsync();

        return Ok(itens);
    }

    [HttpPost("consumos/leituras")]
    public async Task<ActionResult<LeituraConsumo>> CriarLeituraConsumo(
        CriarLeituraConsumoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        if (request.MedidorId == Guid.Empty)
        {
            return BadRequest("Medidor e obrigatorio.");
        }

        if (!CompetenciaValida(request.Competencia))
        {
            return BadRequest("Competencia invalida. Use yyyy-MM.");
        }

        if (request.DataLeitura == default)
        {
            return BadRequest("Data de leitura invalida.");
        }

        if (request.LeituraAtual < 0)
        {
            return BadRequest("Leitura atual invalida.");
        }

        var medidor = await _db.MedidoresConsumo.AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == request.MedidorId);
        if (medidor is null)
        {
            return BadRequest("Medidor nao encontrado.");
        }

        if (medidor.OrganizacaoId != request.OrganizacaoId)
        {
            return BadRequest("Medidor nao pertence a organizacao informada.");
        }

        var ultima = await _db.LeiturasConsumo.AsNoTracking()
            .Where(l => l.MedidorId == request.MedidorId)
            .OrderByDescending(l => l.DataLeitura)
            .ThenByDescending(l => l.Competencia)
            .FirstOrDefaultAsync();

        var leituraAnterior = ultima?.LeituraAtual ?? 0m;
        var consumo = request.LeituraAtual - leituraAnterior;
        if (consumo < 0)
        {
            return BadRequest("Leitura atual deve ser maior ou igual a anterior.");
        }

        var leitura = new LeituraConsumo
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            MedidorId = request.MedidorId,
            Competencia = request.Competencia,
            DataLeitura = request.DataLeitura,
            LeituraAtual = request.LeituraAtual,
            LeituraAnterior = leituraAnterior,
            Consumo = consumo,
            Observacao = string.IsNullOrWhiteSpace(request.Observacao)
                ? null
                : request.Observacao.Trim()
        };

        _db.LeiturasConsumo.Add(leitura);
        RegistrarAudit(leitura.OrganizacaoId, leitura.Id, "LeituraConsumo", "CRIAR_LEITURA", new
        {
            leitura.MedidorId,
            leitura.Competencia,
            leitura.Consumo
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(
            nameof(ListarLeiturasConsumo),
            new { organizacaoId = leitura.OrganizacaoId, medidorId = leitura.MedidorId },
            leitura);
    }

    [HttpPut("consumos/leituras/{id:guid}")]
    public async Task<IActionResult> AtualizarLeituraConsumo(
        Guid id,
        AtualizarLeituraConsumoRequest request)
    {
        var leitura = await _db.LeiturasConsumo.FindAsync(id);
        if (leitura is null)
        {
            return NotFound();
        }

        if (!CompetenciaValida(request.Competencia))
        {
            return BadRequest("Competencia invalida. Use yyyy-MM.");
        }

        if (request.DataLeitura == default)
        {
            return BadRequest("Data de leitura invalida.");
        }

        if (request.LeituraAtual < 0)
        {
            return BadRequest("Leitura atual invalida.");
        }

        var consumo = request.LeituraAtual - leitura.LeituraAnterior;
        if (consumo < 0)
        {
            return BadRequest("Leitura atual deve ser maior ou igual a anterior.");
        }

        leitura.Competencia = request.Competencia;
        leitura.DataLeitura = request.DataLeitura;
        leitura.LeituraAtual = request.LeituraAtual;
        leitura.Consumo = consumo;
        leitura.Observacao = string.IsNullOrWhiteSpace(request.Observacao)
            ? null
            : request.Observacao.Trim();

        RegistrarAudit(leitura.OrganizacaoId, leitura.Id, "LeituraConsumo", "ATUALIZAR_LEITURA", new
        {
            leitura.MedidorId,
            leitura.Competencia,
            leitura.Consumo
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("consumos/leituras/{id:guid}")]
    public async Task<IActionResult> RemoverLeituraConsumo(Guid id)
    {
        var leitura = await _db.LeiturasConsumo.FindAsync(id);
        if (leitura is null)
        {
            return NotFound();
        }

        _db.LeiturasConsumo.Remove(leitura);
        RegistrarAudit(leitura.OrganizacaoId, leitura.Id, "LeituraConsumo", "REMOVER_LEITURA", new
        {
            leitura.MedidorId,
            leitura.Competencia,
            leitura.Consumo
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ---------------------------
    // Cobrancas por unidade
    // ---------------------------

    public record CobrancaUnidadeDto(
        Guid Id,
        Guid OrganizacaoId,
        Guid UnidadeOrganizacionalId,
        string Competencia,
        string Descricao,
        Guid? CategoriaId,
        Guid? CentroCustoId,
        decimal Valor,
        DateTime Vencimento,
        string Status,
        DateTime? PagoEm,
        string? FormaPagamento,
        Guid? ContaBancariaId,
        Guid? AcordoId,
        int? ParcelaNumero,
        int? ParcelaTotal,
        decimal ValorAtualizado,
        decimal Multa,
        decimal Juros,
        decimal Correcao,
        int DiasAtraso,
        decimal CreditoDisponivel);

    public record CobrancaOrganizacaoDto(
        Guid Id,
        Guid OrganizacaoId,
        Guid UnidadeOrganizacionalId,
        string UnidadeCodigo,
        string UnidadeNome,
        string Competencia,
        string Descricao,
        Guid? CategoriaId,
        Guid? CentroCustoId,
        decimal Valor,
        DateTime Vencimento,
        string Status,
        DateTime? PagoEm,
        string? FormaPagamento,
        Guid? ContaBancariaId,
        Guid? AcordoId,
        int? ParcelaNumero,
        int? ParcelaTotal,
        decimal ValorAtualizado,
        decimal Multa,
        decimal Juros,
        decimal Correcao,
        int DiasAtraso);

    public class CriarCobrancaUnidadeRequest
    {
        public Guid OrganizacaoId { get; set; }
        public string Competencia { get; set; } = string.Empty;
        public string Descricao { get; set; } = string.Empty;
        public Guid? CategoriaId { get; set; }
        public Guid? CentroCustoId { get; set; }
        public decimal Valor { get; set; }
        public DateTime Vencimento { get; set; }
        public string? Status { get; set; }
        public string? FormaPagamento { get; set; }
        public Guid? ContaBancariaId { get; set; }
    }

    [HttpGet("unidades/{unidadeId:guid}/cobrancas")]
    public async Task<ActionResult<IEnumerable<CobrancaUnidadeDto>>> ListarCobrancasUnidade(
        Guid unidadeId,
        [FromQuery] string? competencia)
    {
        if (unidadeId == Guid.Empty)
        {
            return BadRequest("UnidadeId e obrigatorio.");
        }

        var unidade = await _db.UnidadesOrganizacionais.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == unidadeId);
        if (unidade is null)
        {
            return NotFound("Unidade nao encontrada.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            unidade.OrganizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            if (!auth.Membership.UnidadeOrganizacionalId.HasValue ||
                auth.Membership.UnidadeOrganizacionalId.Value != unidadeId)
            {
                return Forbid();
            }
        }

        var query = _db.UnidadesCobrancas.AsNoTracking()
            .Where(c => c.UnidadeOrganizacionalId == unidadeId);

        if (!string.IsNullOrWhiteSpace(competencia))
        {
            query = query.Where(c => c.Competencia == competencia.Trim());
        }

        var itens = await query
            .OrderByDescending(c => c.Vencimento)
            .ToListAsync();

        var politica = await ObterPoliticaCobrancaAsync(unidade.OrganizacaoId);
        var correcaoPercentual = await ObterCorrecaoPercentualAsync(
            politica,
            DateTime.UtcNow);
        var creditoDisponivel = await ObterCreditoDisponivelAsync(unidadeId);

        var resposta = itens.Select(c =>
        {
            var encargos = CalcularEncargos(
                c.Valor,
                c.Vencimento,
                politica,
                correcaoPercentual);
            return new CobrancaUnidadeDto(
                c.Id,
                c.OrganizacaoId,
                c.UnidadeOrganizacionalId,
                c.Competencia,
                c.Descricao,
                c.CategoriaId,
                c.CentroCustoId,
                c.Valor,
                c.Vencimento,
                c.Status,
                c.PagoEm,
                c.FormaPagamento,
                c.ContaBancariaId,
                c.AcordoId,
                c.ParcelaNumero,
                c.ParcelaTotal,
                encargos.ValorAtualizado,
                encargos.Multa,
                encargos.Juros,
                encargos.Correcao,
                encargos.DiasAtraso,
                creditoDisponivel);
        }).ToList();

        return Ok(resposta);
    }

    [HttpGet("cobrancas")]
    public async Task<ActionResult<IEnumerable<CobrancaOrganizacaoDto>>> ListarCobrancasOrganizacao(
        [FromQuery] Guid organizacaoId,
        [FromQuery] string? status,
        [FromQuery] string? competencia)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRoleAsync(organizacaoId, UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.UnidadesCobrancas.AsNoTracking()
            .Where(c => c.OrganizacaoId == organizacaoId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusNormalizado = NormalizarStatusCobranca(status);
            query = query.Where(c => c.Status == statusNormalizado);
        }

        if (!string.IsNullOrWhiteSpace(competencia))
        {
            query = query.Where(c => c.Competencia == competencia.Trim());
        }

        var cobrancas = await query
            .OrderByDescending(c => c.Vencimento)
            .ToListAsync();

        var unidades = await _db.UnidadesOrganizacionais.AsNoTracking()
            .Where(u => u.OrganizacaoId == organizacaoId)
            .Select(u => new { u.Id, u.CodigoInterno, u.Nome })
            .ToListAsync();

        var unidadesMap = unidades.ToDictionary(u => u.Id, u => u);
        var politica = await ObterPoliticaCobrancaAsync(organizacaoId);
        var correcaoPercentual = await ObterCorrecaoPercentualAsync(
            politica,
            DateTime.UtcNow);

        var resposta = cobrancas.Select(c =>
        {
            var unidadeInfo = unidadesMap.GetValueOrDefault(c.UnidadeOrganizacionalId);
            var encargos = CalcularEncargos(
                c.Valor,
                c.Vencimento,
                politica,
                correcaoPercentual);
            return new CobrancaOrganizacaoDto(
                c.Id,
                c.OrganizacaoId,
                c.UnidadeOrganizacionalId,
                unidadeInfo?.CodigoInterno ?? "-",
                unidadeInfo?.Nome ?? "-",
                c.Competencia,
                c.Descricao,
                c.CategoriaId,
                c.CentroCustoId,
                c.Valor,
                c.Vencimento,
                c.Status,
                c.PagoEm,
                c.FormaPagamento,
                c.ContaBancariaId,
                c.AcordoId,
                c.ParcelaNumero,
                c.ParcelaTotal,
                encargos.ValorAtualizado,
                encargos.Multa,
                encargos.Juros,
                encargos.Correcao,
                encargos.DiasAtraso);
        }).ToList();

        return Ok(resposta);
    }

    public class CriarAcordoCobrancaRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid UnidadeId { get; set; }
        public List<Guid> CobrancaIds { get; set; } = new();
        public int NumeroParcelas { get; set; }
        public DateTime DataPrimeiraParcela { get; set; }
        public decimal? Desconto { get; set; }
        public string? Observacao { get; set; }
    }

    public class GerarBoletosAcordoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public string? Tipo { get; set; }
    }

    public record GerarBoletosAcordoResumo(int Criadas, int Ignoradas);

    [HttpGet("cobrancas/acordos")]
    public async Task<ActionResult<IEnumerable<AcordoCobranca>>> ListarAcordosCobranca(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? unidadeId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(organizacaoId, UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.AcordosCobranca.AsNoTracking()
            .Where(a => a.OrganizacaoId == organizacaoId);

        if (unidadeId.HasValue && unidadeId.Value != Guid.Empty)
        {
            query = query.Where(a => a.UnidadeOrganizacionalId == unidadeId.Value);
        }

        var acordos = await query
            .OrderByDescending(a => a.CriadoEm)
            .ToListAsync();

        return Ok(acordos);
    }

    [HttpGet("cobrancas/acordos/{id:guid}/parcelas")]
    public async Task<ActionResult<IEnumerable<AcordoParcela>>> ListarParcelasAcordo(Guid id)
    {
        var acordo = await _db.AcordosCobranca.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
        if (acordo is null)
        {
            return NotFound();
        }

        var auth = await EnsureRoleAsync(acordo.OrganizacaoId, UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var parcelas = await _db.AcordosParcelas.AsNoTracking()
            .Where(p => p.AcordoId == id)
            .OrderBy(p => p.Numero)
            .ToListAsync();

        return Ok(parcelas);
    }

    [HttpPost("cobrancas/acordos/{id:guid}/boletos")]
    public async Task<ActionResult<GerarBoletosAcordoResumo>> GerarBoletosAcordo(
        Guid id,
        GerarBoletosAcordoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        if (id == Guid.Empty)
        {
            return BadRequest("Acordo invalido.");
        }

        var acordo = await _db.AcordosCobranca
            .FirstOrDefaultAsync(a => a.Id == id && a.OrganizacaoId == request.OrganizacaoId);
        if (acordo is null)
        {
            return NotFound("Acordo nao encontrado.");
        }

        var auth = await EnsureRoleAsync(request.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var tipo = string.IsNullOrWhiteSpace(request.Tipo)
            ? "boleto"
            : request.Tipo.Trim().ToLowerInvariant();

        var parcelas = await _db.AcordosParcelas.AsNoTracking()
            .Where(p => p.AcordoId == acordo.Id)
            .OrderBy(p => p.Numero)
            .ToListAsync();

        if (parcelas.Count == 0)
        {
            return Ok(new GerarBoletosAcordoResumo(0, 0));
        }

        var cobrancasIds = parcelas
            .Where(p => p.CobrancaId.HasValue)
            .Select(p => p.CobrancaId!.Value)
            .ToList();

        var cobrancas = await _db.UnidadesCobrancas.AsNoTracking()
            .Where(c => cobrancasIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c);

        var planoContasId = cobrancas.Values
            .Select(c => c.CategoriaId)
            .FirstOrDefault(c => c.HasValue)
            ?.Value ?? Guid.Empty;

        if (planoContasId == Guid.Empty)
        {
            var planoFallback = await _db.PlanosContas.AsNoTracking()
                .Where(p => p.OrganizacaoId == request.OrganizacaoId && p.Tipo == "receita")
                .OrderBy(p => p.Nivel)
                .ThenBy(p => p.Codigo)
                .FirstOrDefaultAsync();
            planoContasId = planoFallback?.Id ?? Guid.Empty;
        }

        if (planoContasId == Guid.Empty)
        {
            return BadRequest("Cadastre uma categoria (plano de contas) de receita para gerar boletos.");
        }

        var pessoaId = await _db.VinculosPessoaOrganizacao.AsNoTracking()
            .Where(v => v.OrganizacaoId == request.OrganizacaoId &&
                        v.UnidadeOrganizacionalId == acordo.UnidadeOrganizacionalId &&
                        (v.DataFim == null || v.DataFim > DateTime.UtcNow))
            .Select(v => (Guid?)v.PessoaId)
            .FirstOrDefaultAsync();

        if (!pessoaId.HasValue)
        {
            pessoaId = await _db.VinculosPessoaOrganizacao.AsNoTracking()
                .Where(v => v.OrganizacaoId == request.OrganizacaoId)
                .Select(v => (Guid?)v.PessoaId)
                .FirstOrDefaultAsync();
        }

        if (!pessoaId.HasValue || pessoaId.Value == Guid.Empty)
        {
            return BadRequest("Nenhuma pessoa vinculada a organizacao para gerar boletos.");
        }

        var criadas = 0;
        var ignoradas = 0;

        foreach (var parcela in parcelas)
        {
            if (parcela.Status == "pago")
            {
                ignoradas++;
                continue;
            }

            if (!parcela.CobrancaId.HasValue ||
                !cobrancas.TryGetValue(parcela.CobrancaId.Value, out var cobranca))
            {
                ignoradas++;
                continue;
            }

            if (string.Equals(cobranca.Status, "PAGA", StringComparison.OrdinalIgnoreCase))
            {
                ignoradas++;
                continue;
            }

            var identificador = $"ACORDO-{acordo.Id:N}-P{parcela.Numero}";

            var existe = await _db.DocumentosCobranca.AsNoTracking()
                .AnyAsync(f =>
                    f.OrganizacaoId == request.OrganizacaoId &&
                    f.IdentificadorExterno == identificador &&
                    f.Status != "cancelada");

            if (existe)
            {
                ignoradas++;
                continue;
            }

            var lancamento = new LancamentoFinanceiro
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = request.OrganizacaoId,
                Tipo = "receber",
                Situacao = SituacaoAberto,
                PlanoContasId = planoContasId,
                CentroCustoId = cobranca.CentroCustoId,
                PessoaId = pessoaId.Value,
                Descricao = cobranca.Descricao,
                Valor = cobranca.Valor,
                DataCompetencia = cobranca.Vencimento.Date,
                DataVencimento = cobranca.Vencimento.Date,
                FormaPagamento = tipo,
                ParcelaNumero = cobranca.ParcelaNumero,
                ParcelaTotal = cobranca.ParcelaTotal,
                Referencia = identificador
            };

            _db.LancamentosFinanceiros.Add(lancamento);

            var faturaId = Guid.NewGuid();
            var linhaDigitavel = string.Equals(tipo, "boleto", StringComparison.OrdinalIgnoreCase) ||
                                 string.Equals(tipo, "pix", StringComparison.OrdinalIgnoreCase)
                ? GerarLinhaDigitavelFicticia(faturaId)
                : null;
            var qrCode = string.Equals(tipo, "pix", StringComparison.OrdinalIgnoreCase)
                ? GerarQrCodePixFicticio(faturaId, lancamento.Valor)
                : null;

            var statusInicial = cobranca.Vencimento.Date < DateTime.UtcNow.Date ? "vencida" : "emitida";

            _db.DocumentosCobranca.Add(new DocumentoCobranca
            {
                Id = faturaId,
                OrganizacaoId = request.OrganizacaoId,
                LancamentoFinanceiroId = lancamento.Id,
                Tipo = tipo,
                IdentificadorExterno = identificador,
                LinhaDigitavel = linhaDigitavel,
                QrCode = qrCode,
                UrlPagamento = GerarUrlPagamentoFicticia(tipo, faturaId),
                Status = statusInicial,
                DataEmissao = DateTime.UtcNow,
                DataVencimento = cobranca.Vencimento.Date
            });

            criadas++;
        }

        if (criadas > 0)
        {
            RegistrarAudit(request.OrganizacaoId, acordo.Id, "AcordoCobranca", "GERAR_BOLETOS_ACORDO", new
            {
                criadas,
                ignoradas,
                tipo
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new GerarBoletosAcordoResumo(criadas, ignoradas));
    }

    [HttpPost("cobrancas/acordos")]
    public async Task<ActionResult<AcordoCobranca>> CriarAcordoCobranca(CriarAcordoCobrancaRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        if (request.UnidadeId == Guid.Empty)
        {
            return BadRequest("Unidade e obrigatoria.");
        }

        if (request.NumeroParcelas <= 0)
        {
            return BadRequest("Numero de parcelas invalido.");
        }

        if (request.CobrancaIds.Count == 0)
        {
            return BadRequest("Informe as cobrancas para negociar.");
        }

        var auth = await EnsureRoleAsync(request.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var cobrancas = await _db.UnidadesCobrancas
            .Where(c =>
                request.CobrancaIds.Contains(c.Id) &&
                c.OrganizacaoId == request.OrganizacaoId &&
                c.UnidadeOrganizacionalId == request.UnidadeId)
            .ToListAsync();

        if (cobrancas.Count != request.CobrancaIds.Count)
        {
            return BadRequest("Cobranca(s) invalidas para a unidade.");
        }

        if (cobrancas.Any(c => string.Equals(c.Status, "PAGA", StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest("Nao e possivel negociar cobranca ja paga.");
        }

        var totalOriginal = cobrancas.Sum(c => c.Valor);
        var desconto = Math.Max(0m, request.Desconto ?? 0m);
        if (desconto > totalOriginal)
        {
            desconto = totalOriginal;
        }

        var totalAcordo = Math.Round(totalOriginal - desconto, 2, MidpointRounding.AwayFromZero);
        var baseParcela = Math.Round(totalAcordo / request.NumeroParcelas, 2, MidpointRounding.AwayFromZero);

        var acordo = new AcordoCobranca
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            UnidadeOrganizacionalId = request.UnidadeId,
            TotalOriginal = totalOriginal,
            Desconto = desconto,
            TotalAcordo = totalAcordo,
            NumeroParcelas = request.NumeroParcelas,
            DataPrimeiraParcela = request.DataPrimeiraParcela.Date,
            Status = "ativo",
            Observacao = string.IsNullOrWhiteSpace(request.Observacao) ? null : request.Observacao.Trim(),
            CriadoEm = DateTime.UtcNow
        };
        _db.AcordosCobranca.Add(acordo);

        var vencimentoBase = request.DataPrimeiraParcela.Date;
        var categoriaId = cobrancas.FirstOrDefault()?.CategoriaId;
        var centroCustoId = cobrancas.FirstOrDefault()?.CentroCustoId;

        for (var i = 1; i <= request.NumeroParcelas; i++)
        {
            var valorParcela = i == request.NumeroParcelas
                ? Math.Round(totalAcordo - baseParcela * (request.NumeroParcelas - 1), 2, MidpointRounding.AwayFromZero)
                : baseParcela;

            var vencimento = vencimentoBase.AddMonths(i - 1);
            var competencia = vencimento.ToString("yyyy-MM");

            var cobrancaParcela = new UnidadeCobranca
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = request.OrganizacaoId,
                UnidadeOrganizacionalId = request.UnidadeId,
                Competencia = competencia,
                Descricao = $"Acordo {acordo.Id.ToString()[..8]} Parcela {i}/{request.NumeroParcelas}",
                CategoriaId = categoriaId,
                CentroCustoId = centroCustoId,
                Valor = valorParcela,
                Vencimento = vencimento,
                Status = "ABERTA",
                AcordoId = acordo.Id,
                ParcelaNumero = i,
                ParcelaTotal = request.NumeroParcelas
            };
            _db.UnidadesCobrancas.Add(cobrancaParcela);
            await AplicarCreditoAutomaticoAsync(cobrancaParcela);

            _db.AcordosParcelas.Add(new AcordoParcela
            {
                Id = Guid.NewGuid(),
                AcordoId = acordo.Id,
                CobrancaId = cobrancaParcela.Id,
                Numero = i,
                Valor = valorParcela,
                Vencimento = vencimento,
                Status = "aberto"
            });
        }

        foreach (var cobranca in cobrancas)
        {
            cobranca.Status = "NEGOCIADA";
        }

        RegistrarAudit(request.OrganizacaoId, acordo.Id, "AcordoCobranca", "CRIAR_ACORDO_COBRANCA", new
        {
            acordo.TotalOriginal,
            acordo.Desconto,
            acordo.TotalAcordo,
            acordo.NumeroParcelas
        });

        await _db.SaveChangesAsync();
        return Ok(acordo);
    }

    [HttpPost("unidades/{unidadeId:guid}/cobrancas")]
    public async Task<ActionResult<UnidadeCobranca>> CriarCobrancaUnidade(
        Guid unidadeId,
        CriarCobrancaUnidadeRequest request)
    {
        if (unidadeId == Guid.Empty)
        {
            return BadRequest("UnidadeId e obrigatorio.");
        }

        var unidade = await _db.UnidadesOrganizacionais.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == unidadeId);
        if (unidade is null)
        {
            return NotFound("Unidade nao encontrada.");
        }

        request.OrganizacaoId = request.OrganizacaoId == Guid.Empty ? unidade.OrganizacaoId : request.OrganizacaoId;
        var auth = await EnsureRoleAsync(request.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Descricao))
        {
            return BadRequest("Descricao e obrigatoria.");
        }

        var competencia = string.IsNullOrWhiteSpace(request.Competencia)
            ? request.Vencimento.ToString("yyyy-MM")
            : request.Competencia.Trim();

        var cobranca = new UnidadeCobranca
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            UnidadeOrganizacionalId = unidadeId,
            Competencia = competencia,
            Descricao = request.Descricao.Trim(),
            CategoriaId = request.CategoriaId,
            CentroCustoId = request.CentroCustoId,
            Valor = request.Valor,
            Vencimento = request.Vencimento,
            Status = NormalizarStatusCobranca(request.Status),
            FormaPagamento = request.FormaPagamento,
            ContaBancariaId = request.ContaBancariaId
        };

        _db.UnidadesCobrancas.Add(cobranca);
        await AplicarCreditoAutomaticoAsync(cobranca);
        RegistrarAudit(request.OrganizacaoId, cobranca.Id, "UnidadeCobranca", "CRIAR_COBRANCA_UNIDADE", new
        {
            cobranca.Descricao,
            cobranca.Valor,
            cobranca.Vencimento
        });
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarCobrancasUnidade), new { unidadeId }, cobranca);
    }

    public class AtualizarCobrancaUnidadeRequest
    {
        public string? Status { get; set; }
        public DateTime? Vencimento { get; set; }
        public decimal? Valor { get; set; }
        public string? FormaPagamento { get; set; }
        public Guid? ContaBancariaId { get; set; }
    }

    [HttpPatch("cobrancas/{id:guid}")]
    public async Task<ActionResult<UnidadeCobranca>> AtualizarCobrancaUnidade(
        Guid id,
        AtualizarCobrancaUnidadeRequest request)
    {
        var cobranca = await _db.UnidadesCobrancas.FindAsync(id);
        if (cobranca is null)
        {
            return NotFound();
        }

        var auth = await EnsureRoleAsync(cobranca.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var novoStatus = NormalizarStatusCobranca(request.Status);
            if (!StatusCobrancaValidos.Contains(novoStatus))
            {
                return BadRequest("Status invalido.");
            }

            if (string.Equals(cobranca.Status, "FECHADA", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(novoStatus, "FECHADA", StringComparison.OrdinalIgnoreCase))
            {
                if (!auth.IsPlatformAdmin)
                {
                    return Forbid();
                }
            }

            cobranca.Status = novoStatus;
            if (novoStatus == "PAGA")
            {
                cobranca.PagoEm ??= DateTime.UtcNow;
            }
        }

        if (request.Vencimento.HasValue)
        {
            cobranca.Vencimento = request.Vencimento.Value;
        }

        if (request.Valor.HasValue)
        {
            cobranca.Valor = request.Valor.Value;
        }

        if (request.FormaPagamento is not null)
        {
            cobranca.FormaPagamento = request.FormaPagamento;
        }

        if (request.ContaBancariaId.HasValue)
        {
            cobranca.ContaBancariaId = request.ContaBancariaId.Value;
        }

        RegistrarAudit(cobranca.OrganizacaoId, cobranca.Id, "UnidadeCobranca", "ATUALIZAR_COBRANCA_UNIDADE", new
        {
            cobranca.Status,
            cobranca.Valor,
            cobranca.Vencimento
        });
        await _db.SaveChangesAsync();
        return Ok(cobranca);
    }

    public class PagarCobrancaUnidadeRequest
    {
        public decimal ValorPago { get; set; }
        public DateTime? DataPagamento { get; set; }
        public Guid? ContaBancariaId { get; set; }
        public Guid? ComprovanteAnexoId { get; set; }
        public string? FormaPagamento { get; set; }
        public string? Observacao { get; set; }
    }

    [HttpPost("cobrancas/{id:guid}/pagar")]
    public async Task<ActionResult<UnidadePagamento>> PagarCobrancaUnidade(Guid id, PagarCobrancaUnidadeRequest request)
    {
        var cobranca = await _db.UnidadesCobrancas.FindAsync(id);
        if (cobranca is null)
        {
            return NotFound();
        }

        var auth = await EnsureRoleAsync(
            cobranca.OrganizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            if (!auth.Membership.UnidadeOrganizacionalId.HasValue ||
                auth.Membership.UnidadeOrganizacionalId.Value != cobranca.UnidadeOrganizacionalId)
            {
                return Forbid();
            }
        }

        if (string.Equals(cobranca.Status, "NEGOCIADA", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Cobranca negociada deve ser paga pelas parcelas do acordo.");
        }

        if (request.ValorPago <= 0)
        {
            return BadRequest("Valor pago deve ser maior que zero.");
        }

        var pagamento = new UnidadePagamento
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = cobranca.OrganizacaoId,
            CobrancaId = cobranca.Id,
            ValorPago = request.ValorPago,
            DataPagamento = request.DataPagamento ?? DateTime.UtcNow,
            ContaBancariaId = request.ContaBancariaId,
            ComprovanteAnexoId = request.ComprovanteAnexoId,
            Observacao = request.Observacao
        };

        _db.UnidadesPagamentos.Add(pagamento);

        var totalPagoAnterior = (await _db.UnidadesPagamentos.AsNoTracking()
            .Where(p => p.CobrancaId == cobranca.Id)
            .Select(p => p.ValorPago)
            .ToListAsync())
            .Sum();
        var saldoAnterior = Math.Round(cobranca.Valor - totalPagoAnterior, 2, MidpointRounding.AwayFromZero);
        var excedente = saldoAnterior > 0
            ? Math.Max(0, Math.Round(request.ValorPago - saldoAnterior, 2, MidpointRounding.AwayFromZero))
            : request.ValorPago;

        var totalPago = totalPagoAnterior + request.ValorPago;

        if (totalPago >= cobranca.Valor)
        {
            cobranca.Status = "PAGA";
            cobranca.PagoEm = pagamento.DataPagamento;
        }
        else
        {
            cobranca.Status = "ABERTA";
        }

        if (cobranca.AcordoId.HasValue && string.Equals(cobranca.Status, "PAGA", StringComparison.OrdinalIgnoreCase))
        {
            var parcela = await _db.AcordosParcelas
                .FirstOrDefaultAsync(p => p.CobrancaId == cobranca.Id);
            if (parcela is not null)
            {
                parcela.Status = "pago";
                parcela.PagoEm = pagamento.DataPagamento;
            }

            var acordo = await _db.AcordosCobranca.FindAsync(cobranca.AcordoId.Value);
            if (acordo is not null)
            {
                var pendentes = await _db.AcordosParcelas.AsNoTracking()
                    .AnyAsync(p => p.AcordoId == acordo.Id && p.Status != "pago");
                if (!pendentes)
                {
                    acordo.Status = "concluido";
                }
            }
        }

        if (request.ContaBancariaId.HasValue)
        {
            cobranca.ContaBancariaId = request.ContaBancariaId.Value;
        }

        if (!string.IsNullOrWhiteSpace(request.FormaPagamento))
        {
            cobranca.FormaPagamento = request.FormaPagamento;
        }

        if (excedente > 0)
        {
            _db.UnidadesCreditos.Add(new UnidadeCreditoMovimento
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = cobranca.OrganizacaoId,
                UnidadeOrganizacionalId = cobranca.UnidadeOrganizacionalId,
                CobrancaId = cobranca.Id,
                PagamentoId = pagamento.Id,
                Tipo = "credito",
                Valor = excedente,
                DataMovimento = pagamento.DataPagamento,
                Observacao = "Credito por pagamento excedente"
            });
        }

        RegistrarAudit(cobranca.OrganizacaoId, cobranca.Id, "UnidadeCobranca", "PAGAR_COBRANCA_UNIDADE", new
        {
            pagamento.ValorPago,
            pagamento.DataPagamento,
            excedente
        });
        await _db.SaveChangesAsync();
        return Ok(pagamento);
    }

    [HttpGet("cobrancas/{id:guid}/pagamentos")]
    public async Task<ActionResult<IEnumerable<UnidadePagamento>>> ListarPagamentosCobranca(Guid id)
    {
        var cobranca = await _db.UnidadesCobrancas.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        if (cobranca is null)
        {
            return NotFound();
        }

        var auth = await EnsureRoleAsync(
            cobranca.OrganizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            if (!auth.Membership.UnidadeOrganizacionalId.HasValue ||
                auth.Membership.UnidadeOrganizacionalId.Value != cobranca.UnidadeOrganizacionalId)
            {
                return Forbid();
            }
        }

        var pagamentos = await _db.UnidadesPagamentos.AsNoTracking()
            .Where(p => p.CobrancaId == id)
            .OrderByDescending(p => p.DataPagamento)
            .ToListAsync();
        return Ok(pagamentos);
    }

    public record CreditoUnidadeResponse(decimal Saldo, IEnumerable<UnidadeCreditoMovimento> Movimentos);

    [HttpGet("unidades/{unidadeId:guid}/creditos")]
    public async Task<ActionResult<CreditoUnidadeResponse>> ListarCreditosUnidade(Guid unidadeId)
    {
        if (unidadeId == Guid.Empty)
        {
            return BadRequest("UnidadeId e obrigatorio.");
        }

        var unidade = await _db.UnidadesOrganizacionais.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == unidadeId);
        if (unidade is null)
        {
            return NotFound("Unidade nao encontrada.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            unidade.OrganizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            if (!auth.Membership.UnidadeOrganizacionalId.HasValue ||
                auth.Membership.UnidadeOrganizacionalId.Value != unidadeId)
            {
                return Forbid();
            }
        }

        var movimentos = await _db.UnidadesCreditos.AsNoTracking()
            .Where(m => m.UnidadeOrganizacionalId == unidadeId)
            .OrderByDescending(m => m.DataMovimento)
            .ToListAsync();
        var saldo = movimentos.Where(m => m.EstornadoEm == null).Sum(m => m.Valor);
        return Ok(new CreditoUnidadeResponse(saldo, movimentos));
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
        Guid? MovimentoId,
        Guid? SugestaoLancamentoId,
        Guid? SugestaoCobrancaId,
        string? SugestaoDescricao,
        string? SugestaoTipo);

    public record ConciliacaoImportResponse(
        string Arquivo,
        int Total,
        IEnumerable<ExtratoItemDto> Itens);

    [HttpPost("conciliacao/importar")]
    [RequestSizeLimit(25_000_000)]
    public async Task<ActionResult<ConciliacaoImportResponse>> ImportarExtrato(
        [FromForm] Guid organizacaoId,
        [FromForm] Guid? contaBancariaId,
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
        var contaId = contaBancariaId ?? Guid.Empty;

        var movimentos = await RegistrarMovimentosAsync(organizacaoId, contaId, itensBase);
        var itens = await SugerirLancamentosAsync(organizacaoId, itensBase, movimentos);

        RegistrarAudit(organizacaoId, Guid.NewGuid(), "ConciliacaoBancaria", "IMPORTAR_EXTRATO", new
        {
            Arquivo = arquivo.FileName,
            Total = itens.Count
        });
        await _db.SaveChangesAsync();

        return Ok(new ConciliacaoImportResponse(arquivo.FileName, itens.Count, itens));
    }

    [HttpGet("conciliacao/movimentos")]
    public async Task<ActionResult<IEnumerable<MovimentoBancario>>> ListarMovimentos(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? contaBancariaId,
        [FromQuery] string? status)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(organizacaoId, UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.MovimentosBancarios.AsNoTracking()
            .Where(m => m.OrganizacaoId == organizacaoId);

        if (contaBancariaId.HasValue && contaBancariaId.Value != Guid.Empty)
        {
            query = query.Where(m => m.ContaBancariaId == contaBancariaId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(m => m.Status == status.Trim().ToUpperInvariant());
        }

        var itens = await query.OrderByDescending(m => m.Data).ToListAsync();
        return Ok(itens);
    }

    public class ConfirmarConciliacaoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public DateTime? DataConciliacao { get; set; }
        public string? Referencia { get; set; }
        public string? Documento { get; set; }
        public Guid? MovimentoBancarioId { get; set; }
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
            UserRole.CONDO_ADMIN);
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

        if (request.MovimentoBancarioId.HasValue)
        {
            var movimento = await _db.MovimentosBancarios.FindAsync(request.MovimentoBancarioId.Value);
            if (movimento is not null && movimento.OrganizacaoId == request.OrganizacaoId)
            {
                movimento.Status = "CONCILIADO";
                movimento.LancamentoFinanceiroId = lancamento.Id;
            }
        }

        await _db.SaveChangesAsync();

        return NoContent();
    }

    public class VincularMovimentoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid? LancamentoId { get; set; }
        public Guid? CobrancaUnidadeId { get; set; }
        public Guid? ContaBancariaId { get; set; }
    }

    [HttpPost("conciliacao/movimentos/{id:guid}/vincular")]
    public async Task<IActionResult> VincularMovimento(Guid id, VincularMovimentoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("Organizacao e obrigatoria.");
        }

        var auth = await EnsureRoleAsync(request.OrganizacaoId, UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var movimento = await _db.MovimentosBancarios.FindAsync(id);
        if (movimento is null || movimento.OrganizacaoId != request.OrganizacaoId)
        {
            return NotFound();
        }

        if (request.LancamentoId is null && request.CobrancaUnidadeId is null)
        {
            return BadRequest("Informe um lancamento ou cobranca.");
        }

        if (request.LancamentoId.HasValue)
        {
            var lancamento = await _db.LancamentosFinanceiros.FindAsync(request.LancamentoId.Value);
            if (lancamento is null || lancamento.OrganizacaoId != request.OrganizacaoId)
            {
                return NotFound("Lancamento nao encontrado.");
            }

            lancamento.Situacao = SituacaoConciliado;
            lancamento.DataPagamento ??= DateTime.UtcNow;
            movimento.LancamentoFinanceiroId = lancamento.Id;
            movimento.Status = "CONCILIADO";
        }

        if (request.CobrancaUnidadeId.HasValue)
        {
            var cobranca = await _db.UnidadesCobrancas.FindAsync(request.CobrancaUnidadeId.Value);
            if (cobranca is null || cobranca.OrganizacaoId != request.OrganizacaoId)
            {
                return NotFound("Cobranca nao encontrada.");
            }

            var pagamento = new UnidadePagamento
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = request.OrganizacaoId,
                CobrancaId = cobranca.Id,
                ValorPago = Math.Abs(movimento.Valor),
                DataPagamento = movimento.Data,
                ContaBancariaId = request.ContaBancariaId ?? movimento.ContaBancariaId,
                Observacao = "Conciliado automaticamente."
            };
            _db.UnidadesPagamentos.Add(pagamento);
            movimento.UnidadePagamentoId = pagamento.Id;
            movimento.Status = "CONCILIADO";

            cobranca.Status = "PAGA";
            cobranca.PagoEm = pagamento.DataPagamento;
            cobranca.ContaBancariaId = pagamento.ContaBancariaId;
        }

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

    private async Task<Dictionary<int, MovimentoBancario>> RegistrarMovimentosAsync(
        Guid organizacaoId,
        Guid contaBancariaId,
        List<ExtratoItemBase> itens)
    {
        var movimentos = new Dictionary<int, MovimentoBancario>();
        if (itens.Count == 0)
        {
            return movimentos;
        }

        var hashes = itens.Select(i => ComputeMovimentoHash(i.Data, i.Valor, i.Descricao, i.Documento)).ToList();
        var existentes = await _db.MovimentosBancarios.AsNoTracking()
            .Where(m => m.OrganizacaoId == organizacaoId && hashes.Contains(m.Hash))
            .ToListAsync();
        var porHash = existentes.ToDictionary(m => m.Hash, m => m);

        foreach (var item in itens)
        {
            var hash = ComputeMovimentoHash(item.Data, item.Valor, item.Descricao, item.Documento);
            if (porHash.TryGetValue(hash, out var existente))
            {
                movimentos[item.Index] = existente;
                continue;
            }

            var movimento = new MovimentoBancario
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                ContaBancariaId = contaBancariaId,
                Data = item.Data,
                Descricao = item.Descricao,
                Valor = item.Valor,
                Hash = hash,
                Status = "PENDENTE"
            };
            _db.MovimentosBancarios.Add(movimento);
            porHash[hash] = movimento;
            movimentos[item.Index] = movimento;
        }

        await _db.SaveChangesAsync();
        return movimentos;
    }

    private async Task<List<ExtratoItemDto>> SugerirLancamentosAsync(
        Guid organizacaoId,
        List<ExtratoItemBase> itens,
        IReadOnlyDictionary<int, MovimentoBancario> movimentos)
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

        var cobrancas = await _db.UnidadesCobrancas
            .AsNoTracking()
            .Where(c => c.OrganizacaoId == organizacaoId)
            .Where(c => c.Vencimento >= minDate && c.Vencimento <= maxDate)
            .ToListAsync();

        var resposta = new List<ExtratoItemDto>();
        foreach (var item in itens)
        {
            var tipoEsperado = item.Valor < 0 ? "pagar" : "receber";
            var valorAbs = Math.Abs(item.Valor);

            var sugestaoLancamento = candidatos
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

            var sugestaoCobranca = item.Valor > 0
                ? cobrancas
                    .Where(c => (c.Status == "ABERTA" || c.Status == "ATRASADA"))
                    .Where(c => Math.Abs(c.Valor - valorAbs) <= 0.01m)
                    .OrderBy(c => Math.Abs((c.Vencimento.Date - item.Data.Date).TotalDays))
                    .FirstOrDefault()
                : null;

            var escolherCobranca = sugestaoCobranca is not null &&
                                   (sugestaoLancamento is null ||
                                    Math.Abs((sugestaoCobranca.Vencimento.Date - item.Data.Date).TotalDays) <=
                                    Math.Abs((sugestaoLancamento.DataBase.Date - item.Data.Date).TotalDays));

            movimentos.TryGetValue(item.Index, out var movimento);

            resposta.Add(new ExtratoItemDto(
                item.Index,
                item.Data,
                item.Descricao,
                item.Valor,
                item.Documento,
                movimento?.Id,
                escolherCobranca ? null : sugestaoLancamento?.Lancamento.Id,
                escolherCobranca ? sugestaoCobranca?.Id : null,
                escolherCobranca ? sugestaoCobranca?.Descricao : sugestaoLancamento?.Lancamento.Descricao,
                escolherCobranca ? "cobranca_unidade" : sugestaoLancamento is null ? null : "lancamento"));
        }

        return resposta;
    }

    private static string ComputeMovimentoHash(DateTime data, decimal valor, string descricao, string? documento)
    {
        var raw = $"{data:yyyyMMdd}|{valor:0.00}|{descricao.Trim().ToLowerInvariant()}|{documento?.Trim().ToLowerInvariant()}";
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes);
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
