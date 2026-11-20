/**
 * Chargement et validation du contenu.
 *
 *   content/catalogue.json        niveaux (années) → matières (couleur, emblème…)
 *   content/<matière>/*.json      un fichier par chapitre (champ « monde » = id de la matière)
 *
 * Au démarrage, seul l'INDEX est chargé : le catalogue et le RÉSUMÉ de chaque
 * chapitre (titre, icône, identifiants des questions…), calculé au build par
 * le plugin « resume-chapitres » (vite.config.ts). Le chapitre complet (cours,
 * énoncés, flashcards) est un fichier séparé, chargé à la demande par
 * `chargerChapitre` puis validé avec le schéma Zod.
 *
 * Un chapitre invalide n'empêche pas l'application de démarrer : il est écarté
 * et l'erreur est affichée sur l'écran d'accueil (ou à son ouverture).
 */
import {
  CatalogueSchema,
  ChapitreResumeSchema,
  ChapitreSchema,
  type Catalogue,
  type Chapitre,
  type ChapitreResume,
  type Matiere,
  type Niveau,
} from './schema';
import catalogueBrut from '../../content/catalogue.json';

export interface ErreurContenu {
  fichier: string;
  messages: string[];
}

/** Index (résumés) ou contenu complet, selon le schéma utilisé pour valider. */
interface Valide<C> {
  catalogue: Catalogue;
  chapitres: C[];
  erreurs: ErreurContenu[];
}
export type Index = Valide<ChapitreResume>;
export type Contenu = Valide<Chapitre>;

/** Catalogue de secours si catalogue.json est absent ou invalide (l'erreur est signalée). */
const CATALOGUE_VIDE: Catalogue = { niveaux: [] };

const messagesZod = (issues: readonly { path: readonly PropertyKey[]; message: string }[]) =>
  issues.map((i) => `${i.path.map(String).join('.') || '(racine)'} : ${i.message}`);

/** Incohérences d'un chapitre valide (matière inconnue, mauvais dossier, identifiants en double). */
function incoherences(fichier: string, ch: ChapitreResume, matieres: readonly string[] | null): string[] {
  const messages: string[] = [];
  if (matieres && !matieres.includes(ch.monde)) messages.push(`matière « ${ch.monde} » absente de content/catalogue.json`);
  // Le dossier doit correspondre à la matière déclarée.
  if (!fichier.includes(`/${ch.monde}/`)) messages.push(`matière « ${ch.monde} » mais fichier hors du dossier ${ch.monde}/`);
  const ids = [...ch.exercices.map((q) => q.id), ...ch.flashcards.map((f) => f.id)];
  const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (doublons.length) messages.push(`identifiants en double : ${[...new Set(doublons)].join(', ')}`);
  return messages;
}

