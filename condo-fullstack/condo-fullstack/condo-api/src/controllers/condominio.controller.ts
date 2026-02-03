import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function getCondominio(_req: Request, res: Response) {
  const cond = await prisma.condominio.findFirst({
    include: {
      blocos: { include: { unidades: true } },
      configuracoes: true
    }
  });
  return res.json(cond);
}

export async function upsertCondominio(req: Request, res: Response) {
  const { id, nome, cnpj, endereco } = req.body as Record<string, any>;
  if (!nome) return res.status(400).json({ message: "nome é obrigatório" });

  const cond = await prisma.condominio.upsert({
    where: { id: id ?? "" },
    update: { nome, cnpj, endereco },
    create: { nome, cnpj, endereco }
  });
  return res.json(cond);
}

export async function saveConfigReserva(req: Request, res: Response) {
  const { condominioId, limitePorMes, antecedenciaDias, horarioInicio, horarioFim } = req.body as any;
  if (!condominioId) return res.status(400).json({ message: "condominioId é obrigatório" });

  const cfg = await prisma.configReserva.upsert({
    where: { condominioId },
    update: { limitePorMes, antecedenciaDias, horarioInicio, horarioFim },
    create: { condominioId, limitePorMes, antecedenciaDias, horarioInicio, horarioFim }
  });
  return res.json(cfg);
}
