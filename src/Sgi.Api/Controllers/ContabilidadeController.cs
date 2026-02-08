using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Auth;
using Sgi.Domain.Contabilidade;
using Sgi.Domain.Core;
using Sgi.Domain.Financeiro;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[ServiceFilter(typeof(FinanceiroAccessFilter))]
public class ContabilidadeController : ControllerBase
{
    private readonly SgiDbContext _db;

    public ContabilidadeController(SgiDbContext db)
    {
        _db = db;
    }

    private static string NormalizarTipo(string? value)
        => string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim().ToLowerInvariant();

    private async Task<ActionResult?> EnsureRole(Guid organizacaoId, bool write)
    {
        var roles = write
            ? new[] { UserRole.CONDO_ADMIN }
            : new[] { UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF };

        var auth = await Authz.EnsureMembershipAsync(_db, User, organizacaoId, roles);
        return auth.Error;
    }

    [HttpGet("contas")]
    public async Task<ActionResult<IEnumerable<ContaContabil>>> ListarContas([FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(organizacaoId, write: false);
        if (auth is not null)
        {
            return auth;
        }

        var itens = await _db.ContasContabeis
            .AsNoTracking()
            .Where(c => c.OrganizacaoId == organizacaoId)
            .OrderBy(c => c.Codigo)
            .ToListAsync();

        return Ok(itens);
    }

    public record CriarContaContabilRequest(
        Guid OrganizacaoId,
        string Codigo,
        string Nome,
        string Grupo,
        string Natureza,
        int? Nivel,
        Guid? ParentId,
        string? CodigoReferencialSped);

    [HttpPost("contas")]
    public async Task<ActionResult<ContaContabil>> CriarConta([FromBody] CriarContaContabilRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(request.OrganizacaoId, write: true);
        if (auth is not null)
        {
            return auth;
        }

        if (string.IsNullOrWhiteSpace(request.Codigo) || string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Codigo e nome sao obrigatorios.");
        }

        if (string.IsNullOrWhiteSpace(request.Grupo))
        {
            return BadRequest("Grupo contábil é obrigatorio.");
        }

        if (string.IsNullOrWhiteSpace(request.Natureza))
        {
            return BadRequest("Natureza é obrigatoria.");
        }

        var nivel = request.Nivel.GetValueOrDefault();
        if (nivel <= 0)
        {
            nivel = request.Codigo.Count(c => c == '.') + 1;
        }

        var conta = new ContaContabil
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            Codigo = request.Codigo.Trim(),
            Nome = request.Nome.Trim(),
            Grupo = request.Grupo.Trim(),
            Natureza = request.Natureza.Trim(),
            Nivel = nivel,
            ParentId = request.ParentId,
            CodigoReferencialSped = string.IsNullOrWhiteSpace(request.CodigoReferencialSped)
                ? null
                : request.CodigoReferencialSped.Trim()
        };

        _db.ContasContabeis.Add(conta);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarContas), new { organizacaoId = conta.OrganizacaoId }, conta);
    }

    public record AtualizarContaContabilRequest(
        string Codigo,
        string Nome,
        string Grupo,
        string Natureza,
        int? Nivel,
        Guid? ParentId,
        bool Ativa,
        string? CodigoReferencialSped);

    [HttpPut("contas/{id:guid}")]
    public async Task<IActionResult> AtualizarConta(Guid id, [FromBody] AtualizarContaContabilRequest request)
    {
        var conta = await _db.ContasContabeis.FindAsync(id);
        if (conta is null)
        {
            return NotFound();
        }

        var auth = await EnsureRole(conta.OrganizacaoId, write: true);
        if (auth is not null)
        {
            return auth;
        }

        if (string.IsNullOrWhiteSpace(request.Codigo) || string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Codigo e nome sao obrigatorios.");
        }

        conta.Codigo = request.Codigo.Trim();
        conta.Nome = request.Nome.Trim();
        conta.Grupo = request.Grupo.Trim();
        conta.Natureza = request.Natureza.Trim();
        conta.Nivel = request.Nivel.GetValueOrDefault(conta.Nivel);
        conta.ParentId = request.ParentId;
        conta.Ativa = request.Ativa;
        conta.CodigoReferencialSped = string.IsNullOrWhiteSpace(request.CodigoReferencialSped)
            ? null
            : request.CodigoReferencialSped.Trim();

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("periodos")]
    public async Task<ActionResult<IEnumerable<PeriodoContabil>>> ListarPeriodos([FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(organizacaoId, write: false);
        if (auth is not null)
        {
            return auth;
        }

        var itens = await _db.PeriodosContabeis
            .AsNoTracking()
            .Where(p => p.OrganizacaoId == organizacaoId)
            .OrderByDescending(p => p.CompetenciaInicio)
            .ToListAsync();

        return Ok(itens);
    }

    public record CriarPeriodoRequest(Guid OrganizacaoId, DateTime CompetenciaInicio, DateTime CompetenciaFim, string? Observacao);

    [HttpPost("periodos")]
    public async Task<ActionResult<PeriodoContabil>> CriarPeriodo([FromBody] CriarPeriodoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(request.OrganizacaoId, write: true);
        if (auth is not null)
        {
            return auth;
        }

        if (request.CompetenciaFim < request.CompetenciaInicio)
        {
            return BadRequest("Competencia final deve ser maior ou igual ao inicio.");
        }

        var periodo = new PeriodoContabil
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            CompetenciaInicio = request.CompetenciaInicio.Date,
            CompetenciaFim = request.CompetenciaFim.Date,
            Status = "aberto",
            Observacao = request.Observacao
        };

        _db.PeriodosContabeis.Add(periodo);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarPeriodos), new { organizacaoId = periodo.OrganizacaoId }, periodo);
    }

    [HttpPost("periodos/{id:guid}/fechar")]
    public async Task<IActionResult> FecharPeriodo(Guid id)
    {
        var periodo = await _db.PeriodosContabeis.FindAsync(id);
        if (periodo is null)
        {
            return NotFound();
        }

        var auth = await EnsureRole(periodo.OrganizacaoId, write: true);
        if (auth is not null)
        {
            return auth;
        }

        periodo.Status = "fechado";
        periodo.FechadoEm = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("periodos/{id:guid}/reabrir")]
    public async Task<IActionResult> ReabrirPeriodo(Guid id)
    {
        var periodo = await _db.PeriodosContabeis.FindAsync(id);
        if (periodo is null)
        {
            return NotFound();
        }

        var auth = await EnsureRole(periodo.OrganizacaoId, write: true);
        if (auth is not null)
        {
            return auth;
        }

        periodo.Status = "aberto";
        periodo.FechadoEm = null;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    public record CriarMapeamentoRequest(
        Guid OrganizacaoId,
        Guid PlanoContasId,
        string TipoLancamento,
        Guid ContaDebitoId,
        Guid ContaCreditoId,
        string? Observacao);

    [HttpGet("mapeamentos")]
    public async Task<ActionResult<IEnumerable<MapeamentoPlanoContasContabil>>> ListarMapeamentos([FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(organizacaoId, write: false);
        if (auth is not null)
        {
            return auth;
        }

        var itens = await _db.MapeamentosPlanoContasContabil
            .AsNoTracking()
            .Where(m => m.OrganizacaoId == organizacaoId)
            .ToListAsync();

        return Ok(itens);
    }

    [HttpPost("mapeamentos")]
    public async Task<ActionResult<MapeamentoPlanoContasContabil>> CriarMapeamento([FromBody] CriarMapeamentoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(request.OrganizacaoId, write: true);
        if (auth is not null)
        {
            return auth;
        }

        var mapping = new MapeamentoPlanoContasContabil
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            PlanoContasId = request.PlanoContasId,
            TipoLancamento = request.TipoLancamento.Trim(),
            ContaDebitoId = request.ContaDebitoId,
            ContaCreditoId = request.ContaCreditoId,
            Observacao = request.Observacao
        };

        _db.MapeamentosPlanoContasContabil.Add(mapping);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarMapeamentos), new { organizacaoId = mapping.OrganizacaoId }, mapping);
    }

    [HttpDelete("mapeamentos/{id:guid}")]
    public async Task<IActionResult> RemoverMapeamento(Guid id)
    {
        var item = await _db.MapeamentosPlanoContasContabil.FindAsync(id);
        if (item is null)
        {
            return NotFound();
        }

        var auth = await EnsureRole(item.OrganizacaoId, write: true);
        if (auth is not null)
        {
            return auth;
        }

        _db.MapeamentosPlanoContasContabil.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    public record PartidaRequest(Guid ContaContabilId, string Tipo, decimal Valor, Guid? CentroCustoId);
    public record CriarLancamentoRequest(
        Guid OrganizacaoId,
        DateTime Competencia,
        DateTime? DataLancamento,
        string Historico,
        string? Origem,
        Guid? LancamentoFinanceiroId,
        IEnumerable<PartidaRequest> Partidas);

    [HttpPost("lancamentos")]
    public async Task<ActionResult<LancamentoContabil>> CriarLancamento([FromBody] CriarLancamentoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(request.OrganizacaoId, write: true);
        if (auth is not null)
        {
            return auth;
        }

        var partidas = request.Partidas?.ToList() ?? new List<PartidaRequest>();
        if (partidas.Count < 2)
        {
            return BadRequest("Informe pelo menos duas partidas.");
        }

        if (partidas.Any(p => p.Valor <= 0))
        {
            return BadRequest("Valor das partidas deve ser maior que zero.");
        }

        var totalDebito = partidas
            .Where(p => NormalizarTipo(p.Tipo) == "debito")
            .Sum(p => p.Valor);
        var totalCredito = partidas
            .Where(p => NormalizarTipo(p.Tipo) == "credito")
            .Sum(p => p.Valor);

        if (totalDebito != totalCredito)
        {
            return BadRequest("Debito e credito devem possuir o mesmo valor.");
        }

        var competencia = request.Competencia.Date;
        var periodoFechado = await _db.PeriodosContabeis.AsNoTracking()
            .AnyAsync(p => p.OrganizacaoId == request.OrganizacaoId
                           && p.Status == "fechado"
                           && p.CompetenciaInicio <= competencia
                           && p.CompetenciaFim >= competencia);
        if (periodoFechado)
        {
            return BadRequest("Periodo contábil fechado para esta competencia.");
        }

        var contaIds = partidas.Select(p => p.ContaContabilId).Distinct().ToList();
        var contasValidas = await _db.ContasContabeis
            .AsNoTracking()
            .Where(c => c.OrganizacaoId == request.OrganizacaoId && contaIds.Contains(c.Id) && c.Ativa)
            .ToListAsync();

        if (contasValidas.Count != contaIds.Count)
        {
            return BadRequest("Conta contábil inválida ou inativa.");
        }

        var lancamento = new LancamentoContabil
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            DataLancamento = (request.DataLancamento ?? DateTime.UtcNow).Date,
            Competencia = competencia,
            Historico = request.Historico?.Trim() ?? string.Empty,
            Origem = request.Origem,
            LancamentoFinanceiroId = request.LancamentoFinanceiroId,
            Status = "aberto"
        };

        var partidasEntidade = partidas.Select(p => new PartidaContabil
        {
            Id = Guid.NewGuid(),
            LancamentoContabilId = lancamento.Id,
            ContaContabilId = p.ContaContabilId,
            Tipo = NormalizarTipo(p.Tipo),
            Valor = p.Valor,
            CentroCustoId = p.CentroCustoId
        }).ToList();

        _db.LancamentosContabeis.Add(lancamento);
        _db.PartidasContabeis.AddRange(partidasEntidade);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ListarLancamentos), new { organizacaoId = lancamento.OrganizacaoId }, lancamento);
    }

    [HttpGet("lancamentos")]
    public async Task<ActionResult<IEnumerable<LancamentoContabil>>> ListarLancamentos(
        [FromQuery] Guid organizacaoId,
        [FromQuery] DateTime? competenciaInicio,
        [FromQuery] DateTime? competenciaFim)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(organizacaoId, write: false);
        if (auth is not null)
        {
            return auth;
        }

        var query = _db.LancamentosContabeis
            .AsNoTracking()
            .Where(l => l.OrganizacaoId == organizacaoId);

        if (competenciaInicio.HasValue)
        {
            query = query.Where(l => l.Competencia >= competenciaInicio.Value.Date);
        }

        if (competenciaFim.HasValue)
        {
            query = query.Where(l => l.Competencia <= competenciaFim.Value.Date);
        }

        var itens = await query
            .OrderByDescending(l => l.Competencia)
            .ToListAsync();

        return Ok(itens);
    }

    public record IntegrarFinanceiroRequest(Guid OrganizacaoId, DateTime? CompetenciaInicio, DateTime? CompetenciaFim);

    [HttpPost("integrar-financeiro")]
    public async Task<ActionResult<object>> IntegrarFinanceiro([FromBody] IntegrarFinanceiroRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(request.OrganizacaoId, write: true);
        if (auth is not null)
        {
            return auth;
        }

        var inicio = request.CompetenciaInicio?.Date ?? DateTime.UtcNow.Date.AddMonths(-1);
        var fim = request.CompetenciaFim?.Date ?? DateTime.UtcNow.Date;

        var lancamentosBase = await _db.LancamentosFinanceiros
            .AsNoTracking()
            .Where(l => l.OrganizacaoId == request.OrganizacaoId)
            .Where(l => l.DataCompetencia >= inicio && l.DataCompetencia <= fim)
            .ToListAsync();

        var lancamentos = lancamentosBase
            .Where(l =>
            {
                var situacao = NormalizarTipo(l.Situacao);
                return situacao == "pago" || situacao == "conciliado" || situacao == "fechado";
            })
            .ToList();

        if (lancamentos.Count == 0)
        {
            return Ok(new { Total = 0, Criados = 0, Ignorados = 0, SemMapeamento = 0 });
        }

        var existentes = await _db.LancamentosContabeis
            .AsNoTracking()
            .Where(l => l.OrganizacaoId == request.OrganizacaoId)
            .Where(l => l.LancamentoFinanceiroId.HasValue)
            .ToListAsync();
        var jaIntegrados = existentes
            .Where(l => l.LancamentoFinanceiroId.HasValue)
            .ToDictionary(l => l.LancamentoFinanceiroId!.Value, l => l.Id);

        var mapeamentos = await _db.MapeamentosPlanoContasContabil
            .AsNoTracking()
            .Where(m => m.OrganizacaoId == request.OrganizacaoId)
            .ToListAsync();

        var criados = 0;
        var ignorados = 0;
        var semMapeamento = 0;

        foreach (var lanc in lancamentos)
        {
            if (jaIntegrados.ContainsKey(lanc.Id))
            {
                ignorados++;
                continue;
            }

            var tipo = NormalizarTipo(lanc.Tipo);
            var map = mapeamentos.FirstOrDefault(m =>
                m.PlanoContasId == lanc.PlanoContasId &&
                NormalizarTipo(m.TipoLancamento) == tipo);

            if (map is null)
            {
                semMapeamento++;
                continue;
            }

            var periodoFechado = await _db.PeriodosContabeis.AsNoTracking()
                .AnyAsync(p => p.OrganizacaoId == request.OrganizacaoId
                               && p.Status == "fechado"
                               && p.CompetenciaInicio <= lanc.DataCompetencia
                               && p.CompetenciaFim >= lanc.DataCompetencia);
            if (periodoFechado)
            {
                ignorados++;
                continue;
            }

            var contabil = new LancamentoContabil
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = request.OrganizacaoId,
                DataLancamento = (lanc.DataPagamento ?? lanc.DataCompetencia).Date,
                Competencia = lanc.DataCompetencia.Date,
                Historico = lanc.Descricao,
                Origem = "financeiro",
                LancamentoFinanceiroId = lanc.Id,
                Status = "aberto"
            };

            var partidas = new List<PartidaContabil>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    LancamentoContabilId = contabil.Id,
                    ContaContabilId = map.ContaDebitoId,
                    Tipo = "debito",
                    Valor = lanc.Valor,
                    CentroCustoId = lanc.CentroCustoId
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    LancamentoContabilId = contabil.Id,
                    ContaContabilId = map.ContaCreditoId,
                    Tipo = "credito",
                    Valor = lanc.Valor,
                    CentroCustoId = lanc.CentroCustoId
                }
            };

            _db.LancamentosContabeis.Add(contabil);
            _db.PartidasContabeis.AddRange(partidas);
            criados++;
        }

        await _db.SaveChangesAsync();
        return Ok(new
        {
            Total = lancamentos.Count,
            Criados = criados,
            Ignorados = ignorados,
            SemMapeamento = semMapeamento
        });
    }

    public record BalanceteItem(Guid ContaId, string Codigo, string Nome, decimal Debitos, decimal Creditos, decimal Saldo);

    [HttpGet("balancete")]
    public async Task<ActionResult<IEnumerable<BalanceteItem>>> ObterBalancete(
        [FromQuery] Guid organizacaoId,
        [FromQuery] DateTime? competenciaInicio,
        [FromQuery] DateTime? competenciaFim)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(organizacaoId, write: false);
        if (auth is not null)
        {
            return auth;
        }

        var inicio = competenciaInicio?.Date ?? DateTime.MinValue;
        var fim = competenciaFim?.Date ?? DateTime.MaxValue;

        var partidas = await _db.PartidasContabeis
            .AsNoTracking()
            .Join(_db.LancamentosContabeis.AsNoTracking(),
                p => p.LancamentoContabilId,
                l => l.Id,
                (p, l) => new { Partida = p, Lancamento = l })
            .Where(x => x.Lancamento.OrganizacaoId == organizacaoId)
            .Where(x => x.Lancamento.Competencia >= inicio && x.Lancamento.Competencia <= fim)
            .ToListAsync();

        var contas = await _db.ContasContabeis
            .AsNoTracking()
            .Where(c => c.OrganizacaoId == organizacaoId)
            .ToListAsync();

        var resultado = partidas
            .GroupBy(p => p.Partida.ContaContabilId)
            .Select(grupo =>
            {
                var conta = contas.FirstOrDefault(c => c.Id == grupo.Key);
                var debitos = grupo.Where(g => g.Partida.Tipo == "debito").Sum(g => g.Partida.Valor);
                var creditos = grupo.Where(g => g.Partida.Tipo == "credito").Sum(g => g.Partida.Valor);
                var saldo = debitos - creditos;
                return new BalanceteItem(
                    grupo.Key,
                    conta?.Codigo ?? string.Empty,
                    conta?.Nome ?? string.Empty,
                    debitos,
                    creditos,
                    saldo);
            })
            .OrderBy(item => item.Codigo)
            .ToList();

        return Ok(resultado);
    }

    public record DreResumo(decimal Receitas, decimal Despesas, decimal Resultado);

    [HttpGet("dre")]
    public async Task<ActionResult<DreResumo>> ObterDre(
        [FromQuery] Guid organizacaoId,
        [FromQuery] DateTime? competenciaInicio,
        [FromQuery] DateTime? competenciaFim)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(organizacaoId, write: false);
        if (auth is not null)
        {
            return auth;
        }

        var inicio = competenciaInicio?.Date ?? DateTime.MinValue;
        var fim = competenciaFim?.Date ?? DateTime.MaxValue;

        var contasResultado = await _db.ContasContabeis
            .AsNoTracking()
            .Where(c => c.OrganizacaoId == organizacaoId && c.Grupo.ToLower() == "resultado")
            .ToListAsync();
        var ids = contasResultado.Select(c => c.Id).ToList();

        var partidas = await _db.PartidasContabeis
            .AsNoTracking()
            .Join(_db.LancamentosContabeis.AsNoTracking(),
                p => p.LancamentoContabilId,
                l => l.Id,
                (p, l) => new { Partida = p, Lancamento = l })
            .Where(x => x.Lancamento.OrganizacaoId == organizacaoId)
            .Where(x => x.Lancamento.Competencia >= inicio && x.Lancamento.Competencia <= fim)
            .Where(x => ids.Contains(x.Partida.ContaContabilId))
            .ToListAsync();

        var receitas = partidas
            .Where(p => p.Partida.Tipo == "credito")
            .Sum(p => p.Partida.Valor);
        var despesas = partidas
            .Where(p => p.Partida.Tipo == "debito")
            .Sum(p => p.Partida.Valor);
        var resultado = receitas - despesas;

        return Ok(new DreResumo(receitas, despesas, resultado));
    }

    public record BalancoResumo(decimal Ativo, decimal Passivo, decimal Patrimonio);

    [HttpGet("balanco")]
    public async Task<ActionResult<BalancoResumo>> ObterBalanco(
        [FromQuery] Guid organizacaoId,
        [FromQuery] DateTime? competenciaFim)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await EnsureRole(organizacaoId, write: false);
        if (auth is not null)
        {
            return auth;
        }

        var fim = competenciaFim?.Date ?? DateTime.MaxValue;

        var contas = await _db.ContasContabeis
            .AsNoTracking()
            .Where(c => c.OrganizacaoId == organizacaoId)
            .ToListAsync();
        var contasIds = contas.Select(c => c.Id).ToList();

        var partidas = await _db.PartidasContabeis
            .AsNoTracking()
            .Join(_db.LancamentosContabeis.AsNoTracking(),
                p => p.LancamentoContabilId,
                l => l.Id,
                (p, l) => new { Partida = p, Lancamento = l })
            .Where(x => x.Lancamento.OrganizacaoId == organizacaoId)
            .Where(x => x.Lancamento.Competencia <= fim)
            .Where(x => contasIds.Contains(x.Partida.ContaContabilId))
            .ToListAsync();

        decimal SomarGrupo(string grupo)
        {
            var contaIds = contas
                .Where(c => c.Grupo.ToLower() == grupo)
                .Select(c => c.Id)
                .ToHashSet();

            var debitos = partidas
                .Where(p => contaIds.Contains(p.Partida.ContaContabilId) && p.Partida.Tipo == "debito")
                .Sum(p => p.Partida.Valor);
            var creditos = partidas
                .Where(p => contaIds.Contains(p.Partida.ContaContabilId) && p.Partida.Tipo == "credito")
                .Sum(p => p.Partida.Valor);
            return debitos - creditos;
        }

        var ativo = SomarGrupo("ativo");
        var passivo = SomarGrupo("passivo");
        var patrimonio = SomarGrupo("patrimonio");

        return Ok(new BalancoResumo(ativo, passivo, patrimonio));
    }
}
