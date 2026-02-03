"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = auth;
const jwt_1 = require("../utils/jwt");
function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Token ausente" });
    }
    const token = header.replace("Bearer ", "").trim();
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({ message: "Token invalido" });
    }
}
