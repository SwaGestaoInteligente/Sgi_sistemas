import { Request, Response } from "express";
import { prisma } from "../config/prisma";

type AuthUser = { userId: string; role: string };

export async function listEntregas(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  const where =
    user?.role === "MORADOR"
      ? {
          OR: [
            { destinatarioId: user.userId },
            { destinatarioEmail: (await prisma.user.findUnique({ where: { id: user.userId } }))?.email }
          ]
        }
      : {};

  const entregas = await prisma.delivery.findMany({
    where,
    include: {
      destinatario: { select: { id: true, nome: true, email: true, apartamento: true, bloco: true } },
      createdBy: { select: { id: true, nome: true, email: true } },
      notificacoes: { select: { id: true, lida: true } }
    },
    orderBy: { chegouEm: "desc" }
  });
  return res.json(entregas);
}

export async function createEntrega(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.userId) return res.status(401).json({ message: "Nao autenticado" });

  const { descricao, destinatarioEmail, fotoUrl } = req.body as Record<string, any>;
  if (!descricao) return res.status(400).json({ message: "descricao é obrigatória" });

  let destinatarioId: string | undefined;
  if (destinatarioEmail) {
    const destinatario = await prisma.user.findUnique({ where: { email: destinatarioEmail } });
    destinatarioId = destinatario?.id;
  }

  const entrega = await prisma.delivery.create({
    data: {
      descricao,
      destinatarioEmail,
      fotoUrl,
      createdById: user.userId,
      destinatarioId
    }
  });

  if (destinatarioId) {
    await prisma.notification.create({
      data: {
        titulo: "Entrega na portaria",
        mensagem: descricao,
        imageUrl: fotoUrl,
        userId: destinatarioId,
        deliveryId: entrega.id
      }
    });
  }

  return res.status(201).json(entrega);
}

export async function marcarEntregue(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.userId) return res.status(401).json({ message: "Nao autenticado" });

  const { id } = req.params;
  const { assinaturaUrl } = req.body as { assinaturaUrl?: string };

  const entrega = await prisma.delivery.update({
    where: { id },
    data: {
      status: "ENTREGUE",
      entregueEm: new Date(),
      assinaturaUrl
    }
  });

  return res.json(entrega);
}
