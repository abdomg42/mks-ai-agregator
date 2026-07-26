// Adaptateur ByteDance Volcano Engine ModelArk — API officielle
// (https://docs.volcengine.com). Modèles servis :
// - doubao-seedream-*  : édition image->image multi-références (/images/generations,
//                        OpenAI-compatible, réponse synchrone) ;
// - doubao-seedance-*  : image->vidéo (/contents/generations/tasks + polling).
//
// L'adaptateur distingue image/vidéo à la forme de l'input construit par le
// catalogue : présence de `content` => tâche vidéo, sinon génération d'image.
//
// Clé : ARK_API_KEY (console Volcano Engine) — serveur uniquement.
// ARK_BASE_URL optionnel (région) — défaut : Beijing.
import type { ProviderAdapter } from "../types";
import { ProviderError, getJson, pollUntilDone, postJson, requireEnv } from "./http";

function baseUrl(): string {
  return process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3";
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${requireEnv("ARK_API_KEY")}` };
}

interface ArkImagesResponse {
  data?: Array<{ url?: string }>;
}

interface ArkTask {
  id?: string;
  status?: string;
  content?: { video_url?: string };
  error?: { message?: string };
}

async function runImages(modelId: string, input: Record<string, unknown>): Promise<unknown> {
  const { quantity, ...payload } = input;
  const count = Math.max(1, Number(quantity) || 1);
  const urls = await Promise.all(
    Array.from({ length: count }, async () => {
      const data = (await postJson(
        `${baseUrl()}/images/generations`,
        headers(),
        { model: modelId, ...payload }
      )) as ArkImagesResponse;
      const url = data.data?.[0]?.url;
      if (!url) throw new ProviderError("ark: no image url in response");
      return url;
    })
  );
  return { images: urls.map((url) => ({ url })) };
}

async function runVideo(modelId: string, input: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  const task = (await postJson(
    `${baseUrl()}/contents/generations/tasks`,
    headers(),
    { model: modelId, ...input }
  )) as ArkTask;
  if (!task.id) throw new ProviderError("ark: no task id in submit response");

  const videoUrl = await pollUntilDone<ArkTask>({
    fetchStatus: () => getJson(`${baseUrl()}/contents/generations/tasks/${task.id}`, headers()),
    extractDone: (s) => (s.status === "succeeded" && s.content?.video_url ? s.content.video_url : null),
    extractError: (s) =>
      s.status === "failed" ? `ark task failed: ${s.error?.message ?? "unknown"}` : null,
    timeoutMs,
    intervalMs: 5000,
  });
  return { video: { url: videoUrl } };
}

export const arkAdapter: ProviderAdapter = {
  name: "ark",
  async run(modelId, input, timeoutMs) {
    return "content" in input ? runVideo(modelId, input, timeoutMs) : runImages(modelId, input);
  },
};
