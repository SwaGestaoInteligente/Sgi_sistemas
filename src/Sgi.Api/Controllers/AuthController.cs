using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

public class JwtSettings
{
    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int ExpiresInMinutes { get; set; } = 60;
}

public record LoginRequest(string Email, string Senha);

public record MembershipDto(
    Guid Id,
    Guid? CondoId,
    Guid? UnidadeOrganizacionalId,
    UserRole Role,
    bool IsActive);

public record LoginResponse(
    string AccessToken,
    DateTime ExpiresAt,
    Guid UserId,
    Guid PessoaId,
    bool IsPlatformAdmin,
    IEnumerable<MembershipDto> Memberships);

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly SgiDbContext _db;
    private readonly JwtSettings _jwtSettings;

    public AuthController(SgiDbContext db, IConfiguration configuration)
    {
        _db = db;
        _jwtSettings = configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var usuario = await _db.Usuarios
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.EmailLogin == request.Email && u.Status == "ativo");

        if (usuario is null)
        {
            return Unauthorized("Usuário ou senha inválidos");
        }

        if (!VerifyPassword(request.Senha, usuario.SenhaHash))
        {
            return Unauthorized("Usuário ou senha inválidos");
        }

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_jwtSettings.Key);

        var memberships = await _db.UserCondoMemberships
            .Where(m => m.UsuarioId == usuario.Id && m.IsActive)
            .ToListAsync();

        if (!memberships.Any() &&
            string.Equals(usuario.EmailLogin, "admin@teste.com", StringComparison.OrdinalIgnoreCase))
        {
            var adminMembership = new UserCondoMembership
            {
                Id = Guid.NewGuid(),
                UsuarioId = usuario.Id,
                OrganizacaoId = null,
                UnidadeOrganizacionalId = null,
                Role = UserRole.PLATFORM_ADMIN,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _db.UserCondoMemberships.Add(adminMembership);
            await _db.SaveChangesAsync();
            memberships.Add(adminMembership);
        }

        var isPlatformAdmin = memberships.Any(m => m.Role == UserRole.PLATFORM_ADMIN);

        var membershipDtos = memberships
            .Select(m => new MembershipDto(
                m.Id,
                m.OrganizacaoId,
                m.UnidadeOrganizacionalId,
                m.Role,
                m.IsActive))
            .ToList();

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, usuario.EmailLogin),
            new("uid", usuario.Id.ToString()),
            new("pid", usuario.PessoaId.ToString()),
            new("isPlatformAdmin", isPlatformAdmin ? "true" : "false"),
            new("memberships", System.Text.Json.JsonSerializer.Serialize(membershipDtos))
        };

        var expires = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpiresInMinutes);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expires,
            Issuer = _jwtSettings.Issuer,
            Audience = _jwtSettings.Audience,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        return Ok(new LoginResponse(tokenString, expires, usuario.Id, usuario.PessoaId, isPlatformAdmin, membershipDtos));
    }

    // Utilização simples de hash com SHA256 apenas para ambiente de desenvolvimento.
    public static string HashPassword(string password)
    {
        var bytes = Encoding.UTF8.GetBytes(password);
        var hashBytes = SHA256.HashData(bytes);
        return Convert.ToBase64String(hashBytes);
    }

    public static bool VerifyPassword(string password, string storedHash)
    {
        var hashOfInput = HashPassword(password);
        return hashOfInput == storedHash;
    }
}
