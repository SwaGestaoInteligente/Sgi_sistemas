"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
exports.env = {
    PORT: process.env.PORT ? Number(process.env.PORT) : 3333,
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    JWT_SECRET: process.env.JWT_SECRET ?? ""
};
if (!exports.env.JWT_SECRET) {
    throw new Error("JWT_SECRET nao definido no .env");
}
