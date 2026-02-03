import { Router } from "express";
import { auth } from "../middlewares/auth";
import { allowRoles } from "../middlewares/role";
import { listReservas, createReserva, cancelReserva } from "../controllers/reservas.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", auth, asyncHandler(listReservas));
router.post("/", auth, allowRoles("MORADOR", "PORTEIRO", "SINDICO", "ADMINISTRADORA"), asyncHandler(createReserva));
router.patch(
  "/:id/cancelar",
  auth,
  allowRoles("MORADOR", "SINDICO", "ADMINISTRADORA", "PORTEIRO"),
  asyncHandler(cancelReserva)
);

export default router;
