"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowRoles = allowRoles;
function allowRoles(...roles) {
    return (req, res, next) => {
        const user = req.user;
        if (!user)
            return res.status(401).json({ message: "Nao autenticado" });
        if (!user.role || !roles.includes(user.role)) {
            return res.status(403).json({ message: "Sem permissao" });
        }
        return next();
    };
}
