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
        string? UnidadeCodigo,
        string? Logradouro,
        string? Numero,
        string? Bairro,
        string? Cidade,
        string? Estado,
        string? Cep
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

        auth.RequireRole(UserRole.CONDO_ADMIN, UserRole.CONDO_STAFF);
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
                u != null ? u.CodigoInterno : null,
                e != null ? e.Logradouro : null,
                e != null ? e.Numero : null,
                e != null ? e.Bairro : null,
                e != null ? e.Cidade : null,
                e != null ? e.Estado : null,
                e != null ? e.Cep : null
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

        if (!string.IsNullOrWhiteSpace(request.Logradouro) ||
            !string.IsNullOrWhiteSpace(request.Numero) ||
            !string.IsNullOrWhiteSpace(request.Bairro) ||
            !string.IsNullOrWhiteSpace(request.Cidade) ||
            !string.IsNullOrWhiteSpace(request.Estado) ||
            !string.IsNullOrWhiteSpace(request.Cep))
        {
            var endereco = new Endereco
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = request.OrganizacaoId,
                PessoaId = pessoa.Id,
                Logradouro = request.Logradouro?.Trim() ?? string.Empty,
                Numero = request.Numero?.Trim(),
                Bairro = request.Bairro?.Trim(),
                Cidade = request.Cidade?.Trim(),
                Estado = request.Estado?.Trim(),
                Cep = request.Cep?.Trim()
            };
            _db.Enderecos.Add(endereco);
        }

        await _db.SaveChangesAsync();

        var enderecoResumoCriado = !string.IsNullOrWhiteSpace(request.Logradouro)
            ? $"{request.Logradouro}, {request.Numero} - {request.Bairro} - {request.Cidade}/{request.Estado}"
            : null;

        return Ok(new PessoaDto(
            pessoa.Id,
            pessoa.Nome,
            pessoa.Email,
            pessoa.Telefone,
            pessoa.Documento,
            vinculo.Papel,
            enderecoResumoCriado,
            null,
            null,
            request.Logradouro?.Trim(),
            request.Numero?.Trim(),
            request.Bairro?.Trim(),
            request.Cidade?.Trim(),
            request.Estado?.Trim(),
            request.Cep?.Trim()
        ));
    }

    public class AtualizarPessoaRequest
    {
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

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PessoaDto>> Atualizar(
        Guid id,
        [FromQuery] Guid organizacaoId,
        AtualizarPessoaRequest request)
    {
        if (organizacaoId == Guid.Empty)
            return BadRequest("OrganizacaoId é obrigatório.");

        var pessoa = await _db.Pessoas.FindAsync(id);
        if (pessoa is null)
            return NotFound();

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null)
            return auth.Error;

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
            return auth.Error;

        var vinculo = await _db.VinculosPessoaOrganizacao
            .FirstOrDefaultAsync(v => v.PessoaId == id && v.OrganizacaoId == organizacaoId);
        if (vinculo is null)
            return BadRequest("Vinculo nao encontrado para esta organizacao.");

        pessoa.Nome = request.Nome.Trim();
        pessoa.Tipo = request.Tipo.Trim();
        pessoa.Documento = request.Documento?.Trim();
        pessoa.Email = request.Email?.Trim();
        pessoa.Telefone = request.Telefone?.Trim();

        if (!string.IsNullOrWhiteSpace(request.Papel))
        {
            vinculo.Papel = request.Papel.Trim();
        }

        var endereco = await _db.Enderecos
            .FirstOrDefaultAsync(e => e.PessoaId == id && e.OrganizacaoId == organizacaoId);

        if (endereco is null &&
            (!string.IsNullOrWhiteSpace(request.Logradouro) ||
             !string.IsNullOrWhiteSpace(request.Numero) ||
             !string.IsNullOrWhiteSpace(request.Bairro) ||
             !string.IsNullOrWhiteSpace(request.Cidade) ||
             !string.IsNullOrWhiteSpace(request.Estado) ||
             !string.IsNullOrWhiteSpace(request.Cep)))
        {
            endereco = new Endereco
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                PessoaId = id
            };
            _db.Enderecos.Add(endereco);
        }

        if (endereco is not null)
        {
            endereco.Logradouro = request.Logradouro?.Trim() ?? endereco.Logradouro;
            endereco.Numero = request.Numero?.Trim() ?? endereco.Numero;
            endereco.Bairro = request.Bairro?.Trim() ?? endereco.Bairro;
            endereco.Cidade = request.Cidade?.Trim() ?? endereco.Cidade;
            endereco.Estado = request.Estado?.Trim() ?? endereco.Estado;
            endereco.Cep = request.Cep?.Trim() ?? endereco.Cep;
        }

        await _db.SaveChangesAsync();

        return Ok(new PessoaDto(
            pessoa.Id,
            pessoa.Nome,
            pessoa.Email,
            pessoa.Telefone,
            pessoa.Documento,
            vinculo.Papel,
            endereco is not null
                ? $"{endereco.Logradouro}, {endereco.Numero} - {endereco.Bairro} - {endereco.Cidade}/{endereco.Estado}"
                : null,
            vinculo.UnidadeOrganizacionalId,
            null,
            endereco?.Logradouro,
            endereco?.Numero,
            endereco?.Bairro,
            endereco?.Cidade,
            endereco?.Estado,
            endereco?.Cep
        ));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remover(Guid id, [FromQuery] Guid organizacaoId)
    {
        if (organizacaoId == Guid.Empty)
            return BadRequest("OrganizacaoId é obrigatório.");

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null)
            return auth.Error;

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
            return auth.Error;

        var vinculos = await _db.VinculosPessoaOrganizacao
            .Where(v => v.PessoaId == id && v.OrganizacaoId == organizacaoId)
            .ToListAsync();
        if (vinculos.Count == 0)
            return NotFound();

        _db.VinculosPessoaOrganizacao.RemoveRange(vinculos);

        var enderecos = await _db.Enderecos
            .Where(e => e.PessoaId == id && e.OrganizacaoId == organizacaoId)
            .ToListAsync();
        if (enderecos.Count > 0)
        {
            _db.Enderecos.RemoveRange(enderecos);
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }
}
