/**
 * Progression de l'élève : modèle, sauvegarde localStorage, export/import JSON.
 *
 * Le format est versionné et validé (Zod) : un fichier importé ou un
 * localStorage corrompu ne peut pas casser l'application — les champs
 * manquants reprennent leur valeur par défaut.
 */
import { z } from 'zod';
import type { TypeQuestion } from '../core/schema';
import { migrer } from './migrations';

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
  questions: z.record(z.string(), Leitner).default({}),
  /** Flashcards, clé « chapitre/id ». */
  flashcards: z.record(z.string(), Leitner).default({}),
  /** Statistiques par chapitre puis par type de question (questions générées comprises). */
  stats: z.record(z.string(), z.record(z.string(), Stat)).default({}),
  streak: z
    .object({ courant: z.number().int().default(0), record: z.number().int().default(0), dernierJour: z.string().nullable().default(null) })
    .prefault({}),
  /** Badges débloqués : id → date. */
  badges: z.record(z.string(), z.string()).default({}),
  records: z
    .object({
      survie: z.number().default(0),
      eclair: z.number().default(0),
      eclairParfait: z.boolean().default(false),
      meilleurCombo: z.number().default(0),
      boss: z.record(z.string(), z.object({ meilleur: z.number(), vaincu: z.boolean(), sansIndice: z.boolean().default(false) })).default({}),
      /** Meilleure note (sur 20) à l'examen blanc, par matière. Ajout compatible : valeur par défaut. */
      examens: z.record(z.string(), z.number().min(0).max(20)).default({}),
      /** Toutes les notes d'examen blanc, par matière, de la plus ancienne à la plus récente (30 au plus). Ajout compatible. */
      historiqueExamens: z.record(z.string(), z.array(z.object({ date: z.string(), note: z.number().min(0).max(20) }))).default({}),
    })
    .prefault({}),
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
    .prefault({}),
  reglages: z.object({ sons: z.boolean().default(true), animations: z.boolean().default(true) }).prefault({}),
  /**
   * Pièges dans lesquels l'élève est tombé : distracteur choisi (QCM) ou
   * justification fausse (vrai/faux). Clé « chapitre/question#choix », ou
   * « gen~<générateur>#<explication> » pour les questions générées (la même
   * erreur typique se retrouve d'une question à l'autre). Ajout compatible.
   */
  pieges: z
    .record(
      z.string(),
      z.object({ n: z.number().int().positive(), chapitre: z.string(), texte: z.string(), explication: z.string(), derniere: z.string() }),
    )
    .default({}),
  /** Nombre de réponses par jour (AAAA-MM-JJ). */
  journal: z.record(z.string(), z.number()).default({}),
});

export type Progression = z.infer<typeof ProgressionSchema>;

export const progressionVide = (): Progression => ProgressionSchema.parse({});

const CLE_STOCKAGE = 'math-quest:progression:v1';

/** Préfixe des copies de sécurité d'une sauvegarde illisible (jamais écrasées en silence). */
export const PREFIXE_COPIE = 'math-quest:copie-securite:';

/** Résultat détaillé d'un chargement, pour avertir l'élève en cas de problème. */
export interface RapportChargement {
  /**
   * - `nouvelle` : aucune sauvegarde ; `ok` : lue telle quelle (éventuellement migrée) ;
   * - `reparee` : seuls les éléments invalides ont été réinitialisés ;
   * - `reinitialisee` : sauvegarde illisible (JSON cassé, migration manquante) ;
   * - `version-future` : créée par une version plus récente de l'application.
   */
  statut: 'nouvelle' | 'ok' | 'reparee' | 'reinitialisee' | 'version-future';
  /** Versions de départ des migrations appliquées. */
  migrations: number[];
  /** Chemins des éléments invalides réinitialisés (ex. « questions.analyse/q3 »). */
  perdus: string[];
  /** Clé de la copie de sécurité de la sauvegarde d'origine, s'il a fallu en faire une. */
  copie: string | null;
}

type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Récupération partielle : renvoie une valeur conforme au schéma en ne
 * supprimant que ce qui est invalide (un champ reprend sa valeur par défaut,
 * une entrée de dictionnaire invalide est retirée). `undefined` = à retirer.
 */
