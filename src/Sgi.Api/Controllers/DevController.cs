using System.Data;
using System.Data.Common;
using System.IO;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sgi.Api.Controllers;
using Sgi.Domain.Core;
using Sgi.Domain.Financeiro;
using Sgi.Domain.Operacao;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Dev;

[ApiController]
[Route("api/dev")]
public class DevController : ControllerBase
{
    private readonly SgiDbContext _db;
    private readonly IWebHostEnvironment _env;

    private const string DemoSource = "DEMO";
    private const string DemoOrgName = "Condominio Mar Azul (DEMO)";
    private const string DemoOrgKey = "DEMO";

    public DevController(SgiDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    private IActionResult? GuardDev()
    {
        return _env.IsDevelopment() ? null : NotFound();
    }

    [HttpPost("seed-admin")]
    [HttpGet("seed-admin")]
    [AllowAnonymous]
    public async Task<IActionResult> SeedAdmin()
    {
        var guard = GuardDev();
        if (guard is not null)
        {
            return guard;
        }

        const string adminEmail = "admin@teste.com";
        const string adminSenha = "Admin@123";
        const string sindicoEmail = "sindico@teste.com";
        const string sindicoSenha = "Sindico@123";
        const string auxAdminEmail = "auxadmin@teste.com";
        const string auxAdminSenha = "AuxAdmin@123";
        const string porteiroEmail = "porteiro@teste.com";
        const string porteiroSenha = "Porteiro@123";
        const string moradorEmail = "morador@teste.com";
        const string moradorSenha = "Morador@123";

        var admin = await EnsureUserAsync(adminEmail, adminSenha, "Usuario Admin");
        var sindico = await EnsureUserAsync(sindicoEmail, sindicoSenha, "Sindico");
        var auxAdmin = await EnsureUserAsync(auxAdminEmail, auxAdminSenha, "Aux Admin");
        var porteiro = await EnsureUserAsync(porteiroEmail, porteiroSenha, "Porteiro");
        var morador = await EnsureUserAsync(moradorEmail, moradorSenha, "Morador");

        var organizacao = await _db.Organizacoes
            .FirstOrDefaultAsync(o => o.Documento == DemoOrgKey || o.Nome == DemoOrgName);
        if (organizacao is null)
        {
            organizacao = new Organizacao
            {
                Id = Guid.NewGuid(),
                Nome = DemoOrgName,
                Tipo = "Condominios",
                Documento = DemoOrgKey,
                ModulosAtivos = "core,financeiro,manutencao,reservas",
                Status = "ativo"
            };
            _db.Organizacoes.Add(organizacao);
            MarkDemo(organizacao);
        }
        else
        {
            MarkDemoIfEmpty(organizacao);
        }

        var bloco = await _db.UnidadesOrganizacionais
            .FirstOrDefaultAsync(u =>
                u.OrganizacaoId == organizacao.Id &&
                u.Tipo == "Bloco");
        if (bloco is null)
        {
            bloco = new UnidadeOrganizacional
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacao.Id,
                Tipo = "Bloco",
                CodigoInterno = "A",
                Nome = "Bloco A",
                Status = "ativo"
            };
            _db.UnidadesOrganizacionais.Add(bloco);
            MarkDemo(bloco);
        }

        var unidade = await _db.UnidadesOrganizacionais
            .FirstOrDefaultAsync(u =>
                u.OrganizacaoId == organizacao.Id &&
                u.Tipo == "Apartamento");
        if (unidade is null)
        {
            unidade = new UnidadeOrganizacional
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = organizacao.Id,
                Tipo = "Apartamento",
                CodigoInterno = "101",
                Nome = "Apto 101",
                ParentId = bloco.Id,
                Status = "ativo"
            };
            _db.UnidadesOrganizacionais.Add(unidade);
            MarkDemo(unidade);
        }

        await _db.SaveChangesAsync();

        await EnsureMembershipAsync(admin.Id, null, null, UserRole.PLATFORM_ADMIN);
        await EnsureMembershipAsync(sindico.Id, organizacao.Id, null, UserRole.CONDO_ADMIN);
        await EnsureMembershipAsync(auxAdmin.Id, organizacao.Id, null, UserRole.CONDO_STAFF);
        await EnsureMembershipAsync(porteiro.Id, organizacao.Id, null, UserRole.CONDO_STAFF);
        await EnsureMembershipAsync(morador.Id, organizacao.Id, unidade.Id, UserRole.RESIDENT);

