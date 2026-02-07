using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sgi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AdvancedFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "VinculosPessoaOrganizacao",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "UnidadesOrganizacionais",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AprovadorPessoaId",
                table: "Reservas",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DataAprovacao",
                table: "Reservas",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DataSolicitacao",
                table: "Reservas",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Observacao",
                table: "Reservas",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Reservas",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "RegrasRateio",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BloqueiosJson",
                table: "RecursosReservaveis",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ExigeAprovacao",
                table: "RecursosReservaveis",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "JanelaHorarioFim",
                table: "RecursosReservaveis",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JanelaHorarioInicio",
                table: "RecursosReservaveis",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LimitePorUnidadePorMes",
                table: "RecursosReservaveis",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "RecursosReservaveis",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "PlanosContas",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Pessoas",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModulosAtivos",
                table: "Organizacoes",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Organizacoes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "LancamentosRateados",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "LancamentosFinanceiros",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Enderecos",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "DocumentosCobranca",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "ContasFinanceiras",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DataPrazoSla",
                table: "Chamados",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ResponsavelPessoaId",
                table: "Chamados",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SlaHoras",
                table: "Chamados",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Chamados",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "CentrosCusto",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Anexos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TipoEntidade = table.Column<string>(type: "TEXT", nullable: false),
                    EntidadeId = table.Column<Guid>(type: "TEXT", nullable: false),
                    NomeArquivo = table.Column<string>(type: "TEXT", nullable: false),
                    MimeType = table.Column<string>(type: "TEXT", nullable: false),
                    Tamanho = table.Column<long>(type: "INTEGER", nullable: false),
                    Caminho = table.Column<string>(type: "TEXT", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CriadoPorUserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Anexos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChamadoHistoricos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ChamadoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    DataHora = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Acao = table.Column<string>(type: "TEXT", nullable: false),
                    Detalhes = table.Column<string>(type: "TEXT", nullable: true),
                    ResponsavelPessoaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChamadoHistoricos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CotasCondominio",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UnidadeOrganizacionalId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PlanoContasId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Valor = table.Column<decimal>(type: "TEXT", nullable: false),
                    CompetenciaInicio = table.Column<string>(type: "TEXT", nullable: false),
                    CompetenciaFim = table.Column<string>(type: "TEXT", nullable: true),
                    Ativo = table.Column<bool>(type: "INTEGER", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CotasCondominio", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FinanceAudits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Acao = table.Column<string>(type: "TEXT", nullable: false),
                    Entidade = table.Column<string>(type: "TEXT", nullable: false),
                    EntidadeId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Detalhes = table.Column<string>(type: "TEXT", nullable: true),
                    DataHora = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinanceAudits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ItensCobrados",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Nome = table.Column<string>(type: "TEXT", nullable: false),
                    Tipo = table.Column<string>(type: "TEXT", nullable: false),
                    FinanceCategoryId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ValorPadrao = table.Column<decimal>(type: "TEXT", nullable: true),
                    PermiteAlterarValor = table.Column<bool>(type: "INTEGER", nullable: false),
                    ExigeReserva = table.Column<bool>(type: "INTEGER", nullable: false),
                    GeraCobrancaAutomatica = table.Column<bool>(type: "INTEGER", nullable: false),
                    DescricaoOpcional = table.Column<string>(type: "TEXT", nullable: true),
                    Ativo = table.Column<bool>(type: "INTEGER", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ItensCobrados", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MovimentosBancarios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ContaBancariaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Data = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Descricao = table.Column<string>(type: "TEXT", nullable: false),
                    Valor = table.Column<decimal>(type: "TEXT", nullable: false),
                    Hash = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    LancamentoFinanceiroId = table.Column<Guid>(type: "TEXT", nullable: true),
                    UnidadePagamentoId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MovimentosBancarios", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NotificacoesConfig",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tipo = table.Column<string>(type: "TEXT", nullable: false),
                    Canal = table.Column<string>(type: "TEXT", nullable: false),
                    Ativo = table.Column<bool>(type: "INTEGER", nullable: false),
                    DiasAntesVencimento = table.Column<int>(type: "INTEGER", nullable: true),
                    LimiteValor = table.Column<decimal>(type: "TEXT", nullable: true),
                    DestinatariosJson = table.Column<string>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificacoesConfig", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NotificacoesEventos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tipo = table.Column<string>(type: "TEXT", nullable: false),
                    Canal = table.Column<string>(type: "TEXT", nullable: false),
                    Titulo = table.Column<string>(type: "TEXT", nullable: false),
                    Mensagem = table.Column<string>(type: "TEXT", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LidoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    DestinatariosJson = table.Column<string>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificacoesEventos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Pets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UnidadeOrganizacionalId = table.Column<Guid>(type: "TEXT", nullable: true),
                    PessoaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Nome = table.Column<string>(type: "TEXT", nullable: false),
                    Especie = table.Column<string>(type: "TEXT", nullable: false),
                    Raca = table.Column<string>(type: "TEXT", nullable: true),
                    Porte = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UnidadesCobrancas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UnidadeOrganizacionalId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Competencia = table.Column<string>(type: "TEXT", nullable: false),
                    Descricao = table.Column<string>(type: "TEXT", nullable: false),
                    CategoriaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    CentroCustoId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Valor = table.Column<decimal>(type: "TEXT", nullable: false),
                    Vencimento = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    PagoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    FormaPagamento = table.Column<string>(type: "TEXT", nullable: true),
                    ContaBancariaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnidadesCobrancas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UnidadesPagamentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CobrancaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ValorPago = table.Column<decimal>(type: "TEXT", nullable: false),
                    DataPagamento = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ContaBancariaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ComprovanteAnexoId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Observacao = table.Column<string>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnidadesPagamentos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserCondoMemberships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: true),
                    UnidadeOrganizacionalId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Role = table.Column<string>(type: "TEXT", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserCondoMemberships", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Veiculos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UnidadeOrganizacionalId = table.Column<Guid>(type: "TEXT", nullable: true),
                    PessoaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Placa = table.Column<string>(type: "TEXT", nullable: false),
                    Marca = table.Column<string>(type: "TEXT", nullable: false),
                    Modelo = table.Column<string>(type: "TEXT", nullable: false),
                    Cor = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Veiculos", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Anexos");

            migrationBuilder.DropTable(
                name: "ChamadoHistoricos");

            migrationBuilder.DropTable(
                name: "CotasCondominio");

            migrationBuilder.DropTable(
                name: "FinanceAudits");

            migrationBuilder.DropTable(
                name: "ItensCobrados");

            migrationBuilder.DropTable(
                name: "MovimentosBancarios");

            migrationBuilder.DropTable(
                name: "NotificacoesConfig");

            migrationBuilder.DropTable(
                name: "NotificacoesEventos");

            migrationBuilder.DropTable(
                name: "Pets");

            migrationBuilder.DropTable(
                name: "UnidadesCobrancas");

            migrationBuilder.DropTable(
                name: "UnidadesPagamentos");

            migrationBuilder.DropTable(
                name: "UserCondoMemberships");

            migrationBuilder.DropTable(
                name: "Veiculos");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "VinculosPessoaOrganizacao");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "UnidadesOrganizacionais");

            migrationBuilder.DropColumn(
                name: "AprovadorPessoaId",
                table: "Reservas");

            migrationBuilder.DropColumn(
                name: "DataAprovacao",
                table: "Reservas");

            migrationBuilder.DropColumn(
                name: "DataSolicitacao",
                table: "Reservas");

            migrationBuilder.DropColumn(
                name: "Observacao",
                table: "Reservas");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Reservas");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "RegrasRateio");

            migrationBuilder.DropColumn(
                name: "BloqueiosJson",
                table: "RecursosReservaveis");

            migrationBuilder.DropColumn(
                name: "ExigeAprovacao",
                table: "RecursosReservaveis");

            migrationBuilder.DropColumn(
                name: "JanelaHorarioFim",
                table: "RecursosReservaveis");

            migrationBuilder.DropColumn(
                name: "JanelaHorarioInicio",
                table: "RecursosReservaveis");

            migrationBuilder.DropColumn(
                name: "LimitePorUnidadePorMes",
                table: "RecursosReservaveis");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "RecursosReservaveis");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "PlanosContas");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Pessoas");

            migrationBuilder.DropColumn(
                name: "ModulosAtivos",
                table: "Organizacoes");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Organizacoes");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "LancamentosRateados");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "LancamentosFinanceiros");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Enderecos");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "DocumentosCobranca");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "ContasFinanceiras");

            migrationBuilder.DropColumn(
                name: "DataPrazoSla",
                table: "Chamados");

            migrationBuilder.DropColumn(
                name: "ResponsavelPessoaId",
                table: "Chamados");

            migrationBuilder.DropColumn(
                name: "SlaHoras",
                table: "Chamados");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Chamados");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "CentrosCusto");
        }
    }
}
