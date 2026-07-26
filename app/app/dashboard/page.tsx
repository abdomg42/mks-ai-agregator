"use client";

// Studio — orchestration des panneaux (jalon orchestration multi-modèles).
// L'utilisateur ne voit qu'UN bouton Generate par fonctionnalité : choix
// du modèle, routage, fallback et chaînage ont tous lieu côté serveur.
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatePanel } from "@/components/studio/animate-panel";
import { FeatureCard } from "@/components/studio/feature-card";
import { GenerationControls } from "@/components/studio/generation-controls";
import { StudioIconGrid, type StudioIconId } from "@/components/studio/icon-grid";
import { PresetGrid } from "@/components/studio/preset-grid";
import { ReferencesPanel, type ReferenceImage } from "@/components/studio/references-panel";
import { ResultPanel, type ResultState } from "@/components/studio/result-panel";
import { SceneDetails } from "@/components/studio/scene-details";
import { SettingsAccordion } from "@/components/studio/settings-accordion";
import { UploadDropzone } from "@/components/upload-dropzone";
import { computeCreditCost } from "@/lib/costs";
import { FEATURES, STUDIO_TABS, type StudioTab } from "@/lib/features";
import {
  LIGHTING_PRESETS,
  MATERIAL_PRESETS,
  MOTION_PRESETS,
  STYLE_PRESETS,
} from "@/lib/presets";
import type { AspectRatio, QualityTier, Resolution } from "@/lib/ai/types";

const POLL_INTERVAL_MS = 2500;

interface HistoryEntry {
  id: string;
  kind: "image" | "video";
  beforeUrl: string | null;
  outputUrls: string[];
  featureName: string;
}

type RightView = "compare" | "gallery";

const TAB_PLACEHOLDERS: Partial<Record<StudioTab, string>> = {
  edit: "Mood swap, chat edit and object swap arrive in the next milestones — same one-click pipeline, no model to pick.",
  audio: "Narration and audio tools arrive in a dedicated milestone. Narration is already available inside Animate.",
};

