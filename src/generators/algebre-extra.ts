/** Générateurs — sommes usuelles, coefficients/racines, produit de matrices, systèmes 2×2, dimension. */
import { randInt, randNonZero, pick } from '../core/random';
import type { Question } from '../core/schema';
import { Q, construireQcm, cleNum, combinaisonTex, matTex, polyTex, type Generateur, type Candidat } from './outils';

const candN = (v: number | Q, explication: string): Candidat => {
  const q = Q.of(v);
  return { texte: `$${q.tex()}$`, explication, cle: cleNum(q.valueOf()) };
};

/* ------------------------------------------------------------------ */
/* Sommes usuelles                                                     */
/* ------------------------------------------------------------------ */

export const sommesUsuelles: Generateur = {
  id: 'sommes-usuelles',
  titre: 'Sommes usuelles',
  chapitre: 'sommes',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const genre = pick(rng, difficulte === 1 ? ['affine', 'entiers'] : difficulte === 2 ? ['entiers', 'carres', 'affine'] : ['carres', 'affine']);
    let enonce: string;
    let rep: number;
    let correction: string[];
    let distr: Candidat[];
    if (genre === 'entiers') {
      const m = randInt(rng, 2, 6);
      const n = randInt(rng, 15, 40);
      const N = n - m + 1;
      rep = (N * (m + n)) / 2;
      enonce = `Calculer $\\displaystyle\\sum_{k=${m}}^{${n}} k$.`;
      correction = [
        `Somme arithmétique : nombre de termes × (premier + dernier) / 2.`,
        `Il y a $${n} - ${m} + 1 = ${N}$ termes : $\\dfrac{${N} \\times (${m} + ${n})}{2} = ${rep}$.`,
      ];
      distr = [
        candN(new Q((N - 1) * (m + n), 2), `Un terme oublié : de ${m} à ${n} il y a ${N} termes, pas ${N - 1}.`),
        candN((n * (n + 1)) / 2, `C'est la somme de 1 à ${n} : il faut retirer $1 + \\dots + ${m - 1}$.`),
        candN(N * (m + n), 'Oubli de la division par 2.'),
        candN((n * (n + 1)) / 2 - (m * (m + 1)) / 2, `On a retiré $1 + \\dots + ${m}$ : le terme $k = ${m}$ fait partie de la somme.`),
      ];
    } else if (genre === 'carres') {
      const n = randInt(rng, difficulte === 3 ? 12 : 6, difficulte === 3 ? 30 : 15);
      rep = (n * (n + 1) * (2 * n + 1)) / 6;
      enonce = `Calculer $\\displaystyle\\sum_{k=1}^{${n}} k^2$.`;
      correction = [`$\\sum_{k=1}^{n} k^2 = \\dfrac{n(n+1)(2n+1)}{6}$, d'où $\\dfrac{${n} \\times ${n + 1} \\times ${2 * n + 1}}{6} = ${rep}$.`];
      distr = [
        candN(((n * (n + 1)) / 2) ** 2, 'Ça, c\'est $\\sum k^3 = \\left(\\frac{n(n+1)}{2}\\right)^2$.'),
        candN(((n - 1) * n * (2 * n - 1)) / 6, `C'est la somme jusqu'à ${n - 1} : formule appliquée avec $n - 1$.`),
        candN((n * (n + 1) * (2 * n + 1)) / 3, 'On divise par 6, pas par 3.'),
        candN((n * (n + 1)) / 2, 'C\'est $\\sum k$, pas $\\sum k^2$.'),
      ];
    } else {
      const a = difficulte === 3 ? randNonZero(rng, -5, 5) : randInt(rng, 2, 5);
      const b = randNonZero(rng, -6, 6);
      const n = randInt(rng, 8, 30);
      rep = (a * n * (n + 1)) / 2 + b * n;
      enonce = `Calculer $\\displaystyle\\sum_{k=1}^{${n}} (${combinaisonTex([[a, 'k'], [b, '']])})$.`;
      correction = [
        `Linéarité : $${a}\\sum_{k=1}^{${n}} k ${b < 0 ? '-' : '+'} \\sum_{k=1}^{${n}} ${Math.abs(b)}$.`,
        `$= ${a} \\times \\dfrac{${n} \\times ${n + 1}}{2} ${b < 0 ? '-' : '+'} ${Math.abs(b)} \\times ${n} = ${rep}$.`,
      ];
      distr = [
        candN((a * n * (n + 1)) / 2 + b, `La constante $${b}$ est sommée ${n} fois : $\\sum_{k=1}^{${n}} ${b} = ${b * n}$.`),
        candN(a * n * (n + 1) + b * n, 'Oubli de la division par 2 dans $\\sum k$.'),
        candN((a * n * (n + 1)) / 2 + b * (n + 1), `Il y a ${n} termes, pas ${n + 1}.`),
        candN((a * n * (n - 1)) / 2 + b * n, '$\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$, pas $\\frac{n(n-1)}{2}$.'),
      ];
    }
    const indice = 'Utilise la linéarité et les sommes usuelles ; compte bien le nombre de termes.';
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: rep };
    return construireQcm({ difficulte, enonce, indice, correction }, candN(rep, 'Formule correctement appliquée.'), distr);
  },
};

