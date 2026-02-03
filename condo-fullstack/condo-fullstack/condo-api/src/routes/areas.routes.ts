import { Router } from "express";
import { auth } from "../middlewares/auth";
import { allowRoles } from "../middlewares/role";
import { listAreas, createArea } from "../controllers/areas.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.get("/", auth, asyncHandler(listAreas));
router.post("/", auth, allowRoles("SINDICO", "ADMINISTRADORA"), asyncHandler(createArea));

export default router;
