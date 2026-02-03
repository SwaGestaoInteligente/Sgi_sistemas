import express from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middlewares/error";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", routes);
app.use(errorHandler);

export default app;
