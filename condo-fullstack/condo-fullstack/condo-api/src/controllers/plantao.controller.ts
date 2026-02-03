import { Request, Response } from "express";
import { prisma } from "../config/prisma";

type AuthUser = { userId: string; role: string };

export async function listPlantao(_req: Request, res: Response) {
  const notas = await prisma.shiftNote.findMany({
    include: { createdBy: { select: { id: true, nome: true, email: true } } },
    orderBy: { createdAt: "desc" }
  });
  return res.json(notas);
}

export async function createPlantao(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.userId) return res.status(401).json({ message: "Nao autenticado" });

  const { texto } = req.body as { texto?: string };
  if (!texto || !texto.trim()) return res.status(400).json({ message: "texto é obrigatório" });

  const nota = await prisma.shiftNote.create({
    data: {
      texto,
      createdById: user.userId
    }
  });

  return res.status(201).json(nota);
}