function valider<C extends ChapitreResume>(
  schema: { safeParse(v: unknown): { success: true; data: C } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
  fichiers: Record<string, unknown>,
  catalogueBrut: unknown,
): Valide<C> & { fichiers: Map<string, string> } {
  const erreurs: ErreurContenu[] = [];
  const cat = CatalogueSchema.safeParse(catalogueBrut);
  if (!cat.success) erreurs.push({ fichier: '/content/catalogue.json', messages: messagesZod(cat.error.issues) });
  const catalogue = cat.success ? cat.data : CATALOGUE_VIDE;
  const matieres = catalogue.niveaux.flatMap((n) => n.matieres.map((m) => m.id));

  const chapitres: C[] = [];
  const parId = new Map<string, string>();
  for (const [fichier, brut] of Object.entries(fichiers)) {
    if (/\/(schema|catalogue|catalogue\.schema)\.json$/.test(fichier)) continue;
    const res = schema.safeParse(brut);
    if (!res.success) {
      erreurs.push({ fichier, messages: messagesZod(res.error.issues) });
      continue;
    }
    const ch = res.data;
    const messages = incoherences(fichier, ch, cat.success ? matieres : null);
    if (parId.has(ch.id)) messages.push(`chapitre « ${ch.id} » déjà défini`);
    if (messages.length) erreurs.push({ fichier, messages });
    else {
      chapitres.push(ch);
      parId.set(ch.id, fichier);
    }
  }
  // Ordre : celui du catalogue (niveau puis matière), puis « ordre » dans la matière.
  const rang = (m: string) => matieres.indexOf(m);
  chapitres.sort((a, b) => (a.monde === b.monde ? a.ordre - b.ordre : rang(a.monde) - rang(b.monde)));
  return { catalogue, chapitres, erreurs, fichiers: parId };
}

/** Valide le catalogue et des chapitres COMPLETS { chemin: contenu JSON } (tests, outils). */
export function validerContenu(fichiers: Record<string, unknown>, catalogueBrut: unknown): Contenu {
  const { catalogue, chapitres, erreurs } = valider(ChapitreSchema, fichiers, catalogueBrut);
  return { catalogue, chapitres, erreurs };
}

/** Valide le catalogue et des RÉSUMÉS de chapitres. */
export function validerIndex(fichiers: Record<string, unknown>, catalogueBrut: unknown): Index & { fichiers: Map<string, string> } {
  return valider(ChapitreResumeSchema, fichiers, catalogueBrut);
}

/* ------------------------------------------------------------------ */
/* Index (démarrage) et chapitres complets (à la demande)              */
/* ------------------------------------------------------------------ */

const resumes = import.meta.glob('/content/*/*.json', { eager: true, query: '?resume', import: 'default' });
const complets = import.meta.glob('/content/*/*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>;

const { fichiers: fichierDe, ...index } = validerIndex(resumes, catalogueBrut);
/** Catalogue + résumés des chapitres valides (chargés au démarrage). */
export const INDEX: Index = index;

const cache = new Map<string, Promise<Chapitre>>();

/** Erreur de chargement d'un chapitre (fichier invalide ou introuvable). */
export class ErreurChapitre extends Error {
  constructor(readonly erreur: ErreurContenu) {
    super(`${erreur.fichier} : ${erreur.messages.join(' ; ')}`);
  }
}

/** Chapitre complet, chargé (une seule fois) puis validé. */
export function chargerChapitre(id: string): Promise<Chapitre> {
  const deja = cache.get(id);
  if (deja) return deja;
  const fichier = fichierDe.get(id);
  const promesse = (async () => {
    if (!fichier) throw new ErreurChapitre({ fichier: id, messages: ['chapitre introuvable'] });
    const res = ChapitreSchema.safeParse(await complets[fichier]());
    if (!res.success) throw new ErreurChapitre({ fichier, messages: messagesZod(res.error.issues) });
    const messages = incoherences(fichier, res.data, null);
    if (res.data.id !== id) messages.push(`identifiant « ${res.data.id} » différent de l'index (« ${id} »)`);
    if (messages.length) throw new ErreurChapitre({ fichier, messages });
    return res.data;
  })();
  cache.set(id, promesse);
  promesse.catch(() => cache.delete(id)); // on pourra réessayer (ex. hors ligne sans cache)
  return promesse;
}

/** Plusieurs chapitres complets, dans l'ordre des identifiants donnés. */
export const chargerChapitres = (ids: readonly string[]): Promise<Chapitre[]> => Promise.all(ids.map(chargerChapitre));

/** Tous les chapitres complets (modes Survie et QCM éclair). */
export const chargerTout = (): Promise<Chapitre[]> => chargerChapitres(INDEX.chapitres.map((c) => c.id));

export const chapitreParId = (id: string): ChapitreResume | undefined => INDEX.chapitres.find((c) => c.id === id);

/** Toutes les matières, dans l'ordre du catalogue. */
export const toutesLesMatieres = (): Matiere[] => INDEX.catalogue.niveaux.flatMap((n) => n.matieres);

export const matiereParId = (id: string): Matiere | undefined => toutesLesMatieres().find((m) => m.id === id);

export const niveauDeMatiere = (id: string): Niveau | undefined => INDEX.catalogue.niveaux.find((n) => n.matieres.some((m) => m.id === id));

export const chapitresDe = (matiere: string): ChapitreResume[] => INDEX.chapitres.filter((c) => c.monde === matiere);

/** Variables CSS de couleur d'une matière, à poser en style inline. */
export const styleMatiere = (m: Matiere | undefined): string =>
  m ? `--couleur:${m.couleur};--couleur-fonce:${m.couleurFonce}` : '';

/** Clé globale d'une question / flashcard : « chapitre/id ». */
export const cle = (chapitre: string, id: string): string => `${chapitre}/${id}`;
