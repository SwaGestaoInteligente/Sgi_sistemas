"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAvisos = listAvisos;
exports.createAviso = createAviso;
const prisma_1 = require("../config/prisma");
async function listAvisos(_req, res) {
    const avisos = await prisma_1.prisma.aviso.findMany({ orderBy: { createdAt: "desc" } });
    return res.json(avisos);
}
async function createAviso(req, res) {
    const { titulo, conteudo } = req.body;
    if (!titulo || !conteudo)
        return res.status(400).json({ message: "titulo e conteudo obrigatorios" });
    const aviso = await prisma_1.prisma.aviso.create({ data: { titulo, conteudo } });
    return res.status(201).json(aviso);
}