/* ------------------------------------------------------------------ */
/* Relations coefficients-racines                                      */
/* ------------------------------------------------------------------ */

export const coefficientsRacines: Generateur = {
  id: 'polynomes-relations',
  titre: 'Relations coefficients-racines',
  chapitre: 'polynomes',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    let r1 = 0;
    let r2 = 0;
    while (r1 === r2 || r1 * r2 === 0 || r1 + r2 === 0) {
      r1 = randNonZero(rng, -6, 6);
      r2 = randNonZero(rng, -6, 6);
    }
    const S = r1 + r2;
    const P = r1 * r2;
    const poly = polyTex([new Q(P), new Q(-S), new Q(1)], 'decroissant', 'X');
    const genre = pick(rng, difficulte === 1 ? ['somme', 'produit'] : difficulte === 2 ? ['carres', 'somme'] : ['inverses', 'cubes', 'carres']);
    let quoi: string;
    let rep: Q;
    let calc: string;
    let distr: Candidat[];
    switch (genre) {
      case 'somme':
        quoi = 'a + b';
        rep = new Q(S);
        calc = `$a + b = -\\frac{${-S}}{1} = ${S}$.`;
        distr = [candN(-S, 'Signe : la somme vaut $-\\frac{b}{a}$, pas $\\frac{b}{a}$.'), candN(P, "C'est le produit."), candN(-P, 'Ni la somme, ni le produit.')];
        break;
      case 'produit':
        quoi = 'ab';
        rep = new Q(P);
        calc = `$ab = \\frac{${P}}{1} = ${P}$ (terme constant, degré 2).`;
        distr = [candN(-P, 'En degré 2, le produit vaut $+\\frac{c}{a}$.'), candN(S, "C'est la somme."), candN(-S, "C'est l'opposé de la somme.")];
        break;
      case 'carres':
        quoi = 'a^2 + b^2';
        rep = new Q(S * S - 2 * P);
        calc = `$a^2 + b^2 = (a + b)^2 - 2ab = ${S * S} - ${2 * P < 0 ? `(${2 * P})` : 2 * P} = ${S * S - 2 * P}$.`;
        distr = [candN(S * S, 'Oubli du terme $-2ab$.'), candN(S * S + 2 * P, 'Signe : $(a+b)^2 = a^2 + b^2 + 2ab$, donc on RETRANCHE $2ab$.'), candN(S * S - P, 'Le double produit vaut $2ab$, pas $ab$.')];
        break;
      case 'inverses':
        quoi = '\\frac{1}{a} + \\frac{1}{b}';
        rep = new Q(S, P);
        calc = `$\\frac1a + \\frac1b = \\frac{a + b}{ab} = \\frac{${S}}{${P}}$.`;
        distr = [candN(new Q(P, S), 'Fraction renversée : $\\frac{a+b}{ab}$.'), candN(new Q(1, S), '$\\frac1a + \\frac1b \\neq \\frac{1}{a+b}$.'), candN(new Q(-S, P), 'Erreur de signe sur la somme.')];
        break;
      default:
        quoi = 'a^3 + b^3';
        rep = new Q(S ** 3 - 3 * P * S);
        calc = `$a^3 + b^3 = (a + b)^3 - 3ab(a + b) = ${S ** 3} - ${3 * P * S < 0 ? `(${3 * P * S})` : 3 * P * S} = ${S ** 3 - 3 * P * S}$.`;
        distr = [candN(S ** 3, 'Oubli du terme $-3ab(a + b)$.'), candN(S ** 3 - 3 * P, 'Le terme correctif est $3ab(a+b)$, pas $3ab$.'), candN(S ** 3 + 3 * P * S, 'Signe : on retranche $3ab(a + b)$.')];
    }
    const enonce = `Soient $a$ et $b$ les racines de $${poly}$. Calculer $${quoi}$ sans calculer $a$ et $b$.`;
    const correction = [`Relations coefficients-racines : $a + b = ${S}$ et $ab = ${P}$.`, calc, `(Vérification : les racines sont $${r1}$ et $${r2}$.)`];
    const indice = 'Exprime la quantité avec $a + b$ et $ab$ seulement.';
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: rep.toString() };
    return construireQcm({ difficulte, enonce, indice, correction }, candN(rep, 'Expression en fonction de $a + b$ et $ab$.'), [...distr, candN(rep.add(1), 'Erreur de calcul.')]);
  },
};