export default function DashboardPage() {
  // --- Navigation ---
  const [tab, setTab] = useState<StudioTab>("render");
  const [rightView, setRightView] = useState<RightView>("compare");

  // --- Crédits (stub côté serveur jusqu'au jalon DB) ---
  const [balance, setBalance] = useState<number | null>(null);

  // --- Print Render ---
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [styleId, setStyleId] = useState(STYLE_PRESETS[0].id);
  const [materialId, setMaterialId] = useState(MATERIAL_PRESETS[0].id);
  const [lightingId, setLightingId] = useState(LIGHTING_PRESETS[0].id);
  const [sceneDetails, setSceneDetails] = useState("");

  // --- Contrôles de génération ---
  const [quantity, setQuantity] = useState(1);
  const [quality, setQuality] = useState<QualityTier>("standard");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("4:3");
  const [resolution, setResolution] = useState<Resolution>("1K");

  // --- Animate ---
  const [animateFile, setAnimateFile] = useState<File | null>(null);
  const [animateSource, setAnimateSource] = useState<{ kind: "history" | "upload"; previewUrl: string | null }>({
    kind: "upload",
    previewUrl: null,
  });
  const [motionId, setMotionId] = useState(MOTION_PRESETS[0].id);
  const [durationSeconds, setDurationSeconds] = useState<4 | 8 | 12>(4);
  const [withNarration, setWithNarration] = useState(false);
  const [narrationScript, setNarrationScript] = useState("");
  const [animateSceneDetails, setAnimateSceneDetails] = useState("");

  // --- Job courant + historique de session ---
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBusy = result.status === "busy";

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    fetch("/api/credits/balance")
      .then((res) => res.json())
      .then((data) => setBalance(typeof data.balance === "number" ? data.balance : null))
      .catch(() => setBalance(null));
  }, []);

  const pollJob = useCallback(
    (jobId: string, kind: "image" | "video", beforeUrl: string | null, featureName: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/generate/${jobId}`);
          const data = await res.json();
          if (data.status === "done") {
            stopPolling();
            const outputUrls: string[] = data.outputUrls ?? [];
            setResult({ status: "done", kind: data.kind ?? kind, beforeUrl, outputUrls });
            setHistory((entries) => [
              { id: jobId, kind: data.kind ?? kind, beforeUrl, outputUrls, featureName },
              ...entries,
            ]);
            setRightView("compare");
          } else if (data.status === "error") {
            stopPolling();
            setResult({ status: "idle" });
            setError(data.error ?? "Generation failed, please try again.");
          } else {
            setResult((current) =>
              current.status === "busy" ? { ...current, stage: data.stage } : current
            );
          }
        } catch {
          // Erreur réseau transitoire : on retente au prochain tick.
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const submitGeneration = async (form: FormData, kind: "image" | "video", beforeUrl: string | null) => {
    setError(null);
    setResult({ status: "busy" });
    setRightView("compare");
    try {
      const res = await fetch("/api/generate", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 402) {
        setBalance(typeof data.balance === "number" ? data.balance : balance);
        setResult({ status: "idle" });
        setError("You don't have enough credits for this generation.");
        return;
      }
      if (!res.ok) {
        setResult({ status: "idle" });
        setError(data.error ?? "Generation failed, please try again.");
        return;
      }
      pollJob(data.jobId, kind, beforeUrl, FEATURES[kind === "video" ? "animate" : "print_render"].name);
    } catch {
      setResult({ status: "idle" });
      setError("Network error — please try again.");
    }
  };

  const handleGenerateRender = () => {
    if (!file) return;
    const form = new FormData();
    form.append("feature", "print_render");
    form.append("image", file);
    for (const reference of references) form.append("reference", reference.file);
    form.append("styleId", styleId);
    form.append("materialId", materialId);
    form.append("lightingId", lightingId);
    form.append("sceneDetails", sceneDetails);
    form.append("quality", quality);
    form.append("aspectRatio", aspectRatio);
    form.append("resolution", resolution);
    form.append("quantity", String(quantity));
    void submitGeneration(form, "image", previewUrl);
  };

  const handleGenerateVideo = () => {
    const form = new FormData();
    form.append("feature", "animate");
    if (animateSource.kind === "upload" && animateFile) {
      form.append("image", animateFile);
    } else if (animateSource.kind === "history" && animateSource.previewUrl) {
      // Rendu précédent (URL CDN) : transmis tel quel, le serveur le
      // forwarde au pipeline — pas de re-upload nécessaire.
      form.append("imageUrl", animateSource.previewUrl);
    } else {
      return;
    }
    form.append("motionId", motionId);
    form.append("durationSeconds", String(durationSeconds));
    form.append("sceneDetails", animateSceneDetails);
    form.append("quality", quality);
    form.append("aspectRatio", aspectRatio);
    form.append("resolution", "1K");
    form.append("quantity", "1");
    if (withNarration) {
      form.append("narration", "on");
      form.append("narrationScript", narrationScript);
    }
    void submitGeneration(form, "video", animateSource.previewUrl);
  };

  const handleIconSelect = (id: StudioIconId) => {
    if (id === "animate") {
      setTab("animate");
    } else if (id === "gallery") {
      setTab("render");
      setRightView("gallery");
    } else {
      setTab("render");
      setRightView("compare");
    }
  };

  const activeIconId: StudioIconId =
    tab === "animate" ? "animate" : rightView === "gallery" ? "gallery" : "enhance";

  const handleAddReferences = (files: File[]) => {
    setReferences((current) => [
      ...current,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  };

  const latestImageUrl = history.find((entry) => entry.kind === "image")?.outputUrls[0] ?? null;

  const renderCost = computeCreditCost({ feature: "print_render", quality, resolution, quantity });
  const animateCost = computeCreditCost({
    feature: "animate",
    quality,
    resolution: "1K",
    quantity: 1,
    durationSeconds,
    withNarration,
  });

  const activeFeature = FEATURES[tab === "animate" ? "animate" : "print_render"];

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 p-4 pb-0 sm:p-6 sm:pb-0">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">RenderStudio</h1>
          <p className="text-sm text-muted-foreground">
            From 3D viewport screenshot to photorealistic render.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          {balance === null ? "…" : balance} credits
        </Badge>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as StudioTab)}>
        <TabsList>
          {STUDIO_TABS.map((studioTab) => (
            <TabsTrigger key={studioTab.id} value={studioTab.id}>
              {studioTab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <StudioIconGrid activeId={activeIconId} onSelect={handleIconSelect} />

      {TAB_PLACEHOLDERS[tab] ? (
        <Card>
          <CardHeader>
            <CardTitle>{STUDIO_TABS.find((studioTab) => studioTab.id === tab)?.label}</CardTitle>
            <CardDescription>{TAB_PLACEHOLDERS[tab]}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid flex-1 gap-6 lg:grid-cols-[400px_1fr]">
          <div className="flex flex-col gap-4">
            <FeatureCard name={activeFeature.name} tagline={activeFeature.tagline} />

            <Card>
              <CardContent className="flex flex-col gap-4 p-4">
                {tab === "render" ? (
                  <>
                    <UploadDropzone
                      previewUrl={previewUrl}
                      onFileSelected={(selected) => {
                        setFile(selected);
                        setPreviewUrl(URL.createObjectURL(selected));
                        setError(null);
                      }}
                    />
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Style</span>
                      <PresetGrid items={STYLE_PRESETS} value={styleId} onChange={setStyleId} />
                    </div>
                    <ReferencesPanel
                      references={references}
                      onAdd={handleAddReferences}
                      onRemove={(id) => setReferences((current) => current.filter((ref) => ref.id !== id))}
                    />
                    <SettingsAccordion
                      materialId={materialId}
                      lightingId={lightingId}
                      onMaterialChange={setMaterialId}
                      onLightingChange={setLightingId}
                    />
                    <SceneDetails value={sceneDetails} onChange={setSceneDetails} />
                  </>
                ) : (
                  <AnimatePanel
                    source={animateSource}
                    hasHistoryImages={latestImageUrl !== null}
                    onPickFromHistory={() => {
                      if (latestImageUrl) setAnimateSource({ kind: "history", previewUrl: latestImageUrl });
                    }}
                    onFileSelected={(selected) => {
                      setAnimateFile(selected);
                      setAnimateSource({ kind: "upload", previewUrl: URL.createObjectURL(selected) });
                      setError(null);
                    }}
                    motionId={motionId}
                    onMotionChange={setMotionId}
                    durationSeconds={durationSeconds}
                    onDurationChange={setDurationSeconds}
                    withNarration={withNarration}
                    onNarrationToggle={setWithNarration}
                    narrationScript={narrationScript}
                    onNarrationScriptChange={setNarrationScript}
                    sceneDetails={animateSceneDetails}
                    onSceneDetailsChange={setAnimateSceneDetails}
                    cost={animateCost}
                    balance={balance}
                    isBusy={isBusy}
                    onGenerate={handleGenerateVideo}
                  />
                )}

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6 pb-6">
            {rightView === "compare" ? (
              <ResultPanel result={result} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>
                    Session history — kept in your browser only, accounts come next.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing generated yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {history.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            setResult({
                              status: "done",
                              kind: entry.kind,
                              beforeUrl: entry.beforeUrl,
                              outputUrls: entry.outputUrls,
                            });
                            setRightView("compare");
                          }}
                          className="group rounded-lg border p-1.5 text-left transition-colors hover:border-primary/60"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={entry.outputUrls[0]}
                            alt={entry.featureName}
                            className="aspect-[4/3] w-full rounded-md object-cover"
                          />
                          <span className="mt-1 block px-0.5 text-xs text-muted-foreground">
                            {entry.featureName}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "render" && (
        <GenerationControls
          quantity={quantity}
          quality={quality}
          aspectRatio={aspectRatio}
          resolution={resolution}
          cost={renderCost}
          balance={balance}
          isBusy={isBusy}
          canGenerate={file !== null}
          onQuantityChange={setQuantity}
          onQualityChange={setQuality}
          onAspectRatioChange={setAspectRatio}
          onResolutionChange={setResolution}
          onGenerate={handleGenerateRender}
        />
      )}
    </main>
  );
}
