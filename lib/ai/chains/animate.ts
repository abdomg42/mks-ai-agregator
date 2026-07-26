// Chaîne Animate — pipeline composé, invisible pour l'utilisateur :
//   1. image -> modèle vidéo (priorité + fallback, comme le pipeline image)
//   2. script de narration -> modèle TTS (optionnel)
//   3. merge vidéo + audio côté serveur (ffmpeg)
// Le frontend reçoit UN SEUL résultat (une URL vidéo) et UN SEUL coût en
// crédits, même si 2-3 modèles + ffmpeg ont tourné derrière.
import { MODEL_CATALOG, type ModelCandidate } from "../catalog";
import {
  executeWithFallback,
  orderCandidates,
  type RouterDeps,
  type StageCallback,
} from "../router";
import type { AttemptLog, GenerationRequest, GenerationResult } from "../types";
import { FfmpegUnavailableError, mergeVideoAudio } from "../media";

export async function runAnimateChain(
  req: GenerationRequest,
  onStage: StageCallback | undefined,
  deps: RouterDeps
): Promise<GenerationResult> {
  // Étape 1 : image -> vidéo.
  onStage?.("video");
  const videoCandidates =
    deps.candidatesOverride ?? orderCandidates(MODEL_CATALOG.animate, req.quality);
  const video = await executeWithFallback("animate", videoCandidates, req, deps);

  let finalUrl = video.outputUrls[0];
  let servedBy = video.winner.key;
  const attempts: AttemptLog[] = [...video.attempts];

  // Étapes 2-3 : narration + merge (uniquement si un script est fourni —
  // la légende auto est construite en amont par la route si besoin).
  if (req.narrationScript?.trim()) {
    onStage?.("narration");
    const ttsCandidates: ModelCandidate[] = orderCandidates(
      MODEL_CATALOG.lip_sync_narration,
      req.quality
    );
    const narrationReq: GenerationRequest = { ...req, feature: "lip_sync_narration" };
    const audio = await executeWithFallback(
      "lip_sync_narration",
      ttsCandidates,
      narrationReq,
      deps
    );
    attempts.push(...audio.attempts);
    servedBy = `${servedBy}+${audio.winner.key}`;

    onStage?.("merging");
    try {
      finalUrl = await mergeVideoAudio(finalUrl, audio.outputUrls[0]);
    } catch (err) {
      // Dégradation gracieuse : si ffmpeg est indisponible (ou le merge
      // échoue), on livre la vidéo muette plutôt qu'un échec complet.
      // Loggé côté serveur ; à brancher sur un remboursement partiel de
      // crédits quand le ledger existera.
      if (!(err instanceof FfmpegUnavailableError)) {
        console.error("narration merge failed:", err);
      } else {
        console.error("narration skipped: ffmpeg is not installed");
      }
    }
  }

  return { kind: "video", outputUrls: [finalUrl], servedBy, attempts };
}
