using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sgi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPoliticaCobrancaIndice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CorrecaoIndice",
                table: "PoliticasCobranca",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CorrecaoTipo",
                table: "PoliticasCobranca",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CorrecaoIndice",
                table: "PoliticasCobranca");

            migrationBuilder.DropColumn(
                name: "CorrecaoTipo",
                table: "PoliticasCobranca");
        }
    }
}
