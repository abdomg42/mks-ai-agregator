// Adaptateur Runway — API officielle (https://docs.dev.runwayml.com).
// Modèle servi : gen4_turbo (image->vidéo).
//
// Schéma : POST /v1/image_to_video (Bearer + header de version
// `X-Runway-Version`) -> { id }, puis polling GET /v1/tasks/{id}
// -> status "SUCCEEDED" -> output[0] (URL).
//
// Clé : RUNWAY_API_KEY (https://dev.runwayml.com) — serveur uniquement.
import type { ProviderAdapter } from "../types";
import { ProviderError, getJson, pollUntilDone, postJson, requireEnv } from "./http";

const BASE_URL = "https://api.dev.runwayml.com";
// Version d'API requise par Runway dans un header dédié.
const API_VERSION = "2024-11-06";

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireEnv("RUNWAY_API_KEY")}`,
    "X-Runway-Version": API_VERSION,
  };
}

interface RunwayTask {
  id?: string;
  status?: string;
  failure?: string;
  output?: string[];
}

export const runwayAdapter: ProviderAdapter = {
  name: "runway",
  async run(modelId, input, timeoutMs) {
    const task = (await postJson(`${BASE_URL}/v1/image_to_video`, headers(), {
      model: modelId,
      ...input,
    })) as RunwayTask;
    if (!task.id) throw new ProviderError("runway: no task id in submit response");

    const videoUrl = await pollUntilDone<RunwayTask>({
      fetchStatus: () => getJson(`${BASE_URL}/v1/tasks/${task.id}`, headers()),
      extractDone: (s) => (s.status === "SUCCEEDED" && s.output?.[0] ? s.output[0] : null),
      extractError: (s) => (s.status === "FAILED" ? `runway task failed: ${s.failure ?? "unknown"}` : null),
      timeoutMs,
      intervalMs: 5000,
    });
    return { video: { url: videoUrl } };
  },
};
