import { buildReport } from "../../../server/report.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = (await request.json()) as { gene?: string };
    const report = await buildReport(body?.gene);
    console.log(`report ${report.gene.symbol} ${Date.now() - started}ms`);
    return Response.json(report);
  } catch (error) {
    const status =
      typeof error === "object" && error && "status" in error && typeof error.status === "number"
        ? error.status
        : 500;
    const message = error instanceof Error ? error.message : "The report could not be built.";
    if (status >= 500) console.error(error);
    return Response.json({ error: message }, { status });
  }
}
