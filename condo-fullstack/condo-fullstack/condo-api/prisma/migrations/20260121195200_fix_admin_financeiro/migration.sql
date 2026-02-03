-- DropForeignKey
ALTER TABLE "Bloco" DROP CONSTRAINT "Bloco_condominioId_fkey";

-- DropForeignKey
ALTER TABLE "Cobranca" DROP CONSTRAINT "Cobranca_unidadeId_fkey";

-- DropForeignKey
ALTER TABLE "ConfigReserva" DROP CONSTRAINT "ConfigReserva_condominioId_fkey";

-- DropForeignKey
ALTER TABLE "Pagamento" DROP CONSTRAINT "Pagamento_cobrancaId_fkey";

-- DropForeignKey
ALTER TABLE "Unidade" DROP CONSTRAINT "Unidade_blocoId_fkey";

-- AddForeignKey
ALTER TABLE "Bloco" ADD CONSTRAINT "Bloco_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unidade" ADD CONSTRAINT "Unidade_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "Bloco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigReserva" ADD CONSTRAINT "ConfigReserva_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
