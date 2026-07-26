// Store de jobs EN MÉMOIRE process — suffisant en dev mono-instance.
//
// Au jalon DB : remplacer l'implémentation par la table `generations`
// (interface publique inchangée), puis par une vraie file (BullMQ) en prod
// serverless — le fire-and-forget des routes ne survivrait pas à un
// environnement sans état.
//
// Règle non négociable : `errorMessage` ne contient QUE des messages
// génériques destinés au client. L'erreur réelle est journalisée côté
// serveur (lib/ai/logger.ts).
export type JobStatus = "pending" | "processing" | "done" | "error";

export interface Job {
  id: string;
  status: JobStatus;
  /** Étape courante — libellés PRODUIT génériques ("render", "video",
   *  "narration"...), jamais un nom de modèle/fournisseur. */
  stage?: string;
  kind?: "image" | "video";
  outputUrls?: string[];
  errorMessage?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

export function createJob(id: string): Job {
  const job: Job = { id, status: "pending", createdAt: Date.now() };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Omit<Job, "id" | "createdAt">>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, patch);
}
