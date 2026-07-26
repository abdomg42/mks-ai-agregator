// Métadonnées d'affichage des fonctionnalités — CLIENT-SAFE.
// Le `name` et la `tagline` sont les libellés PRODUIT vus par
// l'utilisateur ; ils ne révèlent rien des modèles sous-jacents.

export type StudioTab = "render" | "edit" | "animate" | "audio";

export const STUDIO_TABS: Array<{ id: StudioTab; label: string }> = [
  { id: "render", label: "Render" },
  { id: "edit", label: "Edit" },
  { id: "animate", label: "Animate" },
  { id: "audio", label: "Audio" },
];

export interface FeatureMeta {
  id: "print_render" | "animate";
  tab: StudioTab;
  name: string;
  tagline: string;
}

export const FEATURES: Record<FeatureMeta["id"], FeatureMeta> = {
  print_render: {
    id: "print_render",
    tab: "render",
    name: "Print Render",
    tagline:
      "Enhance your model adding extreme photorealism suitable for editorial photographic presentations.",
  },
  animate: {
    id: "animate",
    tab: "animate",
    name: "Animate",
    tagline:
      "Turn any render into a cinematic camera move, with optional AI narration.",
  },
};
