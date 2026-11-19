/**
 * Registre des générateurs d'exercices aléatoires.
 * Pour en ajouter un : créer le générateur (voir outils.ts › Generateur) puis l'ajouter à GENERATEURS.
 */
import { createRng, randomSeed } from '../core/random';
import type { Difficulte, Question } from '../core/schema';
import type { Forme, Generateur } from './outils';
import { racineCarree, formeExponentielle } from './complexes';
import { binome, sommeGeometrique } from './sommes';
import { resteDivision, divisionEuclidienne } from './polynomes';
import { inverse2x2, determinant3x3 } from './matrices';
import { familleLibre } from './espaces-vectoriels';
import { derivees } from './derivees';
import { dlOrdre3 } from './developpements-limites';
import { primitives, integralePolynome } from './integration';
import { edoOrdre1, edoOrdre2 } from './equations-differentielles';
import { limiteSuite, arithmeticoGeometrique } from './suites';
import { limitesUsuelles, trigoReciproques } from './limites-fonctions';
import { tableVerite, negationQuantifiee, denombrement } from './logique-ensembles';
import { sommesUsuelles, coefficientsRacines, produitMatrices, systeme2x2, dimensionEquations } from './algebre-extra';
import { suiteOrdre2, limitesFactorisation, tangente, limiteParDl, expLn } from './analyse-extra';

export type { Forme, Generateur } from './outils';

export const GENERATEURS: readonly Generateur[] = [
  tableVerite,
  negationQuantifiee,
  denombrement,
  sommesUsuelles,
  coefficientsRacines,
  produitMatrices,
  systeme2x2,
  dimensionEquations,
  suiteOrdre2,
  limitesFactorisation,
  tangente,
  limiteParDl,
  expLn,
  racineCarree,
  formeExponentielle,
  binome,
  sommeGeometrique,
  resteDivision,
  divisionEuclidienne,
  inverse2x2,
  determinant3x3,
  familleLibre,
  trigoReciproques,
  limiteSuite,
  arithmeticoGeometrique,
  limitesUsuelles,
  derivees,
  dlOrdre3,
  primitives,
  integralePolynome,
  edoOrdre1,
  edoOrdre2,
];

export const generateursDu = (chapitre: string): Generateur[] => GENERATEURS.filter((g) => g.chapitre === chapitre);

export const generateurParId = (id: string): Generateur | undefined => GENERATEURS.find((g) => g.id === id);

/** Préfixe des identifiants de questions générées : « gen~<générateur>~<graine>~<difficulté> ». */
export const PREFIXE_GEN = 'gen~';

/**
 * Produit une question à partir d'un générateur. La graine et la difficulté
 * sont encodées dans l'identifiant : la même graine redonne la même question.
 */
export function generer(g: Generateur, difficulte: Difficulte, forme?: Forme, graine = randomSeed()): Question {
  const rng = createRng(graine);
  const f: Forme = forme && g.formes.includes(forme) ? forme : g.formes[Math.floor(rng() * g.formes.length)];
  const q = g.generer(rng, difficulte, f);
  return { ...q, id: `${PREFIXE_GEN}${g.id}~${graine}~${difficulte}` };
}

export const estGeneree = (id: string): boolean => id.startsWith(PREFIXE_GEN);
