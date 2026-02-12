using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Auth;
using Sgi.Domain.Core;
using Sgi.Domain.Operacao;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/relatorios")]
[Authorize]
public class RelatoriosController : ControllerBase
{
    private readonly SgiDbContext _db;

    public RelatoriosController(SgiDbContext db)
    {
        _db = db;
    }

    private AuthorizationGuard Guard() => new(_db, User);

    [HttpGet("chamados")]
    public async Task<IActionResult> RelatorioChamados(
        [FromQuery] Guid organizacaoId,
        [FromQuery] DateTime? de,
        [FromQuery] DateTime? ate,
        [FromQuery] string? status,
        [FromQuery] string? formato)
    {
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

        var query = _db.Chamados.AsNoTracking().Where(c => c.OrganizacaoId == organizacaoId);
        if (de.HasValue)
        {
            query = query.Where(c => c.DataAbertura >= de.Value);
        }

        if (ate.HasValue)
        {
            query = query.Where(c => c.DataAbertura <= ate.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToUpperInvariant();
            query = query.Where(c => c.Status == normalized);
        }

        var itens = await query.OrderByDescending(c => c.DataAbertura).ToListAsync();

        if (string.Equals(formato, "csv", StringComparison.OrdinalIgnoreCase))
        {
            var csv = BuildCsv(
                new[] { "Id", "Titulo", "Categoria", "Status", "Prioridade", "DataAbertura", "DataFechamento" },
                itens.Select(c => new[]
                {
                    c.Id.ToString(),
                    c.Titulo,
                    c.Categoria,
                    c.Status,
                    c.Prioridade ?? string.Empty,
                    c.DataAbertura.ToString("yyyy-MM-dd"),
                    c.DataFechamento?.ToString("yyyy-MM-dd") ?? string.Empty
                }));
            return File(Encoding.UTF8.GetBytes(csv), "text/csv", "relatorio-chamados.csv");
        }

        if (string.Equals(formato, "pdf", StringComparison.OrdinalIgnoreCase))
        {
            var linhas = itens.Select(c =>
                $"{c.DataAbertura:dd/MM} | {c.Status} | {c.Titulo} ({c.Categoria})");
            var pdf = BuildPdf("Relatorio de chamados", linhas);
            return File(pdf, "application/pdf", "relatorio-chamados.pdf");
        }

        return Ok(itens);
    }

    [HttpGet("reservas")]
    public async Task<IActionResult> RelatorioReservas(
        [FromQuery] Guid organizacaoId,
        [FromQuery] DateTime? de,
        [FromQuery] DateTime? ate,
        [FromQuery] Guid? recursoId,
        [FromQuery] string? formato)
    {
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

        var query = _db.Reservas.AsNoTracking().Where(r => r.OrganizacaoId == organizacaoId);
        if (de.HasValue)
        {
            query = query.Where(r => r.DataInicio >= de.Value);
        }

        if (ate.HasValue)
        {
            query = query.Where(r => r.DataFim <= ate.Value);
        }

        if (recursoId.HasValue && recursoId.Value != Guid.Empty)
        {
            query = query.Where(r => r.RecursoReservavelId == recursoId.Value);
        }

        var itens = await query.OrderByDescending(r => r.DataInicio).ToListAsync();

        if (string.Equals(formato, "csv", StringComparison.OrdinalIgnoreCase))
        {
            var csv = BuildCsv(
                new[] { "Id", "RecursoId", "Status", "DataInicio", "DataFim", "Valor" },
                itens.Select(r => new[]
                {
                    r.Id.ToString(),
                    r.RecursoReservavelId.ToString(),
                    r.Status,
                    r.DataInicio.ToString("yyyy-MM-dd"),
                    r.DataFim.ToString("yyyy-MM-dd"),
                    (r.ValorTotal ?? 0).ToString("F2", CultureInfo.InvariantCulture)
                }));
            return File(Encoding.UTF8.GetBytes(csv), "text/csv", "relatorio-reservas.csv");
        }

        if (string.Equals(formato, "pdf", StringComparison.OrdinalIgnoreCase))
        {
            var linhas = itens.Select(r =>
                $"{r.DataInicio:dd/MM} {r.Status} | {r.RecursoReservavelId}");
            var pdf = BuildPdf("Relatorio de reservas", linhas);
            return File(pdf, "application/pdf", "relatorio-reservas.pdf");
        }

        return Ok(itens);
    }

    [HttpGet("veiculos")]
    public async Task<IActionResult> RelatorioVeiculos(
        [FromQuery] Guid organizacaoId,
        [FromQuery] string? formato)
    {
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

        var itens = await _db.Veiculos.AsNoTracking()
            .Where(v => v.OrganizacaoId == organizacaoId)
            .OrderBy(v => v.Placa)
            .ToListAsync();

        if (string.Equals(formato, "csv", StringComparison.OrdinalIgnoreCase))
        {
            var csv = BuildCsv(
                new[] { "Id", "Placa", "Marca", "Modelo", "Cor", "Status" },
                itens.Select(v => new[]
                {
                    v.Id.ToString(),
                    v.Placa,
                    v.Marca,
                    v.Modelo,
                    v.Cor,
                    v.Status
                }));
            return File(Encoding.UTF8.GetBytes(csv), "text/csv", "relatorio-veiculos.csv");
        }

        if (string.Equals(formato, "pdf", StringComparison.OrdinalIgnoreCase))
        {
            var linhas = itens.Select(v =>
                $"{v.Placa} | {v.Marca} {v.Modelo} | {v.Cor} | {v.Status}");
            var pdf = BuildPdf("Relatorio de veiculos", linhas);
            return File(pdf, "application/pdf", "relatorio-veiculos.pdf");
        }

        return Ok(itens);
    }

    [HttpGet("pets")]
    public async Task<IActionResult> RelatorioPets(
        [FromQuery] Guid organizacaoId,
        [FromQuery] string? formato)
    {
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

        var itens = await _db.Pets.AsNoTracking()
            .Where(p => p.OrganizacaoId == organizacaoId)
            .OrderBy(p => p.Nome)
            .ToListAsync();

        if (string.Equals(formato, "csv", StringComparison.OrdinalIgnoreCase))
        {
            var csv = BuildCsv(
                new[] { "Id", "Nome", "Especie", "Raca", "Porte", "Status" },
                itens.Select(p => new[]
                {
                    p.Id.ToString(),
                    p.Nome,
                    p.Especie,
                    p.Raca ?? string.Empty,
                    p.Porte,
                    p.Status
                }));
            return File(Encoding.UTF8.GetBytes(csv), "text/csv", "relatorio-pets.csv");
        }

        if (string.Equals(formato, "pdf", StringComparison.OrdinalIgnoreCase))
        {
            var linhas = itens.Select(p =>
                $"{p.Nome} | {p.Especie} | {p.Porte} | {p.Status}");
            var pdf = BuildPdf("Relatorio de pets", linhas);
            return File(pdf, "application/pdf", "relatorio-pets.pdf");
        }

        return Ok(itens);
    }

    private static string BuildCsv(IEnumerable<string> headers, IEnumerable<IEnumerable<string>> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(";", headers.Select(EscapeCsv)));
        foreach (var row in rows)
        {
            sb.AppendLine(string.Join(";", row.Select(EscapeCsv)));
        }

        return sb.ToString();
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains(';') || value.Contains('"') || value.Contains('\n'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }

    private static byte[] BuildPdf(string titulo, IEnumerable<string> linhas)
    {
        var contentLines = new List<string>
        {
            $"BT /F1 14 Tf 50 780 Td ({EscapePdf(titulo)}) Tj ET"
        };

        var y = 760;
        foreach (var linha in linhas.Take(45))
        {
            contentLines.Add($"BT /F1 10 Tf 50 {y} Td ({EscapePdf(linha)}) Tj ET");
            y -= 14;
        }

        var content = string.Join("\n", contentLines);
        var contentBytes = Encoding.ASCII.GetBytes(content);

        using var ms = new MemoryStream();
        var offsets = new List<long> { 0 };
        void Write(string text)
        {
            var bytes = Encoding.ASCII.GetBytes(text);
            ms.Write(bytes, 0, bytes.Length);
        }

        Write("%PDF-1.4\n");

        offsets.Add(ms.Position);
        Write("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
        offsets.Add(ms.Position);
        Write("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n");
        offsets.Add(ms.Position);
        Write("3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n");
        offsets.Add(ms.Position);
        Write($"4 0 obj << /Length {contentBytes.Length} >> stream\n");
        ms.Write(contentBytes, 0, contentBytes.Length);
        Write("\nendstream endobj\n");
        offsets.Add(ms.Position);
        Write("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n");

        var xrefStart = ms.Position;
        Write($"xref\n0 {offsets.Count}\n");
        Write("0000000000 65535 f \n");
        foreach (var offset in offsets.Skip(1))
        {
            Write($"{offset:0000000000} 00000 n \n");
        }

        Write($"trailer << /Size {offsets.Count} /Root 1 0 R >>\nstartxref\n{xrefStart}\n%%EOF");
        return ms.ToArray();
    }

    private static string EscapePdf(string value)
    {
        return value
            .Replace("\\", "\\\\")
            .Replace("(", "\\(")
            .Replace(")", "\\)");
    }
}
