// Templates de prompt — côté serveur UNIQUEMENT, VERSIONNÉS.
//
// Règle non négociable : tout le prompt engineering vit ici. Le texte
// libre de l'utilisateur ("scene details") est TOUJOURS enveloppé dans
// ces templates, jamais envoyé brut au modèle. Itérer sur la qualité =
// modifier ce fichier (et bumper la version), sans toucher au frontend.
//
// Les fragments par preset y sont centralisés : lib/presets.ts (client)
// ne contient que les métadonnées d'affichage (label, vignette).

export const PROMPT_TEMPLATES_VERSION = "2026-07-26.v1";

// --- Fragments internes par preset (jamais affichés tels quels) ---

/** Type de scène ("Customize Scene") : la BASE du prompt — elle oriente le
 *  cadrage, le contexte et les réglages pertinents pour le sujet. */
const SCENE_TYPE_FRAGMENTS: Record<string, string> = {
  commercial_exterior:
    "commercial building exterior, urban façade, street-level architectural photography, city context, professional presentation",
  interior:
    "interior space, indoor environment, carefully staged furniture and décor, balanced indoor lighting",
  residential_exterior:
    "residential home exterior, garden and landscaping, welcoming curb appeal, neighborhood context",
};

const MATERIAL_FRAGMENTS: Record<string, string> = {
  oak: "light oak wood flooring and joinery",
  marble: "polished marble surfaces with subtle veining",
  concrete: "board-formed raw concrete surfaces",
  brick: "warm exposed brick walls",
  steel_glass: "black steel frames and floor-to-ceiling glass",
  textile: "soft natural textiles, linen and wool textures",
};

const LIGHTING_FRAGMENTS: Record<string, string> = {
  daylight: "bright natural daylight, soft shadows",
  golden_hour: "golden hour lighting, warm sunset glow, long soft shadows",
  overcast: "overcast daylight, soft diffused light, neutral color grading",
  night: "night scene, interior lights on, blue hour sky",
};

const MOTION_FRAGMENTS: Record<string, string> = {
  push_in: "slow cinematic camera push-in towards the building",
  orbit: "smooth orbital camera movement around the subject",
  pan: "slow lateral camera pan across the scene",
  tilt_up: "gentle upward camera tilt revealing the full height",
  dolly: "slow lateral dolly shot, architectural walkthrough feel",
};

function fragment(table: Record<string, string>, id: string | undefined): string | null {
  return id && table[id] ? table[id] : null;
}

/** Enveloppe le texte libre utilisateur : borné et neutralisé. */
function sanitizeSceneDetails(sceneDetails: string | undefined): string | null {
  const trimmed = sceneDetails?.trim();
  if (!trimmed) return null;
  // Le compteur UI borne déjà à 10000 caractères ; on re-borne côté serveur.
  return trimmed.slice(0, 10_000);
}

export interface PrintRenderPromptArgs {
  sceneDetails?: string;
  sceneTypeId?: string;
  materialId?: string;
  lightingId?: string;
}

export function buildPrintRenderPrompt(args: PrintRenderPromptArgs): string {
  const parts: string[] = [
    "photorealistic architectural render, preserve exact geometry and proportions of the input image",
  ];
  for (const part of [
    fragment(SCENE_TYPE_FRAGMENTS, args.sceneTypeId),
    fragment(MATERIAL_FRAGMENTS, args.materialId),
    fragment(LIGHTING_FRAGMENTS, args.lightingId),
    sanitizeSceneDetails(args.sceneDetails),
  ]) {
    if (part) parts.push(part);
  }
  return parts.join(", ");
}

export interface AnimatePromptArgs {
  sceneDetails?: string;
  motionId?: string;
}

export function buildAnimatePrompt(args: AnimatePromptArgs): string {
  const parts: string[] = [
    "cinematic architectural video, photorealistic, smooth camera motion, preserve the building geometry",
  ];
  const motion = fragment(MOTION_FRAGMENTS, args.motionId);
  parts.push(motion ?? MOTION_FRAGMENTS.push_in);
  const details = sanitizeSceneDetails(args.sceneDetails);
  if (details) parts.push(details);
  return parts.join(", ");
}

/** Légende auto quand l'utilisateur ne fournit pas de script de narration. */
export function buildAutoNarrationScript(args: PrintRenderPromptArgs): string {
  const scene = args.sceneTypeId ? args.sceneTypeId.replace(/_/g, " ") : "contemporary";
  return `Discover this ${scene} project, brought to life with natural light and carefully chosen materials.`;
}
