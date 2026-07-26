// Métadonnées d'affichage des presets — CLIENT-SAFE.
// Aucun fragment de prompt ici : le prompt engineering vit côté serveur
// dans lib/ai/prompt-templates.ts. Ici : ids, labels, vignettes, bornes UI.

export interface PresetMeta {
  id: string;
  label: string;
  /** Dégradé Tailwind utilisé comme vignette (scanné car lib/ est dans le
   *  `content` de tailwind.config.ts). */
  swatch: string;
}

export const STYLE_PRESETS: PresetMeta[] = [
  { id: "modern", label: "Modern", swatch: "from-slate-300 to-slate-500" },
  { id: "mediterranean", label: "Mediterranean", swatch: "from-amber-200 to-orange-400" },
  { id: "scandinavian", label: "Scandinavian", swatch: "from-stone-200 to-stone-400" },
  { id: "industrial", label: "Industrial", swatch: "from-zinc-400 to-zinc-700" },
  { id: "japandi", label: "Japandi", swatch: "from-amber-100 to-stone-300" },
  { id: "luxury", label: "Luxury", swatch: "from-yellow-200 to-amber-500" },
];

export const MATERIAL_PRESETS: PresetMeta[] = [
  { id: "oak", label: "Oak wood", swatch: "from-amber-200 to-amber-400" },
  { id: "marble", label: "Marble", swatch: "from-stone-100 to-stone-300" },
  { id: "concrete", label: "Concrete", swatch: "from-zinc-300 to-zinc-500" },
  { id: "brick", label: "Brick", swatch: "from-red-300 to-orange-500" },
  { id: "steel_glass", label: "Steel & glass", swatch: "from-sky-200 to-slate-500" },
  { id: "textile", label: "Textiles", swatch: "from-rose-100 to-rose-300" },
];

export const LIGHTING_PRESETS: PresetMeta[] = [
  { id: "daylight", label: "Daylight", swatch: "from-sky-200 to-blue-400" },
  { id: "golden_hour", label: "Golden hour", swatch: "from-amber-300 to-orange-500" },
  { id: "overcast", label: "Overcast", swatch: "from-slate-200 to-slate-400" },
  { id: "night", label: "Night", swatch: "from-indigo-400 to-slate-800" },
];

export interface MotionPresetMeta {
  id: string;
  label: string;
  description: string;
}

export const MOTION_PRESETS: MotionPresetMeta[] = [
  { id: "push_in", label: "Push-in", description: "Slow cinematic move towards the subject" },
  { id: "orbit", label: "Orbit", description: "Smooth rotation around the building" },
  { id: "pan", label: "Pan", description: "Lateral sweep across the scene" },
  { id: "tilt_up", label: "Tilt up", description: "Reveals the full height" },
  { id: "dolly", label: "Dolly", description: "Walkthrough-style lateral move" },
];

// --- Bornes et options des contrôles de génération ---

export const MAX_REFERENCES = 14;
export const MAX_QUANTITY = 4;
export const SCENE_DETAILS_MAX = 10_000;
export const NARRATION_SCRIPT_MAX = 2_000;

export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
export const RESOLUTIONS = ["1K", "2K", "4K"] as const;
export const QUALITY_TIERS = [
  { id: "standard", label: "Standard" },
  { id: "pro", label: "Pro" },
] as const;
export const DURATIONS = [4, 8, 12] as const;
