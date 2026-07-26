// Simulation hors-ligne du generation-router : prouve que le fallback
// fonctionne SANS appeler les vrais fournisseurs (adaptateur injecté).
//
//   npm run test:fallback
//
// Couvre : ordre des tentatives, fallback après erreurs, normalisation de
// la sortie, échec global (AllModelsFailedError), tri par tier de qualité,
// troncature des références, sortie vide = échec.
import { executeWithFallback, orderCandidates } from "../lib/ai/router";
import type { ModelCandidate } from "../lib/ai/catalog";
import {
  AllModelsFailedError,
  type GenerationRequest,
  type ProviderAdapter,
} from "../lib/ai/types";

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
  }
}

/** Fabrique un candidat factice. buildInput propage les références pour
 *  pouvoir vérifier la troncature. */
function fakeCandidate(
  key: string,
  overrides: Partial<ModelCandidate> = {}
): ModelCandidate {
  return {
    key,
    provider: "fal",
    modelId: `fake/${key}`,
    costWeight: 1,
    maxReferences: 99,
    timeoutMs: 1000,
    tiers: ["standard", "pro"],
    buildInput: (req) => ({ prompt: req.prompt, refs: req.referenceUrls }),
    extractOutput: (data) => {
      const urls = (data as { urls?: string[] }).urls;
      return Array.isArray(urls) ? urls : [];
    },
    ...overrides,
  };
}

/** Adaptateur factice : échoue pour les clés listées, réussit sinon et
 *  enregistre l'ordre des appels. */
function fakeAdapter(failingKeys: string[], calls: string[]): ProviderAdapter {
  return {
    name: "fake",
    async run(modelId) {
      calls.push(modelId);
      if (failingKeys.some((key) => modelId.endsWith(key))) {
        throw new Error("simulated provider failure");
      }
      return { urls: [`https://example.test/${modelId.split("/").pop()}.jpg`] };
    },
  };
}

function baseRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    feature: "print_render",
    imageUrl: "data:image/png;base64,x",
    referenceUrls: ["ref-1", "ref-2", "ref-3"],
    prompt: "test prompt",
    quality: "standard",
    aspectRatio: "1:1",
    resolution: "1K",
    quantity: 1,
    ...overrides,
  };
}

async function main(): Promise<void> {
  console.log("\n[1] Fallback : A et B échouent, C sert la génération");
  {
    const calls: string[] = [];
    const candidates = [fakeCandidate("a"), fakeCandidate("b"), fakeCandidate("c")];
    const outcome = await executeWithFallback("print_render", candidates, baseRequest(), {
      adapter: fakeAdapter(["a", "b"], calls),
    });
    assert(calls.join(",") === "fake/a,fake/b,fake/c", "tentatives dans l'ordre a, b, c");
    assert(outcome.winner.key === "c", "le gagnant est c");
    assert(outcome.outputUrls[0] === "https://example.test/c.jpg", "sortie normalisée (URL)");
    assert(outcome.attempts.length === 3, "3 tentatives tracées");
    assert(
      outcome.attempts[0].ok === false && Boolean(outcome.attempts[0].error),
      "l'erreur réelle est tracée côté serveur"
    );
    assert(outcome.attempts.every((a) => a.latencyMs >= 0), "latences enregistrées");
  }

  console.log("\n[2] Tous les candidats échouent -> AllModelsFailedError");
  {
    const calls: string[] = [];
    let thrown: unknown = null;
    try {
      await executeWithFallback(
        "print_render",
        [fakeCandidate("a"), fakeCandidate("b")],
        baseRequest(),
        { adapter: fakeAdapter(["a", "b"], calls) }
      );
    } catch (err) {
      thrown = err;
    }
    assert(thrown instanceof AllModelsFailedError, "lève AllModelsFailedError");
    assert(
      thrown instanceof AllModelsFailedError && thrown.attempts.length === 2,
      "la trace des 2 tentatives est jointe"
    );
  }

  console.log("\n[3] Tri par tier : un candidat 'pro' passe devant pour quality=pro");
  {
    const standard = fakeCandidate("standard-first", { tiers: ["standard"] });
    const pro = fakeCandidate("pro-second", { tiers: ["pro"] });
    const ordered = orderCandidates([standard, pro], "pro");
    assert(ordered[0].key === "pro-second", "le candidat pro est essayé en premier");
    const orderedStandard = orderCandidates([standard, pro], "standard");
    assert(
      orderedStandard[0].key === "standard-first",
      "l'ordre config est conservé pour standard"
    );
  }

  console.log("\n[4] Références tronquées au max supporté par le candidat");
  {
    const calls: string[] = [];
    let seenRefs: unknown = null;
    const candidate = fakeCandidate("limited", {
      maxReferences: 1,
      buildInput: (req) => {
        seenRefs = req.referenceUrls;
        return {};
      },
    });
    await executeWithFallback("print_render", [candidate], baseRequest(), {
      adapter: fakeAdapter([], calls),
    });
    assert(
      Array.isArray(seenRefs) && seenRefs.length === 1 && seenRefs[0] === "ref-1",
      "3 références fournies -> 1 seule passée au modèle"
    );
  }

  console.log("\n[5] Sortie vide du fournisseur = échec -> fallback");
  {
    const calls: string[] = [];
    const empty = fakeCandidate("empty", { extractOutput: () => [] });
    const ok = fakeCandidate("ok");
    const outcome = await executeWithFallback("print_render", [empty, ok], baseRequest(), {
      adapter: fakeAdapter([], calls),
    });
    assert(outcome.winner.key === "ok", "sortie vide traitée comme un échec, b sert");
  }

  console.log(failures === 0 ? "\nTous les tests passent.\n" : `\n${failures} test(s) en échec.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
