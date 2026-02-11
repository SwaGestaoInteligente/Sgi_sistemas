using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Sgi.Infrastructure.Data;

#nullable disable

namespace Sgi.Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(SgiDbContext))]
    [Migration("20260211210000_AddAbonosFinanceiros")]
    public partial class AddAbonosFinanceiros : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AbonosFinanceiros",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    LancamentoFinanceiroId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tipo = table.Column<string>(type: "TEXT", nullable: false),
                    Valor = table.Column<decimal>(type: "TEXT", nullable: false),
                    Percentual = table.Column<decimal>(type: "TEXT", nullable: true),
                    Motivo = table.Column<string>(type: "TEXT", nullable: false),
                    Observacao = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    DataSolicitacao = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DataAprovacao = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AbonosFinanceiros", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AbonosFinanceiros_OrganizacaoId",
                table: "AbonosFinanceiros",
                column: "OrganizacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_AbonosFinanceiros_LancamentoFinanceiroId",
                table: "AbonosFinanceiros",
                column: "LancamentoFinanceiroId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AbonosFinanceiros");
        }

        /// <inheritdoc />
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
            modelBuilder.HasAnnotation("ProductVersion", "8.0.0");

            modelBuilder.Entity("Sgi.Domain.Financeiro.AbonoFinanceiro", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("TEXT");

                    b.Property<DateTime?>("DataAprovacao")
                        .HasColumnType("TEXT");

                    b.Property<DateTime>("DataSolicitacao")
                        .HasColumnType("TEXT");

                    b.Property<Guid>("LancamentoFinanceiroId")
                        .HasColumnType("TEXT");

                    b.Property<string>("Motivo")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Observacao")
                        .HasColumnType("TEXT");

                    b.Property<Guid>("OrganizacaoId")
                        .HasColumnType("TEXT");

                    b.Property<decimal?>("Percentual")
                        .HasColumnType("TEXT");

                    b.Property<string>("Source")
                        .HasColumnType("TEXT");

                    b.Property<string>("Status")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Tipo")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<decimal>("Valor")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("LancamentoFinanceiroId");

                    b.HasIndex("OrganizacaoId");

                    b.ToTable("AbonosFinanceiros", (string)null);
                });
        }
    }
}
