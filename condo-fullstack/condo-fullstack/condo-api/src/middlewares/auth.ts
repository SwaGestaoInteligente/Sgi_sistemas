import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente" });
  }

  const token = header.replace("Bearer ", "").trim();

  try {
    const payload = verifyToken(token);
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Token invalido" });
  }
}
