import cors from "cors";
import express from "express";

const PORT = Number(process.env.PORT) || 4000;

const notes = [
  {
    id: "seed-1",
    author: "Mina",
    text: "The bakery on Pine opens at 7. Get there before the rye is gone.",
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
  {
    id: "seed-2",
    author: "Jules",
    text: "Prototype looks good. Ship the small version today.",
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: "seed-3",
    author: "Sam",
    text: "Rain until four. The walk home is nicer if you wait.",
    createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
  },
];

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  }),
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "fieldnote-api" });
});

app.get("/api/notes", (_req, res) => {
  res.json({ notes });
});

app.post("/api/notes", (req, res) => {
  const author = String(req.body?.author ?? "").trim();
  const text = String(req.body?.text ?? "").trim();

  if (!author || !text) {
    res.status(400).json({ error: "Name and note are both required." });
    return;
  }

  if (author.length > 40 || text.length > 280) {
    res.status(400).json({
      error: "Keep the name under 40 characters and the note under 280.",
    });
    return;
  }

  const note = {
    id: crypto.randomUUID(),
    author,
    text,
    createdAt: new Date().toISOString(),
  };

  notes.unshift(note);
  res.status(201).json({ note });
});

app.listen(PORT, () => {
  console.log(`Fieldnote API listening on http://localhost:${PORT}`);
});
