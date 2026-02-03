import { Request, Response } from "express";
import { comparePassword } from "../utils/hash";
import { signToken } from "../utils/jwt";
import { prisma } from "../config/prisma";

export async function login(req: Request, res: Response) {
  const { email, senha } = req.body as { email?: string; senha?: string };

  if (!email || !senha) return res.status(400).json({ message: "Email e senha sao obrigatorios" });

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) return res.status(401).json({ message: "Credenciais invalidas" });

  const ok = await comparePassword(senha, user.senhaHash);
  if (!ok) return res.status(401).json({ message: "Credenciais invalidas" });

  const token = signToken({ userId: user.id, role: user.role });
  return res.json({
    token,
    user: { id: user.id, nome: user.nome, email: user.email, role: user.role }
  });
}
