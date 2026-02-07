using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Sgi.Api.Auth;
using Sgi.Api.Services;
using Sgi.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// =======================
// DATABASE
// =======================
builder.Services.AddDbContext<SgiDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    options.UseSqlite(connectionString);
});

// =======================
// CORS (DEV x PROD)
// =======================
builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultCors", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy
                .AllowAnyHeader()
                .AllowAnyMethod()
                .SetIsOriginAllowed(origin =>
                {
                    if (string.IsNullOrWhiteSpace(origin))
                        return false;

                    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                        return false;

                    if (string.Equals(origin, "http://localhost:5173", StringComparison.OrdinalIgnoreCase))
                        return true;

                    // localhost
                    if (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                        uri.Host.Equals("127.0.0.1") ||
                        uri.Host.Equals("::1"))
                        return true;

                    // IP local (teste em celular)
                    if (System.Net.IPAddress.TryParse(uri.Host, out var ip))
                    {
                        var bytes = ip.GetAddressBytes();
                        if (bytes.Length == 4)
                        {
                            if (bytes[0] == 10)
                                return true;

                            if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
                                return true;

                            if (bytes[0] == 192 && bytes[1] == 168)
                                return true;
                        }
                    }

                    return false;
                });
        }
        else
        {
            policy
                .WithOrigins(
                    "https://swagestaointeligente.github.io",
                    "http://localhost:5173")
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    });
});

// =======================
// AUTHENTICATION (JWT)
// =======================
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    var jwtSection = builder.Configuration.GetSection("Jwt");
    var key = jwtSection.GetValue<string>("Key")
              ?? throw new InvalidOperationException("Jwt:Key não configurado");

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSection.GetValue<string>("Issuer"),
        ValidAudience = jwtSection.GetValue<string>("Audience"),
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// =======================
// SERVICES
// =======================
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddScoped<FinanceiroAccessFilter>();
builder.Services.AddHostedService<NotificacoesJob>();

var app = builder.Build();

// =======================
// MIGRATIONS (DEV ONLY)
// =======================
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<SgiDbContext>();
    await db.Database.MigrateAsync();

    app.UseSwagger();
    app.UseSwaggerUI();
}

// =======================
// PIPELINE
// =======================
app.UseCors("DefaultCors");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
