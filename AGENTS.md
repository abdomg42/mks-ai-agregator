# AGENTS.md — Immo AI Platform (RenderStudio)

Ce fichier s'adresse aux agents de code IA. Il décrit le dépôt tel qu'il
existe réellement — ne rien supposer au-delà de ce qui est écrit ici.

## Vue d'ensemble

SaaS de **rendu architectural par IA** (concept type RenderLab) : les
architectes / designers d'intérieur déposent un screenshot brut de viewport
3D (SketchUp, Revit, 3ds Max) et obtiennent un rendu photoréaliste. L'app
choisit le bon modèle IA par fonctionnalité — **l'utilisateur ne choisit
jamais un modèle manuellement**.

Refonte en cours d'un ancien backend FastAPI : celui-ci est archivé dans
`legacy/` (conservé comme référence pour les presets et le registre, non
fonctionnel en l'état). Le nouveau stack est **Next.js full-stack**.

Trois principes d'architecture à respecter dans toute modification :

1. **Aucun modèle fondamental n'est développé ici.** Toutes les capacités
   IA sont des appels à des modèles tiers via l'agrégateur **fal.ai**. Le
   registre pluggable `lib/ai/registry.ts` est le fichier central :
   changer de fournisseur = modifier UNE entrée dans ce fichier, jamais
   de code ailleurs.
2. **Les clés API ne quittent JAMAIS le serveur.** Tous les appels modèles
   passent par des Route Handlers (`app/api/...`) ; `lib/ai/fal.ts` lit
   `FAL_KEY` côté serveur uniquement. Aucune variable sensible ne doit
   être préfixée `NEXT_PUBLIC_`.
3. **L'utilisateur n'écrit jamais de prompt technique.** Il clique des
   presets (style) + texte libre optionnel ; la traduction en prompt de
   génération se fait dans `lib/prompts.ts`.

## Stack technique

- **Next.js 14.2** (App Router) + **React 18** + **TypeScript strict**
- **TailwindCSS 3.4** + **shadcn/ui** (style new-york, base zinc, variables
  CSS, thème sombre par défaut via `class="dark"` sur `<html>`)
- **@fal-ai/client** — queue fal.ai (submit + polling de statut)
- Pas encore intégrés (jalons suivants, voir feuille de route) :
  **Supabase** (auth + Postgres + storage), **Stripe** (Checkout +
  Customer Portal + webhooks)

Il n'y a pas de `src/` : l'App Router est à la racine dans `app/`.

## Structure du code

```
app/
  page.tsx                    # redirige vers /app/dashboard (la landing
                              #   marketing arrive en dernier)
  layout.tsx                  # fonts Geist, metadata, thème sombre
  globals.css                 # variables CSS shadcn (zinc, light+dark)
  app/dashboard/page.tsx      # STUDIO : onglets de fonctionnalités, upload,
                              #   presets, génération, polling 2,5 s,
                              #   comparateur avant/après, historique session
  api/generate/route.ts       # POST multipart (image + style + customText?)
                              #   -> soumet à la queue fal -> { jobId }
  api/generate/[id]/route.ts  # GET -> statut fal -> { status, outputUrl? }
components/
  compare-slider.tsx          # comparateur avant/après (clip-path + pointer events)
  upload-dropzone.tsx         # drag & drop + aperçu (PNG/JPEG/WebP, 10 Mo max)
  preset-picker.tsx           # vignettes de style cliquables (pas de prompt brut)
  ui/                         # composants shadcn/ui (button, card, tabs,
                              #   badge, skeleton, textarea)
lib/
  ai/registry.ts              # LE fichier central : Capability -> (provider,
                              #   modelId, coût crédits indicatif)
  ai/fal.ts                   # client fal configuré (serveur uniquement)
  prompts.ts                  # STYLE_PRESETS + buildRenderPrompt()
  utils.ts                    # cn() (clsx + tailwind-merge)
legacy/                       # ancien backend FastAPI (référence, non utilisé)
```

### Flux d'une génération (jalon actuel)

1. Le client POST `multipart/form-data` vers `/api/generate`
   (image + style + texte libre optionnel).
2. La route valide (type, taille), construit le prompt via `lib/prompts.ts`,
   encode l'image en data URI base64 et soumet à la queue fal.ai
   (`flux-pro/kontext/max` — img2img avec préservation de géométrie).
3. Le client polle `GET /api/generate/{jobId}` toutes les 2,5 s jusqu'à
   `done` (avec `outputUrl`) ou `error`.

## Commandes

```bash
npm install
cp .env.example .env.local   # puis renseigner FAL_KEY (https://fal.ai/dashboard/keys)
npm run dev                  # http://localhost:3000 -> /app/dashboard
npm run build                # vérif compile + lint + types
```

Vérification rapide : `GET /app/dashboard` → 200 ; `POST /api/generate`
sans clé → JSON d'erreur explicite sur `FAL_KEY`.

Il n'y a ni Dockerfile, ni CI, ni tests : seul le lancement local ci-dessus
est défini.

## Configuration

`FAL_KEY` via `.env.local` (voir `.env.example`). C'est la seule variable
requise à ce jalon. À venir : `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`.

## Conventions de code

- **Langue** : commentaires et docs en **français** ; identifiants, code et
  **copy UI en anglais**. Conserver cette règle.
- Docstrings de module qui expliquent le **pourquoi** (choix d'architecture),
  pas seulement le quoi — en particulier `registry.ts`, routes API, page studio.
- Typage systématique (TS strict, pas de `any` non justifié).
- Composants serveur par défaut ; `"use client"` uniquement pour
  l'interactivité (upload, slider, polling).
- Images distantes : balises `<img>` natives (les URLs de résultat sont du
  CDN fal) — si `next/image` est adopté, ajouter `remotePatterns` dans
  `next.config.mjs`.
- Changement de fournisseur de modèle IA : toucher **uniquement**
  `MODEL_REGISTRY` dans `lib/ai/registry.ts`, rien d'autre.
- shadcn/ui a été installé **à la main** (le CLI npm était défaillant) :
  `components.json` + `components/ui/` + thème dans `tailwind.config.ts` et
  `globals.css`. Pour ajouter un composant, reprendre le source officiel
  (style new-york) ou réessayer le CLI.

## Feuille de route (spec produit)

Ordre de construction convenu — **ne pas avancer sans validation de l'étape
courante** :

1. ~~Scaffold Next.js + Tailwind + shadcn/ui~~ — fait.
2. ~~Boucle upload -> API -> modèle IA -> affichage pour Print-to-Render,
   sans auth ni facturation~~ — **fait (jalon courant)**.
3. Auth (Supabase Auth), schéma DB, système de crédits.
4. Abonnements Stripe + webhooks + mint des crédits.
5. Fonctionnalités suivantes (mood swap, chat edit, upscale 4K) — même
   pipeline, autres presets/prompts.
6. Object swap et new angle en dernier (itération lourde).
7. Landing page marketing en tout dernier.

Exigences d'architecture pour les jalons 3-4 (à respecter telles quelles) :

- Chaque génération : vérifier le solde de crédits → refus si insuffisant →
  appel modèle → **débit uniquement au succès** → log (input, output, coût,
  timestamp) → retour client.
- Coûts par action en **table de config** `action_costs(feature_type,
  credit_cost)`, pas en dur (le `creditCost` du registre est indicatif).
- **Ledger append-only** `credit_ledger(id, user_id, delta, reason,
  created_at)` : entrées mint/spend/refund/expire, pas juste un solde.
- Tables minimales : `users`, `subscriptions`, `credit_ledger`,
  `generations`, `action_costs`.
- Webhook Stripe : succès de paiement d'abonnement → mint des crédits de la
  période ; annulation → arrêt des mints futurs, crédits existants
  utilisables jusqu'à la fin de période ; top-up unitaire réservé aux
  abonnés actifs.
- Jobs : polling simple en table pour le MVP, conçu pour être remplaçable
  par une vraie file (BullMQ) plus tard.

## État d'avancement et pièges connus

- **Jalon 2 terminé et vérifié** : `npm run build` passe (compile + lint +
  types), smoke test dev OK (redirect `/` → `/app/dashboard`, erreurs API
  propres sans clé). La qualité de rendu réelle reste à valider avec une
  vraie `FAL_KEY`.
- Pas d'auth : la route `/api/generate` est **ouverte** — ne pas exposer
  telle quelle en production.
- L'image transite en data URI base64 (10 Mo max) ; S3/Supabase Storage
  prendra le relais au jalon DB.
- L'historique du studio est **en mémoire** (session navigateur) — la
  persistance arrive avec la DB.
- Les `model_id` fal.ai sont **indicatifs** : vérifier le catalogue (il
  évolue vite) avant la prod.
- Le dépôt git existe mais n'a **aucun commit** — penser à committer.
- Aucun test : si tu en ajoutes, installer d'abord le framework de test.
- `legacy/` n'est pas destiné à être exécuté ; ne pas importer depuis.
