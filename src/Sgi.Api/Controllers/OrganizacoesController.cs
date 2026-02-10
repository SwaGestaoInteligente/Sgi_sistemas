using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Auth;
using Sgi.Domain.Core;
using Sgi.Domain.Financeiro;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrganizacoesController : ControllerBase
{
    private readonly SgiDbContext _db;

    public OrganizacoesController(SgiDbContext db)
    {
        _db = db;
    }

    private AuthorizationGuard Guard() => new(_db, User);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Organizacao>>> GetAll()
    {
        var userId = Authz.GetUserId(User);
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var memberships = await _db.UserCondoMemberships
            .AsNoTracking()
            .Where(m => m.UsuarioId == userId.Value && m.IsActive)
            .ToListAsync();

        if (memberships.Any(m => m.Role == UserRole.PLATFORM_ADMIN))
        {
            var items = await _db.Organizacoes.AsNoTracking().ToListAsync();
            return Ok(items);
        }

        var orgIds = memberships
            .Where(m => m.OrganizacaoId.HasValue)
            .Select(m => m.OrganizacaoId!.Value)
            .Distinct()
            .ToList();

        var lista = await _db.Organizacoes.AsNoTracking()
            .Where(o => orgIds.Contains(o.Id))
            .ToListAsync();
        return Ok(lista);
    }

    [HttpGet("minhas")]
    public async Task<ActionResult<IEnumerable<Organizacao>>> GetMinhas()
    {
        var userId = Authz.GetUserId(User);
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var memberships = await _db.UserCondoMemberships
            .AsNoTracking()
            .Where(m => m.UsuarioId == userId.Value && m.IsActive)
            .ToListAsync();

        if (memberships.Any(m => m.Role == UserRole.PLATFORM_ADMIN))
        {
            var items = await _db.Organizacoes.AsNoTracking().ToListAsync();
            return Ok(items);
        }

        var orgIds = memberships
            .Where(m => m.OrganizacaoId.HasValue)
            .Select(m => m.OrganizacaoId!.Value)
            .Distinct()
            .ToList();

        var lista = await _db.Organizacoes.AsNoTracking()
            .Where(o => orgIds.Contains(o.Id))
            .ToListAsync();
        return Ok(lista);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Organizacao>> GetById(Guid id)
    {
        var auth = await Guard().RequireOrgAccess(id);
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var item = await _db.Organizacoes.FindAsync(id);
        if (item == null)
        {
            return NotFound();
        }

        return Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<Organizacao>> Create(Organizacao model)
    {
        var auth = await Guard().RequirePlatformAdmin();
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        model.Id = Guid.NewGuid();
        _db.Organizacoes.Add(model);
        await _db.SaveChangesAsync();
        await SeedPlanoContasPadrao(model.Id);

        return CreatedAtAction(nameof(GetById), new { id = model.Id }, model);
    }

    private async Task SeedPlanoContasPadrao(Guid organizacaoId)
    {
        var existe = await _db.PlanosContas
            .AsNoTracking()
            .AnyAsync(p => p.OrganizacaoId == organizacaoId);

        if (existe)
        {
            return;
        }

        var planoReceita = new PlanoContas
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = organizacaoId,
            Codigo = "1",
            Nome = "Receitas",
            Tipo = "Receita",
            Nivel = 1
        };

        var planoDespesa = new PlanoContas
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = organizacaoId,
            Codigo = "2",
            Nome = "Despesas",
            Tipo = "Despesa",
            Nivel = 1
        };

        var planos = new List<PlanoContas>
        {
            planoReceita,
            planoDespesa,
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "1.01",
                Nome = "Taxa condominial",
                Tipo = "Receita",
                Nivel = 2,
                ParentId = planoReceita.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "1.02",
                Nome = "Multas e juros",
                Tipo = "Receita",
                Nivel = 2,
                ParentId = planoReceita.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "1.03",
                Nome = "Areas comuns",
                Tipo = "Receita",
                Nivel = 2,
                ParentId = planoReceita.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "2.01",
                Nome = "Folha e encargos",
                Tipo = "Despesa",
                Nivel = 2,
                ParentId = planoDespesa.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "2.02",
                Nome = "Manutencao predial",
                Tipo = "Despesa",
                Nivel = 2,
                ParentId = planoDespesa.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "2.03",
                Nome = "Limpeza",
                Tipo = "Despesa",
                Nivel = 2,
                ParentId = planoDespesa.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "2.04",
                Nome = "Seguranca",
                Tipo = "Despesa",
                Nivel = 2,
                ParentId = planoDespesa.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "2.05",
                Nome = "Energia e agua",
                Tipo = "Despesa",
                Nivel = 2,
                ParentId = planoDespesa.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "2.06",
                Nome = "Despesas de obras",
                Tipo = "Despesa",
                Nivel = 2,
                ParentId = planoDespesa.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "2.07",
                Nome = "Despesas extras",
                Tipo = "Despesa",
                Nivel = 2,
                ParentId = planoDespesa.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "2.08",
                Nome = "Depreciacao",
                Tipo = "Despesa",
                Nivel = 2,
                ParentId = planoDespesa.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "2.09",
                Nome = "Outras despesas",
                Tipo = "Despesa",
                Nivel = 2,
                ParentId = planoDespesa.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "2.10",
                Nome = "Impostos e taxas",
                Tipo = "Despesa",
                Nivel = 2,
                ParentId = planoDespesa.Id
            },
            new()
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacaoId,
                Codigo = "2.11",
                Nome = "Investimentos",
                Tipo = "Despesa",
                Nivel = 2,
                ParentId = planoDespesa.Id
            }
        };

        _db.PlanosContas.AddRange(planos);
        await _db.SaveChangesAsync();
    }

    public class AtualizarOrganizacaoRequest
    {
        public string Nome { get; set; } = string.Empty;
        public string? Tipo { get; set; }
        public string? ModulosAtivos { get; set; }
        public string? Status { get; set; }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Organizacao>> Update(Guid id, AtualizarOrganizacaoRequest request)
    {
        var auth = await Guard().RequirePlatformAdmin();
        if (auth.Error is not null)
        {
            return auth.Error;
        }

        var item = await _db.Organizacoes.FindAsync(id);
        if (item == null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Nome))
        {
            return BadRequest("Nome é obrigatório.");
        }

        item.Nome = request.Nome.Trim();
        item.Tipo = request.Tipo;
        if (!string.IsNullOrWhiteSpace(request.ModulosAtivos))
        {
            item.ModulosAtivos = request.ModulosAtivos;
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            item.Status = request.Status;
        }

        await _db.SaveChangesAsync();

        return Ok(item);
    }
}
