"use client";

// Barre d'outils de génération (bas de studio) :
// - stepper de quantité (variantes)
// - sélecteur de qualité — libellé GÉNÉRIQUE ("Standard/Pro") : il choisit
//   juste quel candidat interne est essayé en premier, sans jamais nommer
//   le modèle sous-jacent (règle non négociable)
// - ratio d'aspect, résolution
// - bouton Generate avec coût en crédits EN DIRECT + état désactivé et
//   message chiffré quand le solde est insuffisant (+ lien d'achat)
import { Loader2, Minus, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ASPECT_RATIOS, MAX_QUANTITY, QUALITY_TIERS, RESOLUTIONS } from "@/lib/presets";
import { cn } from "@/lib/utils";
import type { AspectRatio, QualityTier, Resolution } from "@/lib/ai/types";

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ id: T; label: string } | T>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex overflow-hidden rounded-md border">
        {options.map((option) => {
          const id = typeof option === "string" ? option : option.id;
          const text = typeof option === "string" ? option : option.label;
          const isActive = id === value;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(id)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              )}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface GenerationControlsProps {
  quantity: number;
  quality: QualityTier;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  cost: number;
  balance: number | null;
  isBusy: boolean;
  canGenerate: boolean;
  onQuantityChange: (value: number) => void;
  onQualityChange: (value: QualityTier) => void;
  onAspectRatioChange: (value: AspectRatio) => void;
  onResolutionChange: (value: Resolution) => void;
  onGenerate: () => void;
}

export function GenerationControls({
  quantity,
  quality,
  aspectRatio,
  resolution,
  cost,
  balance,
  isBusy,
  canGenerate,
  onQuantityChange,
  onQualityChange,
  onAspectRatioChange,
  onResolutionChange,
  onGenerate,
}: GenerationControlsProps) {
  const hasEnoughCredits = balance === null || balance >= cost;

  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Quantity</span>
          <div className="flex items-center overflow-hidden rounded-md border">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              className="px-2 py-1.5 transition-colors hover:bg-accent disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-medium">{quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= MAX_QUANTITY}
              onClick={() => onQuantityChange(Math.min(MAX_QUANTITY, quantity + 1))}
              className="px-2 py-1.5 transition-colors hover:bg-accent disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <SegmentedControl
          label="Quality"
          options={QUALITY_TIERS.map((tier) => ({ id: tier.id, label: tier.label }))}
          value={quality}
          onChange={onQualityChange}
        />
        <SegmentedControl
          label="Aspect ratio"
          options={ASPECT_RATIOS}
          value={aspectRatio}
          onChange={onAspectRatioChange}
        />
        <SegmentedControl
          label="Resolution"
          options={RESOLUTIONS}
          value={resolution}
          onChange={onResolutionChange}
        />

        <div className="ml-auto flex flex-col items-end gap-1">
          {!hasEnoughCredits && balance !== null && (
            <p role="alert" className="text-xs text-destructive">
              You don&apos;t have enough credits for this generation. {cost} credits required. You
              have {balance} credits.{" "}
              {/* La page /app/billing arrive au jalon Stripe. */}
              <a href="/app/billing" className="font-medium underline">
                Buy more credits
              </a>
            </p>
          )}
          <Button onClick={onGenerate} disabled={!canGenerate || isBusy || !hasEnoughCredits} size="lg">
            {isBusy ? (
              <>
                <Loader2 className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles />
                Generate — {cost} credits
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
