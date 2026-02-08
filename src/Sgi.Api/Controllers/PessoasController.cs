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
public class PessoasController : ControllerBase
{
    private readonly SgiDbContext _db;

    public PessoasController(SgiDbContext db)
    {
        _db = db;
    }

    private AuthorizationGuard Guard() => new(_db, User);

    public record PessoaDto(
        Guid Id,
        string Nome,
        string? Email,
        string? Telefone,
        string? Documento,
        string? Papel,
        string? EnderecoResumo,
        Guid? UnidadeOrganizacionalId,
        string? UnidadeCodigo
    );

    public class CriarPessoaRequest
    {
        public Guid OrganizacaoId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Tipo { get; set; } = "fisica";
        public string? Documento { get; set; }
        public string? Email { get; set; }
        public string? Telefone { get; set; }
        public string? Papel { get; set; }

        public string? Logradouro { get; set; }
        public string? Numero { get; set; }
        public string? Bairro { get; set; }
        public string? Cidade { get; set; }
        public string? Estado { get; set; }
        public string? Cep { get; set; }
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PessoaDto>>> Listar([FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
            return BadRequest("organizacaoId é obrigatório.");

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null)
            return auth.Error;

        var query =
            from v in _db.VinculosPessoaOrganizacao
            join p in _db.Pessoas on v.PessoaId equals p.Id
            join e in _db.Enderecos on p.Id equals e.PessoaId into enderecos
            from e in enderecos.DefaultIfEmpty()
            join u in _db.UnidadesOrganizacionais on v.UnidadeOrganizacionalId equals u.Id into unidades
            from u in unidades.DefaultIfEmpty()
            where v.OrganizacaoId == organizacaoId
            select new PessoaDto(
                p.Id,
                p.Nome,
                p.Email,
                p.Telefone,
                p.Documento,
                v.Papel,
                e != null
                    ? $"{e.Logradouro}, {e.Numero} - {e.Bairro} - {e.Cidade}/{e.Estado}"
                    : null,
                v.UnidadeOrganizacionalId,
                u != null ? u.CodigoInterno : null
            );

        if (!auth.IsPlatformAdmin && auth.Membership?.Role == UserRole.RESIDENT)
        {
            if (!auth.Membership.UnidadeOrganizacionalId.HasValue && !auth.PessoaId.HasValue)
                return Forbid();

            var unidadeId = auth.Membership.UnidadeOrganizacionalId;
            var pessoaId = auth.PessoaId;

            query = query.Where(v =>
                (unidadeId.HasValue && v.UnidadeOrganizacionalId == unidadeId.Value) ||
                (pessoaId.HasValue && v.Id == pessoaId.Value));
        }

        return Ok(await query.AsNoTracking().ToListAsync());
    }

    [HttpPost]
    public async Task<ActionResult<PessoaDto>> Criar(CriarPessoaRequest request)
    {
        if (request.OrganizacaoId == Guid.Empty)
            return BadRequest("OrganizacaoId é obrigatório.");

        var auth = await Guard().RequireOrgAccess(request.OrganizacaoId);
        if (auth.Error is not null)
            return auth.Error;

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
            return auth.Error;

        var pessoa = new Pessoa
        {
            Id = Guid.NewGuid(),
            Nome = request.Nome,
            Tipo = request.Tipo,
            Documento = request.Documento,
            Email = request.Email,
            Telefone = request.Telefone
        };

        var vinculo = new VinculoPessoaOrganizacao
        {
            Id = Guid.NewGuid(),
            PessoaId = pessoa.Id,
            OrganizacaoId = request.OrganizacaoId,
            Papel = request.Papel ?? "morador",
            DataInicio = DateTime.UtcNow
        };

        _db.Pessoas.Add(pessoa);
        _db.VinculosPessoaOrganizacao.Add(vinculo);
        await _db.SaveChangesAsync();

        return Ok(new PessoaDto(
            pessoa.Id,
            pessoa.Nome,
            pessoa.Email,
            pessoa.Telefone,
            pessoa.Documento,
            vinculo.Papel,
            null,
            null,
            null
        ));
    }
}
