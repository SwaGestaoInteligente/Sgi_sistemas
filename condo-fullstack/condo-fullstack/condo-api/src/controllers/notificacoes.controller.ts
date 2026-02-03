import { Request, Response } from "express";
import { prisma } from "../config/prisma";

type AuthUser = { userId: string; role: string };

export async function listNotificacoes(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.userId) return res.status(401).json({ message: "Nao autenticado" });

  const notificacoes = await prisma.notification.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" }
  });
  return res.json(notificacoes);
}

export async function marcarLida(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.userId) return res.status(401).json({ message: "Nao autenticado" });

  const { id } = req.params;
  const noti = await prisma.notification.update({
    where: { id },
    data: { lida: true }
  });
  return res.json(noti);
}
