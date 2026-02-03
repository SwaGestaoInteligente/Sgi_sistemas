"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listReservas = listReservas;
exports.createReserva = createReserva;
exports.cancelReserva = cancelReserva;
const prisma_1 = require("../config/prisma");
function parseDateOnly(input) {
    const parsed = new Date(`${input}T00:00:00`);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return parsed;
}
function isValidTime(input) {
    return /^\d{2}:\d{2}$/.test(input);
}
async function listReservas(_req, res) {
    const reservas = await prisma_1.prisma.reserva.findMany({
        include: {
            area: { select: { id: true, nome: true } },
            morador: { select: { id: true, nome: true, apartamento: true, bloco: true } }
        },
        orderBy: { createdAt: "desc" }
    });
    return res.json(reservas);
}
async function createReserva(req, res) {
    const user = req.user;
    const { areaId, data, horarioInicio, horarioFim } = req.body;
    if (!user?.userId) {
        return res.status(401).json({ message: "Nao autenticado" });
    }
    if (!areaId || !data || !horarioInicio || !horarioFim) {
        return res.status(400).json({ message: "areaId, data, horarioInicio, horarioFim sao obrigatorios" });
    }
    if (!isValidTime(horarioInicio) || !isValidTime(horarioFim)) {
        return res.status(400).json({ message: "horarios devem estar no formato HH:MM" });
    }
    if (horarioInicio >= horarioFim) {
        return res.status(400).json({ message: "horarioInicio deve ser menor que horarioFim" });
    }
    const dataDia = parseDateOnly(data);
    if (!dataDia) {
        return res.status(400).json({ message: "data invalida (use AAAA-MM-DD)" });
    }
    const area = await prisma_1.prisma.areaComum.findUnique({ where: { id: areaId } });
    if (!area) {
        return res.status(404).json({ message: "Area nao encontrada" });
    }
    const conflict = await prisma_1.prisma.reserva.findFirst({
        where: {
            areaId,
            data: dataDia,
            status: { notIn: ["CANCELADA", "RESERVA CANCELADA"] },
            AND: [
                { horarioInicio: { lt: horarioFim } },
                { horarioFim: { gt: horarioInicio } }
            ]
        }
    });
    if (conflict) {
        return res.status(409).json({ message: "Ja existe reserva nesse horario para esta area" });
    }
    const reserva = await prisma_1.prisma.reserva.create({
        data: {
            areaId,
            moradorId: user.userId,
            data: dataDia,
            horarioInicio,
            horarioFim,
            status: "PENDENTE"
        }
    });
    return res.status(201).json(reserva);
}
async function cancelReserva(req, res) {
    const { id } = req.params;
    const user = req.user;
    if (!user?.userId) {
        return res.status(401).json({ message: "Nao autenticado" });
    }
    const reserva = await prisma_1.prisma.reserva.findUnique({ where: { id } });
    if (!reserva)
        return res.status(404).json({ message: "Reserva nao encontrada" });
    // MORADOR so pode cancelar a propria reserva
    if (user.role === "MORADOR" && reserva.moradorId !== user.userId) {
        return res.status(403).json({ message: "Voce so pode cancelar a propria reserva" });
    }
    const updated = await prisma_1.prisma.reserva.update({
        where: { id },
        data: { status: "CANCELADA" }
    });
    return res.json(updated);
}
