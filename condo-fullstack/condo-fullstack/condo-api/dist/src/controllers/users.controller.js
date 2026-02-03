"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.createUser = createUser;
const hash_1 = require("../utils/hash");
const prisma_1 = require("../config/prisma");
async function listUsers(_req, res) {
    const users = await prisma_1.prisma.user.findMany({
        select: { id: true, nome: true, email: true, role: true, apartamento: true, bloco: true, createdAt: true }
    });
    return res.json(users);
}
async function createUser(req, res) {
    const { nome, email, senha, role, apartamento, bloco } = req.body;
    if (!nome || !email || !senha || !role) {
        return res.status(400).json({ message: "nome, email, senha e role sao obrigatorios" });
    }
    const created = await prisma_1.prisma.user.create({
        data: {
            nome,
            email,
            senhaHash: await (0, hash_1.hashPassword)(senha),
            role: role,
            apartamento,
            bloco
        },
        select: { id: true, nome: true, email: true, role: true, apartamento: true, bloco: true }
    });
    return res.status(201).json(created);
}
