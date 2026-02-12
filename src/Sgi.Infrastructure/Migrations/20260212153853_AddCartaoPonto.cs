using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sgi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCartaoPonto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PontoMarcacoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PessoaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UnidadeOrganizacionalId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Nsr = table.Column<long>(type: "INTEGER", nullable: false),
                    DataHoraMarcacao = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Tipo = table.Column<string>(type: "TEXT", nullable: false),
                    Origem = table.Column<string>(type: "TEXT", nullable: false),
                    Observacao = table.Column<string>(type: "TEXT", nullable: true),
                    HashComprovante = table.Column<string>(type: "TEXT", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PontoMarcacoes", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PontoMarcacoes");
        }
    }
}
