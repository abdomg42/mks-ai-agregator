// Registre des fournisseurs — C'EST ICI que le "pas de vendor lock-in" se
// joue : chaque modèle du catalogue appelle l'API OFFICIELLE de son éditeur
// via l'adaptateur de ce tableau. Ajouter/retirer un fournisseur = modifier
// UNE entrée ici + son adaptateur, jamais le routeur ni le catalogue.
//
// Un fournisseur sans clé configurée échoue vite au premier appel et le
// routeur bascule sur le candidat suivant : la plateforme reste disponible
// avec n'importe quel sous-ensemble de fournisseurs configurés.
import type { ProviderAdapter, ProviderName } from "../types";
import { arkAdapter } from "./ark";
import { bflAdapter } from "./bfl";
import { elevenlabsAdapter } from "./elevenlabs";
import { googleAdapter } from "./google";
import { klingAdapter } from "./kling";
import { runwayAdapter } from "./runway";

export const PROVIDER_ADAPTERS: Record<ProviderName, ProviderAdapter> = {
  bfl: bflAdapter,
  google: googleAdapter,
  ark: arkAdapter,
  kling: klingAdapter,
  runway: runwayAdapter,
  elevenlabs: elevenlabsAdapter,
};

/** Variables d'env requises par fournisseur — utilisé pour le contrôle de
 *  configuration au démarrage d'une génération. */
const PROVIDER_ENV_KEYS: Record<ProviderName, string[]> = {
  bfl: ["BFL_API_KEY"],
  google: ["GOOGLE_API_KEY"],
  ark: ["ARK_API_KEY"],
  kling: ["KLING_ACCESS_KEY", "KLING_SECRET_KEY"],
  runway: ["RUNWAY_API_KEY"],
  elevenlabs: ["ELEVENLABS_API_KEY"],
};

export function isProviderConfigured(provider: ProviderName): boolean {
  return PROVIDER_ENV_KEYS[provider].every((key) => Boolean(process.env[key]));
}

/** Au moins un fournisseur configuré = la génération peut être tentée. */
export function isAnyProviderConfigured(): boolean {
  return (Object.keys(PROVIDER_ENV_KEYS) as ProviderName[]).some(isProviderConfigured);
}