function reparer(schema: z.ZodType, v: unknown, chemin: string, perdus: string[]): unknown {
  if (schema.safeParse(v).success) return v;
  const s = schema instanceof z.ZodDefault || schema instanceof z.ZodPrefault ? (schema.unwrap() as z.ZodType) : schema;
  if (estObjet(v) && (s instanceof z.ZodObject || s instanceof z.ZodRecord)) {
    const internes: string[] = [];
    const out: Objet = {};
    const enfants: [string, z.ZodType][] =
      s instanceof z.ZodObject
        ? Object.entries(s.shape as Record<string, z.ZodType>)
        : Object.keys(v).map((k) => [k, s.valueType as z.ZodType]);
    for (const [k, sous] of enfants) {
      const r = reparer(sous, v[k], chemin ? `${chemin}.${k}` : k, internes);
      if (r !== undefined) out[k] = r;
    }
    if (schema.safeParse(out).success) {
      perdus.push(...internes);
      return out;
    }
  }
  perdus.push(chemin || '(racine)');
  return undefined;
}

/** Lecture sûre de la sauvegarde ; voir `chargerAvecRapport`. */
export function charger(stockage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): Progression {
  return chargerAvecRapport(stockage).progression;
}

/**
 * Lecture sûre : migre les anciennes sauvegardes vers le format actuel, puis
 * réinitialise UNIQUEMENT les éléments invalides. Dès qu'une donnée serait
 * perdue, une COPIE BRUTE de la sauvegarde d'origine est conservée sous une
 * autre clé : la progression n'est jamais perdue définitivement.
 */
export function chargerAvecRapport(stockage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): {
  progression: Progression;
  rapport: RapportChargement;
} {
  const rapport: RapportChargement = { statut: 'nouvelle', migrations: [], perdus: [], copie: null };
  let brut: string | null | undefined;
  try {
    brut = stockage?.getItem(CLE_STOCKAGE);
  } catch {
    return { progression: progressionVide(), rapport };
  }
  if (!brut) return { progression: progressionVide(), rapport };

  let progression: Progression | null = null;
  try {
    const json: unknown = JSON.parse(brut);
    const m = migrer(estObjet(json) ? json : {});
    if (m.ok) {
      rapport.migrations = m.appliquees;
      const donnees = reparer(ProgressionSchema, m.donnees, '', rapport.perdus);
      const res = ProgressionSchema.safeParse(donnees ?? {});
      if (res.success) progression = res.data;
      rapport.statut = rapport.perdus.length ? 'reparee' : 'ok';
    } else {
      rapport.statut = m.raison === 'version-future' ? 'version-future' : 'reinitialisee';
    }
  } catch {
    rapport.statut = 'reinitialisee';
  }
  if (rapport.statut !== 'ok') rapport.copie = copierSauvegarde(stockage, brut);
  return { progression: progression ?? progressionVide(), rapport };
}

/** Conserve une copie brute de la sauvegarde ; renvoie sa clé (ou null si le stockage la refuse). */
function copierSauvegarde(stockage: Pick<Storage, 'setItem'> | null, brut: string): string | null {
  const cle = `${PREFIXE_COPIE}${new Date().toISOString()}`;
  try {
    stockage?.setItem(cle, brut);
    return stockage ? cle : null;
  } catch {
    return null; /* stockage plein : on ne peut rien de plus */
  }
}

export interface CopieSecurite {
  cle: string;
  /** Date ISO de la copie. */
  date: string;
  contenu: string;
}

type StockageListable = Pick<Storage, 'length' | 'key' | 'getItem'>;

/** Copies de sécurité présentes, de la plus récente à la plus ancienne. */
export function listerCopies(stockage: StockageListable | null = safeStorage()): CopieSecurite[] {
  const copies: CopieSecurite[] = [];
  try {
    for (let i = 0; i < (stockage?.length ?? 0); i++) {
      const cle = stockage!.key(i);
      if (!cle?.startsWith(PREFIXE_COPIE)) continue;
      copies.push({ cle, date: cle.slice(PREFIXE_COPIE.length), contenu: stockage!.getItem(cle) ?? '' });
    }
  } catch {
    /* stockage interdit */
  }
  return copies.sort((a, b) => b.date.localeCompare(a.date));
}

export function supprimerCopie(cle: string, stockage: Pick<Storage, 'removeItem'> | null = safeStorage()): void {
  if (!cle.startsWith(PREFIXE_COPIE)) return;
  try {
    stockage?.removeItem(cle);
  } catch {
    /* stockage interdit */
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
  const m = migrer(estObjet(obj) ? obj : {});
  if (!m.ok)
    return {
      ok: false,
      message:
        m.raison === 'version-future'
          ? `Cette sauvegarde vient d'une version plus récente de Math Quest (format v${m.version}). Recharge la page pour mettre l'application à jour.`
          : `Format de sauvegarde v${m.version} non pris en charge.`,
    };
  const res = ProgressionSchema.safeParse(m.donnees);
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
