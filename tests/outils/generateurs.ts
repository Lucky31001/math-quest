/** Outils communs aux tests des générateurs d'exercices. */
import { generer, generateurParId } from '../../src/generators';
import type { Difficulte, Qcm } from '../../src/core/schema';
import type { Forme } from '../../src/generators/outils';

export const DIFFICULTES: Difficulte[] = [1, 2, 3];

/** 40 graines par défaut ; `depart` et `pas` permettent un second jeu indépendant. */
export const graines = (depart = 1000, pas = 7919) => Array.from({ length: 40 }, (_, i) => depart + i * pas);

/** Toutes les questions d'un générateur pour une forme (3 difficultés × les graines). */
export function* toutes(id: string, forme: Forme, liste = graines()) {
  const g = generateurParId(id)!;
  if (!g.formes.includes(forme)) return;
  for (const d of DIFFICULTES) for (const s of liste) yield generer(g, d, forme, s);
}

export const sansDollars = (t: string) => t.replace(/^\$|\$$/g, '');
export const bonne = (q: Qcm) => q.choix.find((c) => c.correct)!;
export const mauvais = (q: Qcm) => q.choix.filter((c) => !c.correct);
export const proche = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
