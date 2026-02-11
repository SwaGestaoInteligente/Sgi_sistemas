using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sgi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCobrancaCreditoAcordoPolitica : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PrevisoesOrcamentarias_OrganizacaoId_PlanoContasId_Ano_Mes_Tipo",
                table: "PrevisoesOrcamentarias");

            migrationBuilder.DropIndex(
                name: "IX_MedidoresConsumo_OrganizacaoId",
                table: "MedidoresConsumo");

            migrationBuilder.DropIndex(
                name: "IX_MedidoresConsumo_UnidadeOrganizacionalId",
                table: "MedidoresConsumo");

            migrationBuilder.DropIndex(
                name: "IX_LeiturasConsumo_MedidorId",
                table: "LeiturasConsumo");

            migrationBuilder.DropIndex(
                name: "IX_LeiturasConsumo_OrganizacaoId",
                table: "LeiturasConsumo");

            migrationBuilder.DropIndex(
                name: "IX_LancamentosPagamentos_LancamentoFinanceiroId",
                table: "LancamentosPagamentos");

            migrationBuilder.DropIndex(
                name: "IX_LancamentosPagamentos_OrganizacaoId",
                table: "LancamentosPagamentos");

            migrationBuilder.DropIndex(
                name: "IX_AbonosFinanceiros_LancamentoFinanceiroId",
                table: "AbonosFinanceiros");

            migrationBuilder.DropIndex(
                name: "IX_AbonosFinanceiros_OrganizacaoId",
                table: "AbonosFinanceiros");

            migrationBuilder.AddColumn<Guid>(
                name: "AcordoId",
                table: "UnidadesCobrancas",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ParcelaNumero",
                table: "UnidadesCobrancas",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ParcelaTotal",
                table: "UnidadesCobrancas",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AcordosCobranca",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UnidadeOrganizacionalId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TotalOriginal = table.Column<decimal>(type: "TEXT", nullable: false),
                    Desconto = table.Column<decimal>(type: "TEXT", nullable: false),
                    TotalAcordo = table.Column<decimal>(type: "TEXT", nullable: false),
                    NumeroParcelas = table.Column<int>(type: "INTEGER", nullable: false),
                    DataPrimeiraParcela = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Observacao = table.Column<string>(type: "TEXT", nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AcordosCobranca", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AcordosParcelas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AcordoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CobrancaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Numero = table.Column<int>(type: "INTEGER", nullable: false),
                    Valor = table.Column<decimal>(type: "TEXT", nullable: false),
                    Vencimento = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    PagoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AcordosParcelas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PoliticasCobranca",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MultaPercentual = table.Column<decimal>(type: "TEXT", nullable: false),
                    JurosMensalPercentual = table.Column<decimal>(type: "TEXT", nullable: false),
                    CorrecaoMensalPercentual = table.Column<decimal>(type: "TEXT", nullable: false),
                    DiasCarencia = table.Column<int>(type: "INTEGER", nullable: false),
                    Ativo = table.Column<bool>(type: "INTEGER", nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PoliticasCobranca", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UnidadesCreditos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UnidadeOrganizacionalId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CobrancaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    PagamentoId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Tipo = table.Column<string>(type: "TEXT", nullable: false),
                    Valor = table.Column<decimal>(type: "TEXT", nullable: false),
                    DataMovimento = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Observacao = table.Column<string>(type: "TEXT", nullable: true),
                    EstornadoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    EstornoMotivo = table.Column<string>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnidadesCreditos", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AcordosCobranca");

            migrationBuilder.DropTable(
                name: "AcordosParcelas");

            migrationBuilder.DropTable(
                name: "PoliticasCobranca");

            migrationBuilder.DropTable(
                name: "UnidadesCreditos");

            migrationBuilder.DropColumn(
                name: "AcordoId",
                table: "UnidadesCobrancas");

            migrationBuilder.DropColumn(
                name: "ParcelaNumero",
                table: "UnidadesCobrancas");

            migrationBuilder.DropColumn(
                name: "ParcelaTotal",
                table: "UnidadesCobrancas");

            migrationBuilder.CreateIndex(
                name: "IX_PrevisoesOrcamentarias_OrganizacaoId_PlanoContasId_Ano_Mes_Tipo",
                table: "PrevisoesOrcamentarias",
                columns: new[] { "OrganizacaoId", "PlanoContasId", "Ano", "Mes", "Tipo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MedidoresConsumo_OrganizacaoId",
                table: "MedidoresConsumo",
                column: "OrganizacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_MedidoresConsumo_UnidadeOrganizacionalId",
                table: "MedidoresConsumo",
                column: "UnidadeOrganizacionalId");

            migrationBuilder.CreateIndex(
                name: "IX_LeiturasConsumo_MedidorId",
                table: "LeiturasConsumo",
                column: "MedidorId");

            migrationBuilder.CreateIndex(
                name: "IX_LeiturasConsumo_OrganizacaoId",
                table: "LeiturasConsumo",
                column: "OrganizacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_LancamentosPagamentos_LancamentoFinanceiroId",
                table: "LancamentosPagamentos",
                column: "LancamentoFinanceiroId");

            migrationBuilder.CreateIndex(
                name: "IX_LancamentosPagamentos_OrganizacaoId",
                table: "LancamentosPagamentos",
                column: "OrganizacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_AbonosFinanceiros_LancamentoFinanceiroId",
                table: "AbonosFinanceiros",
                column: "LancamentoFinanceiroId");

            migrationBuilder.CreateIndex(
                name: "IX_AbonosFinanceiros_OrganizacaoId",
                table: "AbonosFinanceiros",
                column: "OrganizacaoId");
        }
    }
}
