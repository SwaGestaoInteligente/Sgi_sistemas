using Microsoft.EntityFrameworkCore;
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

    public DbSet<Chamado> Chamados => Set<Chamado>();
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

        modelBuilder.Entity<Chamado>().ToTable("Chamados");
        modelBuilder.Entity<RecursoReservavel>().ToTable("RecursosReservaveis");
        modelBuilder.Entity<Reserva>().ToTable("Reservas");
    }
}
