import type { CellTypeRow, Compartment, Report } from "../types";

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export default function ReportView({ report }: { report: Report }) {
  return (
    <div className="report">
      <section className="identity">
        <p className="eyebrow">{report.gene.symbol}</p>
        <h2>{report.gene.name}</h2>
        <p className="ids">
          <span>{report.gene.ensembl}</span>
          <span>Entrez {report.gene.entrez}</span>
        </p>
        {report.gene.summary ? <p className="summary">{report.gene.summary}</p> : null}
      </section>

      <section className="block" id="datasets">
        <div className="block-head">
          <h2>Spatial datasets</h2>
          <p>Human GEO series for lung adenocarcinoma or NSCLC.</p>
        </div>
        {report.errors.datasets ? <p className="banner">{report.errors.datasets}</p> : null}
        {report.datasets ? (
          <>
            <p className="note">
              {report.datasets.datasets.length} series kept from {report.datasets.considered} GEO records.
              Expression in the next section is not calculated inside each slide. Open a series, download its RAW.tar, unpack it, and check three things.
            </p>
            <ol className="steps">
              <li>
                Confirm {report.gene.symbol} is in the feature list. Xenium, CosMx, and MERFISH measure a chosen panel, so the archive can omit it. Visium, GeoMx, and Stereo-seq usually include a broad transcriptome.
              </li>
              <li>
                Place the counts on the tissue image and note whether they sit in tumor epithelium, stroma, immune niches, or adjacent normal.
              </li>
              <li>
                Compare that pattern with the lesion-versus-normal bars in the next section. Those bars come from dissociated CELLxGENE data, not from these slides.
              </li>
            </ol>
            <div className="cards">
              {report.datasets.datasets.map((dataset) => (
                <article className="dataset" key={dataset.accession}>
                  <div className="tags">
                    <span>{dataset.assay}</span>
                    <span>{dataset.histology}</span>
                    {dataset.mentionsNormal ? <span className="tag-normal">Mentions normal tissue</span> : null}
                    {dataset.mixedCohort ? <span className="tag-warn">Mixed record</span> : null}
                  </div>
                  <h3>
                    <a href={dataset.url} target="_blank" rel="noreferrer">
                      {dataset.accession}
                    </a>
                  </h3>
                  <p className="dataset-title">{dataset.title}</p>
                  <p className="meta-line">
                    {dataset.samples != null ? `${dataset.samples} samples` : "Sample count unpublished"}
                    {dataset.published ? ` · ${dataset.published}` : ""}
                    {dataset.pubmedUrl ? (
                      <>
                        {" · "}
                        <a href={dataset.pubmedUrl} target="_blank" rel="noreferrer">
                          PubMed
                        </a>
                      </>
                    ) : null}
                  </p>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="block" id="cell-types">
        <div className="block-head">
          <h2>Lesion versus normal, by cell type</h2>
          <p>Lung adenocarcinoma against ontology-normal lung in CELLxGENE.</p>
        </div>
        {report.errors.cellTypes ? <p className="banner">{report.errors.cellTypes}</p> : null}
        {report.cellTypes ? (
          <>
            <p className="note">
              {formatNumber(report.cellTypes.lesionCells)} adenocarcinoma cells and{" "}
              {formatNumber(report.cellTypes.normalCells)} normal cells in the lung aggregate.
              Bars show the percent of cells with the gene detected.
            </p>
            {report.cellTypes.rows.length === 0 ? (
              <p className="banner">No lung cell type in this aggregate had enough cells to plot.</p>
            ) : (
              <div className="type-list">
                {report.cellTypes.rows.map((row) => (
                  <CellTypeCard key={row.id} row={row} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>

      <section className="block" id="safety">
        <div className="block-head">
          <h2>Normal-tissue safety panel</h2>
          <p>GTEx v8 median bulk TPM, including organs outside the lung.</p>
        </div>
        {report.errors.safety ? <p className="banner">{report.errors.safety}</p> : null}
        {report.safety ? (
          <>
            <p className="note">
              {report.safety.lungMedian == null
                ? "Lung was not in the GTEx tissue list for this gene."
                : `Lung median is ${formatNumber(report.safety.lungMedian, report.safety.lungMedian >= 10 ? 1 : 2)} TPM, rank ${report.safety.lungRank} of ${report.safety.tissueCount} tissues.`}
            </p>
            <div className="safety-layout">
              <div>
                {report.safety.panel.map((tissue) => (
                  <SafetyRow
                    key={tissue.id}
                    label={tissue.label}
                    median={tissue.median}
                    max={Math.max(...report.safety!.panel.map((item) => item.median), 0.01)}
                    lung={tissue.id === "Lung"}
                    flag={tissue.aboveLung}
                  />
                ))}
              </div>
              <aside>
                <h3>Highest tissues</h3>
                <ol>
                  {report.safety.highest.map((tissue) => (
                    <li key={tissue.id}>
                      <span>{tissue.label}</span>
                      <strong>{formatNumber(tissue.median, tissue.median >= 10 ? 1 : 2)}</strong>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          </>
        ) : null}
      </section>

      <section className="block" id="heterogeneity">
        <div className="block-head">
          <h2>Heterogeneity across samples</h2>
          <p>TCGA lung adenocarcinoma tumors, one RNA-seq profile each.</p>
        </div>
        {report.errors.heterogeneity ? <p className="banner">{report.errors.heterogeneity}</p> : null}
        {report.heterogeneity ? (
          <>
            <dl className="stats">
              <div>
                <dt>Tumors</dt>
                <dd>{formatNumber(report.heterogeneity.n)}</dd>
              </div>
              <div>
                <dt>Median</dt>
                <dd>{formatNumber(report.heterogeneity.median, 1)}</dd>
              </div>
              <div>
                <dt>IQR</dt>
                <dd>
                  {formatNumber(report.heterogeneity.q1, 1)}–{formatNumber(report.heterogeneity.q3, 1)}
                </dd>
              </div>
              <div>
                <dt>Range</dt>
                <dd>
                  {formatNumber(report.heterogeneity.min, 1)}–{formatNumber(report.heterogeneity.max, 1)}
                </dd>
              </div>
              <div>
                <dt>CV</dt>
                <dd>{report.heterogeneity.cv == null ? "—" : formatNumber(report.heterogeneity.cv, 2)}</dd>
              </div>
            </dl>
            <div className="hist" aria-hidden="true">
              {report.heterogeneity.bins.map((bin) => (
                <div className="hist-col" key={bin.label}>
                  <div
                    className="hist-bar"
                    style={{
                      height: `${(bin.count / Math.max(...report.heterogeneity!.bins.map((item) => item.count), 1)) * 100}%`,
                    }}
                  />
                  <span>{bin.label}</span>
                </div>
              ))}
            </div>
            <p className="note">Bins are on a log scale of {report.heterogeneity.unit}.</p>
          </>
        ) : null}
      </section>

      <section className="block caveats" id="caveats">
        <div className="block-head">
          <h2>Caveats</h2>
          <p>Written from this result, not a fixed disclaimer.</p>
        </div>
        <ol>
          {report.caveats.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function CellTypeCard({ row }: { row: CellTypeRow }) {
  return (
    <article className="type-card">
      <header>
        <h3>{row.name}</h3>
        {row.detectionDelta == null ? (
          <span>One side missing</span>
        ) : (
          <span className={row.detectionDelta >= 0 ? "delta up" : "delta down"}>
            {row.detectionDelta > 0 ? "+" : ""}
            {formatNumber(row.detectionDelta, 1)} pp in lesion
          </span>
        )}
      </header>
      <div className="pair">
        <CompartmentBar label="Lesion" tone="lesion" value={row.lesion} />
        <CompartmentBar label="Normal" tone="normal" value={row.normal} />
      </div>
    </article>
  );
}

function CompartmentBar({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "lesion" | "normal";
  value: Compartment | null;
}) {
  return (
    <div className={`compartment ${tone}`}>
      <div className="compartment-label">
        <span>{label}</span>
        <strong>{value ? `${formatNumber(value.percent, 1)}%` : "Not reported"}</strong>
      </div>
      <div className="track" aria-hidden="true">
        <div className="fill" style={{ width: `${Math.min(value?.percent ?? 0, 100)}%` }} />
      </div>
      <p>
          {value
            ? `mean ${formatNumber(value.mean, 2)} · ${formatNumber(value.cells)} cells`
            : "Fewer than 40 cells, so this percent is hidden"}
      </p>
    </div>
  );
}

function SafetyRow({
  label,
  median,
  max,
  lung,
  flag,
}: {
  label: string;
  median: number;
  max: number;
  lung: boolean;
  flag: boolean;
}) {
  return (
    <div className={`safety-row${lung ? " lung" : ""}${flag ? " above" : ""}`}>
      <div className="safety-name">
        <span>{label}</span>
        {flag ? <em>Above lung</em> : null}
      </div>
      <div className="track" aria-hidden="true">
        <div className="fill" style={{ width: `${(median / max) * 100}%` }} />
      </div>
      <strong>{formatNumber(median, median >= 10 ? 1 : 2)}</strong>
    </div>
  );
}
