const LUNG = "UBERON:0002048";
const LESION = "MONDO:0005061";
const NORMAL = "PATO:0000461";
const HUMAN = "NCBITaxon:9606";

const SPATIAL_WORDS = [
  "visium",
  "xenium",
  "cosmx",
  "geomx",
  "merfish",
  "stereo-seq",
  "stereo seq",
  "slide-seq",
  "spatial transcriptom",
  "spatial gene expression",
  "spatial molecular",
];

const ASSAYS = [
  ["cosmx", "CosMx SMI"],
  ["xenium", "Xenium"],
  ["visium", "Visium"],
  ["geomx", "GeoMx DSP"],
  ["merfish", "MERFISH"],
  ["stereo", "Stereo-seq"],
  ["slide-seq", "Slide-seq"],
];

const SAFETY_PANEL = [
  { id: "Lung", label: "Lung", vital: true, role: "Organ where these tumors arise" },
  { id: "Heart_Left_Ventricle", label: "Heart, left ventricle", vital: true },
  { id: "Heart_Atrial_Appendage", label: "Heart, atrial appendage", vital: true },
  { id: "Liver", label: "Liver", vital: true },
  { id: "Kidney_Cortex", label: "Kidney cortex", vital: true },
  { id: "Brain_Cortex", label: "Brain cortex", vital: true },
  { id: "Whole_Blood", label: "Whole blood", vital: true },
  { id: "Pancreas", label: "Pancreas", vital: false },
  { id: "Colon_Transverse", label: "Colon", vital: false },
  { id: "Stomach", label: "Stomach", vital: false },
  { id: "Skin_Sun_Exposed_Lower_leg", label: "Skin, sun exposed", vital: false },
  { id: "Muscle_Skeletal", label: "Skeletal muscle", vital: false },
  { id: "Spleen", label: "Spleen", vital: false },
  { id: "Esophagus_Mucosa", label: "Esophagus mucosa", vital: false },
  { id: "Small_Intestine_Terminal_Ileum", label: "Small intestine", vital: false },
];

const PREFERRED_TYPES = [
  "malignant",
  "neoplastic",
  "alveolar type 2",
  "type ii pneumocyte",
  "type 2 pneumocyte",
  "alveolar type 1",
  "type i pneumocyte",
  "pneumocyte",
  "club cell",
  "basal cell",
  "ciliated",
  "goblet",
  "epithelial cell of lung",
  "alveolar macrophage",
  "macrophage",
  "fibroblast",
  "myofibroblast",
  "t cell",
  "b cell",
  "natural killer",
  "dendritic",
  "endothelial",
  "smooth muscle",
  "secretory cell",
];

let datasetCache = null;
let datasetCacheAt = 0;

export async function resolveGene(symbol) {
  const url = new URL("https://mygene.info/v3/query");
  url.searchParams.set("q", `symbol:${symbol}`);
  url.searchParams.set("species", "human");
  url.searchParams.set("fields", "symbol,name,ensembl.gene,entrezgene,summary");
  url.searchParams.set("size", "5");

  const payload = await fetchJson(url);
  const hits = payload.hits ?? [];
  const hit = hits.find((item) => String(item.symbol).toUpperCase() === symbol);
  if (!hit) {
    throw httpError(404, `No human gene symbol matches ${symbol}.`);
  }

  const ensembl = ensemblId(hit.ensembl);
  const entrez = Number(hit.entrezgene);
  if (!ensembl || !Number.isInteger(entrez)) {
    throw httpError(404, `${symbol} did not resolve to an Ensembl and Entrez id.`);
  }

  return {
    symbol: hit.symbol,
    name: hit.name ?? symbol,
    ensembl,
    entrez,
    summary: trimText(hit.summary, 420),
  };
}

