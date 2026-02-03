import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function listAvisos(_req: Request, res: Response) {
  const avisos = await prisma.aviso.findMany({ orderBy: { createdAt: "desc" } });
  return res.json(avisos);
}

export async function createAviso(req: Request, res: Response) {
  const { titulo, conteudo } = req.body as Record<string, string>;
  if (!titulo || !conteudo) return res.status(400).json({ message: "titulo e conteudo obrigatorios" });

  const aviso = await prisma.aviso.create({ data: { titulo, conteudo } });
  return res.status(201).json(aviso);
}
