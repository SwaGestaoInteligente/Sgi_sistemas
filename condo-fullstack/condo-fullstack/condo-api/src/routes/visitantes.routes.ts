import { Router } from "express";
import { auth } from "../middlewares/auth";
import { allowRoles } from "../middlewares/role";
import { asyncHandler } from "../utils/asyncHandler";
import { listVisitantes, createVisitante, registrarSaida } from "../controllers/visitantes.controller";

const router = Router();

router.get("/", auth, allowRoles("PORTEIRO", "SINDICO", "ADMINISTRADORA"), asyncHandler(listVisitantes));
router.post("/", auth, allowRoles("PORTEIRO", "SINDICO", "ADMINISTRADORA"), asyncHandler(createVisitante));
router.patch("/:id/saida", auth, allowRoles("PORTEIRO", "SINDICO", "ADMINISTRADORA"), asyncHandler(registrarSaida));

export default router;
