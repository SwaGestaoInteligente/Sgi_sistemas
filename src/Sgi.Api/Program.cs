using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Sgi.Api.Auth;
using Sgi.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<SgiDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    options.UseSqlite(connectionString);
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrWhiteSpace(origin))
                {
                    return false;
                }

                if (string.Equals(origin, "https://swagestaointeligente.github.io", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                {
                    return false;
                }

                var isLocalHost = string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase)
                                  || string.Equals(uri.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase)
                                  || string.Equals(uri.Host, "::1", StringComparison.OrdinalIgnoreCase);

                if (isLocalHost)
                {
                    return true;
                }

                if (System.Net.IPAddress.TryParse(uri.Host, out var ip))
                {
                    var bytes = ip.GetAddressBytes();
                    // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                    if (bytes.Length == 4)
                    {
                        if (bytes[0] == 10)
                        {
                            return true;
                        }

                        if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
                        {
                            return true;
                        }

                        if (bytes[0] == 192 && bytes[1] == 168)
                        {
                            return true;
                        }
                    }
                }

                return false;
            })
            .AllowAnyHeader()
            .AllowAnyMethod());
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    var jwtSection = builder.Configuration.GetSection("Jwt");
    var key = jwtSection.GetValue<string>("Key") ?? throw new InvalidOperationException("Jwt:Key is not configured");
    var issuer = jwtSection.GetValue<string>("Issuer");
    var audience = jwtSection.GetValue<string>("Audience");

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = issuer,
        ValidAudience = audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key))
    };
});

builder.Services.AddAuthorization();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddControllers();
builder.Services.AddScoped<FinanceiroAccessFilter>();

var app = builder.Build();

// garante criação do banco/tabelas em ambiente de desenvolvimento simples (SQLite)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SgiDbContext>();
    db.Database.EnsureCreated();
    db.Database.ExecuteSqlRaw("""
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
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS FinanceAudits (
            Id TEXT NOT NULL PRIMARY KEY,
            OrganizacaoId TEXT NOT NULL,
            UsuarioId TEXT NULL,
            Acao TEXT NOT NULL,
            Entidade TEXT NOT NULL,
            EntidadeId TEXT NOT NULL,
            Detalhes TEXT NULL,
            DataHora TEXT NOT NULL
        );
        """);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
