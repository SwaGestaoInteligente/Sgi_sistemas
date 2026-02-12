using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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
public class PontoController : ControllerBase
{
    private static readonly HashSet<string> TiposMarcacaoValidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "ENTRADA",
        "INICIO_INTERVALO",
        "FIM_INTERVALO",
        "SAIDA"
    };

    private static readonly HashSet<string> TiposSolicitacaoAjusteValidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "INCLUSAO",
        "CORRECAO"
    };

    private readonly SgiDbContext _db;

    public PontoController(SgiDbContext db)
    {
        _db = db;
    }

    private AuthorizationGuard Guard() => new(_db, User);

    public sealed record RegistrarMarcacaoRequest(
        Guid OrganizacaoId,
        Guid? PessoaId,
        Guid? UnidadeOrganizacionalId,
        string? Tipo,
        string? Origem,
        string? Observacao);

    public sealed record SolicitarAjustePontoRequest(
        Guid OrganizacaoId,
        Guid? PessoaId,
        Guid? MarcacaoOriginalId,
        string? TipoSolicitacao,
        DateTime DataHoraSugerida,
        string? TipoMarcacaoSugerida,
        string Justificativa);

    public sealed record DecidirAjustePontoRequest(bool Aprovar, string? MotivoDecisao);

    public sealed record FecharCompetenciaRequest(Guid OrganizacaoId, Guid? PessoaId, string Competencia);

    public sealed record ComprovanteMarcacaoDto(
        Guid Id,
        Guid OrganizacaoId,
        Guid PessoaId,
        Guid? UnidadeOrganizacionalId,
        long Nsr,
        string Tipo,
        string Origem,
        string HashComprovante,
        DateTime DataHoraMarcacao,
        DateTime CriadoEm);

    public sealed record EspelhoPontoDiaDto(
        string Data,
        string? Entrada,
        string? InicioIntervalo,
        string? FimIntervalo,
        string? Saida,
        decimal HorasTrabalhadas,
        int TotalMarcacoes);

    public sealed record EspelhoPontoDto(
        Guid OrganizacaoId,
        Guid PessoaId,
        string Competencia,
        decimal TotalHoras,
        IReadOnlyList<EspelhoPontoDiaDto> Dias);

    [HttpGet("marcacoes")]
    public async Task<ActionResult<IEnumerable<PontoMarcacao>>> ListarMarcacoes(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? pessoaId,
        [FromQuery] DateTime? de,
        [FromQuery] DateTime? ate)
    {
        if (organizacaoId == Guid.Empty) return BadRequest("OrganizacaoId e obrigatorio.");

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null) return auth.Error;
        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null) return auth.Error;

        if (!TryResolvePessoaEscopo(auth, pessoaId, false, out var pessoaFiltro, out var scopeError))
            return scopeError!;

        var inicio = (de ?? DateTime.UtcNow.Date.AddDays(-15)).Date;
        var fimExclusivo = ((ate ?? DateTime.UtcNow.Date).Date).AddDays(1);
        if (fimExclusivo <= inicio) return BadRequest("Periodo invalido.");

        var query = _db.PontoMarcacoes.AsNoTracking().Where(m =>
            m.OrganizacaoId == organizacaoId &&
            m.DataHoraMarcacao >= inicio &&
            m.DataHoraMarcacao < fimExclusivo);

        if (pessoaFiltro.HasValue) query = query.Where(m => m.PessoaId == pessoaFiltro.Value);
        var itens = await query.OrderByDescending(m => m.DataHoraMarcacao).Take(1500).ToListAsync();
        return Ok(itens);
    }

    [HttpPost("marcacoes")]
    public async Task<ActionResult<PontoMarcacao>> RegistrarMarcacao(RegistrarMarcacaoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty) return BadRequest("OrganizacaoId e obrigatorio.");

        var auth = await Guard().RequireOrgAccess(request.OrganizacaoId);
        if (auth.Error is not null) return auth.Error;
        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null) return auth.Error;

        if (!TryResolvePessoaEscopo(auth, request.PessoaId, true, out var pessoaId, out var scopeError))
            return scopeError!;

        var agora = DateTime.UtcNow;
        if (await IsCompetenciaFechadaAsync(request.OrganizacaoId, pessoaId!.Value, agora))
            return BadRequest("Competencia fechada para esta pessoa. Registro bloqueado.");

        var marcacao = new PontoMarcacao
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            PessoaId = pessoaId.Value,
            UnidadeOrganizacionalId = request.UnidadeOrganizacionalId,
            Nsr = await ProximoNsrAsync(request.OrganizacaoId),
            DataHoraMarcacao = agora,
            Tipo = NormalizarTipoMarcacao(request.Tipo),
            Origem = string.IsNullOrWhiteSpace(request.Origem) ? "WEB" : request.Origem.Trim().ToUpperInvariant(),
            Observacao = string.IsNullOrWhiteSpace(request.Observacao) ? null : request.Observacao.Trim(),
            CriadoEm = agora
        };
        marcacao.HashComprovante = GerarHashComprovante(marcacao);

        _db.PontoMarcacoes.Add(marcacao);
        RegistrarAudit(marcacao.OrganizacaoId, marcacao.Id, "PontoMarcacao", "REGISTRAR_MARCACAO", auth.PessoaId, new
        {
            marcacao.PessoaId,
            marcacao.Tipo,
            marcacao.Nsr
        });
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ObterComprovante), new { id = marcacao.Id }, marcacao);
    }

    [HttpGet("comprovante/{id:guid}")]
    public async Task<ActionResult<ComprovanteMarcacaoDto>> ObterComprovante(Guid id)
    {
        var marcacao = await _db.PontoMarcacoes.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id);
        if (marcacao is null) return NotFound();

        var auth = await Guard().RequireOrgAccess(marcacao.OrganizacaoId);
        if (auth.Error is not null) return auth.Error;
        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null) return auth.Error;

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.CONDO_STAFF)
        {
            if (!auth.PessoaId.HasValue || auth.PessoaId.Value != marcacao.PessoaId) return Forbid();
        }

        return Ok(new ComprovanteMarcacaoDto(
            marcacao.Id,
            marcacao.OrganizacaoId,
            marcacao.PessoaId,
            marcacao.UnidadeOrganizacionalId,
            marcacao.Nsr,
            marcacao.Tipo,
            marcacao.Origem,
            marcacao.HashComprovante,
            marcacao.DataHoraMarcacao,
            marcacao.CriadoEm));
    }

    [HttpGet("espelho")]
    public async Task<ActionResult<EspelhoPontoDto>> ObterEspelho(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? pessoaId,
        [FromQuery] string? competencia)
    {
        if (organizacaoId == Guid.Empty) return BadRequest("OrganizacaoId e obrigatorio.");

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null) return auth.Error;
        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null) return auth.Error;

        if (!TryResolvePessoaEscopo(auth, pessoaId, true, out var pessoaSelecionada, out var scopeError))
            return scopeError!;

        if (!TryParseCompetencia(competencia, out var inicio, out var fimExclusivo, out var comp))
            return BadRequest("Competencia invalida. Use yyyy-MM.");

        var registros = await _db.PontoMarcacoes.AsNoTracking()
            .Where(m => m.OrganizacaoId == organizacaoId &&
                        m.PessoaId == pessoaSelecionada!.Value &&
                        m.DataHoraMarcacao >= inicio &&
                        m.DataHoraMarcacao < fimExclusivo)
            .OrderBy(m => m.DataHoraMarcacao)
            .ToListAsync();

        var dias = BuildEspelhoDias(registros);
        var total = Math.Round(dias.Sum(d => d.HorasTrabalhadas), 2, MidpointRounding.AwayFromZero);
        return Ok(new EspelhoPontoDto(organizacaoId, pessoaSelecionada!.Value, comp, total, dias));
    }

    [HttpGet("ajustes")]
    public async Task<ActionResult<IEnumerable<PontoAjuste>>> ListarAjustes(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? pessoaId,
        [FromQuery] string? status)
    {
        if (organizacaoId == Guid.Empty) return BadRequest("OrganizacaoId e obrigatorio.");

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null) return auth.Error;
        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null) return auth.Error;

        if (!TryResolvePessoaEscopo(auth, pessoaId, false, out var pessoaFiltro, out var scopeError))
            return scopeError!;

        var query = _db.PontoAjustes.AsNoTracking().Where(a => a.OrganizacaoId == organizacaoId);
        if (pessoaFiltro.HasValue) query = query.Where(a => a.PessoaId == pessoaFiltro.Value);
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(a => a.Status == status.Trim().ToUpperInvariant());
        }

        var itens = await query.OrderByDescending(a => a.SolicitadoEm).Take(1000).ToListAsync();
        return Ok(itens);
    }

    [HttpPost("ajustes")]
    public async Task<ActionResult<PontoAjuste>> SolicitarAjuste(SolicitarAjustePontoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty) return BadRequest("OrganizacaoId e obrigatorio.");
        if (string.IsNullOrWhiteSpace(request.Justificativa)) return BadRequest("Justificativa obrigatoria.");

        var auth = await Guard().RequireOrgAccess(request.OrganizacaoId);
        if (auth.Error is not null) return auth.Error;
        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null) return auth.Error;

        if (!TryResolvePessoaEscopo(auth, request.PessoaId, true, out var pessoaId, out var scopeError))
            return scopeError!;

        var tipoSolicitacao = NormalizarTipoSolicitacaoAjuste(request.TipoSolicitacao);
        var tipoMarcacao = NormalizarTipoMarcacao(request.TipoMarcacaoSugerida);

        if (tipoSolicitacao == "CORRECAO")
        {
            if (!request.MarcacaoOriginalId.HasValue || request.MarcacaoOriginalId.Value == Guid.Empty)
                return BadRequest("MarcacaoOriginalId obrigatorio para correcao.");

            var original = await _db.PontoMarcacoes.AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == request.MarcacaoOriginalId.Value);
            if (original is null || original.OrganizacaoId != request.OrganizacaoId)
                return BadRequest("Marcacao original invalida.");
            if (original.PessoaId != pessoaId!.Value)
                return BadRequest("Marcacao original nao pertence a pessoa informada.");
        }

        if (await IsCompetenciaFechadaAsync(request.OrganizacaoId, pessoaId!.Value, request.DataHoraSugerida))
            return BadRequest("Competencia fechada para a data informada. Ajuste bloqueado.");

        var ajuste = new PontoAjuste
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            PessoaId = pessoaId.Value,
            UnidadeOrganizacionalId = auth.Membership?.UnidadeOrganizacionalId,
            MarcacaoOriginalId = request.MarcacaoOriginalId,
            TipoSolicitacao = tipoSolicitacao,
            DataHoraSugerida = request.DataHoraSugerida,
            TipoMarcacaoSugerida = tipoMarcacao,
            Justificativa = request.Justificativa.Trim(),
            Status = "PENDENTE",
            SolicitadoPorPessoaId = auth.PessoaId ?? pessoaId.Value,
            SolicitadoEm = DateTime.UtcNow
        };

        _db.PontoAjustes.Add(ajuste);
        RegistrarAudit(ajuste.OrganizacaoId, ajuste.Id, "PontoAjuste", "SOLICITAR_AJUSTE_PONTO", auth.PessoaId, new
        {
            ajuste.PessoaId,
            ajuste.TipoSolicitacao,
            ajuste.TipoMarcacaoSugerida,
            ajuste.DataHoraSugerida
        });

        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarAjustes), new { organizacaoId = request.OrganizacaoId }, ajuste);
    }

    [HttpPatch("ajustes/{id:guid}/decisao")]
    public async Task<ActionResult<PontoAjuste>> DecidirAjuste(Guid id, DecidirAjustePontoRequest request)
    {
        var ajuste = await _db.PontoAjustes.FirstOrDefaultAsync(a => a.Id == id);
        if (ajuste is null) return NotFound();

        var auth = await Guard().RequireOrgAccess(ajuste.OrganizacaoId);
        if (auth.Error is not null) return auth.Error;
        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null) return auth.Error;

        if (!string.Equals(ajuste.Status, "PENDENTE", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Ajuste ja analisado.");

        if (!request.Aprovar)
        {
            ajuste.Status = "REPROVADO";
            ajuste.AprovadoEm = DateTime.UtcNow;
            ajuste.AprovadoPorPessoaId = auth.PessoaId;
            ajuste.MotivoDecisao = string.IsNullOrWhiteSpace(request.MotivoDecisao)
                ? "Reprovado pelo gestor."
                : request.MotivoDecisao.Trim();
            await _db.SaveChangesAsync();
            return Ok(ajuste);
        }

        if (await IsCompetenciaFechadaAsync(ajuste.OrganizacaoId, ajuste.PessoaId, ajuste.DataHoraSugerida))
            return BadRequest("Competencia fechada para a data do ajuste.");

        var marcacao = new PontoMarcacao
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = ajuste.OrganizacaoId,
            PessoaId = ajuste.PessoaId,
            UnidadeOrganizacionalId = ajuste.UnidadeOrganizacionalId,
            Nsr = await ProximoNsrAsync(ajuste.OrganizacaoId),
            DataHoraMarcacao = ajuste.DataHoraSugerida,
            Tipo = NormalizarTipoMarcacao(ajuste.TipoMarcacaoSugerida),
            Origem = "AJUSTE_APROVADO",
            Observacao = $"Ajuste {ajuste.Id:N}",
            CriadoEm = DateTime.UtcNow
        };
        marcacao.HashComprovante = GerarHashComprovante(marcacao);
        _db.PontoMarcacoes.Add(marcacao);

        ajuste.Status = "APROVADO";
        ajuste.AprovadoEm = DateTime.UtcNow;
        ajuste.AprovadoPorPessoaId = auth.PessoaId;
        ajuste.MotivoDecisao = string.IsNullOrWhiteSpace(request.MotivoDecisao)
            ? "Ajuste aprovado."
            : request.MotivoDecisao.Trim();
        ajuste.MarcacaoGeradaId = marcacao.Id;

        RegistrarAudit(ajuste.OrganizacaoId, ajuste.Id, "PontoAjuste", "APROVAR_AJUSTE_PONTO", auth.PessoaId, new
        {
            ajuste.PessoaId,
            ajuste.MarcacaoOriginalId,
            MarcacaoGeradaId = marcacao.Id
        });

        await _db.SaveChangesAsync();
        return Ok(ajuste);
    }

    [HttpPost("fechamentos")]
    public async Task<ActionResult<object>> FecharCompetencia(FecharCompetenciaRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty) return BadRequest("OrganizacaoId e obrigatorio.");

        var auth = await Guard().RequireOrgAccess(request.OrganizacaoId);
        if (auth.Error is not null) return auth.Error;
        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null) return auth.Error;

        if (!TryParseCompetencia(request.Competencia, out var inicioCompetencia, out _, out var competencia))
            return BadRequest("Competencia invalida. Use yyyy-MM.");

        List<Guid> pessoas;
        if (request.PessoaId.HasValue && request.PessoaId.Value != Guid.Empty)
        {
            pessoas = new List<Guid> { request.PessoaId.Value };
        }
        else
        {
            pessoas = await _db.VinculosPessoaOrganizacao.AsNoTracking()
                .Where(v => v.OrganizacaoId == request.OrganizacaoId &&
                            (!v.DataFim.HasValue || v.DataFim.Value >= inicioCompetencia))
                .Select(v => v.PessoaId)
                .Distinct()
                .ToListAsync();
        }

        if (pessoas.Count == 0) return BadRequest("Nenhuma pessoa encontrada para fechamento.");

        var fechados = 0;
        foreach (var pessoaId in pessoas.Distinct())
        {
            var fechamento = await _db.PontoFechamentos.FirstOrDefaultAsync(f =>
                f.OrganizacaoId == request.OrganizacaoId &&
                f.PessoaId == pessoaId &&
                f.Competencia == competencia);

            if (fechamento is null)
            {
                _db.PontoFechamentos.Add(new PontoFechamentoCompetencia
                {
                    Id = Guid.NewGuid(),
                    OrganizacaoId = request.OrganizacaoId,
                    PessoaId = pessoaId,
                    Competencia = competencia,
                    FechadoEm = DateTime.UtcNow,
                    FechadoPorPessoaId = auth.PessoaId
                });
            }
            else
            {
                fechamento.FechadoEm = DateTime.UtcNow;
                fechamento.FechadoPorPessoaId = auth.PessoaId;
            }

            fechados++;
        }

        await _db.SaveChangesAsync();
        return Ok(new { competencia, fechados });
    }

    [HttpGet("fechamentos")]
    public async Task<ActionResult<IEnumerable<PontoFechamentoCompetencia>>> ListarFechamentos(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? pessoaId,
        [FromQuery] string? competencia)
    {
        if (organizacaoId == Guid.Empty) return BadRequest("OrganizacaoId e obrigatorio.");

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null) return auth.Error;
        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null) return auth.Error;

        if (!TryResolvePessoaEscopo(auth, pessoaId, false, out var pessoaFiltro, out var scopeError))
            return scopeError!;

        var query = _db.PontoFechamentos.AsNoTracking().Where(f => f.OrganizacaoId == organizacaoId);
        if (pessoaFiltro.HasValue) query = query.Where(f => f.PessoaId == pessoaFiltro.Value);
        if (!string.IsNullOrWhiteSpace(competencia)) query = query.Where(f => f.Competencia == competencia.Trim());

        var itens = await query.OrderByDescending(f => f.Competencia).ThenBy(f => f.PessoaId).ToListAsync();
        return Ok(itens);
    }

    [HttpGet("export/afd")]
    public async Task<IActionResult> ExportarAfd(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? pessoaId,
        [FromQuery] DateTime? de,
        [FromQuery] DateTime? ate)
    {
        if (organizacaoId == Guid.Empty) return BadRequest("OrganizacaoId e obrigatorio.");

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null) return auth.Error;
        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null) return auth.Error;

        if (!TryResolvePessoaEscopo(auth, pessoaId, false, out var pessoaFiltro, out var scopeError))
            return scopeError!;

        var inicio = (de ?? DateTime.UtcNow.Date.AddDays(-30)).Date;
        var fimExclusivo = ((ate ?? DateTime.UtcNow.Date).Date).AddDays(1);

        var query = _db.PontoMarcacoes.AsNoTracking().Where(m =>
            m.OrganizacaoId == organizacaoId &&
            m.DataHoraMarcacao >= inicio &&
            m.DataHoraMarcacao < fimExclusivo);
        if (pessoaFiltro.HasValue) query = query.Where(m => m.PessoaId == pessoaFiltro.Value);

        var marcacoes = await query.OrderBy(m => m.Nsr).ThenBy(m => m.DataHoraMarcacao).ToListAsync();

        var csv = BuildCsv(
            new[]
            {
                "NSR","DATA_HORA_UTC","ORGANIZACAO_ID","PESSOA_ID","TIPO","ORIGEM","HASH_COMPROVANTE"
            },
            marcacoes.Select(m => new[]
            {
                m.Nsr.ToString(CultureInfo.InvariantCulture),
                m.DataHoraMarcacao.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture),
                m.OrganizacaoId.ToString(),
                m.PessoaId.ToString(),
                m.Tipo,
                m.Origem,
                m.HashComprovante
            }));

        return File(
            Encoding.UTF8.GetBytes(csv),
            "text/csv",
            $"afd-{organizacaoId}-{DateTime.UtcNow:yyyyMMddHHmm}.csv");
    }

    [HttpGet("export/aej")]
    public async Task<IActionResult> ExportarAej(
        [FromQuery] Guid organizacaoId,
        [FromQuery] Guid? pessoaId,
        [FromQuery] string? competencia)
    {
        if (organizacaoId == Guid.Empty) return BadRequest("OrganizacaoId e obrigatorio.");

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null) return auth.Error;
        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null) return auth.Error;

        if (!TryResolvePessoaEscopo(auth, pessoaId, false, out var pessoaFiltro, out var scopeError))
            return scopeError!;

        if (!TryParseCompetencia(competencia, out var inicio, out var fimExclusivo, out _))
            return BadRequest("Competencia invalida. Use yyyy-MM.");

        var query = _db.PontoMarcacoes.AsNoTracking().Where(m =>
            m.OrganizacaoId == organizacaoId &&
            m.DataHoraMarcacao >= inicio &&
            m.DataHoraMarcacao < fimExclusivo);
        if (pessoaFiltro.HasValue) query = query.Where(m => m.PessoaId == pessoaFiltro.Value);

        var marcacoes = await query.OrderBy(m => m.PessoaId).ThenBy(m => m.DataHoraMarcacao).ToListAsync();
        var linhas = marcacoes
            .GroupBy(m => new { m.PessoaId, Dia = m.DataHoraMarcacao.Date })
            .OrderBy(g => g.Key.PessoaId)
            .ThenBy(g => g.Key.Dia)
            .Select(g =>
            {
                var d = BuildEspelhoDias(g.ToList()).First();
                return new[]
                {
                    g.Key.PessoaId.ToString(),
                    d.Data,
                    d.Entrada ?? string.Empty,
                    d.InicioIntervalo ?? string.Empty,
                    d.FimIntervalo ?? string.Empty,
                    d.Saida ?? string.Empty,
                    d.HorasTrabalhadas.ToString("F2", CultureInfo.InvariantCulture),
                    d.TotalMarcacoes.ToString(CultureInfo.InvariantCulture)
                };
            });

        var csv = BuildCsv(
            new[]
            {
                "PESSOA_ID","DATA","ENTRADA","INICIO_INTERVALO","FIM_INTERVALO","SAIDA","HORAS_TRABALHADAS","TOTAL_MARCACOES"
            },
            linhas);

        return File(
            Encoding.UTF8.GetBytes(csv),
            "text/csv",
            $"aej-{organizacaoId}-{inicio:yyyyMM}.csv");
    }

    private async Task<long> ProximoNsrAsync(Guid organizacaoId)
    {
        var atual = await _db.PontoMarcacoes.Where(m => m.OrganizacaoId == organizacaoId)
            .MaxAsync(m => (long?)m.Nsr) ?? 0;
        return atual + 1;
    }

    private async Task<bool> IsCompetenciaFechadaAsync(Guid organizacaoId, Guid pessoaId, DateTime data)
    {
        var competencia = data.ToString("yyyy-MM", CultureInfo.InvariantCulture);
        return await _db.PontoFechamentos.AsNoTracking().AnyAsync(f =>
            f.OrganizacaoId == organizacaoId &&
            f.PessoaId == pessoaId &&
            f.Competencia == competencia);
    }

    private static bool TryResolvePessoaEscopo(
        AuthzContext auth,
        Guid? pessoaInformada,
        bool requirePessoa,
        out Guid? pessoaResolvida,
        out ActionResult? error)
    {
        pessoaResolvida = pessoaInformada;
        error = null;

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.CONDO_STAFF)
        {
            if (!auth.PessoaId.HasValue)
            {
                error = new ForbidResult();
                return false;
            }

            if (pessoaInformada.HasValue && pessoaInformada.Value != auth.PessoaId.Value)
            {
                error = new ForbidResult();
                return false;
            }

            pessoaResolvida = auth.PessoaId.Value;
        }

        if (requirePessoa && (!pessoaResolvida.HasValue || pessoaResolvida.Value == Guid.Empty))
        {
            error = new BadRequestObjectResult("PessoaId e obrigatorio.");
            return false;
        }

        return true;
    }

    private static bool TryParseCompetencia(
        string? competencia,
        out DateTime inicio,
        out DateTime fimExclusivo,
        out string competenciaNormalizada)
    {
        DateTime baseCompetencia;
        if (string.IsNullOrWhiteSpace(competencia))
        {
            var hoje = DateTime.UtcNow;
            baseCompetencia = new DateTime(hoje.Year, hoje.Month, 1);
        }
        else if (!DateTime.TryParseExact(
                     competencia.Trim(),
                     "yyyy-MM",
                     CultureInfo.InvariantCulture,
                     DateTimeStyles.None,
                     out baseCompetencia))
        {
            inicio = default;
            fimExclusivo = default;
            competenciaNormalizada = string.Empty;
            return false;
        }

        inicio = new DateTime(baseCompetencia.Year, baseCompetencia.Month, 1);
        fimExclusivo = inicio.AddMonths(1);
        competenciaNormalizada = inicio.ToString("yyyy-MM", CultureInfo.InvariantCulture);
        return true;
    }

    private static string NormalizarTipoMarcacao(string? tipo)
    {
        var normalizado = string.IsNullOrWhiteSpace(tipo)
            ? "ENTRADA"
            : tipo.Trim().ToUpperInvariant();
        return TiposMarcacaoValidos.Contains(normalizado) ? normalizado : "ENTRADA";
    }

    private static string NormalizarTipoSolicitacaoAjuste(string? tipo)
    {
        var normalizado = string.IsNullOrWhiteSpace(tipo)
            ? "INCLUSAO"
            : tipo.Trim().ToUpperInvariant();
        return TiposSolicitacaoAjusteValidos.Contains(normalizado) ? normalizado : "INCLUSAO";
    }

    private static List<EspelhoPontoDiaDto> BuildEspelhoDias(IReadOnlyList<PontoMarcacao> registros)
    {
        return registros
            .GroupBy(m => m.DataHoraMarcacao.Date)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var marcacoesDia = g.OrderBy(m => m.DataHoraMarcacao).ToList();
                var entrada = marcacoesDia.FirstOrDefault(m => m.Tipo == "ENTRADA")?.DataHoraMarcacao;
                var ini = marcacoesDia.FirstOrDefault(m => m.Tipo == "INICIO_INTERVALO")?.DataHoraMarcacao;
                var fim = marcacoesDia.FirstOrDefault(m => m.Tipo == "FIM_INTERVALO")?.DataHoraMarcacao;
                var saida = marcacoesDia.LastOrDefault(m => m.Tipo == "SAIDA")?.DataHoraMarcacao;
                return new EspelhoPontoDiaDto(
                    g.Key.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    entrada?.ToString("HH:mm", CultureInfo.InvariantCulture),
                    ini?.ToString("HH:mm", CultureInfo.InvariantCulture),
                    fim?.ToString("HH:mm", CultureInfo.InvariantCulture),
                    saida?.ToString("HH:mm", CultureInfo.InvariantCulture),
                    CalcularHorasTrabalhadas(marcacoesDia),
                    marcacoesDia.Count);
            })
            .ToList();
    }

    private static decimal CalcularHorasTrabalhadas(IReadOnlyList<PontoMarcacao> marcacoesDia)
    {
        var entrada = marcacoesDia.FirstOrDefault(m => m.Tipo == "ENTRADA")?.DataHoraMarcacao;
        var saida = marcacoesDia.LastOrDefault(m => m.Tipo == "SAIDA")?.DataHoraMarcacao;
        if (!entrada.HasValue || !saida.HasValue || saida <= entrada) return 0m;

        var total = saida.Value - entrada.Value;
        TimeSpan intervalos = TimeSpan.Zero;
        DateTime? inicio = null;

        foreach (var m in marcacoesDia.OrderBy(m => m.DataHoraMarcacao))
        {
            if (m.Tipo == "INICIO_INTERVALO" && !inicio.HasValue)
            {
                inicio = m.DataHoraMarcacao;
            }
            else if (m.Tipo == "FIM_INTERVALO" && inicio.HasValue)
            {
                if (m.DataHoraMarcacao > inicio.Value)
                {
                    intervalos += m.DataHoraMarcacao - inicio.Value;
                }
                inicio = null;
            }
        }

        var liquido = total - intervalos;
        return liquido <= TimeSpan.Zero
            ? 0m
            : Math.Round((decimal)liquido.TotalMinutes / 60m, 2, MidpointRounding.AwayFromZero);
    }

    private static string BuildCsv(IEnumerable<string> headers, IEnumerable<IEnumerable<string>> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(";", headers.Select(EscapeCsv)));
        foreach (var row in rows)
        {
            sb.AppendLine(string.Join(";", row.Select(EscapeCsv)));
        }
        return sb.ToString();
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains(';') || value.Contains('"') || value.Contains('\n'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }
        return value;
    }

    private static string GerarHashComprovante(PontoMarcacao marcacao)
    {
        var payload =
            $"{marcacao.OrganizacaoId:N}|{marcacao.PessoaId:N}|{marcacao.Nsr}|{marcacao.Tipo}|{marcacao.DataHoraMarcacao:O}";
        using var sha = SHA256.Create();
        return Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }

    private void RegistrarAudit(
        Guid organizacaoId,
        Guid entidadeId,
        string entidade,
        string acao,
        Guid? pessoaId,
        object? detalhes = null)
    {
        var userId = Authz.GetUserId(User);
        var payload = new { PessoaId = pessoaId, Detalhes = detalhes };
        _db.LogsAuditoria.Add(new LogAuditoria
        {
            Id = Guid.NewGuid(),
            UsuarioId = userId,
            OrganizacaoId = organizacaoId,
            Entidade = entidade,
            EntidadeId = entidadeId,
            Acao = acao,
            DadosDepoisJson = JsonSerializer.Serialize(payload),
            DataHora = DateTime.UtcNow,
            Ip = HttpContext?.Connection?.RemoteIpAddress?.ToString(),
            UserAgent = HttpContext?.Request?.Headers["User-Agent"].ToString()
        });
    }
}
