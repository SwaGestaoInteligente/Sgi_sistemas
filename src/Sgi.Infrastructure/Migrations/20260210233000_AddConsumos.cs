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
    [Migration("20260210233000_AddConsumos")]
    public partial class AddConsumos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MedidoresConsumo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UnidadeOrganizacionalId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Nome = table.Column<string>(type: "TEXT", nullable: false),
                    Tipo = table.Column<string>(type: "TEXT", nullable: false),
                    UnidadeMedida = table.Column<string>(type: "TEXT", nullable: false),
                    NumeroSerie = table.Column<string>(type: "TEXT", nullable: true),
                    Ativo = table.Column<bool>(type: "INTEGER", nullable: false),
                    Observacao = table.Column<string>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MedidoresConsumo", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LeiturasConsumo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrganizacaoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MedidorId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Competencia = table.Column<string>(type: "TEXT", nullable: false),
                    DataLeitura = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LeituraAtual = table.Column<decimal>(type: "TEXT", nullable: false),
                    LeituraAnterior = table.Column<decimal>(type: "TEXT", nullable: false),
                    Consumo = table.Column<decimal>(type: "TEXT", nullable: false),
                    Observacao = table.Column<string>(type: "TEXT", nullable: true),
                    Source = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeiturasConsumo", x => x.Id);
                });

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeiturasConsumo");

            migrationBuilder.DropTable(
                name: "MedidoresConsumo");
        }

        /// <inheritdoc />
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
            modelBuilder.HasAnnotation("ProductVersion", "8.0.0");

            modelBuilder.Entity("Sgi.Domain.Financeiro.MedidorConsumo", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("TEXT");

                    b.Property<bool>("Ativo")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Nome")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("NumeroSerie")
                        .HasColumnType("TEXT");

                    b.Property<string>("Observacao")
                        .HasColumnType("TEXT");

                    b.Property<Guid>("OrganizacaoId")
                        .HasColumnType("TEXT");

                    b.Property<string>("Source")
                        .HasColumnType("TEXT");

                    b.Property<string>("Tipo")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<Guid>("UnidadeOrganizacionalId")
                        .HasColumnType("TEXT");

                    b.Property<string>("UnidadeMedida")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("OrganizacaoId");

                    b.HasIndex("UnidadeOrganizacionalId");

                    b.ToTable("MedidoresConsumo", (string)null);
                });

            modelBuilder.Entity("Sgi.Domain.Financeiro.LeituraConsumo", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("TEXT");

                    b.Property<string>("Competencia")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<decimal>("Consumo")
                        .HasColumnType("TEXT");

                    b.Property<DateTime>("DataLeitura")
                        .HasColumnType("TEXT");

                    b.Property<decimal>("LeituraAnterior")
                        .HasColumnType("TEXT");

                    b.Property<decimal>("LeituraAtual")
                        .HasColumnType("TEXT");

                    b.Property<Guid>("MedidorId")
                        .HasColumnType("TEXT");

                    b.Property<string>("Observacao")
                        .HasColumnType("TEXT");

                    b.Property<Guid>("OrganizacaoId")
                        .HasColumnType("TEXT");

                    b.Property<string>("Source")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("MedidorId");

                    b.HasIndex("OrganizacaoId");

                    b.ToTable("LeiturasConsumo", (string)null);
                });
        }
    }
}
