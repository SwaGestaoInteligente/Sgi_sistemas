import { Request, Response } from "express";
import { prisma } from "../config/prisma";

type AuthUser = { userId: string; role: string };

function parseDateOnly(input: string) {
  const parsed = new Date(`${input}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isValidTime(input: string) {
  return /^\d{2}:\d{2}$/.test(input);
}

function isPastDate(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export async function listReservas(req: Request, res: Response) {
  const reservas = await prisma.reserva.findMany({
    include: {
      area: { select: { id: true, nome: true } },
      morador: { select: { id: true, nome: true, apartamento: true, bloco: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return res.json(reservas);
}

export async function createReserva(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  const { areaId, data, horarioInicio, horarioFim, moradorId, moradorEmail } = req.body as Record<string, string>;

  if (!user?.userId) {
    return res.status(401).json({ message: "Nao autenticado" });
  }

  if (!areaId || !data || !horarioInicio || !horarioFim) {
    return res.status(400).json({ message: "areaId, data, horarioInicio, horarioFim sao obrigatorios" });
  }

  if (!isValidTime(horarioInicio) || !isValidTime(horarioFim)) {
    return res.status(400).json({ message: "horarios devem estar no formato HH:MM" });
  }

  if (horarioInicio >= horarioFim) {
    return res.status(400).json({ message: "horarioInicio deve ser menor que horarioFim" });
  }

  const dataDia = parseDateOnly(data);
  if (!dataDia) {
    return res.status(400).json({ message: "data invalida (use AAAA-MM-DD)" });
  }

  if (isPastDate(dataDia)) {
    return res.status(400).json({ message: "nao e permitido criar reserva no passado" });
  }

  const area = await prisma.areaComum.findUnique({ where: { id: areaId } });
  if (!area) {
    return res.status(404).json({ message: "Area nao encontrada" });
  }

  let targetMoradorId = user.userId;
  if (user.role === "PORTEIRO" || user.role === "SINDICO" || user.role === "ADMINISTRADORA") {
    if (moradorId) {
      targetMoradorId = moradorId;
    } else if (moradorEmail) {
      const morador = await prisma.user.findUnique({ where: { email: moradorEmail } });
      if (!morador) {
        return res.status(404).json({ message: "Morador nao encontrado pelo email informado" });
      }
      targetMoradorId = morador.id;
    }
  }

  // Morador comum nao pode alterar o alvo
  if (user.role === "MORADOR") {
    targetMoradorId = user.userId;
  }

  const conflict = await prisma.reserva.findFirst({
    where: {
      areaId,
      data: dataDia,
      status: { notIn: ["CANCELADA", "RESERVA CANCELADA"] },
      AND: [
        { horarioInicio: { lt: horarioFim } },
        { horarioFim: { gt: horarioInicio } }
      ]
    }
  });

  if (conflict) {
    return res.status(409).json({ message: "Ja existe reserva nesse horario para esta area" });
  }

  const reserva = await prisma.reserva.create({
    data: {
      areaId,
      moradorId: targetMoradorId,
      data: dataDia,
      horarioInicio,
      horarioFim,
      status: "PENDENTE"
    }
  });

  return res.status(201).json(reserva);
}

export async function cancelReserva(req: Request, res: Response) {
  const { id } = req.params;
  const user = (req as any).user as AuthUser | undefined;
  const { motivo } = req.body as { motivo?: string };

  if (!user?.userId) {
    return res.status(401).json({ message: "Nao autenticado" });
  }

  if (!motivo || !motivo.trim()) {
    return res.status(400).json({ message: "Informe o motivo do cancelamento" });
  }

  const reserva = await prisma.reserva.findUnique({ where: { id } });
  if (!reserva) return res.status(404).json({ message: "Reserva nao encontrada" });

  // MORADOR so pode cancelar a propria reserva
  if (user.role === "MORADOR" && reserva.moradorId !== user.userId) {
    return res.status(403).json({ message: "Voce so pode cancelar a propria reserva" });
  }

  const updated = await prisma.reserva.update({
    where: { id },
    data: { status: "CANCELADA", cancelReason: motivo, cancelledById: user.userId }
  });

  return res.json(updated);
}
