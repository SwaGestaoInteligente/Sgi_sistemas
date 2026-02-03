import { Router } from "express";
import { auth } from "../middlewares/auth";
import { allowRoles } from "../middlewares/role";
import { listAvisos, createAviso } from "../controllers/avisos.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.get("/", auth, asyncHandler(listAvisos));
router.post("/", auth, allowRoles("SINDICO", "ADMINISTRADORA"), asyncHandler(createAviso));

export default router;
