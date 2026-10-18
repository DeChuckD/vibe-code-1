import cors from "cors";
import express from "express";
import { buildReport } from "../frontend/src/server/report.js";

const PORT = Number(process.env.PORT) || 4000;
const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  }),
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "alveus" });
});

app.post("/api/report", async (req, res) => {
  const started = Date.now();
  try {
    const report = await buildReport(req.body?.gene);
    console.log(`report ${report.gene.symbol} ${Date.now() - started}ms`);
    res.json(report);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: error.message || "The report could not be built." });
  }
});

app.listen(PORT, () => {
  console.log(`Alveus API listening on http://localhost:${PORT}`);
});