/* ------------------------------------------------------------------ */
/* Produit de matrices 2×2                                             */
/* ------------------------------------------------------------------ */

type M2 = number[][];
export const mul2 = (A: M2, B: M2): M2 => [0, 1].map((i) => [0, 1].map((j) => A[i][0] * B[0][j] + A[i][1] * B[1][j]));
const egal = (A: M2, B: M2) => A.every((l, i) => l.every((x, j) => x === B[i][j]));

export const produitMatrices: Generateur = {
  id: 'matrices-produit',
  titre: 'Produit de matrices',
  chapitre: 'matrices',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const R = [2, 3, 4][difficulte - 1];
    const tirer = (): M2 => [0, 1].map(() => [0, 1].map(() => randInt(rng, -R, R)));
    let A: M2, B: M2;
    do {
      A = tirer();
      B = tirer();
    } while (egal(mul2(A, B), mul2(B, A)) || A.flat().filter(Boolean).length < 3 || B.flat().filter(Boolean).length < 3);
    const AB = mul2(A, B);
    const correction = [
      'Coefficient $(i, j)$ de $AB$ : ligne $i$ de $A$ « fois » colonne $j$ de $B$.',
      ...[0, 1].flatMap((i) => [0, 1].map((j) => `$(AB)_{${i + 1}${j + 1}} = (${A[i][0]})(${B[0][j]}) + (${A[i][1]})(${B[1][j]}) = ${AB[i][j]}$`)),
      `$AB = ${matTex(AB)}$.`,
    ];
    const base = `Soient $A = ${matTex(A)}$ et $B = ${matTex(B)}$.`;
    const indice = 'Ligne de $A$, colonne de $B$ : $(AB)_{ij} = a_{i1}b_{1j} + a_{i2}b_{2j}$.';
    if (forme === 'libre') {
      const i = randInt(rng, 0, 1);
      const j = randInt(rng, 0, 1);
      return { id: '', type: 'numerique', difficulte, enonce: `${base} Calculer le coefficient ligne ${i + 1}, colonne ${j + 1} de $AB$.`, indice, correction, reponse: AB[i][j] };
    }
    const cand = (M: M2, explication: string): Candidat => ({ texte: `$${matTex(M)}$`, explication, cle: M.flat().join(',') });
    const BT = [
      [B[0][0], B[1][0]],
      [B[0][1], B[1][1]],
    ];
    return construireQcm({ difficulte, enonce: `${base} Que vaut $AB$ ?`, indice, correction }, cand(AB, 'Produit ligne par colonne.'), [
      cand(mul2(B, A), "C'est $BA$ : le produit matriciel n'est pas commutatif."),
      cand([0, 1].map((i) => [0, 1].map((j) => A[i][j] * B[i][j])), 'Produit coefficient par coefficient : ce n\'est pas le produit matriciel.'),
      cand(mul2(A, BT), 'On a multiplié ligne par LIGNE au lieu de ligne par colonne.'),
      cand([0, 1].map((i) => [0, 1].map((j) => A[i][j] + B[i][j])), "C'est $A + B$."),
    ]);
  },
};

