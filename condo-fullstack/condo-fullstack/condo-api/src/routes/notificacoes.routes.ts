import { Router } from "express";
import { auth } from "../middlewares/auth";
import { allowRoles } from "../middlewares/role";
import { asyncHandler } from "../utils/asyncHandler";
import { listNotificacoes, marcarLida } from "../controllers/notificacoes.controller";

const router = Router();

router.get("/", auth, allowRoles("MORADOR", "SINDICO", "ADMINISTRADORA", "PORTEIRO"), asyncHandler(listNotificacoes));
router.patch("/:id/lida", auth, allowRoles("MORADOR", "SINDICO", "ADMINISTRADORA", "PORTEIRO"), asyncHandler(marcarLida));

export default router;
