import { Request, Response } from "express";
import { prisma } from "../config/prisma";

type AuthUser = { userId: string; role: string };

export async function listVisitantes(_req: Request, res: Response) {
  const visitantes = await prisma.visitorLog.findMany({
    orderBy: { createdAt: "desc" }
  });
  return res.json(visitantes);
}

export async function createVisitante(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.userId) return res.status(401).json({ message: "Nao autenticado" });

  const { nome, documento, apartamento, bloco, dataEntrada, dataSaida } = req.body as Record<string, any>;
  if (!nome) return res.status(400).json({ message: "nome é obrigatório" });

  const visitante = await prisma.visitorLog.create({
    data: {
      nome,
      documento,
      apartamento,
      bloco,
      dataEntrada: dataEntrada ? new Date(dataEntrada) : undefined,
      dataSaida: dataSaida ? new Date(dataSaida) : undefined,
      createdById: user.userId
    }
  });

  return res.status(201).json(visitante);
}

export async function registrarSaida(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.userId) return res.status(401).json({ message: "Nao autenticado" });

  const { id } = req.params;
  const visitante = await prisma.visitorLog.update({
    where: { id },
    data: { dataSaida: new Date() }
  });
  return res.json(visitante);
}