/* ------------------------------------------------------------------ */
/* Système 2×2                                                         */
/* ------------------------------------------------------------------ */

export const systeme2x2: Generateur = {
  id: 'matrices-systeme',
  titre: 'Systèmes 2×2',
  chapitre: 'matrices',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const R = [3, 4, 5][difficulte - 1];
    let a, b, c, d, x, y;
    do {
      a = difficulte === 1 ? 1 : randNonZero(rng, -R, R);
      b = randNonZero(rng, -R, R);
      c = randNonZero(rng, -R, R);
      d = randNonZero(rng, -R, R);
      x = randInt(rng, -4, 4);
      y = randInt(rng, -4, 4);
    } while (a * d - b * c === 0 || x === y);
    const det = a * d - b * c;
    const e = a * x + b * y;
    const f = c * x + d * y;
    const ligne = (p: number, q: number, r: number) => `${combinaisonTex([[p, 'x'], [q, 'y']])} = ${r}`;
    const sys = `\\begin{cases} ${ligne(a, b, e)} \\\\ ${ligne(c, d, f)} \\end{cases}`;
    const correction = [
      `Déterminant du système : $${a} \\times ${d} - ${b} \\times ${c < 0 ? `(${c})` : c} = ${det} \\neq 0$ : solution unique.`,
      `Par combinaison ($(${d})L_1 - (${b})L_2$ élimine $y$) : $${det}x = ${d * e - b * f}$, donc $x = ${x}$.`,
      `En reportant : $y = ${y}$. Vérification : $${a}(${x}) + ${b}(${y}) = ${e}$ et $${c}(${x}) + ${d}(${y}) = ${f}$.`,
    ];
    const indice = 'Élimine une inconnue en combinant les deux lignes (pivot de Gauss).';
    if (forme === 'libre') {
      const quoi = pick(rng, ['x', 'y']);
      return { id: '', type: 'numerique', difficulte, enonce: `Résoudre $${sys}$ et donner la valeur de $${quoi}$.`, indice, correction, reponse: quoi === 'x' ? x : y };
    }
    // Distracteur « second membre de L1 non multiplié » : on résout un système faux.
    const faux = (ee: number, ff: number) => [new Q(d * ee - b * ff, det), new Q(a * ff - c * ee, det)];
    const [fx, fy] = faux(e, -f);
    const cand = (u: Q | number, v: Q | number, explication: string): Candidat => ({
      texte: `$(x, y) = (${Q.of(u).tex()}, ${Q.of(v).tex()})$`,
      explication,
      cle: `${Q.of(u)}|${Q.of(v)}`,
    });
    return construireQcm({ difficulte, enonce: `Résoudre $${sys}$.`, indice, correction }, cand(x, y, 'Vérifie les deux équations.'), [
      cand(y, x, '$x$ et $y$ inversés.'),
      cand(x, -y, `Erreur de signe sur $y$ : la 1re équation donne $${a * x - b * y} \\neq ${e}$.`),
      cand(fx, fy, 'Erreur de signe sur un second membre lors de la combinaison.'),
      cand(-x, y, `Erreur de signe sur $x$.`),
    ]);
  },
};

