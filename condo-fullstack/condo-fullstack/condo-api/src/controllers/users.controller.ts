import { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { hashPassword } from "../utils/hash";
import { prisma } from "../config/prisma";

export async function listUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: { id: true, nome: true, email: true, role: true, apartamento: true, bloco: true, createdAt: true }
  });
  return res.json(users);
}

export async function createUser(req: Request, res: Response) {
  const { nome, email, senha, role, apartamento, bloco } = req.body as Record<string, any>;

  if (!nome || !email || !senha || !role) {
    return res.status(400).json({ message: "nome, email, senha e role sao obrigatorios" });
  }

  const created = await prisma.user.create({
    data: {
      nome,
      email,
      senhaHash: await hashPassword(senha),
      role: role as UserRole,
      apartamento,
      bloco
    },
    select: { id: true, nome: true, email: true, role: true, apartamento: true, bloco: true }
  });

  return res.status(201).json(created);
}
