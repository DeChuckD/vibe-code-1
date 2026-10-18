import {
  gtexSafetyPanel,
  lungCellTypeContrast,
  resolveGene,
  searchSpatialDatasets,
  tcgaHeterogeneity,
} from "./sources.js";

const SYMBOL = /^[A-Za-z][A-Za-z0-9-]{0,14}$/;

export async function buildReport(rawGene) {
  const symbol = String(rawGene ?? "").trim().toUpperCase();
  if (!SYMBOL.test(symbol)) {
    throw httpError(400, "Enter a gene symbol such as EGFR, SFTPC, or NKX2-1.");
  }

  const gene = await resolveGene(symbol);
  const [datasets, cellTypes, safety, heterogeneity] = await Promise.all([
    settle(searchSpatialDatasets(), "GEO search failed."),
    settle(lungCellTypeContrast(gene.ensembl), "CELLxGENE cell-type query failed."),
    settle(gtexSafetyPanel(gene.symbol), "GTEx normal-tissue query failed."),
    settle(tcgaHeterogeneity(gene.entrez), "TCGA-LUAD expression query failed."),
  ]);

  const report = {
    gene,
    generatedAt: new Date().toISOString(),
    datasets: datasets.ok ? datasets.value : null,
    cellTypes: cellTypes.ok ? cellTypes.value : null,
    safety: safety.ok ? safety.value : null,
    heterogeneity: heterogeneity.ok ? heterogeneity.value : null,
    errors: {
      datasets: datasets.ok ? null : datasets.error,
      cellTypes: cellTypes.ok ? null : cellTypes.error,
      safety: safety.ok ? null : safety.error,
      heterogeneity: heterogeneity.ok ? null : heterogeneity.error,
    },
  };
  report.caveats = buildCaveats(report);
  return report;
}

function buildCaveats(report) {
  const lines = [
    "This page summarizes public research data. It is not a diagnosis, a prescription, or a decision about whether a gene is safe to drug.",
    "The cell-type comparison is the CZ CELLxGENE aggregate for lung (UBERON:0002048). Lesion cells are those annotated as lung adenocarcinoma (MONDO:0005061). Normal cells are those annotated normal (PATO:0000461). Nothing in that call checks that the normal cells came from the same patient as the lesion.",
    "Most of that aggregate is dissociated single-cell or single-nucleus RNA-seq, not a reanalysis of the spatial slides listed above. Visium and GeoMx spots mix several cells. Xenium, CosMx, and MERFISH measure a chosen gene panel, so a real dataset can still lack this gene.",
    "Cell-type rows follow the CELLxGENE ontology. A parent such as epithelial cell already contains its children, so the rows are overlapping descriptions rather than separate fractions of one sample.",
    "WMG mean expression is that portal's normalized mean. It is not TPM and it is not protein. Percent detected is the share of cells of that type with a count above zero.",
  ];

  const thin = (report.cellTypes?.rows ?? []).filter((row) => {
    const lesion = row.lesion?.cells ?? 0;
    const normal = row.normal?.cells ?? 0;
    return (row.lesion && lesion < 50) || (row.normal && normal < 50);
  });
  if (thin.length > 0) {
    lines.push(
      `${thin.map((row) => row.name).join(", ")} ${thin.length === 1 ? "has" : "have"} a compartment under 50 cells. Those percentages can move when the cohort or the annotation changes.`,
    );
  }

  const lesionCells = report.cellTypes?.lesionCells;
  const normalCells = report.cellTypes?.normalCells;
  if (lesionCells && normalCells && normalCells > lesionCells * 5) {
    lines.push(
      `The normal lung side of this aggregate has ${normalCells.toLocaleString("en-US")} cells against ${lesionCells.toLocaleString("en-US")} lung adenocarcinoma cells, so the normal estimate is the more stable of the two.`,
    );
  }

  lines.push(
    "The safety panel is GTEx v8 bulk RNA from tissue donors, a different assay and a different group of people from the tumor cohorts. A high bulk value can be one small cell population, and a low bulk value can hide a high signal in a rare cell type. RNA here is not protein and not a toxicity result.",
  );

  if (report.safety?.lungRank && report.safety.lungRank > 3) {
    lines.push(
      `Lung is rank ${report.safety.lungRank} of ${report.safety.tissueCount} GTEx tissues by median TPM, so this transcript is not restricted to lung in bulk normal RNA.`,
    );
  }

  const hotter = (report.safety?.panel ?? []).filter((tissue) => tissue.aboveLung).map((tissue) => tissue.label);
  if (hotter.length > 0) {
    lines.push(
      `${humanList(hotter)} ${hotter.length === 1 ? "has" : "have"} a higher GTEx median than lung. That is normal-organ RNA expression, not evidence of clinical toxicity.`,
    );
  }

  const spread = report.heterogeneity;
  if (spread) {
    lines.push(
      `Heterogeneity uses ${spread.n.toLocaleString("en-US")} TCGA-LUAD Pan-Cancer Atlas tumor RNA-seq profiles (RSEM, batch normalized). It is not spatial, and this profile does not include matched solid-tissue normals.`,
    );
    if (spread.cv != null && spread.cv >= 1) {
      lines.push(
        `The coefficient of variation across those tumors is ${spread.cv}, so a single summary value hides a wide sample-to-sample range.`,
      );
    }
  }

  const datasets = report.datasets?.datasets ?? [];
  lines.push(
    "The dataset list is a live NCBI GEO search for human series whose titles describe spatial profiling of lung adenocarcinoma or NSCLC. Studies filed under other words, or only as a BioProject, are missing. NSCLC series can mix adenocarcinoma with other histologies.",
  );
  const mixed = datasets.filter((dataset) => dataset.mixedCohort).map((dataset) => dataset.accession);
  if (mixed.length > 0) {
    lines.push(
      `${mixed.join(", ")} ${mixed.length === 1 ? "mentions" : "mention"} another disease in the GEO record, so the cohort may not be lung adenocarcinoma alone.`,
    );
  }
  if (datasets.length < 5) {
    lines.push("Fewer than five series passed the human spatial lung-cancer filter on this search.");
  }

  for (const message of Object.values(report.errors)) {
    if (message) lines.push(message);
  }

  return lines;
}

function humanList(items) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function settle(promise, fallback) {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error: fallback || error.message || "Request failed." }),
  );
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
