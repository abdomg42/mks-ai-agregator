// Adaptateur fal.ai — implémentation réelle du ProviderAdapter.
// Exécute un modèle en mode queue et attend le résultat final
// (`subscribe` poll jusqu'à complétion). Le timeout est géré ici pour
// que le routeur bascule proprement sur le candidat suivant.
//
// Serveur uniquement : la clé FAL_KEY est lue dans lib/ai/fal.ts.
import { fal } from "@/lib/ai/fal";
import type { ProviderAdapter } from "@/lib/ai/types";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`provider timeout after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    );
  });
}

export const falAdapter: ProviderAdapter = {
  name: "fal",
  async run(modelId, input, timeoutMs) {
    // Note : si le timeout saute, la requête fal sous-jacente continue en
    // arrière-plan (pas d'annulation côté client SDK) — acceptable en dev,
    // le coût est absorbé côté plateforme de toute façon.
    const result = await withTimeout(
      fal.queue.subscribe(modelId, { input, logs: false }),
      timeoutMs
    );
    // Le SDK enveloppe dans { data, requestId } — on normalise à `data`.
    return (result as { data?: unknown }).data ?? result;
  },
};
