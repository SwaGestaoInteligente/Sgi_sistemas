using Microsoft.EntityFrameworkCore;
using Sgi.Domain.Contabilidade;
using Sgi.Domain.Core;
using Sgi.Domain.Financeiro;
using Sgi.Domain.Operacao;

namespace Sgi.Infrastructure.Data;

public class SgiDbContext : DbContext
{
    public SgiDbContext(DbContextOptions<SgiDbContext> options) : base(options)
    {
    }

    public DbSet<Organizacao> Organizacoes => Set<Organizacao>();
    public DbSet<UnidadeOrganizacional> UnidadesOrganizacionais => Set<UnidadeOrganizacional>();
    public DbSet<Pessoa> Pessoas => Set<Pessoa>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<UserCondoMembership> UserCondoMemberships => Set<UserCondoMembership>();
    public DbSet<VinculoPessoaOrganizacao> VinculosPessoaOrganizacao => Set<VinculoPessoaOrganizacao>();
    public DbSet<Papel> Papeis => Set<Papel>();
    public DbSet<Permissao> Permissoes => Set<Permissao>();
    public DbSet<PapelPermissao> PapeisPermissoes => Set<PapelPermissao>();
    public DbSet<UsuarioPapelOrganizacao> UsuariosPapeisOrganizacao => Set<UsuarioPapelOrganizacao>();
    public DbSet<Endereco> Enderecos => Set<Endereco>();
    public DbSet<LogAuditoria> LogsAuditoria => Set<LogAuditoria>();
    public DbSet<Anexo> Anexos => Set<Anexo>();
    public DbSet<NotificacaoConfig> NotificacoesConfig => Set<NotificacaoConfig>();
    public DbSet<NotificacaoEvento> NotificacoesEventos => Set<NotificacaoEvento>();
    public DbSet<Veiculo> Veiculos => Set<Veiculo>();
    public DbSet<Pet> Pets => Set<Pet>();

    public DbSet<ContaFinanceira> ContasFinanceiras => Set<ContaFinanceira>();
    public DbSet<PlanoContas> PlanosContas => Set<PlanoContas>();
    public DbSet<ChargeItem> ItensCobrados => Set<ChargeItem>();
    public DbSet<CentroCusto> CentrosCusto => Set<CentroCusto>();
    public DbSet<LancamentoFinanceiro> LancamentosFinanceiros => Set<LancamentoFinanceiro>();
    public DbSet<DocumentoCobranca> DocumentosCobranca => Set<DocumentoCobranca>();
    public DbSet<CotaCondominial> CotasCondominio => Set<CotaCondominial>();
    public DbSet<RegraRateio> RegrasRateio => Set<RegraRateio>();
    public DbSet<LancamentoRateado> LancamentosRateados => Set<LancamentoRateado>();
    public DbSet<FinanceAudit> FinanceAudits => Set<FinanceAudit>();
    public DbSet<UnidadeCobranca> UnidadesCobrancas => Set<UnidadeCobranca>();
    public DbSet<UnidadePagamento> UnidadesPagamentos => Set<UnidadePagamento>();
    public DbSet<MovimentoBancario> MovimentosBancarios => Set<MovimentoBancario>();

    public DbSet<ContaContabil> ContasContabeis => Set<ContaContabil>();
    public DbSet<PeriodoContabil> PeriodosContabeis => Set<PeriodoContabil>();
    public DbSet<LancamentoContabil> LancamentosContabeis => Set<LancamentoContabil>();
    public DbSet<PartidaContabil> PartidasContabeis => Set<PartidaContabil>();
    public DbSet<MapeamentoPlanoContasContabil> MapeamentosPlanoContasContabil => Set<MapeamentoPlanoContasContabil>();

    public DbSet<Chamado> Chamados => Set<Chamado>();
    public DbSet<ChamadoHistorico> ChamadosHistorico => Set<ChamadoHistorico>();
    public DbSet<RecursoReservavel> RecursosReservaveis => Set<RecursoReservavel>();
    public DbSet<Reserva> Reservas => Set<Reserva>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Organizacao>().ToTable("Organizacoes");
        modelBuilder.Entity<UnidadeOrganizacional>().ToTable("UnidadesOrganizacionais");
        modelBuilder.Entity<Pessoa>().ToTable("Pessoas");
        modelBuilder.Entity<Usuario>().ToTable("Usuarios");
        modelBuilder.Entity<UserCondoMembership>().ToTable("UserCondoMemberships");
        modelBuilder.Entity<VinculoPessoaOrganizacao>().ToTable("VinculosPessoaOrganizacao");
        modelBuilder.Entity<Papel>().ToTable("Papeis");
        modelBuilder.Entity<Permissao>().ToTable("Permissoes");
        modelBuilder.Entity<PapelPermissao>().ToTable("PapeisPermissoes")
            .HasKey(pp => new { pp.PapelId, pp.PermissaoId });
        modelBuilder.Entity<UsuarioPapelOrganizacao>().ToTable("UsuariosPapeisOrganizacao")
            .HasKey(up => new { up.UsuarioId, up.OrganizacaoId, up.PapelId });
        modelBuilder.Entity<UserCondoMembership>()
            .Property(m => m.Role)
            .HasConversion<string>();
        modelBuilder.Entity<Endereco>().ToTable("Enderecos");
        modelBuilder.Entity<LogAuditoria>().ToTable("LogsAuditoria");
        modelBuilder.Entity<Anexo>().ToTable("Anexos");
        modelBuilder.Entity<NotificacaoConfig>().ToTable("NotificacoesConfig");
        modelBuilder.Entity<NotificacaoEvento>().ToTable("NotificacoesEventos");
        modelBuilder.Entity<Veiculo>().ToTable("Veiculos");
        modelBuilder.Entity<Pet>().ToTable("Pets");

