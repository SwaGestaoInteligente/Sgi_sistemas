import { Request, Response, NextFunction } from "express";

export type AppRole = "SINDICO" | "ADMINISTRADORA" | "MORADOR" | "PORTEIRO";

export function allowRoles(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { role?: AppRole } | undefined;
    if (!user) return res.status(401).json({ message: "Nao autenticado" });

    if (!user.role || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Sem permissao" });
    }

    return next();
  };
}
