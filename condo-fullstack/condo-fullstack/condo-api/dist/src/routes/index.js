"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const users_routes_1 = __importDefault(require("./users.routes"));
const areas_routes_1 = __importDefault(require("./areas.routes"));
const reservas_routes_1 = __importDefault(require("./reservas.routes"));
const avisos_routes_1 = __importDefault(require("./avisos.routes"));
const router = (0, express_1.Router)();
router.use("/auth", auth_routes_1.default);
router.use("/users", users_routes_1.default);
router.use("/areas", areas_routes_1.default);
router.use("/reservas", reservas_routes_1.default);
router.use("/avisos", avisos_routes_1.default);
exports.default = router;
