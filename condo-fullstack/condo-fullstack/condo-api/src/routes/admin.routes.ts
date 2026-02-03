import { Router } from "express";
import { auth } from "../middlewares/auth";
import { allowRoles } from "../middlewares/role";
import { asyncHandler } from "../utils/asyncHandler";
import { getCondominio, upsertCondominio, saveConfigReserva } from "../controllers/condominio.controller";
import { listUnidades, createUnidade, vincularMorador, ativarDesativarUser } from "../controllers/unidades.controller";
import { listCobrancas, criarCobranca, marcarPago } from "../controllers/cobrancas.controller";
import { listLogs } from "../controllers/logs.controller";

const router = Router();

// Condo/config
router.get("/condominio", auth, allowRoles("ADMINISTRADORA", "SINDICO"), asyncHandler(getCondominio));
router.post("/condominio", auth, allowRoles("ADMINISTRADORA"), asyncHandler(upsertCondominio));
router.post("/condominio/config-reserva", auth, allowRoles("ADMINISTRADORA", "SINDICO"), asyncHandler(saveConfigReserva));

// Unidades / usuários
router.get("/unidades", auth, allowRoles("ADMINISTRADORA", "SINDICO"), asyncHandler(listUnidades));
router.post("/unidades", auth, allowRoles("ADMINISTRADORA"), asyncHandler(createUnidade));
router.post("/unidades/vincular", auth, allowRoles("ADMINISTRADORA", "SINDICO"), asyncHandler(vincularMorador));
router.post("/usuarios/ativar", auth, allowRoles("ADMINISTRADORA", "SINDICO"), asyncHandler(ativarDesativarUser));

// Cobranças
router.get("/cobrancas", auth, allowRoles("ADMINISTRADORA", "SINDICO", "MORADOR"), asyncHandler(listCobrancas));
router.post("/cobrancas", auth, allowRoles("ADMINISTRADORA"), asyncHandler(criarCobranca));
router.post("/cobrancas/:id/pagar", auth, allowRoles("ADMINISTRADORA", "SINDICO"), asyncHandler(marcarPago));

// Logs
router.get("/logs", auth, allowRoles("ADMINISTRADORA", "SINDICO"), asyncHandler(listLogs));

export default router;
