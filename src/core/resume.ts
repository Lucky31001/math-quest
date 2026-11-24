/**
 * Résumé d'un fichier de chapitre (métadonnées + identifiants des questions et
 * flashcards), calculé AU BUILD par le plugin Vite « resume-chapitres »
 * (vite.config.ts) : seul ce résumé est dans le bundle de démarrage.
 *
 * Sans dépendance (importé par vite.config.ts). Ne valide rien : le loader
 * valide le résumé (ChapitreResumeSchema) puis le chapitre complet à son chargement.
 */
type Objet = Record<string, unknown>;
const objet = (v: unknown): Objet => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Objet) : {});
const liste = (v: unknown): Objet[] => (Array.isArray(v) ? v.map(objet) : []);

export function resumerChapitre(brut: unknown): Objet {
  const c = objet(brut);
  return {
    id: c.id,
    monde: c.monde,
    ordre: c.ordre,
    semestre: c.semestre,
    titre: c.titre,
    icone: c.icone,
    resume: c.resume,
    exercices: liste(c.exercices).map((q) => ({ id: q.id, type: q.type, difficulte: q.difficulte })),
    flashcards: liste(c.flashcards).map((f) => ({ id: f.id })),
  };
}

/** Requête d'import qui demande le résumé d'un fichier de chapitre. */
export const REQUETE_RESUME = '?resume';
