using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Sgi.Infrastructure.Data;

#nullable disable

namespace Sgi.Infrastructure.Migrations
{
    [DbContext(typeof(SgiDbContext))]
    [Migration("20260211233000_AddLancamentoPagamentos")]
    public partial class AddLancamentoPagamentos : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LancamentosPagamentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    LancamentoFinanceiroId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ValorPago = table.Column<decimal>(type: "TEXT", nullable: false),
                    DataPagamento = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ContaFinanceiraId = table.Column<Guid>(type: "TEXT", nullable: true),
                    FormaPagamento = table.Column<string>(type: "TEXT", nullable: true),
                    Referencia = table.Column<string>(type: "TEXT", nullable: true),
                    EstornadoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    EstornoMotivo = table.Column<string>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LancamentosPagamentos", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LancamentosPagamentos_OrganizacaoId",
                table: "LancamentosPagamentos",
                column: "OrganizacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_LancamentosPagamentos_LancamentoFinanceiroId",
                table: "LancamentosPagamentos",
                column: "LancamentoFinanceiroId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LancamentosPagamentos");
        }
    }
}