        modelBuilder.Entity<ContaFinanceira>().ToTable("ContasFinanceiras");
        modelBuilder.Entity<PlanoContas>().ToTable("PlanosContas");
        modelBuilder.Entity<ChargeItem>().ToTable("ItensCobrados");
        modelBuilder.Entity<CentroCusto>().ToTable("CentrosCusto");
        modelBuilder.Entity<LancamentoFinanceiro>().ToTable("LancamentosFinanceiros");
        modelBuilder.Entity<DocumentoCobranca>().ToTable("DocumentosCobranca");
        modelBuilder.Entity<CotaCondominial>().ToTable("CotasCondominio");
        modelBuilder.Entity<RegraRateio>().ToTable("RegrasRateio");
        modelBuilder.Entity<LancamentoRateado>().ToTable("LancamentosRateados");
        modelBuilder.Entity<FinanceAudit>().ToTable("FinanceAudits");
        modelBuilder.Entity<UnidadeCobranca>().ToTable("UnidadesCobrancas");
        modelBuilder.Entity<UnidadePagamento>().ToTable("UnidadesPagamentos");
        modelBuilder.Entity<MovimentoBancario>().ToTable("MovimentosBancarios");

        modelBuilder.Entity<ContaContabil>().ToTable("ContasContabeis");
        modelBuilder.Entity<PeriodoContabil>().ToTable("PeriodosContabeis");
        modelBuilder.Entity<LancamentoContabil>().ToTable("LancamentosContabeis");
        modelBuilder.Entity<PartidaContabil>().ToTable("PartidasContabeis");
        modelBuilder.Entity<MapeamentoPlanoContasContabil>().ToTable("MapeamentosPlanoContasContabeis");

        modelBuilder.Entity<Chamado>().ToTable("Chamados");
        modelBuilder.Entity<ChamadoHistorico>().ToTable("ChamadoHistoricos");
        modelBuilder.Entity<RecursoReservavel>().ToTable("RecursosReservaveis");
        modelBuilder.Entity<Reserva>().ToTable("Reservas");

        ConfigureDemoSource(modelBuilder);
    }

    private static void ConfigureDemoSource(ModelBuilder modelBuilder)
    {
        AddSource<Organizacao>(modelBuilder);
        AddSource<UnidadeOrganizacional>(modelBuilder);
        AddSource<Pessoa>(modelBuilder);
        AddSource<UserCondoMembership>(modelBuilder);
        AddSource<VinculoPessoaOrganizacao>(modelBuilder);
        AddSource<Endereco>(modelBuilder);
        AddSource<Anexo>(modelBuilder);
        AddSource<NotificacaoConfig>(modelBuilder);
        AddSource<NotificacaoEvento>(modelBuilder);
        AddSource<Veiculo>(modelBuilder);
        AddSource<Pet>(modelBuilder);

        AddSource<ContaFinanceira>(modelBuilder);
        AddSource<PlanoContas>(modelBuilder);
        AddSource<ChargeItem>(modelBuilder);
        AddSource<CentroCusto>(modelBuilder);
        AddSource<LancamentoFinanceiro>(modelBuilder);
        AddSource<DocumentoCobranca>(modelBuilder);
        AddSource<CotaCondominial>(modelBuilder);
        AddSource<RegraRateio>(modelBuilder);
        AddSource<LancamentoRateado>(modelBuilder);
        AddSource<FinanceAudit>(modelBuilder);
        AddSource<UnidadeCobranca>(modelBuilder);
        AddSource<UnidadePagamento>(modelBuilder);
        AddSource<MovimentoBancario>(modelBuilder);

        AddSource<ContaContabil>(modelBuilder);
        AddSource<PeriodoContabil>(modelBuilder);
        AddSource<LancamentoContabil>(modelBuilder);
        AddSource<PartidaContabil>(modelBuilder);
        AddSource<MapeamentoPlanoContasContabil>(modelBuilder);

        AddSource<Chamado>(modelBuilder);
        AddSource<ChamadoHistorico>(modelBuilder);
        AddSource<RecursoReservavel>(modelBuilder);
        AddSource<Reserva>(modelBuilder);
    }

    private static void AddSource<TEntity>(ModelBuilder modelBuilder) where TEntity : class
    {
        modelBuilder.Entity<TEntity>().Property<string>("Source");
    }
}
