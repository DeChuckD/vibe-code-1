export type Compartment = {
  mean: number | null;
  percent: number | null;
  cells: number;
};

export type CellTypeRow = {
  id: string;
  name: string;
  lesion: Compartment | null;
  normal: Compartment | null;
  detectionDelta: number | null;
};

export type Dataset = {
  accession: string;
  title: string;
  summary: string;
  assay: string;
  histology: string;
  samples: number | null;
  published: string | null;
  mentionsNormal: boolean;
  mixedCohort: boolean;
  url: string;
  pubmedUrl: string | null;
};

export type Report = {
  gene: {
    symbol: string;
    name: string;
    ensembl: string;
    entrez: number;
    summary: string;
  };
  generatedAt: string;
  datasets: {
    source: string;
    retrievedAt: string;
    considered: number;
    datasets: Dataset[];
  } | null;
  cellTypes: {
    source: string;
    snapshotId: number | null;
    lesionCells: number | null;
    normalCells: number | null;
    rows: CellTypeRow[];
  } | null;
  safety: {
    source: string;
    gencodeId: string;
    unit: string;
    lungMedian: number | null;
    lungRank: number | null;
    tissueCount: number;
    panel: Array<{
      id: string;
      label: string;
      vital: boolean;
      role?: string;
      median: number;
      aboveLung: boolean;
    }>;
    highest: Array<{ id: string; label: string; median: number }>;
  } | null;
  heterogeneity: {
    source: string;
    profile: string;
    unit: string;
    n: number;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    mean: number;
    cv: number | null;
    bins: Array<{ label: string; count: number }>;
  } | null;
  errors: {
    datasets: string | null;
    cellTypes: string | null;
    safety: string | null;
    heterogeneity: string | null;
  };
  caveats: string[];
};
