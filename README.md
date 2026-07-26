# RenderStudio — SaaS de rendu architectural IA

Transforme un screenshot brut de viewport 3D (SketchUp, Revit, 3ds Max) en
rendu photoréaliste, via des modèles IA tiers appelés côté serveur.

Stack : **Next.js 14 (App Router) · TypeScript · TailwindCSS · shadcn/ui ·
fal.ai** — voir `AGENTS.md` pour l'architecture et la feuille de route.

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner FAL_KEY (https://fal.ai/dashboard/keys)
npm run dev                  # http://localhost:3000 -> /app/dashboard
```

## État du projet

Jalon courant terminé : **boucle upload → génération → affichage** pour le
« Print to Render » (sans auth ni facturation). L'ancien backend FastAPI est
archivé dans `legacy/` à titre de référence.
