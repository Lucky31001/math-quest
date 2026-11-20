/**
 * Chargement du contenu.
 *
 *   content/catalogue.json        niveaux (années) → matières (couleur, emblème…)
 *   content/<matière>/*.json      un fichier par chapitre (champ « monde » = id de la matière)
 *
 * Le contenu est VALIDÉ AU BUILD par le plugin « contenu » (vite.config.ts,
 * src/core/validation.ts) : un fichier invalide fait échouer le build. Ce module
 * reçoit donc des données déjà validées (valeurs par défaut comprises) et
 * n'embarque pas les schémas Zod du contenu.
 *
 * Au démarrage, seul l'INDEX est chargé : le catalogue et le RÉSUMÉ de chaque
 * chapitre (titre, icône, identifiants des questions…). Le chapitre complet
 * (cours, énoncés, flashcards) est un fichier séparé, chargé à la demande par
 * `chargerChapitre`.
 */
import type { Catalogue, Chapitre, ChapitreResume, Matiere, Niveau } from './schema';
import catalogue from '../../content/catalogue.json';

export interface Index {
  catalogue: Catalogue;
  chapitres: ChapitreResume[];
}

const resumes = import.meta.glob('/content/*/*.json', { eager: true, query: '?resume', import: 'default' }) as Record<string, ChapitreResume>;
const complets = import.meta.glob('/content/*/*.json', { import: 'default' }) as Record<string, () => Promise<Chapitre>>;

/** Tri : ordre du catalogue (niveau puis matière), puis « ordre » dans la matière. */
function indexer(cat: Catalogue, fichiers: Record<string, ChapitreResume>): Index & { fichierDe: Map<string, string> } {
  const matieres = cat.niveaux.flatMap((n) => n.matieres.map((m) => m.id));
  const rang = (m: string) => matieres.indexOf(m);
  const fichierDe = new Map(Object.entries(fichiers).map(([f, c]) => [c.id, f]));
  const chapitres = Object.values(fichiers).sort((a, b) => (a.monde === b.monde ? a.ordre - b.ordre : rang(a.monde) - rang(b.monde)));
  return { catalogue: cat, chapitres, fichierDe };
}

const { fichierDe, ...index } = indexer(catalogue as Catalogue, resumes);
/** Catalogue + résumés des chapitres (chargés au démarrage). */
export const INDEX: Index = index;

const cache = new Map<string, Promise<Chapitre>>();

/** Chapitre introuvable ou impossible à charger (ex. hors ligne sans cache). */
export class ErreurChapitre extends Error {
  constructor(
    readonly fichier: string,
    readonly messages: string[],
  ) {
    super(`${fichier} : ${messages.join(' ; ')}`);
  }
}

/** Chapitre complet, chargé une seule fois. */
export function chargerChapitre(id: string): Promise<Chapitre> {
  const deja = cache.get(id);
  if (deja) return deja;
  const fichier = fichierDe.get(id);
  const promesse = fichier ? complets[fichier]() : Promise.reject(new ErreurChapitre(id, ['chapitre introuvable']));
  cache.set(id, promesse);
  promesse.catch(() => cache.delete(id)); // on pourra réessayer
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
