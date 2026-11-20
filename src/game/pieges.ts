/**
 * Pièges : le distracteur choisi (QCM) ou la justification fausse (vrai/faux)
 * dit QUELLE erreur l'élève a faite, grâce à son explication. On les compte
 * pour repérer les confusions récurrentes (écran Statistiques).
 */
import type { Question } from '../core/schema';
import type { Resultat } from '../core/grading';
import type { PiegeTombe } from './progres';

/**
 * Pièges d'une réponse ratée. Question fixe : clé « chapitre/question#choix ».
 * Question générée : clé « gen~<générateur>#<explication> », car la même erreur
 * typique (même explication) revient d'une question générée à l'autre.
 */
export function piegesDe(q: Question, r: Resultat, cleQuestion: string | null): PiegeTombe[] {
  const choix = q.type === 'qcm' ? q.choix : q.type === 'vrai-faux' ? q.justifications : null;
  if (!choix || !r.fausses?.length) return [];
  const generateur = /^gen~([^~]+)~/.exec(q.id)?.[1];
  if (!cleQuestion && !generateur) return [];
  return r.fausses.map((i) => ({
    cle: cleQuestion ? `${cleQuestion}#${i}` : `gen~${generateur}#${choix[i].explication}`,
    texte: choix[i].texte,
    explication: choix[i].explication,
  }));
}
