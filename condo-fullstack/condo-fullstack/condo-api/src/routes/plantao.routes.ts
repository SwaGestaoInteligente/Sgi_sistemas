import { Router } from "express";
import { auth } from "../middlewares/auth";
import { allowRoles } from "../middlewares/role";
import { asyncHandler } from "../utils/asyncHandler";
import { listPlantao, createPlantao } from "../controllers/plantao.controller";

const router = Router();

router.get("/", auth, allowRoles("PORTEIRO", "SINDICO", "ADMINISTRADORA"), asyncHandler(listPlantao));
router.post("/", auth, allowRoles("PORTEIRO", "SINDICO", "ADMINISTRADORA"), asyncHandler(createPlantao));

export default router;
