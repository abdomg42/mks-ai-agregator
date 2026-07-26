// Table de configuration du routage multi-modèles — le cœur de la couche
// d'orchestration ("generation-router"). C'est ICI, et nulle part ailleurs,
// qu'on décide quels modèles servent chaque fonctionnalité, sur quelle API
// OFFICIELLE ils sont appelés, dans quel ordre ils sont essayés, et combien
// ils coûtent en interne.
//
// Pas d'agrégateur : chaque candidat porte son `provider` (BFL, Google,
// ByteDance ARK, Kling, Runway, ElevenLabs) et le routeur le dispatche vers
// l'adaptateur correspondant (lib/ai/providers/). Changer de fournisseur ou
// de version de modèle = modifier UNE entrée ici.
//
// Règles :
// - Les `key`/`modelId` ne doivent JAMAIS apparaître côté client.
// - Le `costWeight` est un poids de coût INTERNE (comparaison coût/qualité/
//   latence entre modèles). L'utilisateur paie toujours le coût total de la
//   feature (lib/costs.ts, future table action_costs) quel que soit le
//   modèle ayant servi — la variance est absorbée par la plateforme.
// - ⚠️ Les modelId sont indicatifs : vérifier la doc de chaque fournisseur
//   (les versions évoluent vite) avant la mise en production.
import type { Feature, GenerationRequest, ProviderName, QualityTier } from "./types";
import { toBase64OrUrl } from "./providers/http";

export interface ModelCandidate {
  /** Clé interne — journalisation/analytics uniquement, JAMAIS exposée. */
  key: string;
  /** API officielle appelée pour ce candidat (voir lib/ai/providers/). */
  provider: ProviderName;
  /** Identifiant du modèle CHEZ SON FOURNISSEUR (endpoint ou model name). */
  modelId: string;
  costWeight: number;
  /** Nombre max d'images de référence acceptées (0 = elles seront ignorées). */
  maxReferences: number;
  timeoutMs: number;
  /** Niveau(x) de qualité servi(s) par ce candidat. */
  tiers: QualityTier[];
  buildInput(req: GenerationRequest): Record<string, unknown>;
  extractOutput(data: unknown): string[];
}

// --- Extracteurs tolérants : normalisent les réponses des adaptateurs vers
//     une simple liste d'URLs (les adaptateurs rendent tous la même forme
//     { images } / { video } / { audio }). ---

function asRecord(data: unknown): Record<string, unknown> {
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
}

function extractImageUrls(data: unknown): string[] {
  const images = asRecord(data).images;
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => asRecord(img).url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);
}

function extractVideoUrl(data: unknown): string[] {
  const video = asRecord(asRecord(data).video);
  return typeof video.url === "string" ? [video.url] : [];
}

function extractAudioUrl(data: unknown): string[] {
  const audio = asRecord(asRecord(data).audio);
  return typeof audio.url === "string" ? [audio.url] : [];
}

// --- Fabriques d'input : traduisent la GenerationRequest normalisée vers
//     le vocabulaire de l'API officielle de chaque fournisseur. ---

/** BFL Flux Kontext : une seule image d'entrée, base64 brut. L'adaptateur
 *  duplique la requête pour servir `quantity`. */
function bflEditInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: req.prompt,
    input_image: toBase64OrUrl(req.imageUrl),
    output_format: "jpeg",
    safety_tolerance: 2,
    quantity: req.quantity,
  };
}

/** Google Gemini image : l'image principale en tête, suivie des références,
 *  en parts inline_data (data URIs conservées). */
function googleEditInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: req.prompt,
    images: [req.imageUrl, ...req.referenceUrls],
    quantity: req.quantity,
  };
}

/** ByteDance Seedream (ARK) : édition multi-références, `size` accepte
 *  directement "1K"/"2K"/"4K". */
function seedreamEditInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: req.prompt,
    image: [req.imageUrl, ...req.referenceUrls],
    size: req.resolution,
    response_format: "url",
    quantity: req.quantity,
  };
}

/** Upscale via Seedream : ré-édition de la sortie à la résolution cible. */
function seedreamUpscaleInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: "enhance fine details and textures, ultra high resolution, keep the exact same composition",
    image: [req.imageUrl],
    size: req.resolution === "4K" ? "4K" : "2K",
    response_format: "url",
  };
}

/** Les durées demandées (4/8/12 s) sont mappées au plus proche supporté
 *  par les modèles vidéo (généralement 5 ou 10 s). */
function mapDuration(req: GenerationRequest): number {
  return (req.durationSeconds ?? 4) <= 6 ? 5 : 10;
}

/** ByteDance Seedance (ARK) : tâche `contents/generations` — les réglages
 *  passent en flags inline dans le texte (--ratio, --dur). */
function seedanceVideoInput(req: GenerationRequest): Record<string, unknown> {
  return {
    content: [
      { type: "text", text: `${req.prompt} --ratio ${req.aspectRatio} --dur ${mapDuration(req)}` },
      { type: "image_url", image_url: { url: req.imageUrl } },
    ],
  };
}