export async function searchSpatialDatasets() {
  if (datasetCache && Date.now() - datasetCacheAt < 60 * 60 * 1000) {
    return datasetCache;
  }

  const term =
    '(lung adenocarcinoma OR NSCLC OR "non-small cell lung") AND (visium OR xenium OR cosmx OR geomx OR merfish OR "spatial transcriptomics" OR "spatial transcriptome" OR stereo)';
  const search = await ncbi("esearch.fcgi", {
    db: "gds",
    retmode: "json",
    retmax: "40",
    term,
  });
  const ids = search.esearchresult?.idlist ?? [];
  const records = [];
  for (let index = 0; index < ids.length; index += 20) {
    if (index > 0) await delay(400);
    const summary = await ncbi("esummary.fcgi", {
      db: "gds",
      retmode: "json",
      id: ids.slice(index, index + 20).join(","),
    });
    const result = summary.result ?? {};
    for (const uid of result.uids ?? []) {
      records.push(result[uid]);
    }
  }

  const datasets = rankDatasets(records.map(normalizeDataset).filter(Boolean)).slice(0, 10);
  const payload = {
    source: "NCBI GEO",
    retrievedAt: new Date().toISOString(),
    considered: records.length,
    datasets,
  };
  datasetCache = payload;
  datasetCacheAt = Date.now();
  return payload;
}

export async function lungCellTypeContrast(ensembl) {
  const filter = {
    gene_ontology_term_ids: [ensembl],
    organism_ontology_term_id: HUMAN,
    disease_ontology_term_ids: [LESION, NORMAL],
  };
  const [compared, named] = await Promise.all([
    wmg("query", { filter, compare: "disease" }),
    wmg("query", { filter }),
  ]);

  const lung = compared.expression_summary?.[ensembl]?.[LUNG];
  if (!lung) {
    return {
      source: "CZ CELLxGENE Where is my gene",
      snapshotId: compared.snapshot_id ?? null,
      lesionCells: null,
      normalCells: null,
      rows: [],
    };
  }

  const names = cellTypeNames(named.term_id_labels?.cell_types?.[LUNG]);
  const root = lung["CL:0000000"] ?? {};
  const rows = [];
  for (const [id, payload] of Object.entries(lung)) {
    if (id === "tissue_stats" || id === "CL:0000000") continue;
    const name = names[id];
    if (!name || /^(cell|animal cell|native cell|eukaryotic cell|somatic cell|nucleate cell)$/i.test(name)) {
      continue;
    }
    const lesion = compartment(payload[LESION]);
    const normal = compartment(payload[NORMAL]);
    if (!lesion && !normal) continue;
    rows.push({
      id,
      name,
      lesion,
      normal,
      detectionDelta:
        lesion && normal ? round(lesion.percent - normal.percent, 1) : null,
    });
  }

  return {
    source: "CZ CELLxGENE Where is my gene",
    snapshotId: compared.snapshot_id ?? null,
    lesionCells: root[LESION]?.n ?? null,
    normalCells: root[NORMAL]?.n ?? null,
    rows: dropParentTypes(pickCellTypes(rows)),
  };
}

export async function gtexSafetyPanel(symbol) {
  const genePayload = await fetchJson(
    `https://gtexportal.org/api/v2/reference/gene?geneId=${encodeURIComponent(symbol)}&gencodeVersion=v26&genomeBuild=GRCh38%2Fhg38`,
  );
  const gene = (genePayload.data ?? []).find((item) => item.geneSymbolUpper === symbol.toUpperCase());
  if (!gene?.gencodeId) {
    throw new Error("GTEx has no v26 gene id for this symbol.");
  }

  const expression = await fetchJson(
    `https://gtexportal.org/api/v2/expression/medianGeneExpression?gencodeId=${encodeURIComponent(gene.gencodeId)}&datasetId=gtex_v8&itemsPerPage=100`,
  );
  const tissues = (expression.data ?? [])
    .filter((item) => Number.isFinite(item.median))
    .map((item) => ({
      id: item.tissueSiteDetailId,
      label: prettyTissue(item.tissueSiteDetailId),
      median: round(item.median, item.median >= 10 ? 1 : 2),
    }))
    .sort((a, b) => b.median - a.median);

  const lungIndex = tissues.findIndex((item) => item.id === "Lung");
  const lungMedian = lungIndex >= 0 ? tissues[lungIndex].median : null;
  const panel = SAFETY_PANEL.map((slot) => {
    const found = tissues.find((item) => item.id === slot.id);
    if (!found) return null;
    return {
      ...slot,
      median: found.median,
      aboveLung: lungMedian != null && slot.id !== "Lung" && found.median > lungMedian,
    };
  }).filter(Boolean);

  return {
    source: "GTEx v8 median TPM",
    gencodeId: gene.gencodeId,
    unit: "TPM",
    lungMedian,
    lungRank: lungIndex >= 0 ? lungIndex + 1 : null,
    tissueCount: tissues.length,
    panel,
    highest: tissues.slice(0, 5),
  };
}

