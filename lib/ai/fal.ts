// Client fal.ai — côté serveur UNIQUEMENT.
// Ce module ne doit être importé que depuis des Route Handlers (app/api/...) :
// la clé FAL_KEY lue ici ne doit jamais être exposée au navigateur
// (ne jamais la préfixer par NEXT_PUBLIC_).
import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_KEY,
});

export { fal };
