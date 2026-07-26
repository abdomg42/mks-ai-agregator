// Solde de crédits pour l'affichage — STUB (jalon auth + DB à venir).
// Au jalon 3 : somme du ledger `credit_ledger` de l'utilisateur connecté.
import { NextResponse } from "next/server";

import { getCreditBalance } from "@/lib/credits";

export const runtime = "nodejs";

export async function GET() {
  const balance = await getCreditBalance();
  return NextResponse.json({ balance });
}