export async function tcgaHeterogeneity(entrez) {
  const profile = "luad_tcga_pan_can_atlas_2018_rna_seq_v2_mrna";
  const rows = await fetchJson(
    `https://www.cbioportal.org/api/molecular-profiles/${profile}/molecular-data?entrezGeneId=${entrez}&sampleListId=${profile}`,
  );
  const values = (Array.isArray(rows) ? rows : [])
    .map((row) => Number(row.value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (values.length === 0) {
    throw new Error("cBioPortal returned no TCGA-LUAD RNA values for this gene.");
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return {
    source: "TCGA-LUAD Pan-Cancer Atlas via cBioPortal",
    profile,
    unit: "RSEM, batch normalized",
    n: values.length,
    min: round(values[0], 1),
    q1: round(quantile(values, 0.25), 1),
    median: round(quantile(values, 0.5), 1),
    q3: round(quantile(values, 0.75), 1),
    max: round(values[values.length - 1], 1),
    mean: round(mean, 1),
    cv: mean === 0 ? null : round(Math.sqrt(variance) / mean, 2),
    bins: histogram(values),
  };
}

function rankDatasets(datasets) {
  return datasets
    .map((dataset) => ({ ...dataset, score: datasetScore(dataset) }))
    .sort((a, b) => b.score - a.score || b.samples - a.samples)
    .map(({ score, ...dataset }) => dataset);
}

function normalizeDataset(record) {
  const accession = record?.accession;
  const title = String(record?.title ?? "").trim();
  const summary = String(record?.summary ?? "").replace(/\s+/g, " ").trim();
  const taxon = record?.taxon ?? "";
  if (!accession?.startsWith("GSE") || taxon !== "Homo sapiens" || !title) return null;

  const titleL = title.toLowerCase();
  const text = `${titleL} ${summary.toLowerCase()}`;
  if (!SPATIAL_WORDS.some((word) => titleL.includes(word)) && !titleL.includes("spatial")) return null;
  if (!/(lung adenocarcinoma|\bluad\b|non-small cell lung|\bnsclc\b|lung cancer)/.test(text)) return null;
  if (/(brain metasta|squamous cell|pancreatic|renal cell|cholangiocarcinoma|bronchiolitis|neuroendocrine|scrna-seq data)/.test(titleL)) {
    return null;
  }
  if (/(?<!non-)small cell/.test(titleL)) return null;

  const pubmedIds = Array.isArray(record.pubmedids) ? record.pubmedids : [];
  const assay = ASSAYS.find(([needle]) => text.includes(needle))?.[1] ?? "Spatial transcriptomics";
  const histology = /lung adenocarcinoma|\bluad\b/.test(titleL)
    ? "Lung adenocarcinoma"
    : /non-small cell|\bnsclc\b/.test(text)
      ? "NSCLC"
      : "Lung cancer";

  return {
    accession,
    title,
    summary: trimText(summary, 280),
    assay,
    histology,
    samples: Number(record.n_samples) || null,
    published: record.pdat || null,
    mentionsNormal: /normal lung|matched normal|adjacent normal|normal tissue|precursor lesion|normal tissues/.test(text),
    mixedCohort: /\b(dlbcl|breast cancer|melanoma|colon cancer|pancreatic|prostate cancer|ovarian cancer)\b/.test(text),
    url: `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${accession}`,
    pubmedUrl: pubmedIds[0] ? `https://pubmed.ncbi.nlm.nih.gov/${pubmedIds[0]}/` : null,
  };
}

function datasetScore(dataset) {
  const title = dataset.title.toLowerCase();
  let score = 0;
  if (dataset.histology === "Lung adenocarcinoma") score += 5;
  if (dataset.histology === "NSCLC") score += 3;
  if (dataset.mentionsNormal) score += 3;
  if (/pre-invasive|precursor|stage i/.test(title)) score += 2;
  if (dataset.assay !== "Spatial transcriptomics") score += 1;
  if (dataset.mixedCohort) score -= 3;
  return score;
}

function cellTypeNames(tree) {
  const names = {};
  if (!tree) return names;
  for (const [id, node] of Object.entries(tree)) {
    const name = node?.aggregated?.name;
    if (typeof name === "string" && name && !/^(normal|lung adenocarcinoma)$/i.test(name)) {
      names[id] = name;
    }
  }
  return names;
}

function compartment(value) {
  // Fewer than 40 cells makes a percent look more precise than it is.
  if (!value || !Number.isFinite(value.n) || value.n < 40) return null;
  return {
    mean: round(value.me, 2),
    percent: round((value.pc ?? 0) * 100, 1),
    cells: value.n,
  };
}

function nameMatches(name, phrase) {
  const normalized = name.toLowerCase();
  if (!normalized.includes(phrase)) return false;
  const otherLineage = ["fibroblast", "endothelial", "pericyte", "muscle", "neuron"];
  return !otherLineage.some((word) => normalized.includes(word) && !phrase.includes(word));
}

function dropParentTypes(rows) {
  return rows.filter(
    (row) =>
      !rows.some(
        (other) =>
          other.id !== row.id &&
          other.name.toLowerCase().includes(row.name.toLowerCase()) &&
          other.name.length > row.name.length,
      ),
  );
}

function pickCellTypes(rows) {
  const used = new Set();
  const picked = [];
  for (const phrase of PREFERRED_TYPES) {
    const matches = rows
      .filter((row) => !used.has(row.id) && nameMatches(row.name, phrase))
      .sort((a, b) => a.name.length - b.name.length);
    if (!matches[0]) continue;
    used.add(matches[0].id);
    picked.push(matches[0]);
    if (picked.length === 10) return picked;
  }
  if (picked.length >= 6) return picked;

  const rest = rows
    .filter((row) => !used.has(row.id))
    .sort((a, b) => Math.max(b.lesion?.cells ?? 0, b.normal?.cells ?? 0) - Math.max(a.lesion?.cells ?? 0, a.normal?.cells ?? 0));
  for (const row of rest) {
    picked.push(row);
    if (picked.length === 8) break;
  }
  return picked;
}

function prettyTissue(id) {
  const parts = String(id).split("_");
  if (parts.length === 1) return parts[0];
  return `${parts[0]}, ${parts.slice(1).join(" ").toLowerCase()}`;
}

function quantile(sorted, probability) {
  const position = (sorted.length - 1) * probability;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return sorted[low];
  return sorted[low] * (high - position) + sorted[high] * (position - low);
}

function histogram(values) {
  const bins = 10;
  const logs = values.filter((value) => value > 0).map((value) => Math.log10(value));
  if (logs.length === 0) return [];
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  const span = max - min || 1;
  const counts = Array.from({ length: bins }, () => 0);
  for (const value of logs) {
    let index = Math.floor(((value - min) / span) * bins);
    if (index >= bins) index = bins - 1;
    counts[index] += 1;
  }
  return counts.map((count, index) => {
    const start = 10 ** (min + (span * index) / bins);
    const end = 10 ** (min + (span * (index + 1)) / bins);
    return { label: `${compact(start)}–${compact(end)}`, count };
  });
}

function compact(value) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  if (value >= 10) return String(Math.round(value));
  return String(Math.round(value * 10) / 10);
}

function ensemblId(ensembl) {
  if (!ensembl) return null;
  if (Array.isArray(ensembl)) return ensembl[0]?.gene ?? null;
  return ensembl.gene ?? null;
}

async function wmg(path, body) {
  return fetchJson(`https://api.cellxgene.cziscience.com/wmg/v2/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    timeout: 25000,
  });
}

async function ncbi(endpoint, params) {
  const url = new URL(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${endpoint}`);
  url.searchParams.set("tool", "alveus");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return fetchJson(url, { timeout: 25000 });
}

async function fetchJson(url, options = {}) {
  const timeout = options.timeout ?? 20000;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: options.method,
        headers: {
          Accept: "application/json",
          "User-Agent": "alveus/0.1",
          ...(options.headers ?? {}),
        },
        body: options.body,
        signal: AbortSignal.timeout(timeout),
      });
      if (response.status === 429 && attempt < 2) {
        await delay(700 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        throw new Error(`Upstream ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await delay(400 * (attempt + 1));
        continue;
      }
    }
  }
  throw lastError ?? new Error("Upstream request failed");
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function round(value, digits) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function trimText(value, max) {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
