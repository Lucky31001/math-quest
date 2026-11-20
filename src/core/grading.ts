/**
 * Correction d'une réponse, quel que soit le type de question.
 *
 * Les indices de choix manipulés ici sont TOUJOURS ceux du fichier JSON (ordre
 * d'origine) : le mélange à l'affichage est géré par l'interface, qui retraduit
 * la sélection avant d'appeler `corriger`.
 */
import type { Question, Qcm, VraiFaux, TrouveErreur, Programme } from './schema';
import { verifierExpression, verifierNumerique, type Statut } from './checker';

export type Reponse =
  | { type: 'qcm'; choix: number[] }
  | { type: 'numerique'; saisie: string }
  | { type: 'expression'; saisie: string }
  | { type: 'vrai-faux'; valeur: boolean; justification: number }
  | { type: 'trouve-erreur'; etape: number }
  | { type: 'programme'; execution: ExecutionProgramme };

/** Ce qu'a donné le programme de l'élève sur un cas de test. */
export type SortieCas =
  | { sortie: string; code: number }
  | { probleme: 'temps' | 'plantage' | 'trop-long'; sortie: string };

/** Résultat de la compilation puis de l'exécution sur chaque cas de test (dans l'ordre de `tests`). */
export type ExecutionProgramme = { compilation: string } | { sorties: SortieCas[] };

export interface Resultat {
  statut: Statut;
  message?: string;
  /** QCM multiple : nombre de choix bien traités (cochés à raison ou laissés à raison). */
  bienTraites?: number;
  /** Vrai/faux : la valeur était bonne mais pas la justification (ou l'inverse). */
  partiel?: boolean;
  /** Programme : nombre de tests réussis. */
  testsReussis?: number;
}

/**
 * QCM : juste si l'ensemble des choix cochés est EXACTEMENT l'ensemble des bonnes
 * réponses (aucune oubliée, aucune mauvaise cochée). Vaut pour les deux variantes.
 */
export function corrigerQcm(q: Qcm, choix: readonly number[]): Resultat {
  const coches = new Set(choix);
  if (coches.size === 0) return { statut: 'invalide', message: 'Sélectionne au moins une réponse.' };
  if (!q.multiple && coches.size > 1)
    return { statut: 'invalide', message: 'Une seule réponse possible pour ce QCM.' };
  for (const c of coches)
    if (!Number.isInteger(c) || c < 0 || c >= q.choix.length)
      return { statut: 'invalide', message: `Choix ${c} inexistant.` };
  let bienTraites = 0;
  q.choix.forEach((c, i) => {
    if (c.correct === coches.has(i)) bienTraites++;
  });
  return { statut: bienTraites === q.choix.length ? 'correct' : 'incorrect', bienTraites };
}

/** Vrai/faux avec justification : il faut la bonne valeur ET la bonne justification. */
export function corrigerVraiFaux(q: VraiFaux, valeur: boolean, justification: number): Resultat {
  const j = q.justifications[justification];
  if (!j) return { statut: 'invalide', message: 'Choisis une justification.' };
  const valeurOk = valeur === q.reponse;
  const justOk = j.correct;
  return {
    statut: valeurOk && justOk ? 'correct' : 'incorrect',
    partiel: valeurOk !== justOk,
  };
}

export function corrigerTrouveErreur(q: TrouveErreur, etape: number): Resultat {
  if (!Number.isInteger(etape) || etape < 0 || etape >= q.etapes.length)
    return { statut: 'invalide', message: 'Clique sur une étape.' };
  return { statut: etape === q.etapeFausse ? 'correct' : 'incorrect' };
}

/** Sorties égales, aux espaces de fin de ligne et aux lignes vides finales près. */
export function memeSortie(attendue: string, obtenue: string): boolean {
  const normaliser = (t: string) => t.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '');
  return normaliser(attendue) === normaliser(obtenue);
}

/** Juste si le programme compile et réussit TOUS les tests. Une erreur de compilation n'est pas comptée (à corriger). */
export function corrigerProgramme(q: Programme, e: ExecutionProgramme): Resultat {
  if ('compilation' in e) return { statut: 'invalide', message: 'Ton code ne compile pas : corrige les erreurs puis vérifie à nouveau.' };
  if (e.sorties.length !== q.tests.length) throw new Error(`${e.sorties.length} sorties pour ${q.tests.length} tests`);
  const testsReussis = q.tests.filter((t, i) => {
    const s = e.sorties[i];
    return !('probleme' in s) && memeSortie(t.sortie, s.sortie);
  }).length;
  return { statut: testsReussis === q.tests.length ? 'correct' : 'incorrect', testsReussis };
}

export function corriger(q: Question, r: Reponse): Resultat {
  if (q.type !== r.type) throw new Error(`Réponse de type ${r.type} pour une question ${q.type}`);
  switch (q.type) {
    case 'qcm':
      return corrigerQcm(q, (r as Extract<Reponse, { type: 'qcm' }>).choix);
    case 'numerique':
      return verifierNumerique((r as Extract<Reponse, { type: 'numerique' }>).saisie, q.reponse, q.tolerance);
    case 'expression':
      return verifierExpression((r as Extract<Reponse, { type: 'expression' }>).saisie, q.reponse, {
        variables: q.variables,
        domaine: q.domaine,
        aConstantePres: q.aConstantePres,
      });
    case 'vrai-faux': {
      const v = r as Extract<Reponse, { type: 'vrai-faux' }>;
      return corrigerVraiFaux(q, v.valeur, v.justification);
    }
    case 'trouve-erreur':
      return corrigerTrouveErreur(q, (r as Extract<Reponse, { type: 'trouve-erreur' }>).etape);
    case 'programme':
      return corrigerProgramme(q, (r as Extract<Reponse, { type: 'programme' }>).execution);
  }
}
