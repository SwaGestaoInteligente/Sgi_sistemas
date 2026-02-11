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
    [Migration("20260210211500_AddPrevisaoOrcamentaria")]
    public partial class AddPrevisaoOrcamentaria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PrevisoesOrcamentarias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PlanoContasId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tipo = table.Column<string>(type: "TEXT", nullable: false),
                    Ano = table.Column<int>(type: "INTEGER", nullable: false),
                    Mes = table.Column<int>(type: "INTEGER", nullable: false),
                    ValorPrevisto = table.Column<decimal>(type: "TEXT", nullable: false),
                    Observacao = table.Column<string>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrevisoesOrcamentarias", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PrevisoesOrcamentarias_OrganizacaoId_PlanoContasId_Ano_Mes_Tipo",
                table: "PrevisoesOrcamentarias",
                columns: new[] { "OrganizacaoId", "PlanoContasId", "Ano", "Mes", "Tipo" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PrevisoesOrcamentarias");
        }

        /// <inheritdoc />
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
            modelBuilder.HasAnnotation("ProductVersion", "8.0.0");

            modelBuilder.Entity("Sgi.Domain.Financeiro.PrevisaoOrcamentaria", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("TEXT");

                    b.Property<int>("Ano")
                        .HasColumnType("INTEGER");

                    b.Property<int>("Mes")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Observacao")
                        .HasColumnType("TEXT");

                    b.Property<Guid>("OrganizacaoId")
                        .HasColumnType("TEXT");

                    b.Property<Guid>("PlanoContasId")
                        .HasColumnType("TEXT");

                    b.Property<string>("Source")
                        .HasColumnType("TEXT");

                    b.Property<string>("Tipo")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<decimal>("ValorPrevisto")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("OrganizacaoId", "PlanoContasId", "Ano", "Mes", "Tipo")
                        .IsUnique();

                    b.ToTable("PrevisoesOrcamentarias", (string)null);
                });
        }
    }
}