/** Kling officiel : image base64 ou URL ; les ratios 4:3/3:4 ne sont pas
 *  supportés par l'endpoint — repli sur le ratio cinéma le plus proche. */
function klingVideoInput(req: GenerationRequest): Record<string, unknown> {
  const ratio =
    req.aspectRatio === "16:9" || req.aspectRatio === "4:3"
      ? "16:9"
      : req.aspectRatio === "9:16" || req.aspectRatio === "3:4"
        ? "9:16"
        : "1:1";
  return {
    image: toBase64OrUrl(req.imageUrl),
    prompt: req.prompt,
    duration: String(mapDuration(req)),
    aspect_ratio: ratio,
  };
}

/** Runway officiel : ratios en pixels cibles, durée numérique. */
function runwayVideoInput(req: GenerationRequest): Record<string, unknown> {
  const ratio =
    req.aspectRatio === "16:9"
      ? "1280:720"
      : req.aspectRatio === "9:16"
        ? "720:1280"
        : req.aspectRatio === "4:3"
          ? "1104:832"
          : req.aspectRatio === "3:4"
            ? "832:1104"
            : "960:960";
  return {
    promptImage: req.imageUrl,
    promptText: req.prompt,
    ratio,
    duration: mapDuration(req),
  };
}

function ttsInput(req: GenerationRequest): Record<string, unknown> {
  return { text: req.narrationScript ?? "" };
}

// --- LE CATALOGUE : feature -> candidats par ordre de priorité. ---
// Le tri final tient compte du tier demandé ET du modèle éventuellement
// choisi par l'utilisateur (voir router.orderCandidates).

const IMAGE_TIMEOUT_MS = 3 * 60 * 1000;
const VIDEO_TIMEOUT_MS = 10 * 60 * 1000;

export const MODEL_CATALOG: Record<Feature, ModelCandidate[]> = {
  print_render: [
    {
      key: "edit-alpha-pro",
      provider: "bfl",
      modelId: "flux-kontext-max",
      costWeight: 8,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["pro"],
      buildInput: bflEditInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "edit-beta-pro",
      provider: "google",
      modelId: "gemini-3-pro-image-preview",
      costWeight: 6,
      maxReferences: 13,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: googleEditInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "edit-gamma",
      provider: "ark",
      modelId: "doubao-seedream-4-5-251128",
      costWeight: 3,
      maxReferences: 13,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: seedreamEditInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "edit-alpha",
      provider: "bfl",
      modelId: "flux-kontext-pro",
      costWeight: 4,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: bflEditInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "edit-beta",
      provider: "google",
      modelId: "gemini-2.5-flash-image",
      costWeight: 2,
      maxReferences: 13,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard"],
      buildInput: googleEditInput,
      extractOutput: extractImageUrls,
    },
  ],

  mood_swap: [
    {
      key: "edit-alpha",
      provider: "bfl",
      modelId: "flux-kontext-pro",
      costWeight: 4,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: bflEditInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "edit-gamma",
      provider: "ark",
      modelId: "doubao-seedream-4-5-251128",
      costWeight: 3,
      maxReferences: 13,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: seedreamEditInput,
      extractOutput: extractImageUrls,
    },
  ],

  object_swap: [
    {
      key: "edit-beta",
      provider: "google",
      modelId: "gemini-2.5-flash-image",
      costWeight: 2,
      maxReferences: 13,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: googleEditInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "edit-alpha",
      provider: "bfl",
      modelId: "flux-kontext-pro",
      costWeight: 4,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: bflEditInput,
      extractOutput: extractImageUrls,
    },
  ],

  upscale: [
    {
      key: "upscale-alpha",
      provider: "ark",
      modelId: "doubao-seedream-4-5-251128",
      costWeight: 3,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: seedreamUpscaleInput,
      extractOutput: extractImageUrls,
    },
  ],

  animate: [
    {
      key: "video-alpha",
      provider: "ark",
      modelId: "doubao-seedance-1-0-pro-250528",
      costWeight: 20,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["pro"],
      buildInput: seedanceVideoInput,
      extractOutput: extractVideoUrl,
    },
    {
      key: "video-beta-pro",
      provider: "kling",
      // ⚠️ Nom du modèle v3 à vérifier dans la console Kling — si l'API le
      // rejette, le fallback bascule automatiquement sur v2.5-turbo.
      modelId: "kling-v3",
      costWeight: 18,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: klingVideoInput,
      extractOutput: extractVideoUrl,
    },
    {
      key: "video-beta",
      provider: "kling",
      modelId: "kling-v2-5-turbo",
      costWeight: 15,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: klingVideoInput,
      extractOutput: extractVideoUrl,
    },
    {
      key: "video-gamma",
      provider: "runway",
      modelId: "gen4_turbo",
      costWeight: 15,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["standard"],
      buildInput: runwayVideoInput,
      extractOutput: extractVideoUrl,
    },
  ],

  lip_sync_narration: [
    {
      key: "tts-alpha",
      provider: "elevenlabs",
      modelId: "eleven_turbo_v2_5",
      costWeight: 2,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: ttsInput,
      extractOutput: extractAudioUrl,
    },
  ],
};
