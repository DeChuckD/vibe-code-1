"use client";

import { FormEvent, useEffect, useState } from "react";

type Note = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function HomePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverUp, setServerUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadNotes() {
    try {
      const [notesRes, healthRes] = await Promise.all([
        fetch("/api/notes", { cache: "no-store" }),
        fetch("/api/health", { cache: "no-store" }),
      ]);

      if (!notesRes.ok) {
        throw new Error("Could not load the board.");
      }

      const data = (await notesRes.json()) as { notes: Note[] };
      setNotes(data.notes);
      setServerUp(healthRes.ok);
      setError(null);
    } catch {
      setServerUp(false);
      setError("The API is not responding. The Node server should be on port 4000.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, text }),
      });
      const data = (await response.json()) as { note?: Note; error?: string };

      if (!response.ok || !data.note) {
        throw new Error(data.error ?? "Could not save that note.");
      }

      setNotes((current) => [data.note as Note, ...current]);
      setText("");
      setServerUp(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            Fn
          </span>
          <span>Fieldnote</span>
        </div>
        <p className={serverUp ? "status up" : "status"}>
          <span className="dot" aria-hidden="true" />
          {serverUp ? "API connected" : "API offline"}
        </p>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Next.js frontend · Node API</p>
          <h1>A board for short notes.</h1>
          <p className="lede">
            This page is a Next.js app. The notes themselves live in a separate
            Node server. Pin a line and it is stored in memory until that
            server restarts.
          </p>
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <label>
            Name
            <input
              name="author"
              value={author}
              maxLength={40}
              autoComplete="nickname"
              placeholder="Ada"
              onChange={(event) => setAuthor(event.target.value)}
              required
            />
          </label>
          <label>
            Note
            <textarea
              name="text"
              value={text}
              maxLength={280}
              rows={4}
              placeholder="Leave something short."
              onChange={(event) => setText(event.target.value)}
              required
            />
          </label>
          <div className="composer-row">
            <span>{280 - text.length} characters left</span>
            <button type="submit" disabled={saving}>
              {saving ? "Pinning…" : "Pin note"}
            </button>
          </div>
        </form>
      </section>

      <section className="board" aria-live="polite">
        <div className="board-head">
          <h2>On the board</h2>
          <p>{loading ? "Loading" : `${notes.length} notes`}</p>
        </div>

        {error ? <p className="banner">{error}</p> : null}

        {loading ? (
          <div className="stack">
            <article className="card skeleton" />
            <article className="card skeleton" />
          </div>
        ) : (
          <div className="stack">
            {notes.map((note, index) => (
              <article className="card" key={note.id}>
                <header>
                  <strong>{note.author}</strong>
                  <span className="meta">
                    {index === 0 ? <span className="fresh">Newest</span> : null}
                    <time dateTime={note.createdAt}>{formatWhen(note.createdAt)}</time>
                  </span>
                </header>
                <p>{note.text}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
