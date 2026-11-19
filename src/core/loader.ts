/**
 * Chargement et validation du contenu.
 *
 *   content/catalogue.json        niveaux (années) → matières (couleur, emblème…)
 *   content/<matière>/*.json      un fichier par chapitre (champ « monde » = id de la matière)
 *
 * Les fichiers sont importés au build par Vite (import.meta.glob) puis validés
 * avec les schémas Zod. Un chapitre invalide n'empêche pas l'application de
 * démarrer : il est écarté et l'erreur est affichée sur l'écran d'accueil.
 */
import { CatalogueSchema, ChapitreSchema, type Catalogue, type Chapitre, type Matiere, type Niveau } from './schema';

export interface ErreurContenu {
  fichier: string;
  messages: string[];
}

export interface Contenu {
  catalogue: Catalogue;
  chapitres: Chapitre[];
  erreurs: ErreurContenu[];
}

/** Catalogue de secours si catalogue.json est absent ou invalide (l'erreur est signalée). */
const CATALOGUE_VIDE: Catalogue = { niveaux: [] };

/** Valide le catalogue et un ensemble de fichiers de chapitres { chemin: contenu JSON }. */
export function validerContenu(fichiers: Record<string, unknown>, catalogueBrut: unknown): Contenu {
  const erreurs: ErreurContenu[] = [];
  const cat = CatalogueSchema.safeParse(catalogueBrut);
  if (!cat.success)
    erreurs.push({ fichier: '/content/catalogue.json', messages: cat.error.issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`) });
  const catalogue = cat.success ? cat.data : CATALOGUE_VIDE;
  const matieres = catalogue.niveaux.flatMap((n) => n.matieres.map((m) => m.id));

  const chapitres: Chapitre[] = [];
  for (const [fichier, brut] of Object.entries(fichiers)) {
    if (/\/(schema|catalogue|catalogue\.schema)\.json$/.test(fichier)) continue;
    const res = ChapitreSchema.safeParse(brut);
    if (!res.success) {
      erreurs.push({ fichier, messages: res.error.issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`) });
      continue;
    }
    const ch = res.data;
    const messages: string[] = [];
    if (cat.success && !matieres.includes(ch.monde)) messages.push(`matière « ${ch.monde} » absente de content/catalogue.json`);
    // Le dossier doit correspondre à la matière déclarée.
    if (!fichier.includes(`/${ch.monde}/`)) messages.push(`matière « ${ch.monde} » mais fichier hors du dossier ${ch.monde}/`);
    // Identifiants uniques dans le chapitre.
    const ids = [...ch.exercices.map((q) => q.id), ...ch.flashcards.map((f) => f.id)];
    const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (doublons.length) messages.push(`identifiants en double : ${[...new Set(doublons)].join(', ')}`);
    if (chapitres.some((c) => c.id === ch.id)) messages.push(`chapitre « ${ch.id} » déjà défini`);
    if (messages.length) erreurs.push({ fichier, messages });
    else chapitres.push(ch);
  }
  // Ordre : celui du catalogue (niveau puis matière), puis « ordre » dans la matière.
  const rang = (m: string) => matieres.indexOf(m);
  chapitres.sort((a, b) => (a.monde === b.monde ? a.ordre - b.ordre : rang(a.monde) - rang(b.monde)));
  return { catalogue, chapitres, erreurs };
}

const fichiers = import.meta.glob('/content/**/*.json', { eager: true, import: 'default' });

/** Contenu de l'application (validé une seule fois au démarrage). */
export const CONTENU: Contenu = validerContenu(fichiers, fichiers['/content/catalogue.json']);

export const chapitreParId = (id: string): Chapitre | undefined => CONTENU.chapitres.find((c) => c.id === id);

/** Toutes les matières, dans l'ordre du catalogue. */
export const toutesLesMatieres = (): Matiere[] => CONTENU.catalogue.niveaux.flatMap((n) => n.matieres);

export const matiereParId = (id: string): Matiere | undefined => toutesLesMatieres().find((m) => m.id === id);

export const niveauDeMatiere = (id: string): Niveau | undefined => CONTENU.catalogue.niveaux.find((n) => n.matieres.some((m) => m.id === id));

export const chapitresDe = (matiere: string): Chapitre[] => CONTENU.chapitres.filter((c) => c.monde === matiere);

/** Variables CSS de couleur d'une matière, à poser en style inline. */
export const styleMatiere = (m: Matiere | undefined): string =>
  m ? `--couleur:${m.couleur};--couleur-fonce:${m.couleurFonce}` : '';

/** Clé globale d'une question / flashcard : « chapitre/id ». */
export const cle = (chapitre: string, id: string): string => `${chapitre}/${id}`;
