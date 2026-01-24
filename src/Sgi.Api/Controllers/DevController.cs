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
        const string email = "admin@teste.com";
        const string senha = "123456";

        await _db.Database.EnsureCreatedAsync();

        var existing = await _db.Usuarios.AsNoTracking()
            .FirstOrDefaultAsync(u => u.EmailLogin == email);

        if (existing is not null)
        {
            return Ok(new { message = "Usuário admin já existe.", email });
        }

        var pessoa = new Pessoa
        {
            Id = Guid.NewGuid(),
            Nome = "Usuário Admin",
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

        await _db.SaveChangesAsync();

        return Ok(new { message = "Usuário admin criado.", email, senha });
    }
}
