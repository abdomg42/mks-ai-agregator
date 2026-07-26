// Adaptateur Black Forest Labs — API officielle Flux (https://docs.bfl.ai).
// Modèles servis : flux-kontext-pro, flux-kontext-max (édition image->image).
//
// Schéma : POST /v1/{model} (header `x-key`) -> { id, polling_url }, puis
// polling de polling_url jusqu'à status "Ready" -> result.sample (URL).
// BFL ne produit qu'UNE image par requête : la quantité demandée est servie
// par des requêtes parallèles.
//
// Clé : BFL_API_KEY (https://dashboard.bfl.ai) — serveur uniquement.
import type { ProviderAdapter } from "../types";
import { ProviderError, pollUntilDone, postJson, getJson, requireEnv } from "./http";

const BASE_URL = "https://api.bfl.ml";

function headers(): Record<string, string> {
  return { "x-key": requireEnv("BFL_API_KEY") };
}

interface BflPollResult {
  status?: string;
  result?: { sample?: string };
}

async function runOne(modelId: string, input: Record<string, unknown>, timeoutMs: number): Promise<string> {
  const submit = (await postJson(`${BASE_URL}/v1/${modelId}`, headers(), input)) as {
    id?: string;
    polling_url?: string;
  };
  const pollingUrl = submit.polling_url ?? (submit.id ? `${BASE_URL}/v1/get_result?id=${submit.id}` : null);
  if (!pollingUrl) throw new ProviderError("bfl: no polling_url in submit response");

  const sample = (await pollUntilDone<BflPollResult>({
    fetchStatus: () => getJson(pollingUrl, headers()),
    extractDone: (s) => (s.status === "Ready" && s.result?.sample ? s.result.sample : null),
    extractError: (s) =>
      s.status && s.status !== "Pending" && s.status !== "Ready" ? `bfl task ${s.status}` : null,
    timeoutMs,
  })) as string;
  return sample;
}

export const bflAdapter: ProviderAdapter = {
  name: "bfl",
  async run(modelId, input, timeoutMs) {
    const { quantity, ...payload } = input;
    const count = Math.max(1, Number(quantity) || 1);
    // Requêtes parallèles : chaque appel produit une variante.
    const urls = await Promise.all(
      Array.from({ length: count }, () => runOne(modelId, payload, timeoutMs))
    );
    // Forme normalisée attendue par l'extracteur du catalogue.
    return { images: urls.map((url) => ({ url })) };
  },
};
