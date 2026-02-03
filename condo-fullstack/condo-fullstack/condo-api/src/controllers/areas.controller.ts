import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function listAreas(_req: Request, res: Response) {
  const areas = await prisma.areaComum.findMany({ orderBy: { createdAt: "desc" } });
  return res.json(areas);
}

export async function createArea(req: Request, res: Response) {
  const { nome, descricao } = req.body as Record<string, unknown>;
  if (!nome || typeof nome !== "string") {
    return res.status(400).json({ message: "nome e obrigatorio" });
  }

  const area = await prisma.areaComum.create({ data: { nome, descricao: descricao as string | undefined } });
  return res.status(201).json(area);
}
