using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Auth;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AnexosController : ControllerBase
{
    private readonly SgiDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AnexosController> _logger;

    public AnexosController(SgiDbContext db, IWebHostEnvironment env, ILogger<AnexosController> logger)
    {
        _db = db;
        _env = env;
        _logger = logger;
    }

    private static string NormalizeTipo(string tipoEntidade)
    {
        return tipoEntidade.Trim().ToLowerInvariant().Replace("/", "-");
    }

    private async Task<Guid?> ResolvePessoaIdAsync(Guid? userId)
    {
        if (!userId.HasValue)
        {
            return null;
        }

        return await _db.Usuarios.AsNoTracking()
            .Where(u => u.Id == userId.Value)
            .Select(u => (Guid?)u.PessoaId)
            .FirstOrDefaultAsync();
    }

    private async Task<bool> ResidentPodeAcessarEntidadeAsync(
        string tipoEntidade,
        Guid entidadeId,
        Guid organizacaoId,
        Guid? unidadeId,
        Guid? pessoaId)
    {
        if (entidadeId == Guid.Empty)
        {
            return false;
        }

        switch (tipoEntidade)
        {
            case "chamado":
            {
                var query = _db.Chamados.AsNoTracking()
                    .Where(c => c.OrganizacaoId == organizacaoId && c.Id == entidadeId);

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
                else
                {
                    return false;
                }

                return await query.AnyAsync();
            }
            case "cobranca_unidade":
            {
                if (!unidadeId.HasValue || unidadeId.Value == Guid.Empty)
                {
                    return false;
                }

                return await _db.UnidadesCobrancas.AsNoTracking()
                    .AnyAsync(c =>
                        c.Id == entidadeId &&
                        c.OrganizacaoId == organizacaoId &&
                        c.UnidadeOrganizacionalId == unidadeId.Value);
            }
            case "reserva":
            {
                var query = _db.Reservas.AsNoTracking()
                    .Where(r => r.OrganizacaoId == organizacaoId && r.Id == entidadeId);

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
                else
                {
                    return false;
                }

                return await query.AnyAsync();
            }
            default:
                return false;
        }
    }

    private async Task<List<Guid>> ListarEntidadesPermitidasAsync(
        string tipoEntidade,
        Guid organizacaoId,
        Guid? unidadeId,
        Guid? pessoaId)
    {
        switch (tipoEntidade)
        {
            case "chamado":
            {
                var query = _db.Chamados.AsNoTracking()
                    .Where(c => c.OrganizacaoId == organizacaoId);

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
                else
                {
                    return new List<Guid>();
                }

                return await query.Select(c => c.Id).ToListAsync();
            }
            case "cobranca_unidade":
            {
                if (!unidadeId.HasValue || unidadeId.Value == Guid.Empty)
                {
                    return new List<Guid>();
                }

                return await _db.UnidadesCobrancas.AsNoTracking()
                    .Where(c =>
                        c.OrganizacaoId == organizacaoId &&
                        c.UnidadeOrganizacionalId == unidadeId.Value)
                    .Select(c => c.Id)
                    .ToListAsync();
            }
            case "reserva":
            {
                var query = _db.Reservas.AsNoTracking()
                    .Where(r => r.OrganizacaoId == organizacaoId);

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
                else
                {
                    return new List<Guid>();
                }

                return await query.Select(r => r.Id).ToListAsync();
            }
            default:
                return new List<Guid>();
        }
    }

    [HttpPost("upload")]
    [RequestSizeLimit(25_000_000)]
    public async Task<ActionResult<Anexo>> Upload(
        [FromForm] Guid organizacaoId,
        [FromForm] string tipoEntidade,
        [FromForm] Guid entidadeId,
        [FromForm] IFormFile arquivo)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        if (string.IsNullOrWhiteSpace(tipoEntidade))
        {
            return BadRequest("TipoEntidade e obrigatorio.");
        }

        if (entidadeId == Guid.Empty)
        {
            return BadRequest("EntidadeId e obrigatorio.");
        }

        if (arquivo is null || arquivo.Length == 0)
        {
            return BadRequest("Arquivo e obrigatorio.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            organizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var tipoSeguro = NormalizeTipo(tipoEntidade);
        var isResident = !auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT;
        if (isResident)
        {
            var pessoaId = await ResolvePessoaIdAsync(Authz.GetUserId(User));
            var permitido = await ResidentPodeAcessarEntidadeAsync(
                tipoSeguro,
                entidadeId,
                organizacaoId,
                auth.Membership?.UnidadeOrganizacionalId,
                pessoaId);
            if (!permitido)
            {
                return Forbid();
            }
        }

        var pasta = Path.Combine(
            _env.ContentRootPath,
            "Uploads",
            organizacaoId.ToString(),
            tipoSeguro,
            entidadeId.ToString());
        Directory.CreateDirectory(pasta);

        var nomeOriginal = Path.GetFileName(arquivo.FileName);
        var uniqueName = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}-{nomeOriginal}";
        var caminho = Path.Combine(pasta, uniqueName);

        await using (var stream = System.IO.File.Create(caminho))
        {
            await arquivo.CopyToAsync(stream);
        }

        var anexo = new Anexo
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = organizacaoId,
            TipoEntidade = tipoSeguro,
            EntidadeId = entidadeId,
            NomeArquivo = nomeOriginal,
            MimeType = arquivo.ContentType ?? "application/octet-stream",
            Tamanho = arquivo.Length,
            Caminho = caminho,
            CriadoEm = DateTime.UtcNow,
            CriadoPorUserId = Authz.GetUserId(User)
        };

        _db.Anexos.Add(anexo);
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Anexo criado: {AnexoId} ({TipoEntidade}) org {OrgId}",
            anexo.Id,
            anexo.TipoEntidade,
            organizacaoId);

        return Ok(anexo);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Anexo>>> Listar(
        [FromQuery] Guid organizacaoId,
        [FromQuery] string tipoEntidade,
        [FromQuery] Guid? entidadeId)
    {
        if (organizacaoId == Guid.Empty)
        {
            return BadRequest("OrganizacaoId e obrigatorio.");
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            organizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var query = _db.Anexos.AsNoTracking().Where(a => a.OrganizacaoId == organizacaoId);
        var isResident = !auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT;
        if (isResident)
        {
            if (string.IsNullOrWhiteSpace(tipoEntidade))
            {
                return Forbid();
            }

            var tipo = NormalizeTipo(tipoEntidade);
            query = query.Where(a => a.TipoEntidade == tipo);

            var pessoaId = await ResolvePessoaIdAsync(Authz.GetUserId(User));
            var unidadeId = auth.Membership?.UnidadeOrganizacionalId;

            if (entidadeId.HasValue && entidadeId.Value != Guid.Empty)
            {
                var permitido = await ResidentPodeAcessarEntidadeAsync(
                    tipo,
                    entidadeId.Value,
                    organizacaoId,
                    unidadeId,
                    pessoaId);
                if (!permitido)
                {
                    return Forbid();
                }

                query = query.Where(a => a.EntidadeId == entidadeId.Value);
            }
            else
            {
                var entidadesPermitidas = await ListarEntidadesPermitidasAsync(
                    tipo,
                    organizacaoId,
                    unidadeId,
                    pessoaId);
                if (entidadesPermitidas.Count == 0)
                {
                    return Ok(new List<Anexo>());
                }

                query = query.Where(a => entidadesPermitidas.Contains(a.EntidadeId));
            }

            var itensResidente = await query.OrderByDescending(a => a.CriadoEm).ToListAsync();
            return Ok(itensResidente);
        }

        if (!string.IsNullOrWhiteSpace(tipoEntidade))
        {
            var tipo = NormalizeTipo(tipoEntidade);
            query = query.Where(a => a.TipoEntidade == tipo);
        }

        if (entidadeId.HasValue && entidadeId.Value != Guid.Empty)
        {
            query = query.Where(a => a.EntidadeId == entidadeId.Value);
        }

        var itens = await query.OrderByDescending(a => a.CriadoEm).ToListAsync();
        return Ok(itens);
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id)
    {
        var anexo = await _db.Anexos.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
        if (anexo is null)
        {
            return NotFound();
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            anexo.OrganizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF,
            UserRole.RESIDENT);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var isResident = !auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT;
        if (isResident)
        {
            var pessoaId = await ResolvePessoaIdAsync(Authz.GetUserId(User));
            var permitido = await ResidentPodeAcessarEntidadeAsync(
                anexo.TipoEntidade,
                anexo.EntidadeId,
                anexo.OrganizacaoId,
                auth.Membership?.UnidadeOrganizacionalId,
                pessoaId);
            if (!permitido)
            {
                return Forbid();
            }
        }

        if (!System.IO.File.Exists(anexo.Caminho))
        {
            return NotFound("Arquivo nao encontrado.");
        }

        return PhysicalFile(anexo.Caminho, anexo.MimeType, anexo.NomeArquivo);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remover(Guid id)
    {
        var anexo = await _db.Anexos.FindAsync(id);
        if (anexo is null)
        {
            return NotFound();
        }

        var auth = await Authz.EnsureMembershipAsync(
            _db,
            User,
            anexo.OrganizacaoId,
            UserRole.CONDO_ADMIN,
            UserRole.CONDO_STAFF);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        if (System.IO.File.Exists(anexo.Caminho))
        {
            System.IO.File.Delete(anexo.Caminho);
        }

        _db.Anexos.Remove(anexo);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
