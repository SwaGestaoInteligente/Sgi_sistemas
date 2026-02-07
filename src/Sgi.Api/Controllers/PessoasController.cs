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
        string? UnidadeCodigo);

    public class CriarPessoaRequest
    {
        public Guid OrganizacaoId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Tipo { get; set; } = "fisica";
        public string? Documento { get; set; }
        public string? Email { get; set; }
        public string? Telefone { get; set; }
        public string? Papel { get; set; }

        // Endereco principal
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
        {
            return BadRequest("organizacaoId e obrigatorio.");
        }

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

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
            {
                return Forbid();
            }

            var unidadeId = auth.Membership.UnidadeOrganizacionalId;
            var pessoaId = auth.PessoaId;
            query = query.Where(v =>
                (unidadeId.HasValue && v.UnidadeOrganizacionalId == unidadeId.Value) ||
                (pessoaId.HasValue && v.PessoaId == pessoaId.Value));
        }

        var pessoas = await query.AsNoTracking().ToListAsync();
        return Ok(pessoas);
    }

    [HttpPost]
    public async Task<ActionResult<PessoaDto>> Criar(CriarPessoaRequest request)
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

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var pessoa = new Pessoa
        {
            Id = Guid.NewGuid(),
            Nome = request.Nome,
            Tipo = request.Tipo,
            Documento = request.Documento,
            Email = request.Email,
            Telefone = request.Telefone,
            DataNascimentoAbertura = null,
            Observacoes = null
        };

        var vinculo = new VinculoPessoaOrganizacao
        {
            Id = Guid.NewGuid(),
            PessoaId = pessoa.Id,
            OrganizacaoId = request.OrganizacaoId,
            UnidadeOrganizacionalId = null,
            Papel = request.Papel ?? "morador",
            DataInicio = DateTime.UtcNow,
            DataFim = null
        };

        Endereco? endereco = null;
        if (!string.IsNullOrWhiteSpace(request.Logradouro))
        {
            endereco = new Endereco
            {
                Id = Guid.NewGuid(),
                PessoaId = pessoa.Id,
                OrganizacaoId = request.OrganizacaoId,
                UnidadeOrganizacionalId = null,
                Logradouro = request.Logradouro,
                Numero = request.Numero,
                Bairro = request.Bairro,
                Cidade = request.Cidade,
                Estado = request.Estado,
                Cep = request.Cep,
                Pais = "Brasil",
                Tipo = "principal"
            };
        }

        _db.Pessoas.Add(pessoa);
        _db.VinculosPessoaOrganizacao.Add(vinculo);
        if (endereco is not null)
        {
            _db.Enderecos.Add(endereco);
        }

        await _db.SaveChangesAsync();

        var dto = new PessoaDto(
            pessoa.Id,
            pessoa.Nome,
            pessoa.Email,
            pessoa.Telefone,
            pessoa.Documento,
            vinculo.Papel,
            endereco != null
                ? $"{endereco.Logradouro}, {endereco.Numero} - {endereco.Bairro} - {endereco.Cidade}/{endereco.Estado}"
                : null,
            vinculo.UnidadeOrganizacionalId,
            null
        );

        return CreatedAtAction(nameof(Listar), new { organizacaoId = request.OrganizacaoId }, dto);
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
    public async Task<ActionResult<PessoaDto>> Atualizar(Guid id, [FromQuery] Guid organizacaoId, AtualizarPessoaRequest request)
    {
        var pessoa = await _db.Pessoas.FindAsync(id);
        if (pessoa is null)
        {
            return NotFound();
        }

        var vinculo = await _db.VinculosPessoaOrganizacao
            .FirstOrDefaultAsync(v => v.PessoaId == id && v.OrganizacaoId == organizacaoId);

        if (vinculo is null)
        {
            return BadRequest("Vinculo da pessoa com a organizacao nao encontrado.");
        }

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        pessoa.Nome = request.Nome;
        pessoa.Tipo = request.Tipo;
        pessoa.Documento = request.Documento;
        pessoa.Email = request.Email;
        pessoa.Telefone = request.Telefone;

        vinculo.Papel = request.Papel ?? vinculo.Papel;

        var endereco = await _db.Enderecos
            .FirstOrDefaultAsync(e => e.PessoaId == id && e.Tipo == "principal");

        if (!string.IsNullOrWhiteSpace(request.Logradouro))
        {
            if (endereco is null)
            {
                endereco = new Endereco
                {
                    Id = Guid.NewGuid(),
                    PessoaId = pessoa.Id,
                    OrganizacaoId = organizacaoId,
                    Tipo = "principal"
                };
                _db.Enderecos.Add(endereco);
            }

            endereco.Logradouro = request.Logradouro;
            endereco.Numero = request.Numero;
            endereco.Bairro = request.Bairro;
            endereco.Cidade = request.Cidade;
            endereco.Estado = request.Estado;
            endereco.Cep = request.Cep;
        }

        await _db.SaveChangesAsync();

        var resumoEndereco = endereco != null
            ? $"{endereco.Logradouro}, {endereco.Numero} - {endereco.Bairro} - {endereco.Cidade}/{endereco.Estado}"
            : null;

        return Ok(new PessoaDto(
            pessoa.Id,
            pessoa.Nome,
            pessoa.Email,
            pessoa.Telefone,
            pessoa.Documento,
            vinculo.Papel,
            resumoEndereco,
            vinculo.UnidadeOrganizacionalId,
            null));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remover(Guid id, [FromQuery] Guid organizacaoId)
    {
        var pessoa = await _db.Pessoas.FindAsync(id);
        if (pessoa is null)
        {
            return NotFound();
        }

        var auth = await Guard().RequireOrgAccess(organizacaoId);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        auth.RequireRole(UserRole.CONDO_ADMIN);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var vinculos = await _db.VinculosPessoaOrganizacao
            .Where(v => v.PessoaId == id &&
                        (organizacaoId == Guid.Empty || v.OrganizacaoId == organizacaoId))
            .ToListAsync();

        var enderecos = await _db.Enderecos
            .Where(e => e.PessoaId == id &&
                        (organizacaoId == Guid.Empty || e.OrganizacaoId == organizacaoId))
            .ToListAsync();

        _db.VinculosPessoaOrganizacao.RemoveRange(vinculos);
        _db.Enderecos.RemoveRange(enderecos);

        var aindaTemVinculos = await _db.VinculosPessoaOrganizacao
            .AnyAsync(v => v.PessoaId == id);

        if (!aindaTemVinculos)
        {
            _db.Pessoas.Remove(pessoa);
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }
}
