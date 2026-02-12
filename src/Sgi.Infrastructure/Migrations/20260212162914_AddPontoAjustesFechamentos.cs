using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sgi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPontoAjustesFechamentos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PontoAjustes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PessoaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UnidadeOrganizacionalId = table.Column<Guid>(type: "TEXT", nullable: true),
                    MarcacaoOriginalId = table.Column<Guid>(type: "TEXT", nullable: true),
                    TipoSolicitacao = table.Column<string>(type: "TEXT", nullable: false),
                    DataHoraSugerida = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TipoMarcacaoSugerida = table.Column<string>(type: "TEXT", nullable: false),
                    Justificativa = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    SolicitadoPorPessoaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    SolicitadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    AprovadoPorPessoaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    AprovadoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    MotivoDecisao = table.Column<string>(type: "TEXT", nullable: true),
                    MarcacaoGeradaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PontoAjustes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PontoFechamentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PessoaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Competencia = table.Column<string>(type: "TEXT", nullable: false),
                    FechadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    FechadoPorPessoaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PontoFechamentos", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PontoAjustes");

            migrationBuilder.DropTable(
                name: "PontoFechamentos");
        }
    }
}
