import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function listUnidades(_req: Request, res: Response) {
  const unidades = await prisma.unidade.findMany({
    include: {
      bloco: true,
      moradores: { select: { id: true, nome: true, email: true, role: true, ativo: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return res.json(unidades);
}

export async function createUnidade(req: Request, res: Response) {
  const { blocoId, numero } = req.body as { blocoId?: string; numero?: string };
  if (!blocoId || !numero) return res.status(400).json({ message: "blocoId e numero são obrigatórios" });

  const unidade = await prisma.unidade.create({
    data: { blocoId, numero }
  });

  return res.status(201).json(unidade);
}

export async function vincularMorador(req: Request, res: Response) {
  const { unidadeId, userId } = req.body as { unidadeId?: string; userId?: string };
  if (!unidadeId || !userId) return res.status(400).json({ message: "unidadeId e userId são obrigatórios" });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { unidadeId }
  });

  return res.json(user);
}

export async function ativarDesativarUser(req: Request, res: Response) {
  const { userId, ativo } = req.body as { userId?: string; ativo?: boolean };
  if (!userId || typeof ativo !== "boolean") return res.status(400).json({ message: "userId e ativo são obrigatórios" });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { ativo }
  });

  return res.json(user);
}
