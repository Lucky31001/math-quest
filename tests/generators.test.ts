/**
 * Tests des générateurs d'exercices de maths.
 *
 * 1. Structure (tous les générateurs) : question valide pour le schéma,
 *    QCM avec 4 choix distincts dont un seul correct, réponse attendue évaluable.
 * 2. Mathématiques : chaque générateur a sa vérification dans
 *    `verifications/generateurs.ts`, qui relit l'énoncé AFFICHÉ (LaTeX), recalcule
 *    la réponse indépendamment, et vérifie que chaque distracteur de QCM est faux.
 *    Un seul test les lance toutes et liste les générateurs fautifs.
 *
 * Physique et informatique : generators-physique.test.ts, generators-informatique.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { GENERATEURS, generer, type Generateur } from '../src/generators';
import { GENERATEURS_PHYSIQUE } from '../src/generators/physique';
import { GENERATEURS_INFORMATIQUE } from '../src/generators/informatique';
import { QuestionSchema } from '../src/core/schema';
import { verifierExpression, verifierNumerique } from '../src/core/checker';
import { evalTex, texVersMath } from './tex';
import { toutVerifier } from './outils/tout-verifier';
import { VERIFICATIONS_GENERATEURS } from './verifications/generateurs';
import { DIFFICULTES, graines, toutes } from './outils/generateurs';

const GRAINES = graines();

/** Une question générée est valide pour le schéma, sans « undefined »/« NaN », avec des QCM propres. */
function verifierStructure(g: Generateur): void {
  let qcmA4 = 0;
  let nbQcm = 0;
  for (const forme of g.formes)
    for (const d of DIFFICULTES)
      for (const s of GRAINES) {
        const q = generer(g, d, forme, s);
        const parse = QuestionSchema.safeParse({ ...q, id: 'genere' }); // les ids générés contiennent « ~ »
        expect(parse.success, `${q.id} : ${JSON.stringify(parse.error?.issues)}`).toBe(true);
        expect(q.difficulte).toBe(d);
        expect(q.enonce).not.toMatch(/undefined|NaN|Infinity|\[object/);
        for (const c of q.correction) expect(c).not.toMatch(/undefined|NaN|\[object/);
        if (q.type === 'qcm') {
          nbQcm++;
          expect(q.choix.length, q.enonce).toBeGreaterThanOrEqual(3);
          if (q.choix.length === 4) qcmA4++;
          expect(q.choix.filter((c) => c.correct)).toHaveLength(1);
          const textes = q.choix.map((c) => c.texte);
          expect(new Set(textes).size, textes.join(' | ')).toBe(textes.length);
          for (const c of q.choix) expect(c.texte + c.explication).not.toMatch(/undefined|NaN|\[object/);
          // Pas de coefficient « 1 » inutile : 1x, 1e^{…}, 1\sin…
          for (const c of q.choix) expect(c.texte, c.texte).not.toMatch(/(?<![\d.{^_])1(?=[a-z]|\\(sin|cos|tan|ln|sqrt|arctan))/);
        }
        if (q.type === 'expression') expect(verifierExpression(q.reponse, q.reponse, q).statut).toBe('correct');
        if (q.type === 'numerique') expect(verifierNumerique(Array.isArray(q.reponse) ? q.reponse.join(';') : String(q.reponse), q.reponse).statut).toBe('correct');
      }
  // 4 choix par défaut : on tolère de rares cas à 3 choix.
  if (nbQcm) expect(qcmA4 / nbQcm).toBeGreaterThan(0.9);
}

/* ------------------------------------------------------------------ */
describe('structure de tous les générateurs', () => {
  // ~50 générateurs × 3 difficultés × 40 graines × formes : plusieurs secondes.
  it('chaque générateur produit des questions valides (3 difficultés × 40 graines × chaque forme)', { timeout: 30_000 }, () =>
    toutVerifier(GENERATEURS.map((g): [string, () => void] => [g.id, () => verifierStructure(g)])));
  it('la même graine redonne la même question', () => {
    const g = GENERATEURS[0];
    expect(generer(g, 2, 'qcm', 42)).toEqual(generer(g, 2, 'qcm', 42));
  });
});

/* ------------------------------------------------------------------ */
const MATHS = GENERATEURS.filter((g) => !GENERATEURS_PHYSIQUE.includes(g) && !GENERATEURS_INFORMATIQUE.includes(g));

describe('mathématiques des générateurs', () => {
  it('chaque générateur de maths a sa vérification', () => {
    expect(Object.keys(VERIFICATIONS_GENERATEURS).sort()).toEqual(MATHS.map((g) => g.id).sort());
  });

  // Deux jeux de graines indépendants : celui des tests de structure et un second.
  it('réponse recalculée depuis l’énoncé affiché, distracteurs faux (chaque forme, 2 × 40 graines)', { timeout: 60_000 }, () =>
    toutVerifier(
      MATHS.map((g): [string, () => void] => [
        g.id,
        () => {
          for (const forme of g.formes) for (const liste of [graines(), graines(500, 6271)]) for (const q of toutes(g.id, forme, liste)) VERIFICATIONS_GENERATEURS[g.id](q);
        },
      ]),
    ));

  // Garde-fou : les utilitaires de conversion savent lire les notations utilisées.
  it('texVersMath lit \\dfrac et les puissances de suites', () => {
    expect(evalTex('\\dfrac{3}{4}')).toBe(0.75);
    expect(texVersMath('(-2)^n')).toBe('(-2)^n');
  });
});
