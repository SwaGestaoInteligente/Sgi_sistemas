import { Router } from "express";
import { auth } from "../middlewares/auth";
import { allowRoles } from "../middlewares/role";
import { asyncHandler } from "../utils/asyncHandler";
import { listEntregas, createEntrega, marcarEntregue } from "../controllers/entregas.controller";

const router = Router();

router.get("/", auth, allowRoles("PORTEIRO", "SINDICO", "ADMINISTRADORA", "MORADOR"), asyncHandler(listEntregas));
router.post("/", auth, allowRoles("PORTEIRO", "SINDICO", "ADMINISTRADORA"), asyncHandler(createEntrega));
router.patch("/:id/entregar", auth, allowRoles("PORTEIRO", "SINDICO", "ADMINISTRADORA"), asyncHandler(marcarEntregue));

export default router;
