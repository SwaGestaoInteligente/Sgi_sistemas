using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Controllers;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Dev;

[ApiController]
[Route("api/dev")]
public class DevController : ControllerBase
{
    private readonly SgiDbContext _db;

    public DevController(SgiDbContext db)
    {
        _db = db;
    }

    [HttpPost("seed-admin")]
    [HttpGet("seed-admin")]
    [AllowAnonymous]
    public async Task<IActionResult> SeedAdmin()
    {
        const string adminEmail = "admin@teste.com";
        const string adminSenha = "Admin@123";
        const string sindicoEmail = "sindico@teste.com";
        const string sindicoSenha = "Sindico@123";
        const string porteiroEmail = "porteiro@teste.com";
        const string porteiroSenha = "Porteiro@123";
        const string moradorEmail = "morador@teste.com";
        const string moradorSenha = "Morador@123";

        await _db.Database.EnsureCreatedAsync();
        await _db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS UserCondoMemberships (
                Id TEXT NOT NULL PRIMARY KEY,
                UsuarioId TEXT NOT NULL,
                OrganizacaoId TEXT NULL,
                UnidadeOrganizacionalId TEXT NULL,
                Role TEXT NOT NULL,
                IsActive INTEGER NOT NULL DEFAULT 1,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """);

        var admin = await EnsureUserAsync(adminEmail, adminSenha, "Usuario Admin");

        var organizacao = await _db.Organizacoes.AsNoTracking().FirstOrDefaultAsync();
        if (organizacao is null)
        {
            organizacao = new Organizacao
            {
                Id = Guid.NewGuid(),
                Nome = "Condominio Teste",
                Tipo = "Condominios",
                ModulosAtivos = "core,financeiro,manutencao,reservas",
                Status = "ativo"
            };
            _db.Organizacoes.Add(organizacao);
        }

        var unidade = await _db.UnidadesOrganizacionais.AsNoTracking()
            .FirstOrDefaultAsync(u => u.OrganizacaoId == organizacao.Id);
        if (unidade is null)
        {
            unidade = new UnidadeOrganizacional
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacao.Id,
                Tipo = "Apartamento",
                CodigoInterno = "101",
                Nome = "Apto 101",
                Status = "ativo"
            };
            _db.UnidadesOrganizacionais.Add(unidade);
        }

        var sindico = await EnsureUserAsync(sindicoEmail, sindicoSenha, "Sindico");
        var porteiro = await EnsureUserAsync(porteiroEmail, porteiroSenha, "Porteiro");
        var morador = await EnsureUserAsync(moradorEmail, moradorSenha, "Morador");

        await _db.SaveChangesAsync();

        await EnsureMembershipAsync(admin.Id, null, null, UserRole.PLATFORM_ADMIN);
        await EnsureMembershipAsync(sindico.Id, organizacao.Id, null, UserRole.CONDO_ADMIN);
        await EnsureMembershipAsync(porteiro.Id, organizacao.Id, null, UserRole.CONDO_STAFF);
        await EnsureMembershipAsync(morador.Id, organizacao.Id, unidade.Id, UserRole.RESIDENT);

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Seed concluido.",
            admin = new { email = adminEmail, senha = adminSenha },
            sindico = new { email = sindicoEmail, senha = sindicoSenha },
            porteiro = new { email = porteiroEmail, senha = porteiroSenha },
            morador = new { email = moradorEmail, senha = moradorSenha },
            organizacaoId = organizacao.Id
        });
    }

    private async Task<Usuario> EnsureUserAsync(string email, string senha, string nome)
    {
        var existing = await _db.Usuarios
            .FirstOrDefaultAsync(u => u.EmailLogin == email);
        if (existing is not null)
        {
            existing.SenhaHash = AuthController.HashPassword(senha);
            existing.Status = "ativo";
            return existing;
        }

        var pessoa = new Pessoa
        {
            Id = Guid.NewGuid(),
            Nome = nome,
            Tipo = "fisica",
            Email = email
        };

        var usuario = new Usuario
        {
            Id = Guid.NewGuid(),
            PessoaId = pessoa.Id,
            EmailLogin = email,
            SenhaHash = AuthController.HashPassword(senha),
            Status = "ativo"
        };

        _db.Pessoas.Add(pessoa);
        _db.Usuarios.Add(usuario);
        return usuario;
    }

    private async Task EnsureMembershipAsync(Guid usuarioId, Guid? organizacaoId, Guid? unidadeId, UserRole role)
    {
        var exists = await _db.UserCondoMemberships.AsNoTracking()
            .AnyAsync(m => m.UsuarioId == usuarioId &&
                           m.Role == role &&
                           m.OrganizacaoId == organizacaoId &&
                           m.UnidadeOrganizacionalId == unidadeId &&
                           m.IsActive);
        if (exists)
        {
            return;
        }

        _db.UserCondoMemberships.Add(new UserCondoMembership
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            OrganizacaoId = organizacaoId,
            UnidadeOrganizacionalId = unidadeId,
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
    }
}
