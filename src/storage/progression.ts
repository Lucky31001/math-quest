/**
 * Progression de l'élève : modèle, sauvegarde localStorage, export/import JSON.
 *
 * Le format est versionné et validé (Zod) : un fichier importé ou un
 * localStorage corrompu ne peut pas casser l'application — les champs
 * manquants reprennent leur valeur par défaut.
 */
import { z } from 'zod';
import type { TypeQuestion } from '../core/schema';

const Leitner = z.object({
  boite: z.number().int().min(1).max(5),
  prochaine: z.string(),
  vues: z.number().int().nonnegative(),
  reussites: z.number().int().nonnegative(),
  derniere: z.string(),
});

const Stat = z.object({ tentatives: z.number().nonnegative(), reussites: z.number().nonnegative() });

export const ProgressionSchema = z.object({
  version: z.literal(1).default(1),
  xp: z.number().nonnegative().default(0),
  /** Questions fixes, clé « chapitre/id ». */
  questions: z.record(Leitner).default({}),
  /** Flashcards, clé « chapitre/id ». */
  flashcards: z.record(Leitner).default({}),
  /** Statistiques par chapitre puis par type de question (questions générées comprises). */
  stats: z.record(z.record(Stat)).default({}),
  streak: z
    .object({ courant: z.number().int().default(0), record: z.number().int().default(0), dernierJour: z.string().nullable().default(null) })
    .default({}),
  /** Badges débloqués : id → date. */
  badges: z.record(z.string()).default({}),
  records: z
    .object({
      survie: z.number().default(0),
      eclair: z.number().default(0),
      eclairParfait: z.boolean().default(false),
      meilleurCombo: z.number().default(0),
      boss: z.record(z.object({ meilleur: z.number(), vaincu: z.boolean(), sansIndice: z.boolean().default(false) })).default({}),
    })
    .default({}),
  compteurs: z
    .object({
      reponses: z.number().default(0),
      bonnes: z.number().default(0),
      qcmReussis: z.number().default(0),
      indices: z.number().default(0),
      flashcards: z.number().default(0),
      revisions: z.number().default(0),
      /** Séries d'exercices terminées (seules elles font avancer le streak). */
      series: z.number().default(0),
    })
    .default({}),
  reglages: z.object({ sons: z.boolean().default(true), animations: z.boolean().default(true) }).default({}),
  /** Nombre de réponses par jour (AAAA-MM-JJ). */
  journal: z.record(z.number()).default({}),
});

export type Progression = z.infer<typeof ProgressionSchema>;
export type StatType = z.infer<typeof Stat>;

export const progressionVide = (): Progression => ProgressionSchema.parse({});

const CLE_STOCKAGE = 'math-quest:progression:v1';

/** Lecture tolérante : renvoie une progression vide si rien n'est stocké ou si c'est illisible. */
export function charger(stockage: Pick<Storage, 'getItem'> | null = safeStorage()): Progression {
  try {
    const brut = stockage?.getItem(CLE_STOCKAGE);
    if (!brut) return progressionVide();
    const res = ProgressionSchema.safeParse(JSON.parse(brut));
    return res.success ? res.data : progressionVide();
  } catch {
    return progressionVide();
  }
}

export function sauvegarder(p: Progression, stockage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    stockage?.setItem(CLE_STOCKAGE, JSON.stringify(p));
  } catch {
    /* stockage plein ou interdit (navigation privée) : on continue en mémoire */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function exporter(p: Progression): string {
  return JSON.stringify({ application: 'math-quest', exporteLe: new Date().toISOString(), progression: p }, null, 2);
}

/** Import d'une sauvegarde : renvoie la progression ou un message d'erreur lisible. */
export function importer(texte: string): { ok: true; progression: Progression } | { ok: false; message: string } {
  let json: unknown;
  try {
    json = JSON.parse(texte);
  } catch {
    return { ok: false, message: "Ce fichier n'est pas du JSON valide." };
  }
  const obj = (json && typeof json === 'object' && 'progression' in json ? (json as { progression: unknown }).progression : json) ?? {};
  const res = ProgressionSchema.safeParse(obj);
  if (!res.success) return { ok: false, message: `Sauvegarde invalide : ${res.error.issues[0]?.path.join('.')} ${res.error.issues[0]?.message}` };
  return { ok: true, progression: res.data };
}

/** Ajoute une tentative aux statistiques chapitre × type. */
export function compterStat(p: Progression, chapitre: string, type: TypeQuestion, correct: boolean): void {
  const parType = (p.stats[chapitre] ??= {});
  const s = (parType[type] ??= { tentatives: 0, reussites: 0 });
  s.tentatives++;
  if (correct) s.reussites++;
}
