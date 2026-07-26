// Journalisation interne des générations — ANALYTICS INTERNE UNIQUEMENT.
//
// C'est ici qu'on enregistre quel modèle a réellement servi chaque
// génération (fallback inclus), pour comparer qualité/coût/latence entre
// modèles dans le temps. Règle non négociable : ces données ne doivent
// JAMAIS être renvoyées au client (ni dans une API, ni dans l'UI).
//
// Pour l'instant : log structuré JSON sur stdout serveur. Au jalon DB,
// persister dans une table `generation_model_stats` (ou équivalent).
import type { AttemptLog, Feature } from "./types";

export interface GenerationLogEvent {
  jobId: string;
  feature: Feature;
  /** Clé(s) interne(s) du/des modèle(s) ayant servi — jamais client-facing. */
  servedBy?: string;
  attempts: AttemptLog[];
  /** Poids de coût interne cumulé (absorbé par la plateforme). */
  internalCostWeight: number;
  /** Crédits réellement facturés à l'utilisateur (coût total de la feature). */
  creditsCharged: number;
  status: "done" | "error";
  /** Erreur réelle — serveur uniquement. */
  error?: string;
}

export function logGeneration(event: GenerationLogEvent): void {
  console.log(
    "[generation]",
    JSON.stringify({ at: new Date().toISOString(), ...event })
  );
}
