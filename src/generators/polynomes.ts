/** Générateurs — polynômes (division euclidienne, reste). */
import { randInt, randNonZero, pick, type Rng } from '../core/random';
import type { Question } from '../core/schema';
import { Q, construireQcm, polyTex, polyStr, affineTex, cleNum, monomeTex, type Generateur, type Candidat } from './outils';

/** Polynôme = coefficients rationnels par degré croissant. */
export type Poly = Q[];

export const degre = (p: Poly): number => {
  for (let k = p.length - 1; k >= 0; k--) if (!p[k].zero) return k;
  return -Infinity;
};
const nettoyer = (p: Poly): Poly => p.slice(0, Math.max(1, degre(p) + 1));

export function addPoly(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  return nettoyer(Array.from({ length: n }, (_, k) => (a[k] ?? new Q(0)).add(b[k] ?? new Q(0))));
}
export function mulPoly(a: Poly, b: Poly): Poly {
  const r = Array.from({ length: a.length + b.length - 1 }, () => new Q(0));
  a.forEach((x, i) => b.forEach((y, j) => (r[i + j] = r[i + j].add(x.mul(y)))));
  return nettoyer(r);
}
export const evalQ = (p: Poly, x: number | Q): Q => p.reduceRight((acc, c) => acc.mul(x).add(c), new Q(0));

/** Division euclidienne avec les étapes intermédiaires (pour la correction). */
export function diviser(A: Poly, B: Poly): { Q: Poly; R: Poly; etapes: string[] } {
  let R = nettoyer(A.slice());
  const dB = degre(B);
  const quot: Poly = Array.from({ length: Math.max(1, degre(A) - dB + 1) }, () => new Q(0));
  const etapes: string[] = [];
  while (degre(R) >= dB) {
    const k = degre(R) - dB;
    const c = R[degre(R)].div(B[dB]);
    quot[k] = c;
    const terme: Poly = Array.from({ length: k + 1 }, (_, i) => (i === k ? c : new Q(0)));
    R = nettoyer(addPoly(R, mulPoly(terme, B).map((x) => x.neg())));
    etapes.push(
      `On ajoute $${monomeTex(c, k)}$ au quotient et on retranche $${monomeTex(c, k)} \\times B$ : il reste $${polyTex(R)}$.`,
    );
  }
  return { Q: nettoyer(quot), R, etapes };
}

const polyAleatoire = (rng: Rng, deg: number, R: number): Poly =>
  Array.from({ length: deg + 1 }, (_, k) => new Q(k === deg ? randNonZero(rng, -R, R) : randInt(rng, -R, R)));

/* ------------------------------------------------------------------ */