        await EnsureVinculoAsync(admin.PessoaId, organizacao.Id, null, "administrador");
        await EnsureVinculoAsync(sindico.PessoaId, organizacao.Id, null, "sindico");
        await EnsureVinculoAsync(auxAdmin.PessoaId, organizacao.Id, null, "aux_admin");
        await EnsureVinculoAsync(porteiro.PessoaId, organizacao.Id, null, "porteiro");
        await EnsureVinculoAsync(morador.PessoaId, organizacao.Id, unidade.Id, "morador");

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Seed concluido.",
            admin = new { email = adminEmail, senha = adminSenha },
            sindico = new { email = sindicoEmail, senha = sindicoSenha },
            auxAdmin = new { email = auxAdminEmail, senha = auxAdminSenha },
            porteiro = new { email = porteiroEmail, senha = porteiroSenha },
            morador = new { email = moradorEmail, senha = moradorSenha },
            organizacaoId = organizacao.Id
        });
    }

    [HttpPost("seed-demo-full")]
    [AllowAnonymous]
    public async Task<IActionResult> SeedDemoFull()
    {
        var guard = GuardDev();
        if (guard is not null)
        {
            return guard;
        }

        const string adminEmail = "admin@teste.com";
        const string adminSenha = "Admin@123";
        const string sindicoEmail = "sindico@teste.com";
        const string sindicoSenha = "Sindico@123";
        const string porteiroEmail = "porteiro@teste.com";
        const string porteiroSenha = "Porteiro@123";
        const string moradorEmail = "morador@teste.com";
        const string moradorSenha = "Morador@123";

        var demoOrgIds = await _db.Organizacoes.AsNoTracking()
            .Where(o =>
                EF.Property<string>(o, "Source") == DemoSource ||
                o.Documento == DemoOrgKey ||
                o.Nome == DemoOrgName)
            .Select(o => o.Id)
            .ToListAsync();

        await WipeDemoDataAsync(demoOrgIds);

        foreach (var orgId in demoOrgIds)
        {
            var uploadsRoot = Path.Combine(_env.ContentRootPath, "Uploads", orgId.ToString());
            if (Directory.Exists(uploadsRoot))
            {
                Directory.Delete(uploadsRoot, true);
            }

            var uploadsFinanceiro = Path.Combine(_env.ContentRootPath, "Uploads", "Financeiro", orgId.ToString());
            if (Directory.Exists(uploadsFinanceiro))
            {
                Directory.Delete(uploadsFinanceiro, true);
            }
        }

        var (admin, adminPessoa, adminCriado) =
            await GetOrCreateUserAsync(adminEmail, adminSenha, "Administrador");
        var (sindico, sindicoPessoa, sindicoCriado) =
            await GetOrCreateUserAsync(sindicoEmail, sindicoSenha, "Carlos Almeida");
        var (porteiro, porteiroPessoa, porteiroCriado) =
            await GetOrCreateUserAsync(porteiroEmail, porteiroSenha, "Joao Porteiro");
        var (morador, moradorPessoa, moradorCriado) =
            await GetOrCreateUserAsync(moradorEmail, moradorSenha, "Patricia Gomes");

        if (sindicoPessoa is not null)
        {
            if (sindicoCriado || string.IsNullOrWhiteSpace(sindicoPessoa.Nome))
            {
                sindicoPessoa.Nome = "Carlos Almeida";
            }

            if (sindicoCriado || string.IsNullOrWhiteSpace(sindicoPessoa.Email))
            {
                sindicoPessoa.Email = sindicoEmail;
            }

            if (sindicoCriado || string.IsNullOrWhiteSpace(sindicoPessoa.Telefone))
            {
                sindicoPessoa.Telefone = "(11) 98888-0001";
            }
        }

        if (porteiroPessoa is not null)
        {
            if (porteiroCriado || string.IsNullOrWhiteSpace(porteiroPessoa.Nome))
            {
                porteiroPessoa.Nome = "Joao Porteiro";
            }

            if (porteiroCriado || string.IsNullOrWhiteSpace(porteiroPessoa.Email))
            {
                porteiroPessoa.Email = porteiroEmail;
            }

            if (porteiroCriado || string.IsNullOrWhiteSpace(porteiroPessoa.Telefone))
            {
                porteiroPessoa.Telefone = "(11) 98888-0002";
            }
        }

        if (moradorPessoa is not null)
        {
            if (moradorCriado || string.IsNullOrWhiteSpace(moradorPessoa.Nome))
            {
                moradorPessoa.Nome = "Patricia Gomes";
            }

            if (moradorCriado || string.IsNullOrWhiteSpace(moradorPessoa.Email))
            {
                moradorPessoa.Email = moradorEmail;
            }

            if (moradorCriado || string.IsNullOrWhiteSpace(moradorPessoa.Telefone))
            {
                moradorPessoa.Telefone = "(11) 98888-0003";
            }
        }

        await _db.SaveChangesAsync();

        var demoOrg = await _db.Organizacoes
            .FirstOrDefaultAsync(o => o.Documento == DemoOrgKey || o.Nome == DemoOrgName);
        if (demoOrg is null)
        {
            demoOrg = new Organizacao
            {
                Id = Guid.NewGuid(),
                Nome = DemoOrgName,
                Tipo = "Condominios",
                Documento = DemoOrgKey,
                Email = "contato@marazul.demo",
                Telefone = "(11) 4000-0000",
                Site = "https://demo.swa.com.br",
                Observacoes = "Chave DEMO",
                ModulosAtivos = "core,financeiro,manutencao,reservas",
                Status = "ativo"
            };
            _db.Organizacoes.Add(demoOrg);
            MarkDemo(demoOrg);
        }
        else
        {
            MarkDemoIfEmpty(demoOrg);
        }

        var blocos = new List<UnidadeOrganizacional>();
        foreach (var blocoNome in new[] { "A", "B", "C" })
        {
            var bloco = new UnidadeOrganizacional
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                Tipo = "Bloco",
                CodigoInterno = blocoNome,
                Nome = $"Bloco {blocoNome}",
                Status = "ativo"
            };
            _db.UnidadesOrganizacionais.Add(bloco);
            MarkDemo(bloco);
            blocos.Add(bloco);
        }

        var unidades = new List<UnidadeOrganizacional>();
        var unidadesAlugadas = new HashSet<string> { "A103", "A105", "B102", "B105", "C101", "C104" };
        foreach (var bloco in blocos)
        {
            for (var i = 101; i <= 106; i++)
            {
                var codigo = $"{bloco.CodigoInterno}{i}";
                var ocupacao = unidadesAlugadas.Contains(codigo) ? "alugada" : "proprietario_morador";
                var unidade = new UnidadeOrganizacional
                {
                    Id = Guid.NewGuid(),
                    OrganizacaoId = demoOrg.Id,
                    Tipo = "Apartamento",
                    CodigoInterno = codigo,
                    Nome = $"Apto {codigo}",
                    ParentId = bloco.Id,
                    AtributosExtrasJson = JsonSerializer.Serialize(new
                    {
                        ocupacao
                    }),
                    Status = "ativo"
                };
                _db.UnidadesOrganizacionais.Add(unidade);
                MarkDemo(unidade);
                unidades.Add(unidade);
            }
        }

        var dependencias = new List<UnidadeOrganizacional>();
        foreach (var area in new[] { "Salao de Festas", "Churrasqueira", "Quadra", "Piscina" })
        {
            var dep = new UnidadeOrganizacional
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                Tipo = "Dependencia",
                CodigoInterno = area[..1].ToUpperInvariant(),
                Nome = area,
                Status = "ativo"
            };
            _db.UnidadesOrganizacionais.Add(dep);
            MarkDemo(dep);
            dependencias.Add(dep);
        }

        var recursos = new List<RecursoReservavel>();
        foreach (var dep in dependencias)
        {
            var recurso = new RecursoReservavel
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                UnidadeOrganizacionalId = dep.Id,
                Nome = dep.Nome,
                Tipo = "area_comum",
                Capacidade = dep.Nome.Contains("Piscina") ? 30 : 60,
                RegrasJson = JsonSerializer.Serialize(new
                {
                    antecedenciaDias = 7,
                    duracaoHoras = 4
                }),
                LimitePorUnidadePorMes = dep.Nome.Contains("Salao") ? 2 : 3,
                ExigeAprovacao = dep.Nome.Contains("Salao") || dep.Nome.Contains("Churrasqueira"),
                JanelaHorarioInicio = "08:00",
                JanelaHorarioFim = "22:00",
                BloqueiosJson = JsonSerializer.Serialize(new[]
                {
                    DateTime.UtcNow.AddDays(10).ToString("yyyy-MM-dd"),
                    DateTime.UtcNow.AddDays(25).ToString("yyyy-MM-dd")
                }),
                Ativo = true
            };
            _db.RecursosReservaveis.Add(recurso);
            MarkDemo(recurso);
            recursos.Add(recurso);
        }

        var pessoasDemo = new List<Pessoa>();
        var vinculosDemo = new List<VinculoPessoaOrganizacao>();
        var enderecosDemo = new List<Endereco>();

        void AdicionarPessoa(Pessoa pessoa, string papel, UnidadeOrganizacional? unidade = null)
        {
            _db.Pessoas.Add(pessoa);
            MarkDemo(pessoa);
            pessoasDemo.Add(pessoa);

            var vinculo = new VinculoPessoaOrganizacao
            {
                Id = Guid.NewGuid(),
                PessoaId = pessoa.Id,
                OrganizacaoId = demoOrg.Id,
                UnidadeOrganizacionalId = unidade?.Id,
                Papel = papel,
                DataInicio = DateTime.UtcNow.AddMonths(-6),
                DataFim = null
            };
            _db.VinculosPessoaOrganizacao.Add(vinculo);
            MarkDemo(vinculo);
            vinculosDemo.Add(vinculo);
        }

        if (adminPessoa is not null)
        {
            var vinculoAdmin = new VinculoPessoaOrganizacao
            {
                Id = Guid.NewGuid(),
                PessoaId = adminPessoa.Id,
                OrganizacaoId = demoOrg.Id,
                UnidadeOrganizacionalId = null,
                Papel = "administrador",
                DataInicio = DateTime.UtcNow.AddMonths(-12)
            };
            _db.VinculosPessoaOrganizacao.Add(vinculoAdmin);
            MarkDemo(vinculoAdmin);
        }

        if (sindicoPessoa is not null)
        {
            var vinculoSindico = new VinculoPessoaOrganizacao
            {
                Id = Guid.NewGuid(),
                PessoaId = sindicoPessoa.Id,
                OrganizacaoId = demoOrg.Id,
                UnidadeOrganizacionalId = null,
                Papel = "sindico",
                DataInicio = DateTime.UtcNow.AddYears(-1)
            };
            _db.VinculosPessoaOrganizacao.Add(vinculoSindico);
            MarkDemo(vinculoSindico);
        }

        if (porteiroPessoa is not null)
        {
            var vinculoPorteiro = new VinculoPessoaOrganizacao
            {
                Id = Guid.NewGuid(),
                PessoaId = porteiroPessoa.Id,
                OrganizacaoId = demoOrg.Id,
                UnidadeOrganizacionalId = null,
                Papel = "colaborador",
                DataInicio = DateTime.UtcNow.AddMonths(-8)
            };
            _db.VinculosPessoaOrganizacao.Add(vinculoPorteiro);
            MarkDemo(vinculoPorteiro);
        }

        var administradores = new[]
        {
            new Pessoa { Id = Guid.NewGuid(), Nome = "Fernanda Lima", Tipo = "fisica", Email = "fernanda.lima@demo.com", Telefone = "(11) 90000-1111" },
            new Pessoa { Id = Guid.NewGuid(), Nome = "Rafael Souza", Tipo = "fisica", Email = "rafael.souza@demo.com", Telefone = "(11) 90000-2222" }
        };
        foreach (var pessoa in administradores)
        {
            AdicionarPessoa(pessoa, "administrador");
        }

        var funcionarios = new[]
        {
            new Pessoa { Id = Guid.NewGuid(), Nome = "Maria Limpeza", Tipo = "fisica", Email = "maria.limpeza@demo.com", Telefone = "(11) 90000-3333" },
            new Pessoa { Id = Guid.NewGuid(), Nome = "Paulo Manutencao", Tipo = "fisica", Email = "paulo.manutencao@demo.com", Telefone = "(11) 90000-4444" }
        };
        foreach (var pessoa in funcionarios)
        {
            AdicionarPessoa(pessoa, "colaborador");
        }

        var moradoresNomes = new[]
        {
            "Patricia Gomes", "Lucas Araujo", "Camila Costa", "Bruno Santos", "Marina Rocha",
            "Diego Ramos", "Juliana Alves", "Thiago Pereira", "Leticia Nunes", "Vitor Hugo",
            "Renata Martins", "Andre Silva", "Carla Menezes", "Roberto Dias", "Helena Prado",
            "Fabio Melo", "Sandra Reis", "Paulo Henrique"
        };

        var moradores = new List<Pessoa>();
        for (var i = 0; i < moradoresNomes.Length; i++)
        {
            var pessoa = new Pessoa
            {
                Id = Guid.NewGuid(),
                Nome = moradoresNomes[i],
                Tipo = "fisica",
                Email = $"morador{i + 1:00}@demo.com",
                Telefone = $"(11) 9{(8000 + i):000}-55{(20 + i):00}",
                Documento = $"000.000.000-{i:00}"
            };
            moradores.Add(pessoa);
        }

        var unidadesOrdenadas = unidades.OrderBy(u => u.CodigoInterno).ToList();
        for (var i = 0; i < unidadesOrdenadas.Count; i++)
        {
            var pessoa = moradores[i % moradores.Count];
            if (!_db.Pessoas.Local.Any(p => p.Id == pessoa.Id))
            {
                AdicionarPessoa(pessoa, "morador", unidadesOrdenadas[i]);
            }
            else
            {
                var vinculo = new VinculoPessoaOrganizacao
                {
                    Id = Guid.NewGuid(),
                    PessoaId = pessoa.Id,
                    OrganizacaoId = demoOrg.Id,
                    UnidadeOrganizacionalId = unidadesOrdenadas[i].Id,
                    Papel = "morador",
                    DataInicio = DateTime.UtcNow.AddMonths(-4)
                };
                _db.VinculosPessoaOrganizacao.Add(vinculo);
                MarkDemo(vinculo);
            }
        }

        if (moradorPessoa is not null)
        {
            var unidadeMorador = unidadesOrdenadas.First();
            var vinculoMoradorUser = new VinculoPessoaOrganizacao
            {
                Id = Guid.NewGuid(),
                PessoaId = moradorPessoa.Id,
                OrganizacaoId = demoOrg.Id,
                UnidadeOrganizacionalId = unidadeMorador.Id,
                Papel = "morador",
                DataInicio = DateTime.UtcNow.AddMonths(-10)
            };
            _db.VinculosPessoaOrganizacao.Add(vinculoMoradorUser);
            MarkDemo(vinculoMoradorUser);
        }

        var veiculos = new List<Veiculo>();
        var placas = new[] { "ABC1D23", "DFG2H34", "JKL3M45", "NOP4Q56", "RST5U67", "VWX6Y78" };
        for (var i = 0; i < placas.Length; i++)
        {
            var unidade = unidadesOrdenadas[i % unidadesOrdenadas.Count];
            var pessoaId = vinculosDemo.FirstOrDefault(v =>
                v.UnidadeOrganizacionalId == unidade.Id && v.Papel == "morador")?.PessoaId
                ?? moradorPessoa?.Id
                ?? moradores.First().Id;
            var veiculo = new Veiculo
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                UnidadeOrganizacionalId = unidade.Id,
                PessoaId = pessoaId,
                Placa = placas[i],
                Marca = i % 2 == 0 ? "Toyota" : "Honda",
                Modelo = i % 2 == 0 ? "Corolla" : "Civic",
                Cor = i % 3 == 0 ? "Prata" : "Preto",
                Status = "ativo"
            };
            _db.Veiculos.Add(veiculo);
            MarkDemo(veiculo);
            veiculos.Add(veiculo);
        }

        var pets = new List<Pet>();
        var nomesPets = new[] { "Thor", "Luna", "Max", "Nina", "Bob", "Mel" };
        for (var i = 0; i < nomesPets.Length; i++)
        {
            var unidade = unidadesOrdenadas[(i + 2) % unidadesOrdenadas.Count];
            var pessoaId = vinculosDemo.FirstOrDefault(v =>
                v.UnidadeOrganizacionalId == unidade.Id && v.Papel == "morador")?.PessoaId
                ?? moradorPessoa?.Id
                ?? moradores.First().Id;
            var pet = new Pet
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                UnidadeOrganizacionalId = unidade.Id,
                PessoaId = pessoaId,
                Nome = nomesPets[i],
                Especie = i % 2 == 0 ? "Cachorro" : "Gato",
                Raca = i % 2 == 0 ? "SRD" : "Persa",
                Porte = i % 2 == 0 ? "Medio" : "Pequeno",
                Status = "ativo"
            };
            _db.Pets.Add(pet);
            MarkDemo(pet);
            pets.Add(pet);
        }

        var fornecedores = new[]
        {
            "LimpaMais Servicos", "Agua Pura", "Energia Facil", "Jardins & Cia",
            "Seguranca Total", "Elevadores Alfa", "Pintura Boa", "Dedetiza Control"
        };
        var fornecedoresPessoas = new List<Pessoa>();
        for (var i = 0; i < fornecedores.Length; i++)
        {
            var pessoa = new Pessoa
            {
                Id = Guid.NewGuid(),
                Nome = fornecedores[i],
                Tipo = "juridica",
                Email = $"contato{ i + 1}@fornecedor.demo",
                Telefone = $"(11) 3000-7{ i + 10}00",
                Documento = $"12.345.6{i}0/0001-9{i}"
            };
            fornecedoresPessoas.Add(pessoa);
            AdicionarPessoa(pessoa, "fornecedor");
        }

        var prestadores = new[]
        {
            "Carlos Eletrico", "Bruno Hidraulico", "Debora Piscinas", "Rita Portoes", "Marcos Telhados"
        };
        foreach (var nome in prestadores)
        {
            var pessoa = new Pessoa
            {
                Id = Guid.NewGuid(),
                Nome = nome,
                Tipo = "fisica",
                Email = $"{nome.Split(' ')[0].ToLowerInvariant()}@prestador.demo",
                Telefone = "(11) 95555-0000",
                Documento = "123.456.789-00"
            };
            AdicionarPessoa(pessoa, "prestador");
        }

        foreach (var pessoa in pessoasDemo.Take(6))
        {
            var endereco = new Endereco
            {
                Id = Guid.NewGuid(),
                PessoaId = pessoa.Id,
                OrganizacaoId = demoOrg.Id,
                Logradouro = "Av. Atlantica",
                Numero = "100",
                Bairro = "Praia Azul",
                Cidade = "Santos",
                Estado = "SP",
                Cep = "11000-000",
                Pais = "Brasil",
                Tipo = "principal"
            };
            _db.Enderecos.Add(endereco);
            MarkDemo(endereco);
            enderecosDemo.Add(endereco);
        }

        await EnsureMembershipDemoAsync(admin.Id, null, null, UserRole.PLATFORM_ADMIN);
        await EnsureMembershipDemoAsync(sindico.Id, demoOrg.Id, null, UserRole.CONDO_ADMIN);
        await EnsureMembershipDemoAsync(porteiro.Id, demoOrg.Id, null, UserRole.CONDO_STAFF);
        await EnsureMembershipDemoAsync(morador.Id, demoOrg.Id, unidadesOrdenadas.First().Id, UserRole.RESIDENT);

        var centros = new[]
        {
            new CentroCusto { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Codigo = "ADM", Nome = "Administrativo" },
            new CentroCusto { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Codigo = "MAN", Nome = "Manutencao" },
            new CentroCusto { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Codigo = "LAZ", Nome = "Lazer" }
        };
        foreach (var centro in centros)
        {
            _db.CentrosCusto.Add(centro);
            MarkDemo(centro);
        }

        var planoReceita = new PlanoContas
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = demoOrg.Id,
            Codigo = "1",
            Nome = "Receitas",
            Tipo = "Receita",
            Nivel = 1
        };
        var planoDespesa = new PlanoContas
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = demoOrg.Id,
            Codigo = "2",
            Nome = "Despesas",
            Tipo = "Despesa",
            Nivel = 1
        };
        _db.PlanosContas.AddRange(planoReceita, planoDespesa);
        MarkDemo(planoReceita);
        MarkDemo(planoDespesa);

        var planosReceita = new[]
        {
            new PlanoContas { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Codigo = "1.01", Nome = "Taxa condominial", Tipo = "Receita", Nivel = 2, ParentId = planoReceita.Id },
            new PlanoContas { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Codigo = "1.02", Nome = "Multas e juros", Tipo = "Receita", Nivel = 2, ParentId = planoReceita.Id },
            new PlanoContas { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Codigo = "1.03", Nome = "Areas comuns", Tipo = "Receita", Nivel = 2, ParentId = planoReceita.Id }
        };
        var planosDespesa = new[]
        {
            new PlanoContas { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Codigo = "2.01", Nome = "Folha e encargos", Tipo = "Despesa", Nivel = 2, ParentId = planoDespesa.Id },
            new PlanoContas { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Codigo = "2.02", Nome = "Manutencao predial", Tipo = "Despesa", Nivel = 2, ParentId = planoDespesa.Id },
            new PlanoContas { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Codigo = "2.03", Nome = "Limpeza", Tipo = "Despesa", Nivel = 2, ParentId = planoDespesa.Id },
            new PlanoContas { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Codigo = "2.04", Nome = "Seguranca", Tipo = "Despesa", Nivel = 2, ParentId = planoDespesa.Id },
            new PlanoContas { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Codigo = "2.05", Nome = "Energia e agua", Tipo = "Despesa", Nivel = 2, ParentId = planoDespesa.Id }
        };

        foreach (var plano in planosReceita.Concat(planosDespesa))
        {
            _db.PlanosContas.Add(plano);
            MarkDemo(plano);
        }

        var contas = new[]
        {
            new ContaFinanceira { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Nome = "Conta Principal", Tipo = "Corrente", Banco = "Banco do Brasil", Agencia = "1234", NumeroConta = "12345-6", SaldoInicial = 85000, Moeda = "BRL", Status = "ativo" },
            new ContaFinanceira { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Nome = "Conta Reserva", Tipo = "Poupanca", Banco = "Caixa", Agencia = "4321", NumeroConta = "98765-0", SaldoInicial = 42000, Moeda = "BRL", Status = "ativo" },
            new ContaFinanceira { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Nome = "Conta Obras", Tipo = "Corrente", Banco = "Itau", Agencia = "1111", NumeroConta = "55555-5", SaldoInicial = 120000, Moeda = "BRL", Status = "ativo" },
            new ContaFinanceira { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Nome = "Conta Caixa", Tipo = "Caixa", Banco = "Santander", Agencia = "2222", NumeroConta = "44444-4", SaldoInicial = 15000, Moeda = "BRL", Status = "ativo" },
            new ContaFinanceira { Id = Guid.NewGuid(), OrganizacaoId = demoOrg.Id, Nome = "Conta Eventos", Tipo = "Corrente", Banco = "Bradesco", Agencia = "3333", NumeroConta = "33333-3", SaldoInicial = 8000, Moeda = "BRL", Status = "ativo" }
        };
        foreach (var conta in contas)
        {
            _db.ContasFinanceiras.Add(conta);
            MarkDemo(conta);
        }

        var itens = new[]
        {
            new ChargeItem
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                Nome = "Reserva Salao de Festas",
                Tipo = "AreaComum",
                FinanceCategoryId = planosReceita[2].Id,
                ValorPadrao = 350,
                PermiteAlterarValor = true,
                ExigeReserva = true,
                GeraCobrancaAutomatica = true,
                DescricaoOpcional = "Inclui limpeza basica"
            },
            new ChargeItem
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                Nome = "Uso Churrasqueira",
                Tipo = "AreaComum",
                FinanceCategoryId = planosReceita[2].Id,
                ValorPadrao = 180,
                PermiteAlterarValor = false,
                ExigeReserva = true,
                GeraCobrancaAutomatica = true
            },
            new ChargeItem
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                Nome = "Multa atraso",
                Tipo = "Multa",
                FinanceCategoryId = planosReceita[1].Id,
                ValorPadrao = 75,
                PermiteAlterarValor = true,
                ExigeReserva = false,
                GeraCobrancaAutomatica = true
            }
        };
        foreach (var item in itens)
        {
            _db.ItensCobrados.Add(item);
            MarkDemo(item);
        }

        foreach (var unidade in unidades)
        {
            var cota = new CotaCondominial
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                UnidadeOrganizacionalId = unidade.Id,
                PlanoContasId = planosReceita[0].Id,
                Valor = 520,
                CompetenciaInicio = DateTime.UtcNow.AddMonths(-11).ToString("yyyy-MM"),
                CompetenciaFim = null,
                Ativo = true
            };
            _db.CotasCondominio.Add(cota);
            MarkDemo(cota);
        }

        var random = new Random(42);
        var lancamentos = new List<LancamentoFinanceiro>();
        var documentos = new List<DocumentoCobranca>();
        var inicioMes = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1).AddMonths(-11);

        for (var mes = 0; mes < 12; mes++)
        {
            var competencia = inicioMes.AddMonths(mes);
            for (var i = 0; i < 5; i++)
            {
                var categoriaDespesa = planosDespesa[random.Next(planosDespesa.Length)];
                var fornecedor = fornecedoresPessoas[random.Next(fornecedoresPessoas.Count)];
                var conta = contas[random.Next(contas.Length)];
                var valor = 1200 + random.Next(0, 4500);
                var vencimento = competencia.AddDays(5 + i * 3);
                var situacao = i % 2 == 0 ? "pago" : "aprovado";
                var lanc = new LancamentoFinanceiro
                {
                    Id = Guid.NewGuid(),
                    OrganizacaoId = demoOrg.Id,
                    Tipo = "pagar",
                    Situacao = situacao,
                    PlanoContasId = categoriaDespesa.Id,
                    CentroCustoId = centros[random.Next(centros.Length)].Id,
                    ContaFinanceiraId = conta.Id,
                    PessoaId = fornecedor.Id,
                    Descricao = $"Despesa {categoriaDespesa.Nome} - {fornecedor.Nome}",
                    Valor = valor,
                    DataCompetencia = competencia,
                    DataVencimento = vencimento,
                    DataPagamento = situacao == "pago" ? vencimento.AddDays(1) : null,
                    FormaPagamento = i % 3 == 0 ? "transferencia" : "boleto",
                    ParcelaNumero = null,
                    ParcelaTotal = null,
                    Referencia = $"DESP-{competencia:yyyyMM}-{i + 1:00}"
                };
                _db.LancamentosFinanceiros.Add(lanc);
                MarkDemo(lanc);
                lancamentos.Add(lanc);
            }

            foreach (var unidade in unidadesOrdenadas)
            {
                var pessoaId = vinculosDemo.FirstOrDefault(v => v.UnidadeOrganizacionalId == unidade.Id)?.PessoaId
                               ?? moradorPessoa?.Id
                               ?? moradores.First().Id;
                var valor = 480 + random.Next(0, 140);
                var vencimento = competencia.AddDays(10);
                var situacao = random.NextDouble() > 0.15 ? "pago" : "aberto";
                var lanc = new LancamentoFinanceiro
                {
                    Id = Guid.NewGuid(),
                    OrganizacaoId = demoOrg.Id,
                    Tipo = "receber",
                    Situacao = situacao,
                    PlanoContasId = planosReceita[0].Id,
                    CentroCustoId = null,
                    ContaFinanceiraId = contas[0].Id,
                    PessoaId = pessoaId,
                    Descricao = $"Taxa condominial {unidade.CodigoInterno}",
                    Valor = valor,
                    DataCompetencia = competencia,
                    DataVencimento = vencimento,
                    DataPagamento = situacao == "pago" ? vencimento.AddDays(2) : null,
                    FormaPagamento = "boleto",
                    ParcelaNumero = null,
                    ParcelaTotal = null,
                    Referencia = $"COTA-{competencia:yyyyMM}-{unidade.CodigoInterno}"
                };
                _db.LancamentosFinanceiros.Add(lanc);
                MarkDemo(lanc);
                lancamentos.Add(lanc);

                if (situacao != "pago" && random.NextDouble() > 0.4)
                {
                    var doc = new DocumentoCobranca
                    {
                        Id = Guid.NewGuid(),
                        OrganizacaoId = demoOrg.Id,
                        LancamentoFinanceiroId = lanc.Id,
                        Tipo = "boleto",
                        IdentificadorExterno = $"BOL-{competencia:yyyyMM}-{unidade.CodigoInterno}",
                        LinhaDigitavel = $"{random.Next(10000, 99999)}.{random.Next(10000, 99999)}",
                        QrCode = null,
                        UrlPagamento = null,
                        Status = "aberta",
                        DataEmissao = competencia,
                        DataVencimento = vencimento,
                        DataBaixa = null
                    };
                    _db.DocumentosCobranca.Add(doc);
                    MarkDemo(doc);
                    documentos.Add(doc);
                }
            }
        }

        var cobrancasUnidade = new List<UnidadeCobranca>();
        var pagamentosUnidade = new List<UnidadePagamento>();
        var unidadesCompletas = unidadesOrdenadas.Take(3).ToList();
        foreach (var unidade in unidadesOrdenadas)
        {
            var completo = unidadesCompletas.Contains(unidade);
            var meses = completo ? 12 : 3;
            var inicio = completo ? 0 : 9;
            for (var mes = 0; mes < meses; mes++)
            {
                var competencia = inicioMes.AddMonths(inicio + mes);
                var valor = 470 + random.Next(0, 160);
                var vencimento = competencia.AddDays(12);
                var status = random.NextDouble() > 0.25 ? "PAGA" : "ATRASADA";
                var cobranca = new UnidadeCobranca
                {
                    Id = Guid.NewGuid(),
                    OrganizacaoId = demoOrg.Id,
                    UnidadeOrganizacionalId = unidade.Id,
                    Competencia = competencia.ToString("yyyy-MM"),
                    Descricao = $"Cobranca condominial {unidade.CodigoInterno}",
                    CategoriaId = planosReceita[0].Id,
                    CentroCustoId = null,
                    Valor = valor,
                    Vencimento = vencimento,
                    Status = status,
                    ContaBancariaId = contas[0].Id
                };
                _db.UnidadesCobrancas.Add(cobranca);
                MarkDemo(cobranca);
                cobrancasUnidade.Add(cobranca);

                if (status == "PAGA")
                {
                    var pagamento = new UnidadePagamento
                    {
                        Id = Guid.NewGuid(),
                        OrganizacaoId = demoOrg.Id,
                        CobrancaId = cobranca.Id,
                        ValorPago = valor,
                        DataPagamento = vencimento.AddDays(2),
                        ContaBancariaId = contas[0].Id,
                        Observacao = "Pagamento automatico demo"
                    };
                    _db.UnidadesPagamentos.Add(pagamento);
                    MarkDemo(pagamento);
                    pagamentosUnidade.Add(pagamento);
                    cobranca.PagoEm = pagamento.DataPagamento;
                }
            }
        }

        for (var i = 0; i < 6; i++)
        {
            var contaOrigem = contas[i % contas.Length];
            var contaDestino = contas[(i + 1) % contas.Length];
            var referencia = $"TRF-{inicioMes.AddMonths(i):yyyyMM}-{i + 1:00}";
            var valor = 2500 + i * 350;
            var data = inicioMes.AddMonths(i).AddDays(12);

            var saida = new LancamentoFinanceiro
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                Tipo = "pagar",
                Situacao = "pago",
                PlanoContasId = planosDespesa[0].Id,
                CentroCustoId = centros[0].Id,
                ContaFinanceiraId = contaOrigem.Id,
                PessoaId = fornecedoresPessoas.First().Id,
                Descricao = "Transferencia entre contas",
                Valor = valor,
                DataCompetencia = data,
                DataVencimento = data,
                DataPagamento = data,
                FormaPagamento = "transferencia",
                Referencia = referencia
            };
            _db.LancamentosFinanceiros.Add(saida);
            MarkDemo(saida);

            var entrada = new LancamentoFinanceiro
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                Tipo = "receber",
                Situacao = "pago",
                PlanoContasId = planosReceita[0].Id,
                CentroCustoId = centros[0].Id,
                ContaFinanceiraId = contaDestino.Id,
                PessoaId = fornecedoresPessoas.First().Id,
                Descricao = "Transferencia entre contas",
                Valor = valor,
                DataCompetencia = data,
                DataVencimento = data,
                DataPagamento = data,
                FormaPagamento = "transferencia",
                Referencia = referencia
            };
            _db.LancamentosFinanceiros.Add(entrada);
            MarkDemo(entrada);

            lancamentos.Add(saida);
            lancamentos.Add(entrada);
        }

        var movimentosBancarios = new List<MovimentoBancario>();
        var movimentosFonte = lancamentos.Where(l => l.Situacao == "pago").Take(12).ToList();
        for (var i = 0; i < movimentosFonte.Count; i++)
        {
            var lanc = movimentosFonte[i];
            var valorMov = lanc.Tipo == "pagar" ? -lanc.Valor : lanc.Valor;
            var movimento = new MovimentoBancario
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                ContaBancariaId = lanc.ContaFinanceiraId ?? contas[0].Id,
                Data = lanc.DataPagamento ?? lanc.DataCompetencia,
                Descricao = lanc.Descricao,
                Valor = valorMov,
                Hash = Guid.NewGuid().ToString("N"),
                Status = i % 2 == 0 ? "CONCILIADO" : "PENDENTE",
                LancamentoFinanceiroId = i % 2 == 0 ? lanc.Id : null
            };
            _db.MovimentosBancarios.Add(movimento);
            MarkDemo(movimento);
            movimentosBancarios.Add(movimento);
        }

        foreach (var pagamento in pagamentosUnidade.Take(6))
        {
            var movimento = new MovimentoBancario
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                ContaBancariaId = pagamento.ContaBancariaId ?? contas[0].Id,
                Data = pagamento.DataPagamento,
                Descricao = "Recebimento taxa condominial",
                Valor = pagamento.ValorPago,
                Hash = Guid.NewGuid().ToString("N"),
                Status = "CONCILIADO",
                UnidadePagamentoId = pagamento.Id
            };
            _db.MovimentosBancarios.Add(movimento);
            MarkDemo(movimento);
            movimentosBancarios.Add(movimento);
        }

        var regraRateio = new RegraRateio
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = demoOrg.Id,
            Nome = "Rateio igualitario manutencao",
            TipoBase = "igual",
            ConfiguracaoJson = JsonSerializer.Serialize(new { unidades = unidadesOrdenadas.Count })
        };
        _db.RegrasRateio.Add(regraRateio);
        MarkDemo(regraRateio);

        var lancamentoRateioBase = lancamentos.FirstOrDefault(l => l.Tipo == "pagar");
        if (lancamentoRateioBase is not null)
        {
            foreach (var unidade in unidadesOrdenadas.Take(3))
            {
                var rateio = new LancamentoRateado
                {
                    Id = Guid.NewGuid(),
                    LancamentoOriginalId = lancamentoRateioBase.Id,
                    UnidadeOrganizacionalId = unidade.Id,
                    CentroCustoId = centros[1].Id,
                    ValorRateado = Math.Round(lancamentoRateioBase.Valor / 3, 2)
                };
                _db.LancamentosRateados.Add(rateio);
                MarkDemo(rateio);
            }
        }

        var responsaveisChamado = vinculosDemo
            .Where(v => v.Papel is "colaborador" or "administrador" or "sindico")
            .Select(v => v.PessoaId)
            .Distinct()
            .ToList();
        if (sindicoPessoa is not null)
        {
            responsaveisChamado.Add(sindicoPessoa.Id);
        }

        var categoriasChamado = new[] { "Manutencao", "Seguranca", "Limpeza", "Portaria", "Comunicacao" };
        var titulosChamado = new[]
        {
            "Vazamento na cozinha",
            "Portao com ruido",
            "Lampada queimada no corredor",
            "Vistoria de garagem",
            "Interfone com defeito",
            "Piso solto na area comum",
            "Barulho no elevador",
            "Portaria sem comunicacao",
            "Limpeza do hall",
            "Infiltracao no teto"
        };
        var statusChamado = new[] { "ABERTO", "EM_ATENDIMENTO", "AGUARDANDO", "RESOLVIDO", "ENCERRADO" };
        var prioridades = new[] { "BAIXA", "MEDIA", "ALTA", "URGENTE" };

        var chamados = new List<Chamado>();
        var historicosChamado = new List<ChamadoHistorico>();
        for (var i = 0; i < 20; i++)
        {
            var unidade = unidadesOrdenadas[i % unidadesOrdenadas.Count];
            var solicitante = vinculosDemo.FirstOrDefault(v =>
                v.UnidadeOrganizacionalId == unidade.Id && v.Papel == "morador")?.PessoaId
                ?? moradorPessoa?.Id
                ?? moradores.First().Id;
            var statusAtual = statusChamado[i % statusChamado.Length];
            var prioridadeAtual = prioridades[i % prioridades.Length];
            var responsavel = responsaveisChamado.Count > 0
                ? responsaveisChamado[i % responsaveisChamado.Count]
                : (Guid?)null;
            var slaHoras = prioridadeAtual switch
            {
                "URGENTE" => 8,
                "ALTA" => 24,
                "MEDIA" => 48,
                "BAIXA" => 72,
                _ => 48
            };
            var chamado = new Chamado
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                UnidadeOrganizacionalId = unidade.Id,
                PessoaSolicitanteId = solicitante,
                Categoria = categoriasChamado[i % categoriasChamado.Length],
                Titulo = titulosChamado[i % titulosChamado.Length],
                Descricao = "Chamado registrado automaticamente para demonstracao.",
                Status = statusAtual,
                Prioridade = prioridadeAtual,
                ResponsavelPessoaId = responsavel,
                DataAbertura = DateTime.UtcNow.AddDays(-20 + i),
                SlaHoras = slaHoras,
                DataPrazoSla = DateTime.UtcNow.AddDays(-20 + i).AddHours(slaHoras)
            };
            if (statusAtual is "RESOLVIDO" or "ENCERRADO")
            {
                chamado.DataFechamento = chamado.DataAbertura.AddDays(2);
            }
            _db.Chamados.Add(chamado);
            MarkDemo(chamado);
            chamados.Add(chamado);

            var historicoCriado = new ChamadoHistorico
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                ChamadoId = chamado.Id,
                DataHora = chamado.DataAbertura,
                Acao = "CRIADO",
                Detalhes = "Chamado criado no modo demo.",
                ResponsavelPessoaId = responsavel
            };
            historicosChamado.Add(historicoCriado);
            MarkDemo(historicoCriado);

            var historicoStatus = new ChamadoHistorico
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                ChamadoId = chamado.Id,
                DataHora = chamado.DataAbertura.AddDays(1),
                Acao = "STATUS",
                Detalhes = $"Status atualizado para {statusAtual}.",
                ResponsavelPessoaId = responsavel
            };
            historicosChamado.Add(historicoStatus);
            MarkDemo(historicoStatus);
        }
        _db.ChamadosHistorico.AddRange(historicosChamado);

        var reservas = new List<Reserva>();
        var dataBase = DateTime.UtcNow.Date.AddDays(-12);
        var statusReservas = new[] { "PENDENTE", "APROVADA", "CONCLUIDA", "CANCELADA" };
        for (var i = 0; i < 24; i++)
        {
            var recurso = recursos[i % recursos.Count];
            var unidade = unidadesOrdenadas[i % unidadesOrdenadas.Count];
            var solicitante = vinculosDemo.FirstOrDefault(v =>
                v.UnidadeOrganizacionalId == unidade.Id && v.Papel == "morador")?.PessoaId
                ?? moradorPessoa?.Id
                ?? moradores.First().Id;
            var dia = dataBase.AddDays(i * 2);
            var inicio = dia.AddHours(10 + (i % 3) * 3);
            var fim = inicio.AddHours(3);
            var statusAtual = statusReservas[i % statusReservas.Length];
            var reserva = new Reserva
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                RecursoReservavelId = recurso.Id,
                PessoaSolicitanteId = solicitante,
                UnidadeOrganizacionalId = unidade.Id,
                DataInicio = inicio,
                DataFim = fim,
                Status = statusAtual,
                ValorTotal = 150 + (i % 4) * 50,
                LancamentoFinanceiroId = null,
                DataSolicitacao = inicio.AddDays(-2),
                DataAprovacao = statusAtual == "APROVADA" ? inicio.AddDays(-1) : null,
                AprovadorPessoaId = statusAtual == "APROVADA" ? sindicoPessoa?.Id : null
            };
            _db.Reservas.Add(reserva);
            MarkDemo(reserva);
            reservas.Add(reserva);
        }

        var notificacoesConfig = new[]
        {
            new NotificacaoConfig
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                Tipo = "conta_pagar_vencendo",
                Canal = "app",
                Ativo = true,
                DiasAntesVencimento = 5,
                LimiteValor = 500,
                DestinatariosJson = JsonSerializer.Serialize(new { roles = new[] { "CONDO_ADMIN" } })
            },
            new NotificacaoConfig
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                Tipo = "cobranca_unidade_vencendo",
                Canal = "app",
                Ativo = true,
                DiasAntesVencimento = 3,
                LimiteValor = 300,
                DestinatariosJson = JsonSerializer.Serialize(new { roles = new[] { "CONDO_ADMIN", "CONDO_STAFF" } })
            }
        };

        foreach (var cfg in notificacoesConfig)
        {
            _db.NotificacoesConfig.Add(cfg);
            MarkDemo(cfg);
        }

        var eventosNotificacao = new[]
        {
            new NotificacaoEvento
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                Tipo = "conta_pagar_vencendo",
                Canal = "app",
                Titulo = "Conta a pagar vencendo",
                Mensagem = "Despesa de manutencao vence em 3 dias.",
                CriadoEm = DateTime.UtcNow.AddHours(-4)
            },
            new NotificacaoEvento
            {
                Id = Guid.NewGuid(),
                OrganizacaoId = demoOrg.Id,
                Tipo = "cobranca_unidade_vencendo",
                Canal = "app",
                Titulo = "Cobranca de unidade vencendo",
                Mensagem = "Apto A101 com cobranca pendente.",
                CriadoEm = DateTime.UtcNow.AddHours(-2)
            }
        };

        foreach (var ev in eventosNotificacao)
        {
            _db.NotificacoesEventos.Add(ev);
            MarkDemo(ev);
        }

        var pdfBytes = Encoding.ASCII.GetBytes("%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF");
        var pngBytes = Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==");

        foreach (var chamado in chamados.Take(5))
        {
            var anexo = await CriarAnexoDemoAsync(
                demoOrg.Id,
                "chamado",
                chamado.Id,
                $"chamado-{chamado.Id.ToString()[..6]}.pdf",
                "application/pdf",
                pdfBytes);
            _db.Anexos.Add(anexo);
            MarkDemo(anexo);
        }

        foreach (var lanc in lancamentos.Where(l => l.Tipo == "pagar").Take(5))
        {
            var anexo = await CriarAnexoDemoAsync(
                demoOrg.Id,
                "lancamento_financeiro",
                lanc.Id,
                $"conta-{lanc.Id.ToString()[..6]}.pdf",
                "application/pdf",
                pdfBytes);
            _db.Anexos.Add(anexo);
            MarkDemo(anexo);
        }

        foreach (var reserva in reservas.Take(3))
        {
            var anexo = await CriarAnexoDemoAsync(
                demoOrg.Id,
                "reserva",
                reserva.Id,
                $"reserva-{reserva.Id.ToString()[..6]}.png",
                "image/png",
                pngBytes);
            _db.Anexos.Add(anexo);
            MarkDemo(anexo);
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Seed DEMO completo gerado.",
            organizacaoId = demoOrg.Id,
            usuarios = new
            {
                admin = adminEmail,
                sindico = sindicoEmail,
                porteiro = porteiroEmail,
                morador = moradorEmail
            }
        });
    }

    private async Task WipeDemoDataAsync(IReadOnlyCollection<Guid> demoOrgIds)
    {
        var orgIds = demoOrgIds?.Distinct().ToList() ?? new List<Guid>();
        var orgFilter = BuildOrgFilter("OrganizacaoId", orgIds);
        var pessoaIds = await _db.VinculosPessoaOrganizacao.AsNoTracking()
            .Where(v =>
                EF.Property<string>(v, "Source") == DemoSource ||
                orgIds.Contains(v.OrganizacaoId))
            .Select(v => v.PessoaId)
            .Distinct()
            .ToListAsync();

        await using var transacao = await _db.Database.BeginTransactionAsync();

        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM Anexos WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM NotificacoesEventos WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM NotificacoesConfig WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM MovimentosBancarios WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM UnidadesPagamentos WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM UnidadesCobrancas WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM LancamentosRateados WHERE Source = '{DemoSource}' OR LancamentoOriginalId IN (SELECT Id FROM LancamentosFinanceiros WHERE {orgFilter})");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM DocumentosCobranca WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM Reservas WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM ChamadoHistoricos WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM Chamados WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM FinanceAudits WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM LancamentosFinanceiros WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM CotasCondominio WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM ItensCobrados WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM RegrasRateio WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM PlanosContas WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM CentrosCusto WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM ContasFinanceiras WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM RecursosReservaveis WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM VinculosPessoaOrganizacao WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM Enderecos WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM Veiculos WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM Pets WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM UserCondoMemberships WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");
        await _db.Database.ExecuteSqlRawAsync(
            $"DELETE FROM UnidadesOrganizacionais WHERE {BuildSourceOrOrgFilter("OrganizacaoId", orgIds)}");

        if (pessoaIds.Count > 0)
        {
            var pessoaFilter = string.Join(", ", pessoaIds.Select(id => $"'{id}'"));
            await _db.Database.ExecuteSqlRawAsync(
                $"DELETE FROM Pessoas WHERE (Source = '{DemoSource}' OR Id IN ({pessoaFilter})) AND Id NOT IN (SELECT PessoaId FROM Usuarios)");
        }
        else
        {
            await _db.Database.ExecuteSqlRawAsync(
                $"DELETE FROM Pessoas WHERE Source = '{DemoSource}' AND Id NOT IN (SELECT PessoaId FROM Usuarios)");
        }

        var orgIdFilter = BuildOrgIdFilter(orgIds);
        var orgWhere = orgIds.Count == 0
            ? $"Source = '{DemoSource}' OR Documento = '{DemoOrgKey}' OR Nome = '{DemoOrgName}'"
            : $"Source = '{DemoSource}' OR Documento = '{DemoOrgKey}' OR Nome = '{DemoOrgName}' OR {orgIdFilter}";
        await _db.Database.ExecuteSqlRawAsync($"DELETE FROM Organizacoes WHERE {orgWhere}");

        await transacao.CommitAsync();
    }

    private async Task<(Usuario user, Pessoa? pessoa, bool created)> GetOrCreateUserAsync(
        string email,
        string senha,
        string nome)
    {
        var existing = await _db.Usuarios.FirstOrDefaultAsync(u => u.EmailLogin == email);
        if (existing is not null)
        {
            var pessoaExistente = await _db.Pessoas.FirstOrDefaultAsync(p => p.Id == existing.PessoaId);
            if (pessoaExistente is null)
            {
                pessoaExistente = new Pessoa
                {
                    Id = Guid.NewGuid(),
                    Nome = nome,
                    Tipo = "fisica",
                    Email = email
                };
                existing.PessoaId = pessoaExistente.Id;
                _db.Pessoas.Add(pessoaExistente);
            }
            else
            {
                if (string.IsNullOrWhiteSpace(pessoaExistente.Nome))
                {
                    pessoaExistente.Nome = nome;
                }

                if (string.IsNullOrWhiteSpace(pessoaExistente.Email))
                {
                    pessoaExistente.Email = email;
                }
            }

            existing.SenhaHash = AuthController.HashPassword(senha);
            existing.Status = "ativo";

            return (existing, pessoaExistente, false);
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

        return (usuario, pessoa, true);
    }

    private async Task EnsureMembershipDemoAsync(
        Guid usuarioId,
        Guid? organizacaoId,
        Guid? unidadeId,
        UserRole role)
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

        var membership = new UserCondoMembership
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            OrganizacaoId = organizacaoId,
            UnidadeOrganizacionalId = unidadeId,
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.UserCondoMemberships.Add(membership);
        MarkDemo(membership);
    }

    private void MarkDemo<TEntity>(TEntity entity) where TEntity : class
    {
        _db.Entry(entity).Property("Source").CurrentValue = DemoSource;
    }

    private void MarkDemoIfEmpty<TEntity>(TEntity entity) where TEntity : class
    {
        var entry = _db.Entry(entity);
        var property = entry.Metadata.FindProperty("Source");
        if (property is null)
        {
            return;
        }

        var current = entry.Property("Source").CurrentValue as string;
        if (string.IsNullOrWhiteSpace(current))
        {
            entry.Property("Source").CurrentValue = DemoSource;
        }
    }

    private async Task<Anexo> CriarAnexoDemoAsync(
        Guid organizacaoId,
        string tipoEntidade,
        Guid entidadeId,
        string nomeArquivo,
        string mimeType,
        byte[] conteudo)
    {
        var pasta = Path.Combine(
            _env.ContentRootPath,
            "Uploads",
            organizacaoId.ToString(),
            tipoEntidade,
            entidadeId.ToString());
        Directory.CreateDirectory(pasta);

        var uniqueName = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}-{nomeArquivo}";
        var caminho = Path.Combine(pasta, uniqueName);
        await System.IO.File.WriteAllBytesAsync(caminho, conteudo);

        var anexo = new Anexo
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = organizacaoId,
            TipoEntidade = tipoEntidade,
            EntidadeId = entidadeId,
            NomeArquivo = nomeArquivo,
            MimeType = mimeType,
            Tamanho = conteudo.Length,
            Caminho = caminho,
            CriadoEm = DateTime.UtcNow
        };

        return anexo;
    }

    private static string BuildSourceOrOrgFilter(string column, IReadOnlyCollection<Guid> orgIds)
    {
        if (orgIds.Count == 0)
        {
            return $"Source = '{DemoSource}'";
        }

        var orgFilter = BuildOrgFilter(column, orgIds);
        return $"(Source = '{DemoSource}' OR {orgFilter})";
    }

    private static string BuildOrgFilter(string column, IReadOnlyCollection<Guid> orgIds)
    {
        if (orgIds.Count == 0)
        {
            return "0=1";
        }

        var ids = string.Join(", ", orgIds.Select(id => $"'{id}'"));
        return $"{column} IN ({ids})";
    }

    private static string BuildOrgIdFilter(IReadOnlyCollection<Guid> orgIds)
    {
        return BuildOrgFilter("Id", orgIds);
    }

    private async Task<Usuario> EnsureUserAsync(string email, string senha, string nome)
    {
        var existing = await _db.Usuarios
            .FirstOrDefaultAsync(u => u.EmailLogin == email);
        if (existing is not null)
        {
            var pessoaExistente = await _db.Pessoas.FirstOrDefaultAsync(p => p.Id == existing.PessoaId);
            if (pessoaExistente is null)
            {
                pessoaExistente = new Pessoa
                {
                    Id = Guid.NewGuid(),
                    Nome = nome,
                    Tipo = "fisica",
                    Email = email
                };
                existing.PessoaId = pessoaExistente.Id;
                _db.Pessoas.Add(pessoaExistente);
            }
            else
            {
                if (string.IsNullOrWhiteSpace(pessoaExistente.Nome))
                {
                    pessoaExistente.Nome = nome;
                }

                if (string.IsNullOrWhiteSpace(pessoaExistente.Email))
                {
                    pessoaExistente.Email = email;
                }
            }

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

    private async Task EnsureVinculoAsync(Guid pessoaId, Guid organizacaoId, Guid? unidadeId, string papel)
    {
        var exists = await _db.VinculosPessoaOrganizacao.AsNoTracking()
            .AnyAsync(v =>
                v.PessoaId == pessoaId &&
                v.OrganizacaoId == organizacaoId &&
                v.UnidadeOrganizacionalId == unidadeId &&
                v.Papel == papel);
        if (exists)
        {
            return;
        }

        _db.VinculosPessoaOrganizacao.Add(new VinculoPessoaOrganizacao
        {
            Id = Guid.NewGuid(),
            PessoaId = pessoaId,
            OrganizacaoId = organizacaoId,
            UnidadeOrganizacionalId = unidadeId,
            Papel = papel,
            DataInicio = DateTime.UtcNow
        });
    }
}
