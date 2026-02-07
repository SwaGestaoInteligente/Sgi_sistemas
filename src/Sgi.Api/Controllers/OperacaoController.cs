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
public class OperacaoController : ControllerBase
{
    private readonly SgiDbContext _db;

    public OperacaoController(SgiDbContext db)
    {
        _db = db;
    }

    private AuthorizationGuard Guard() => new(_db, User);

    private static readonly HashSet<string> StatusChamadoValidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "ABERTO",
        "EM_ATENDIMENTO",
        "AGUARDANDO",
        "RESOLVIDO",
        "ENCERRADO"
    };

    private static readonly HashSet<string> StatusReservaValidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "PENDENTE",
        "APROVADA",
        "CANCELADA",
        "CONCLUIDA"
    };

    private static readonly HashSet<string> PrioridadesChamadoValidas = new(StringComparer.OrdinalIgnoreCase)
    {
        "BAIXA",
        "MEDIA",
        "ALTA",
        "URGENTE"
    };

    private static string NormalizarStatusChamado(string? status)
    {
        var valor = string.IsNullOrWhiteSpace(status) ? "ABERTO" : status.Trim().ToUpperInvariant();
        return StatusChamadoValidos.Contains(valor) ? valor : "ABERTO";
    }

    private static string NormalizarPrioridade(string? prioridade)
    {
        var valor = string.IsNullOrWhiteSpace(prioridade) ? "MEDIA" : prioridade.Trim().ToUpperInvariant();
        return PrioridadesChamadoValidas.Contains(valor) ? valor : "MEDIA";
    }

    private static int CalcularSlaHoras(string prioridade)
    {
        return prioridade switch
        {
            "URGENTE" => 8,
            "ALTA" => 24,
            "MEDIA" => 48,
            "BAIXA" => 72,
            _ => 48
        };
    }

    private static string NormalizarStatusReserva(string? status)
    {
        var valor = string.IsNullOrWhiteSpace(status) ? "PENDENTE" : status.Trim().ToUpperInvariant();
        if (valor == "SOLICITADA")
        {
            valor = "PENDENTE";
        }

        if (valor == "CONFIRMADA")
        {
            valor = "APROVADA";
        }

        return StatusReservaValidos.Contains(valor) ? valor : "PENDENTE";
    }

    private void RegistrarHistoricoChamado(Guid organizacaoId, Guid chamadoId, string acao, string? detalhes, Guid? responsavelPessoaId)
    {
        var historico = new ChamadoHistorico
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = organizacaoId,
            ChamadoId = chamadoId,
            DataHora = DateTime.UtcNow,
            Acao = acao,
            Detalhes = detalhes,
            ResponsavelPessoaId = responsavelPessoaId
        };
        _db.ChamadosHistorico.Add(historico);
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
        var now = DateTime.UtcNow;
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

    [HttpGet("chamados")]
    public async Task<ActionResult<IEnumerable<Chamado>>> ListarChamados([FromQuery] Guid? organizacaoId)
    {
        if (!organizacaoId.HasValue || organizacaoId.Value == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Guard().RequireOrgAccess(organizacaoId.Value);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.Chamados.AsNoTracking().Where(c => c.OrganizacaoId == organizacaoId.Value);

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            var pessoaId = auth.PessoaId;
            var unidadeId = auth.Membership.UnidadeOrganizacionalId;

            if (!pessoaId.HasValue && !unidadeId.HasValue)
            {
                return Forbid();
            }

            if (pessoaId.HasValue && unidadeId.HasValue)
            {
                query = query.Where(c =>
                    c.PessoaSolicitanteId == pessoaId.Value ||
                    c.UnidadeOrganizacionalId == unidadeId.Value);
            }
            else if (pessoaId.HasValue)
            {
                query = query.Where(c => c.PessoaSolicitanteId == pessoaId.Value);
            }
            else if (unidadeId.HasValue)
            {
                query = query.Where(c => c.UnidadeOrganizacionalId == unidadeId.Value);
            }
        }

        var itens = await query.ToListAsync();
        return Ok(itens);
    }

    [HttpPost("chamados")]
    public async Task<ActionResult<Chamado>> CriarChamado(Chamado model)
    {
        if (model.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Guard().RequireOrgAccess(model.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            if (!auth.PessoaId.HasValue)
            {
                return Forbid();
            }

            model.PessoaSolicitanteId = auth.PessoaId.Value;

            if (auth.Membership.UnidadeOrganizacionalId.HasValue)
            {
                model.UnidadeOrganizacionalId = auth.Membership.UnidadeOrganizacionalId;
            }
        }

        model.Id = Guid.NewGuid();
        model.DataAbertura = DateTime.UtcNow;
        model.Status = NormalizarStatusChamado(model.Status);
        model.Prioridade = NormalizarPrioridade(model.Prioridade);
        model.SlaHoras ??= CalcularSlaHoras(model.Prioridade ?? "MEDIA");
        model.DataPrazoSla ??= model.DataAbertura.AddHours(model.SlaHoras.Value);
        _db.Chamados.Add(model);
        RegistrarHistoricoChamado(model.OrganizacaoId, model.Id, "CRIADO", "Chamado criado.", model.ResponsavelPessoaId);
        RegistrarAudit(model.OrganizacaoId, model.Id, "Chamado", "CRIAR_CHAMADO", auth.PessoaId, new
        {
            model.Prioridade,
            model.Status,
            model.UnidadeOrganizacionalId,
            model.PessoaSolicitanteId,
            model.ResponsavelPessoaId
        });
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarChamados), new { id = model.Id }, model);
    }

    public record AtualizarChamadoRequest(
        string? Status,
        string? Prioridade,
        Guid? ResponsavelPessoaId,
        string? Observacao);

    [HttpPatch("chamados/{id:guid}")]
    public async Task<IActionResult> AtualizarChamado(Guid id, AtualizarChamadoRequest request)
    {
        var chamado = await _db.Chamados.FindAsync(id);
        if (chamado is null)
        {
            return NotFound();
        }

        var auth = await Guard().RequireOrgAccess(chamado.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var detalhes = new List<string>();

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var status = request.Status.Trim().ToUpperInvariant();
            if (!StatusChamadoValidos.Contains(status))
            {
                return BadRequest("Status invalido.");
            }

            if (!string.Equals(chamado.Status, status, StringComparison.OrdinalIgnoreCase))
            {
                detalhes.Add($"Status: {chamado.Status} -> {status}");
            }

            chamado.Status = status;
            if (status is "RESOLVIDO" or "ENCERRADO")
            {
                chamado.DataFechamento = DateTime.UtcNow;
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Prioridade))
        {
            var prioridade = request.Prioridade.Trim().ToUpperInvariant();
            if (!PrioridadesChamadoValidas.Contains(prioridade))
            {
                return BadRequest("Prioridade invalida.");
            }

            if (!string.Equals(chamado.Prioridade, prioridade, StringComparison.OrdinalIgnoreCase))
            {
                detalhes.Add($"Prioridade: {chamado.Prioridade} -> {prioridade}");
            }

            chamado.Prioridade = prioridade;
            chamado.SlaHoras = CalcularSlaHoras(prioridade);
            chamado.DataPrazoSla = chamado.DataAbertura.AddHours(chamado.SlaHoras.Value);
        }

        if (request.ResponsavelPessoaId.HasValue)
        {
            if (chamado.ResponsavelPessoaId != request.ResponsavelPessoaId)
            {
                detalhes.Add("Responsavel atualizado.");
            }
            chamado.ResponsavelPessoaId = request.ResponsavelPessoaId.Value;
        }

        RegistrarHistoricoChamado(
            chamado.OrganizacaoId,
            chamado.Id,
            "ATUALIZADO",
            request.Observacao ?? (detalhes.Count > 0 ? string.Join(" | ", detalhes) : "Atualizacao de chamado."),
            request.ResponsavelPessoaId ?? chamado.ResponsavelPessoaId);
        RegistrarAudit(chamado.OrganizacaoId, chamado.Id, "Chamado", "ATUALIZAR_CHAMADO", auth.PessoaId, new
        {
            Alteracoes = detalhes,
            request.Observacao
        });
        await _db.SaveChangesAsync();

        return Ok(chamado);
    }

    public record CriarComentarioChamadoRequest(string Mensagem);

    [HttpPost("chamados/{id:guid}/comentarios")]
    public async Task<IActionResult> AdicionarComentarioChamado(Guid id, CriarComentarioChamadoRequest request)
    {
        var auth = await Guard().RequireEntityAccess("chamado", id);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Mensagem))
        {
            return BadRequest("Mensagem e obrigatoria.");
        }

        RegistrarHistoricoChamado(
            auth.OrganizacaoId ?? Guid.Empty,
            id,
            "COMENTARIO",
            request.Mensagem.Trim(),
            auth.PessoaId);
        RegistrarAudit(auth.OrganizacaoId ?? Guid.Empty, id, "Chamado", "COMENTAR_CHAMADO", auth.PessoaId, new
        {
            Mensagem = request.Mensagem.Trim()
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("chamados/{id:guid}/historico")]
    public async Task<ActionResult<IEnumerable<ChamadoHistorico>>> ListarHistoricoChamado(Guid id)
    {
        var auth = await Guard().RequireEntityAccess("chamado", id);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var itens = await _db.ChamadosHistorico.AsNoTracking()
            .Where(h => h.ChamadoId == id)
            .OrderByDescending(h => h.DataHora)
            .ToListAsync();
        return Ok(itens);
    }

    public class RecursoRequest
    {
        public Guid OrganizacaoId { get; set; }
        public Guid? UnidadeOrganizacionalId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string? Tipo { get; set; }
        public int? Capacidade { get; set; }
        public string? RegrasJson { get; set; }
        public int? LimitePorUnidadePorMes { get; set; }
        public bool? ExigeAprovacao { get; set; }
        public string? JanelaHorarioInicio { get; set; }
        public string? JanelaHorarioFim { get; set; }
        public string? BloqueiosJson { get; set; }
        public bool? Ativo { get; set; }
    }

    [HttpGet("recursos")]
    public async Task<ActionResult<IEnumerable<RecursoReservavel>>> ListarRecursos([FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var itens = await _db.RecursosReservaveis.AsNoTracking()
            .Where(r => r.OrganizacaoId == organizacaoId)
            .OrderBy(r => r.Nome)
            .ToListAsync();
        return Ok(itens);
    }

    [HttpPost("recursos")]
    public async Task<ActionResult<RecursoReservavel>> CriarRecurso(RecursoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Guard().RequireOrgAccess(request.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome do recurso e obrigatorio.");
        }

        var recurso = new RecursoReservavel
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = request.OrganizacaoId,
            UnidadeOrganizacionalId = request.UnidadeOrganizacionalId ?? Guid.Empty,
            Nome = request.Nome.Trim(),
            Tipo = string.IsNullOrWhiteSpace(request.Tipo) ? "area_comum" : request.Tipo.Trim(),
            Capacidade = request.Capacidade,
            RegrasJson = request.RegrasJson,
            LimitePorUnidadePorMes = request.LimitePorUnidadePorMes,
            ExigeAprovacao = request.ExigeAprovacao ?? false,
            JanelaHorarioInicio = request.JanelaHorarioInicio,
            JanelaHorarioFim = request.JanelaHorarioFim,
            BloqueiosJson = request.BloqueiosJson,
            Ativo = request.Ativo ?? true
        };

        _db.RecursosReservaveis.Add(recurso);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarRecursos), new { organizacaoId = recurso.OrganizacaoId }, recurso);
    }

    [HttpPut("recursos/{id:guid}")]
    public async Task<ActionResult<RecursoReservavel>> AtualizarRecurso(Guid id, RecursoRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var recurso = await _db.RecursosReservaveis.FindAsync(id);
        if (recurso is null)
        {
            return NotFound();
        }

        var auth = await Guard().RequireOrgAccess(request.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome do recurso e obrigatorio.");
        }

        recurso.Nome = request.Nome.Trim();
        recurso.Tipo = string.IsNullOrWhiteSpace(request.Tipo) ? recurso.Tipo : request.Tipo.Trim();
        recurso.Capacidade = request.Capacidade;
        recurso.RegrasJson = request.RegrasJson;
        recurso.LimitePorUnidadePorMes = request.LimitePorUnidadePorMes ?? recurso.LimitePorUnidadePorMes;
        if (request.ExigeAprovacao.HasValue)
        {
            recurso.ExigeAprovacao = request.ExigeAprovacao.Value;
        }
        recurso.JanelaHorarioInicio = request.JanelaHorarioInicio ?? recurso.JanelaHorarioInicio;
        recurso.JanelaHorarioFim = request.JanelaHorarioFim ?? recurso.JanelaHorarioFim;
        recurso.BloqueiosJson = request.BloqueiosJson ?? recurso.BloqueiosJson;
        recurso.Ativo = request.Ativo ?? recurso.Ativo;
        recurso.UnidadeOrganizacionalId = request.UnidadeOrganizacionalId ?? recurso.UnidadeOrganizacionalId;

        await _db.SaveChangesAsync();
        return Ok(recurso);
    }

    [HttpDelete("recursos/{id:guid}")]
    public async Task<IActionResult> RemoverRecurso(Guid id, [FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var recurso = await _db.RecursosReservaveis.FindAsync(id);
        if (recurso is null)
        {
            return NotFound();
        }

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        _db.RecursosReservaveis.Remove(recurso);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("reservas")]
    public async Task<ActionResult<IEnumerable<Reserva>>> ListarReservas(
        [FromQuery] Guid? organizacaoId,
        [FromQuery] Guid? recursoId)
    {
        if (!organizacaoId.HasValue || organizacaoId.Value == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Guard().RequireOrgAccess(organizacaoId.Value);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.Reservas.AsNoTracking().Where(r => r.OrganizacaoId == organizacaoId.Value);

        if (recursoId.HasValue && recursoId.Value != Guid.Empty)
        {
            query = query.Where(r => r.RecursoReservavelId == recursoId.Value);
        }

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            var pessoaId = auth.PessoaId;
            var unidadeId = auth.Membership.UnidadeOrganizacionalId;

            if (!pessoaId.HasValue && !unidadeId.HasValue)
            {
                return Forbid();
            }

            if (pessoaId.HasValue && unidadeId.HasValue)
            {
                query = query.Where(r =>
                    r.PessoaSolicitanteId == pessoaId.Value ||
                    r.UnidadeOrganizacionalId == unidadeId.Value);
            }
            else if (pessoaId.HasValue)
            {
                query = query.Where(r => r.PessoaSolicitanteId == pessoaId.Value);
            }
            else if (unidadeId.HasValue)
            {
                query = query.Where(r => r.UnidadeOrganizacionalId == unidadeId.Value);
            }
        }

        var itens = await query.ToListAsync();
        return Ok(itens);
    }

    [HttpPost("reservas")]
    public async Task<ActionResult<Reserva>> CriarReserva(Reserva model)
    {
        if (model.OrganizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Guard().RequireOrgAccess(model.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            if (!auth.PessoaId.HasValue)
            {
                return Forbid();
            }

            model.PessoaSolicitanteId = auth.PessoaId.Value;

            if (auth.Membership.UnidadeOrganizacionalId.HasValue)
            {
                model.UnidadeOrganizacionalId = auth.Membership.UnidadeOrganizacionalId;
            }
        }

        if (model.RecursoReservavelId == Guid.Empty)
        {
            return BadRequest("RecursoReservavelId e obrigatorio.");
        }

        var recurso = await _db.RecursosReservaveis
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == model.RecursoReservavelId && r.OrganizacaoId == model.OrganizacaoId);
        if (recurso is null)
        {
            return BadRequest("Recurso nao encontrado para este condominio.");
        }

        if (!recurso.Ativo)
        {
            return BadRequest("Recurso indisponivel.");
        }

        if (model.DataFim <= model.DataInicio)
        {
            return BadRequest("DataFim deve ser maior que DataInicio.");
        }

        if (!string.IsNullOrWhiteSpace(recurso.JanelaHorarioInicio) &&
            !string.IsNullOrWhiteSpace(recurso.JanelaHorarioFim) &&
            TimeSpan.TryParse(recurso.JanelaHorarioInicio, out var inicioJanela) &&
            TimeSpan.TryParse(recurso.JanelaHorarioFim, out var fimJanela))
        {
            var inicioReserva = model.DataInicio.TimeOfDay;
            var fimReserva = model.DataFim.TimeOfDay;
            if (inicioReserva < inicioJanela || fimReserva > fimJanela)
            {
                return BadRequest("Horario fora da janela permitida.");
            }
        }

        if (!string.IsNullOrWhiteSpace(recurso.BloqueiosJson))
        {
            try
            {
                var bloqueios = JsonSerializer.Deserialize<List<string>>(recurso.BloqueiosJson) ?? new List<string>();
                var diasBloqueados = new HashSet<string>(bloqueios.Select(b => b.Trim()), StringComparer.OrdinalIgnoreCase);
                if (diasBloqueados.Contains(model.DataInicio.ToString("yyyy-MM-dd")) ||
                    diasBloqueados.Contains(model.DataFim.ToString("yyyy-MM-dd")))
                {
                    return BadRequest("Data bloqueada para este recurso.");
                }
            }
            catch
            {
                // Ignora bloqueios invalidos.
            }
        }

        var conflito = await _db.Reservas.AsNoTracking()
            .Where(r => r.RecursoReservavelId == model.RecursoReservavelId)
            .Where(r =>
                r.Status == null ||
                (r.Status != "CANCELADA" &&
                 r.Status != "cancelada"))
            .AnyAsync(r => r.DataInicio < model.DataFim && r.DataFim > model.DataInicio);

        if (conflito)
        {
            return BadRequest("Horario indisponivel para este recurso.");
        }

        if (recurso.LimitePorUnidadePorMes.HasValue && model.UnidadeOrganizacionalId.HasValue)
        {
            var referencia = new DateTime(model.DataInicio.Year, model.DataInicio.Month, 1);
            var limite = recurso.LimitePorUnidadePorMes.Value;
            var quantidade = await _db.Reservas.AsNoTracking()
                .Where(r => r.RecursoReservavelId == model.RecursoReservavelId)
                .Where(r => r.UnidadeOrganizacionalId == model.UnidadeOrganizacionalId)
                .Where(r => r.Status != "CANCELADA" && r.Status != "cancelada")
                .Where(r => r.DataInicio >= referencia && r.DataInicio < referencia.AddMonths(1))
                .CountAsync();
            if (quantidade >= limite)
            {
                return BadRequest("Limite de reservas por unidade atingido.");
            }
        }

        model.Id = Guid.NewGuid();
        model.DataSolicitacao = DateTime.UtcNow;
        model.Status = recurso.ExigeAprovacao ? "PENDENTE" : NormalizarStatusReserva(model.Status);
        if (!recurso.ExigeAprovacao)
        {
            model.DataAprovacao = DateTime.UtcNow;
        }
        _db.Reservas.Add(model);
        RegistrarAudit(model.OrganizacaoId, model.Id, "Reserva", "CRIAR_RESERVA", auth.PessoaId, new
        {
            model.RecursoReservavelId,
            model.DataInicio,
            model.DataFim,
            model.Status,
            model.UnidadeOrganizacionalId,
            model.PessoaSolicitanteId
        });
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ListarReservas), new { id = model.Id }, model);
    }

    public record AtualizarReservaRequest(string? Status, string? Observacao);

    [HttpPatch("reservas/{id:guid}")]
    public async Task<IActionResult> AtualizarReserva(Guid id, AtualizarReservaRequest request)
    {
        var reserva = await _db.Reservas.FindAsync(id);
        if (reserva is null)
        {
            return NotFound();
        }

        var auth = await Guard().RequireOrgAccess(reserva.OrganizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var status = request.Status.Trim().ToUpperInvariant();
            if (!StatusReservaValidos.Contains(status))
            {
                return BadRequest("Status invalido.");
            }
            reserva.Status = status;
            if (status == "APROVADA")
            {
                reserva.DataAprovacao ??= DateTime.UtcNow;
                var usuarioId = Authz.GetUserId(User);
                if (usuarioId.HasValue)
                {
                    var pessoaId = await _db.Usuarios.AsNoTracking()
                        .Where(u => u.Id == usuarioId.Value)
                        .Select(u => u.PessoaId)
                        .FirstOrDefaultAsync();
                    if (pessoaId != Guid.Empty)
                    {
                        reserva.AprovadorPessoaId = pessoaId;
                    }
                }
            }
            if (status == "CANCELADA")
            {
                reserva.Observacao = request.Observacao;
            }
        }

        RegistrarAudit(reserva.OrganizacaoId, reserva.Id, "Reserva", "ATUALIZAR_RESERVA", auth.PessoaId, new
        {
            request.Status,
            request.Observacao,
            reserva.AprovadorPessoaId
        });
        await _db.SaveChangesAsync();
        return Ok(reserva);
    }
}
