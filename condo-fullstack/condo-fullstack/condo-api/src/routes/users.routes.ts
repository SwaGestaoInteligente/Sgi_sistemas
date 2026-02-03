import { Router } from "express";
import { auth } from "../middlewares/auth";
import { allowRoles } from "../middlewares/role";
import { listUsers, createUser } from "../controllers/users.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", auth, allowRoles("SINDICO", "ADMINISTRADORA"), asyncHandler(listUsers));
router.post("/", auth, allowRoles("SINDICO", "ADMINISTRADORA"), asyncHandler(createUser));

export default router;
