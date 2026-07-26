// Adaptateur Google Gemini — API officielle (https://ai.google.dev/gemini-api/docs/image-generation).
// Modèles servis : gemini-2.5-flash-image ("Nano Banana"),
// gemini-3-pro-image-preview ("Nano Banana Pro") — édition multi-images.
//
// Schéma : POST /v1beta/models/{model}:generateContent (header
// `x-goog-api-key`) ; l'image source + les références partent en parts
// inline_data ; la réponse rend des parts inlineData (base64), converties
// ici en data URIs (le stockage objet arrive au jalon DB).
// Une image par requête : la quantité est servie par requêtes parallèles.
//
// Clé : GOOGLE_API_KEY (https://aistudio.google.com/apikey) — serveur uniquement.
import type { ProviderAdapter } from "../types";
import { ProviderError, parseDataUri, postJson, requireEnv } from "./http";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
  }>;
}

async function runOne(modelId: string, input: Record<string, unknown>): Promise<string> {
  const prompt = String(input.prompt ?? "");
  const images = Array.isArray(input.images) ? (input.images as string[]) : [];

  const parts: unknown[] = [{ text: prompt }];
  for (const uri of images) {
    const parsed = parseDataUri(uri);
    if (!parsed) throw new ProviderError("google: http image inputs are not supported, data URI expected");
    parts.push({ inline_data: { mime_type: parsed.mime, data: parsed.data } });
  }

  const data = (await postJson(
    `${BASE_URL}/${modelId}:generateContent`,
    { "x-goog-api-key": requireEnv("GOOGLE_API_KEY") },
    { contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"] } }
  )) as GeminiResponse;

  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
      }
    }
  }
  throw new ProviderError("google: no image in generateContent response");
}

export const googleAdapter: ProviderAdapter = {
  name: "google",
  async run(modelId, input) {
    const count = Math.max(1, Number(input.quantity) || 1);
    const urls = await Promise.all(Array.from({ length: count }, () => runOne(modelId, input)));
    return { images: urls.map((url) => ({ url })) };
  },
};