export const resteDivision: Generateur = {
  id: 'polynomes-reste',
  titre: 'Reste par (x − a)',
  chapitre: 'polynomes',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const P = polyAleatoire(rng, difficulte === 1 ? 2 : 3, 3);
    // Difficulté 3 en saisie libre : reste par (x − a)(x − b).
    if (difficulte === 3 && forme === 'libre') {
      const a = randNonZero(rng, -2, 2);
      let b = a;
      while (b === a) b = randInt(rng, -2, 2);
      const Pa = evalQ(P, a);
      const Pb = evalQ(P, b);
      const alpha = Pa.sub(Pb).div(a - b);
      const beta = Pa.sub(alpha.mul(a));
      const R: Poly = [beta, alpha];
      const B = mulPoly([new Q(-a), new Q(1)], [new Q(-b), new Q(1)]);
      return {
        id: '',
        type: 'expression',
        difficulte,
        enonce: `Soit $P = ${polyTex(P)}$. Donne le reste $R$ de la division euclidienne de $P$ par $${polyTex(B)} = (${affineTex(1, 'x', -a)})(${affineTex(1, 'x', -b)})$.`,
        indice: 'Le reste est de degré ≤ 1 : $R = \\alpha x + \\beta$. Évalue $P = BQ + R$ en les racines de $B$.',
        correction: [
          `$\\deg R < \\deg B = 2$ donc $R = \\alpha x + \\beta$, et $P = BQ + R$.`,
          `En $x = ${a}$ : $P(${a}) = ${Pa.tex()} = ${a}\\alpha + \\beta$.`,
          `En $x = ${b}$ : $P(${b}) = ${Pb.tex()} = ${b}\\alpha + \\beta$.`,
          `On soustrait : $\\alpha = ${alpha.tex()}$, puis $\\beta = ${beta.tex()}$.`,
          `$R = ${polyTex(R)}$.`,
        ],
        reponse: polyStr(R),
        variables: ['x'],
      };
    }
    const a = difficulte === 1 ? randInt(rng, 1, 2) : randNonZero(rng, -3, 3);
    const Pa = evalQ(P, a);
    const enonce = `Quel est le reste de la division euclidienne de $P = ${polyTex(P)}$ par $${affineTex(1, 'x', -a)}$ ?`;
    const correction = [
      `$P = (x - ${a < 0 ? `(${a})` : a})Q + r$ avec $\\deg r < 1$ : le reste $r$ est une constante.`,
      `En évaluant en $x = ${a}$ : $P(${a}) = 0 \\times Q(${a}) + r$, donc $r = P(${a})$.`,
      `$P(${a}) = ${Pa.tex()}$.`,
    ];
    const indice = 'Inutile de poser la division : évalue $P$ en la racine du diviseur.';
    if (forme === 'libre')
      return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: Pa.toString() };
    const c = (v: Q, explication: string): Candidat => ({ texte: `$${v.tex()}$`, explication, cle: cleNum(v.valueOf()) });
    return construireQcm({ difficulte, enonce, indice, correction }, c(Pa, `Le reste vaut $P(${a})$.`), [
      c(evalQ(P, -a), `Évaluation en $${-a}$ au lieu de $${a}$ : la racine de $x ${a < 0 ? '+' : '-'} ${Math.abs(a)}$ est $${a}$.`),
      c(P[0], "C'est $P(0)$ (le coefficient constant), pas le reste."),
      c(Pa.neg(), 'Erreur de signe : le reste est $P(a)$, pas $-P(a)$.'),
      c(evalQ(P, a).add(1), 'Erreur de calcul dans l\'évaluation de $P(a)$.'),
    ]);
  },
};

export const divisionEuclidienne: Generateur = {
  id: 'polynomes-division',
  titre: 'Division euclidienne',
  chapitre: 'polynomes',
  formes: ['libre'],
  generer(rng, difficulte): Question {
    const B: Poly =
      difficulte === 1 ? [new Q(-randNonZero(rng, -3, 3)), new Q(1)] : [new Q(randInt(rng, -3, 3)), new Q(randInt(rng, -2, 2)), new Q(1)];
    const quot = polyAleatoire(rng, difficulte === 3 ? 2 : 1, 3);
    const R = polyAleatoire(rng, degre(B) - 1, 3);
    const A = addPoly(mulPoly(B, quot), R);
    const div = diviser(A, B);
    const demandeReste = difficulte >= 2 && pick(rng, [false, true]);
    const cible = demandeReste ? div.R : div.Q;
    return {
      id: '',
      type: 'expression',
      difficulte,
      enonce: `Effectuer la division euclidienne de $A = ${polyTex(A)}$ par $B = ${polyTex(B)}$. Donne le **${demandeReste ? 'reste' : 'quotient'}**.`,
      indice: 'Divise le terme de plus haut degré de $A$ par celui de $B$, retranche, et recommence.',
      correction: [
        ...div.etapes,
        `Le degré du reste est $< ${degre(B)}$ : on s'arrête.`,
        `Quotient : $Q = ${polyTex(div.Q)}$ ; reste : $R = ${polyTex(div.R)}$.`,
        `Vérification : $A = BQ + R$.`,
      ],
      reponse: polyStr(cible),
      variables: ['x'],
    };
  },
};
