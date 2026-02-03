import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function listLogs(_req: Request, res: Response) {
  const logs = await prisma.logAuditoria.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return res.json(logs);
}
