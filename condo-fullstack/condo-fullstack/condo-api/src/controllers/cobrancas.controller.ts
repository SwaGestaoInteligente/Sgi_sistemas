import { Request, Response } from "express";
import { prisma } from "../config/prisma";

type AuthUser = { userId: string; role: string };

async function log(acao: string, entidade: string, entidadeId: string | undefined, userId?: string, before?: any, after?: any) {
  await prisma.logAuditoria.create({
    data: {
      acao,
      entidade,
      entidadeId,
      userId,
      before: before ? JSON.stringify(before) : undefined,
      after: after ? JSON.stringify(after) : undefined
    }
  });
}

export async function listCobrancas(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;

  const where =
    user?.role === "MORADOR"
      ? { unidade: { moradores: { some: { id: user.userId } } } }
      : {};

  const cobrancas = await prisma.cobranca.findMany({
    where,
    include: {
      unidade: { include: { bloco: true } },
      pagamentos: true
    },
    orderBy: { vencimento: "desc" }
  });
  return res.json(cobrancas);
}

export async function criarCobranca(req: Request, res: Response) {
  const { unidadeId, mesRef, valor, vencimento, boletoUrl, linhaDigitavel } = req.body as any;
  const user = (req as any).user as AuthUser | undefined;
  if (!unidadeId || !mesRef || !valor || !vencimento) {
    return res.status(400).json({ message: "unidadeId, mesRef, valor, vencimento são obrigatórios" });
  }

  const cobranca = await prisma.cobranca.create({
    data: {
      unidadeId,
      mesRef,
      valor,
      vencimento: new Date(vencimento),
      boletoUrl,
      linhaDigitavel
    }
  });

  await log("CRIAR_COBRANCA", "Cobranca", cobranca.id, user?.userId, undefined, cobranca);

  return res.status(201).json(cobranca);
}

export async function marcarPago(req: Request, res: Response) {
  const { id } = req.params;
  const { valor, comprovanteUrl } = req.body as any;
  const user = (req as any).user as AuthUser | undefined;

  const before = await prisma.cobranca.findUnique({ where: { id } });

  const updated = await prisma.cobranca.update({
    where: { id },
    data: { status: "PAGO" },
    include: { pagamentos: true }
  });

  await prisma.pagamento.create({
    data: {
      cobrancaId: id,
      valor: valor ?? updated.valor,
      comprovanteUrl
    }
  });

  await log("PAGAR_COBRANCA", "Cobranca", id, user?.userId, before, updated);

  return res.json(updated);
}
