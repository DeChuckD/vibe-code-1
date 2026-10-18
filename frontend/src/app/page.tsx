"use client";

import { FormEvent, useState } from "react";
import ReportView from "../components/Report";
import type { Report } from "../types";

const EXAMPLES = ["EGFR", "SFTPC", "NKX2-1", "KRAS"];
const SYMBOL = /^[A-Za-z][A-Za-z0-9-]{0,14}$/;

export default function HomePage() {
  const [gene, setGene] = useState("EGFR");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(symbol: string) {
    const next = symbol.trim().toUpperCase();
    if (!SYMBOL.test(next)) {
      setError("Use a gene symbol such as EGFR or SFTPC.");
      return;
    }
    setGene(next);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gene: next }),
      });
      const payload = (await response.json()) as Report & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "The report could not be built.");
      }
      setReport(payload);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "The report could not be built.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(gene);
  }

  return (
    <main className="page">
      <header className="mast">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            Al
          </span>
          <span>Alveus</span>
        </div>
        <p>Lung adenocarcinoma · public data</p>
      </header>

      <section className="intro">
        <p className="eyebrow">Spatial transcriptomics report</p>
        <h1>Ask for a gene. Read the lesion, the normal lung, and the rest of the body.</h1>
        <p className="lede">
          Alveus looks up human spatial series for lung adenocarcinoma, then places that gene in
          cell types from lesion and normal lung, in a normal-organ panel, and across TCGA tumors.
        </p>
        <form onSubmit={onSubmit}>
          <label>
            Gene symbol
            <input
              name="gene"
              value={gene}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={15}
              onChange={(event) => setGene(event.target.value.toUpperCase())}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Gathering public data…" : "Build report"}
          </button>
        </form>
        <div className="examples">
          {EXAMPLES.map((example) => (
            <button key={example} type="button" className="chip" onClick={() => void run(example)} disabled={loading}>
              {example}
            </button>
          ))}
        </div>
        {error ? <p className="banner">{error}</p> : null}
        {loading ? (
          <p className="note">Checking GEO, CELLxGENE, GTEx, and TCGA. The first search takes a few seconds.</p>
        ) : null}
      </section>

      {report ? <ReportView report={report} /> : null}
    </main>
  );
}