/* ------------------------------------------------------------------ */
/* Dimension d'un sous-espace défini par des équations                 */
/* ------------------------------------------------------------------ */

/** Rang d'une matrice (élimination de Gauss en flottants, petits entiers). */
export function rang(m: number[][]): number {
  const a = m.map((l) => l.slice());
  let r = 0;
  for (let c = 0; c < (a[0]?.length ?? 0) && r < a.length; c++) {
    const p = a.findIndex((l, i) => i >= r && Math.abs(l[c]) > 1e-9);
    if (p < 0) continue;
    [a[r], a[p]] = [a[p], a[r]];
    for (let i = 0; i < a.length; i++)
      if (i !== r) {
        const k = a[i][c] / a[r][c];
        a[i] = a[i].map((v, j) => v - k * a[r][j]);
      }
    r++;
  }
  return r;
}

const VARS = ['x', 'y', 'z', 't'];

export const dimensionEquations: Generateur = {
  id: 'ev-dimension',
  titre: 'Dimension par équations',
  chapitre: 'espaces-vectoriels',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const n = difficulte === 1 ? 3 : 4;
    const r = difficulte === 1 ? randInt(rng, 1, 2) : randInt(rng, 1, 3);
    const tirerLigne = () => Array.from({ length: n }, () => randInt(rng, -2, 2));
    let lignes: number[][];
    do lignes = Array.from({ length: r }, tirerLigne);
    while (rang(lignes) !== r);
    // Difficulté ≥ 2 : on ajoute une équation redondante (combinaison des autres).
    const redondante = difficulte >= 2 && rng() < 0.7;
    if (redondante) {
      const k = pick(rng, [1, -1, 2]);
      const l2 = lignes.length > 1 ? lignes[1] : lignes[0].map(() => 0);
      lignes.push(lignes[0].map((v, j) => k * v + l2[j]));
    }
    const eqs = lignes.map((l) => `${combinaisonTex(l.map((c, j) => [c, VARS[j]] as [number, string]))} = 0`);
    const espace = `\\mathbb{R}^${n}`;
    const enonce = `Quelle est la dimension de $F = \\left\\{(${VARS.slice(0, n).join(', ')}) \\in ${espace} \\;\\middle|\\; \\begin{cases} ${eqs.join(' \\\\ ')} \\end{cases}\\right\\}$ ?`;
    const dim = n - r;
    const correction = [
      `$F$ est le noyau d'un système linéaire homogène à ${n} inconnues.`,
      redondante
        ? `La dernière équation est une combinaison des précédentes : il y a ${r} équation(s) indépendante(s).`
        : `Les ${r} équation(s) sont indépendantes (pivot de Gauss : ${r} pivot(s)).`,
      `$\\dim F = ${n} - ${r} = ${dim}$.`,
    ];
    const indice = '$\\dim F$ = nombre d\'inconnues − nombre d\'équations INDÉPENDANTES.';
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: dim };
    return construireQcm({ difficulte, enonce, indice, correction }, candN(dim, 'Inconnues moins équations indépendantes.'), [
      candN(n - lignes.length, 'Une équation est redondante : il ne faut compter que les équations indépendantes.'),
      candN(r, "C'est le nombre d'équations indépendantes (le rang), pas la dimension de $F$."),
      candN(n, `C'est la dimension de $${espace}$ tout entier.`),
      candN(dim + 1, 'Une équation indépendante oubliée.'),
      candN(Math.max(0, dim - 1), 'Une équation comptée en trop.'),
      candN(n - 1, 'On a compté une seule équation.'),
      candN(0, "$F$ n'est pas réduit à $\\{0\\}$ : il y a moins d'équations indépendantes que d'inconnues."),
      candN(r + 1, 'Rang mal calculé.'),
    ]);
  },
};

