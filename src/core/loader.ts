/**
 * Chargement et validation du contenu (/content/algebre/*.json, /content/analyse/*.json).
 *
 * Les fichiers sont importés au build par Vite (import.meta.glob) puis validés
 * avec le schéma Zod. Un fichier invalide n'empêche pas l'application de
 * démarrer : il est écarté et l'erreur est affichée sur l'écran d'accueil.
 */
import { ChapitreSchema, type Chapitre, type Question } from './schema';

export interface ErreurContenu {
  fichier: string;
  messages: string[];
}

export interface Contenu {
  chapitres: Chapitre[];
  erreurs: ErreurContenu[];
}

/** Valide un ensemble de fichiers { chemin: contenu JSON }. */
export function validerContenu(fichiers: Record<string, unknown>): Contenu {
  const chapitres: Chapitre[] = [];
  const erreurs: ErreurContenu[] = [];
  for (const [fichier, brut] of Object.entries(fichiers)) {
    if (fichier.endsWith('schema.json')) continue;
    const res = ChapitreSchema.safeParse(brut);
    if (!res.success) {
      erreurs.push({
        fichier,
        messages: res.error.issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`),
      });
      continue;
    }
    const ch = res.data;
    const messages: string[] = [];
    // Le dossier doit correspondre au monde déclaré.
    if (!fichier.includes(`/${ch.monde}/`)) messages.push(`monde « ${ch.monde} » mais fichier hors du dossier ${ch.monde}/`);
    // Identifiants uniques dans le chapitre.
    const ids = [...ch.exercices.map((q) => q.id), ...ch.flashcards.map((f) => f.id)];
    const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (doublons.length) messages.push(`identifiants en double : ${[...new Set(doublons)].join(', ')}`);
    if (chapitres.some((c) => c.id === ch.id)) messages.push(`chapitre « ${ch.id} » déjà défini`);
    if (messages.length) erreurs.push({ fichier, messages });
    else chapitres.push(ch);
  }
  chapitres.sort((a, b) => (a.monde === b.monde ? a.ordre - b.ordre : a.monde === 'algebre' ? -1 : 1));
  return { chapitres, erreurs };
}

const fichiers = import.meta.glob('/content/**/*.json', { eager: true, import: 'default' });

/** Contenu de l'application (validé une seule fois au démarrage). */
export const CONTENU: Contenu = validerContenu(fichiers);

export const chapitreParId = (id: string): Chapitre | undefined => CONTENU.chapitres.find((c) => c.id === id);

/** Clé globale d'une question / flashcard : « chapitre/id ». */
export const cle = (chapitre: string, id: string): string => `${chapitre}/${id}`;

export interface QuestionLocalisee {
  chapitre: Chapitre;
  question: Question;
}

/** Toutes les questions fixes, avec leur chapitre. */
export function toutesLesQuestions(): QuestionLocalisee[] {
  return CONTENU.chapitres.flatMap((chapitre) => chapitre.exercices.map((question) => ({ chapitre, question })));
}
