"use client";

// Grille d'icônes des sous-fonctionnalités, sous les onglets principaux.
// Composant partagé avec état actif/inactif ; seules les entrées des
// fonctionnalités livrées sont câblées, le reste est stubbé (disabled +
// tooltip "Coming soon") jusqu'à son jalon.
import {
  Box,
  Building2,
  CalendarClock,
  Camera,
  Clapperboard,
  ClipboardList,
  Columns2,
  Expand,
  History,
  Images,
  Layers,
  Paintbrush,
  PenTool,
  PencilLine,
  Sparkles,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type StudioIconId =
  | "enhance"
  | "sketch_to_render"
  | "animate"
  | "character"
  | "edit_draw"
  | "scheduled"
  | "model_3d"
  | "paint"
  | "building"
  | "compare"
  | "lighting"
  | "camera"
  | "outpaint"
  | "gallery"
  | "sketch"
  | "layers"
  | "history";

interface IconDef {
  id: StudioIconId;
  label: string;
  icon: LucideIcon;
  /** Les entrées non câblées sont désactivées (jalons suivants). */
  wired: boolean;
}

const ICONS: IconDef[] = [
  { id: "enhance", label: "Enhance", icon: Sparkles, wired: true },
  { id: "sketch_to_render", label: "Sketch to render", icon: PencilLine, wired: false },
  { id: "animate", label: "Animate", icon: Clapperboard, wired: true },
  { id: "character", label: "Character reference", icon: User, wired: false },
  { id: "edit_draw", label: "Edit / draw", icon: Paintbrush, wired: false },
  { id: "scheduled", label: "Batch render", icon: CalendarClock, wired: false },
  { id: "model_3d", label: "3D model reference", icon: Box, wired: false },
  { id: "paint", label: "Paint / repaint", icon: PenTool, wired: false },
  { id: "building", label: "Architecture mode", icon: Building2, wired: false },
  { id: "compare", label: "Compare view", icon: Columns2, wired: true },
  { id: "lighting", label: "Lighting", icon: Sun, wired: false },
  { id: "camera", label: "Camera angle", icon: Camera, wired: false },
  { id: "outpaint", label: "Expand / outpaint", icon: Expand, wired: false },
  { id: "gallery", label: "Results", icon: Images, wired: true },
  { id: "sketch", label: "Sketch tool", icon: PencilLine, wired: false },
  { id: "layers", label: "Layers", icon: Layers, wired: false },
  { id: "history", label: "History", icon: History, wired: false },
];

interface StudioIconGridProps {
  activeId: StudioIconId;
  onSelect: (id: StudioIconId) => void;
}

export function StudioIconGrid({ activeId, onSelect }: StudioIconGridProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ICONS.map(({ id, label, icon: Icon, wired }) => {
        const isActive = id === activeId;
        return (
          <button
            key={id}
            type="button"
            disabled={!wired}
            title={wired ? label : `${label} — coming soon`}
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => onSelect(id)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg border transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow"
                : "bg-card text-muted-foreground",
              wired ? "hover:border-primary/60 hover:text-foreground" : "cursor-not-allowed opacity-40"
            )}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}
