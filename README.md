# RenderStudio — SaaS de rendu architectural IA

Transforme un screenshot brut de viewport 3D (SketchUp, Revit, 3ds Max) en
rendu photoréaliste, via des modèles IA tiers appelés côté serveur.

Stack : **Next.js 14 (App Router) · TypeScript · TailwindCSS · shadcn/ui** —
chaque modèle IA est appelé sur l'API officielle de son éditeur (BFL,
Google, ByteDance, Kling, Runway, ElevenLabs), sans agrégateur. Voir
`AGENTS.md` pour l'architecture et la feuille de route.

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner au moins un fournisseur (ex. BFL_API_KEY)
npm run dev                  # http://localhost:3000 -> /app/dashboard
```

## État du projet

Jalon courant terminé : **boucle upload → génération → affichage** pour le
« Print to Render » (sans auth ni facturation). L'ancien backend FastAPI est
archivé dans `legacy/` à titre de référence.
