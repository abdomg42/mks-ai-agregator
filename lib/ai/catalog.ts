// Table de configuration du routage multi-modèles — le cœur de la couche
// d'orchestration ("generation-router"). C'est ICI, et nulle part ailleurs,
// qu'on décide quels modèles servent chaque fonctionnalité, dans quel
// ordre ils sont essayés, et combien ils coûtent en interne.
//
// Règles :
// - Les `key`/`modelId` ne doivent JAMAIS apparaître côté client.
// - Le `costWeight` est un poids de coût INTERNE (comparaison coût/qualité/
//   latence entre modèles). L'utilisateur paie toujours le coût total de la
//   feature (lib/costs.ts, future table action_costs) quel que soit le
//   modèle ayant servi — la variance est absorbée par la plateforme.
// - ⚠️ Les model_id sont indicatifs : vérifier le catalogue fal.ai (il
//   évolue vite) avant la mise en production.
import type { Feature, GenerationRequest, QualityTier } from "./types";

export interface ModelCandidate {
  /** Clé interne — journalisation/analytics uniquement, JAMAIS exposée. */
  key: string;
  provider: "fal";
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

// --- Extracteurs tolérants : normalisent les réponses hétérogènes des
//     fournisseurs vers une simple liste d'URLs. ---

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
  const root = asRecord(data);
  const video = asRecord(root.video);
  if (typeof video.url === "string") return [video.url];
  if (typeof root.video_url === "string") return [root.video_url];
  return [];
}

function extractAudioUrl(data: unknown): string[] {
  const root = asRecord(data);
  const audio = asRecord(root.audio);
  if (typeof audio.url === "string") return [audio.url];
  if (typeof root.audio_url === "string") return [root.audio_url];
  return [];
}

// --- Fabriques d'input : traduisent la GenerationRequest normalisée vers
//     le vocabulaire de chaque modèle. ---

/** Modèles d'édition image à un seul slot d'entrée (la géométrie suit
 *  l'image source ; le ratio demandé n'est pas poussé au modèle). */
function singleImageEditInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: req.prompt,
    image_url: req.imageUrl,
    num_images: req.quantity,
    output_format: "jpeg",
    safety_tolerance: "2",
  };
}

/** Modèles d'édition multi-images : l'image principale en tête, suivie des
 *  références de conditionnement. */
function multiImageEditInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: req.prompt,
    image_urls: [req.imageUrl, ...req.referenceUrls],
    num_images: req.quantity,
    output_format: "jpeg",
  };
}

/** Fabrique d'input image->vidéo. `endFrameParam` = nom du paramètre
 *  "image de fin" propre au modèle ; sans lui, l'end frame est ignorée. */
function imageToVideoInput(endFrameParam?: string) {
  return (req: GenerationRequest): Record<string, unknown> => {
    // Les durées demandées (4/8/12 s) sont mappées au plus proche supporté
    // par les modèles vidéo (généralement 5 ou 10 s).
    const duration = (req.durationSeconds ?? 4) <= 6 ? "5" : "10";
    const input: Record<string, unknown> = {
      prompt: req.prompt,
      image_url: req.imageUrl,
      duration,
      aspect_ratio: req.aspectRatio,
    };
    // Start/end frame : seuls les modèles qui le supportent reçoivent
    // l'image de fin.
    if (endFrameParam && req.endImageUrl) {
      input[endFrameParam] = req.endImageUrl;
    }
    return input;
  };
}

function ttsInput(req: GenerationRequest): Record<string, unknown> {
  return {
    text: req.narrationScript ?? "",
    voice: "Aria",
    stability: 0.5,
  };
}

function upscaleInput(req: GenerationRequest): Record<string, unknown> {
  return {
    image_url: req.imageUrl,
    scale: req.resolution === "4K" ? 4 : 2,
  };
}

// --- LE CATALOGUE : feature -> candidats par ordre de priorité. ---
// Le tri final tient compte du tier demandé (voir router.orderCandidates) :
// à priorité égale, un candidat du tier choisi passe devant.

const IMAGE_TIMEOUT_MS = 3 * 60 * 1000;
const VIDEO_TIMEOUT_MS = 10 * 60 * 1000;

export const MODEL_CATALOG: Record<Feature, ModelCandidate[]> = {
  print_render: [
    {
      key: "edit-alpha-pro",
      provider: "fal",
      modelId: "fal-ai/flux-pro/kontext/max",
      costWeight: 8,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["pro"],
      buildInput: singleImageEditInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "edit-alpha",
      provider: "fal",
      modelId: "fal-ai/flux-pro/kontext",
      costWeight: 4,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: singleImageEditInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "edit-beta",
      provider: "fal",
      modelId: "fal-ai/nano-banana/edit",
      costWeight: 3,
      maxReferences: 13,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: multiImageEditInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "edit-gamma",
      provider: "fal",
      modelId: "fal-ai/bytedance/seedream/v4/edit",
      costWeight: 3,
      maxReferences: 13,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: multiImageEditInput,
      extractOutput: extractImageUrls,
    },
  ],

  mood_swap: [
    {
      key: "edit-alpha",
      provider: "fal",
      modelId: "fal-ai/flux-pro/kontext",
      costWeight: 4,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: singleImageEditInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "edit-gamma",
      provider: "fal",
      modelId: "fal-ai/bytedance/seedream/v4/edit",
      costWeight: 3,
      maxReferences: 13,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: multiImageEditInput,
      extractOutput: extractImageUrls,
    },
  ],

  object_swap: [
    {
      key: "edit-beta",
      provider: "fal",
      modelId: "fal-ai/nano-banana/edit",
      costWeight: 3,
      maxReferences: 13,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: multiImageEditInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "edit-alpha",
      provider: "fal",
      modelId: "fal-ai/flux-pro/kontext",
      costWeight: 4,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: singleImageEditInput,
      extractOutput: extractImageUrls,
    },
  ],

  upscale: [
    {
      key: "upscale-alpha",
      provider: "fal",
      modelId: "fal-ai/topaz/upscale/image",
      costWeight: 10,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["pro"],
      buildInput: upscaleInput,
      extractOutput: extractImageUrls,
    },
    {
      key: "upscale-beta",
      provider: "fal",
      modelId: "fal-ai/esrgan",
      costWeight: 2,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: upscaleInput,
      extractOutput: extractImageUrls,
    },
  ],

  animate: [
    {
      key: "video-alpha",
      provider: "fal",
      modelId: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
      costWeight: 20,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["pro"],
      buildInput: imageToVideoInput("end_image_url"),
      extractOutput: extractVideoUrl,
    },
    {
      key: "video-beta",
      provider: "fal",
      modelId: "fal-ai/kling-video/v2.1/standard/image-to-video",
      costWeight: 15,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: imageToVideoInput("tail_image_url"),
      extractOutput: extractVideoUrl,
    },
    {
      key: "video-gamma",
      provider: "fal",
      modelId: "fal-ai/runway-gen4/turbo/image-to-video",
      costWeight: 15,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["standard"],
      buildInput: imageToVideoInput,
      extractOutput: extractVideoUrl,
    },
  ],

  lip_sync_narration: [
    {
      key: "tts-alpha",
      provider: "fal",
      modelId: "fal-ai/elevenlabs/tts/turbo-v2.5",
      costWeight: 2,
      maxReferences: 0,
      timeoutMs: IMAGE_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: ttsInput,
      extractOutput: extractAudioUrl,
    },
  ],
};
