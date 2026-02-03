import { Router } from "express";
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import areasRoutes from "./areas.routes";
import reservasRoutes from "./reservas.routes";
import avisosRoutes from "./avisos.routes";
import visitantesRoutes from "./visitantes.routes";
import entregasRoutes from "./entregas.routes";
import plantaoRoutes from "./plantao.routes";
import notificacoesRoutes from "./notificacoes.routes";
import adminRoutes from "./admin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/areas", areasRoutes);
router.use("/reservas", reservasRoutes);
router.use("/avisos", avisosRoutes);
router.use("/visitantes", visitantesRoutes);
router.use("/entregas", entregasRoutes);
router.use("/plantao", plantaoRoutes);
router.use("/notificacoes", notificacoesRoutes);
router.use("/admin", adminRoutes);

export default router;
