-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledById" TEXT;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
