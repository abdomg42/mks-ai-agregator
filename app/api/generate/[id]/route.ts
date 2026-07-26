// Polling du statut d'un job : le client appelle cette route toutes les
// ~2,5 s jusqu'à "done" (avec outputUrls) ou "error" (message GÉNÉRIQUE).
// Aucun détail de fournisseur/modèle ne transite ici — uniquement le
// contenu du job store (lib/jobs/store.ts).
import { NextRequest, NextResponse } from "next/server";

import { getJob } from "@/lib/jobs/store";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const job = getJob(params.id);
  if (!job) {
    return NextResponse.json(
      { status: "error", error: "Generation failed, please try again." },
      { status: 404 }
    );
  }

  if (job.status === "done") {
    return NextResponse.json({
      status: "done",
      kind: job.kind,
      outputUrls: job.outputUrls ?? [],
    });
  }
  if (job.status === "error") {
    return NextResponse.json({
      status: "error",
      error: job.errorMessage ?? "Generation failed, please try again.",
    });
  }
  // pending / processing : le client repollera.
  return NextResponse.json({ status: job.status, stage: job.stage });
}
