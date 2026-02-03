"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAreas = listAreas;
exports.createArea = createArea;
const prisma_1 = require("../config/prisma");
async function listAreas(_req, res) {
    const areas = await prisma_1.prisma.areaComum.findMany({ orderBy: { createdAt: "desc" } });
    return res.json(areas);
}
async function createArea(req, res) {
    const { nome, descricao } = req.body;
    if (!nome || typeof nome !== "string") {
        return res.status(400).json({ message: "nome e obrigatorio" });
    }
    const area = await prisma_1.prisma.areaComum.create({ data: { nome, descricao: descricao } });
    return res.status(201).json(area);
}
