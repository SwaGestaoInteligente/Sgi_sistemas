"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const hash_1 = require("../utils/hash");
const jwt_1 = require("../utils/jwt");
const prisma_1 = require("../config/prisma");
async function login(req, res) {
    const { email, senha } = req.body;
    if (!email || !senha)
        return res.status(400).json({ message: "Email e senha sao obrigatorios" });
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user)
        return res.status(401).json({ message: "Credenciais invalidas" });
    const ok = await (0, hash_1.comparePassword)(senha, user.senhaHash);
    if (!ok)
        return res.status(401).json({ message: "Credenciais invalidas" });
    const token = (0, jwt_1.signToken)({ userId: user.id, role: user.role });
    return res.json({
        token,
        user: { id: user.id, nome: user.nome, email: user.email, role: user.role }
    });
}
