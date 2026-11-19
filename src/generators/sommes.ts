/** Générateurs — sommes, binôme de Newton. */
import { randInt, randNonZero, pick } from '../core/random';
import type { Question } from '../core/schema';
import { binom, coefTex, construireQcm, affineTex, cleNum, type Generateur, type Candidat } from './outils';

/** Coefficient de x^k dans (ax+b)^n. */
export const binome: Generateur = {
  id: 'sommes-binome',
  titre: 'Binôme de Newton',
  chapitre: 'sommes',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const n = randInt(rng, [3, 4, 5][difficulte - 1], [5, 6, 7][difficulte - 1]);
    let a = 1;
    let b = 1;
    do {
      a = difficulte === 1 ? randInt(rng, 1, 2) : difficulte === 2 ? randInt(rng, 2, 3) : randNonZero(rng, -3, 3);
      b = difficulte === 1 ? randInt(rng, 1, 3) : randNonZero(rng, -3, 3);
    } while (Math.abs(a) === Math.abs(b) || (difficulte > 1 && Math.abs(b) === 1 && Math.abs(a) === 1));
    const k = randInt(rng, 1, n - 1);
    const C = binom(n, k);
    const rep = C * a ** k * b ** (n - k);
    const expr = `(${affineTex(a, 'x', b)})^{${n}}`;
    const p = (v: number) => (v < 0 ? `(${v})` : String(v));
    const correction = [
      `Binôme de Newton : $(u+v)^{n} = \\sum_{j=0}^{n} \\binom{n}{j} u^{j} v^{n-j}$ avec $u = ${coefTex(a)}x$, $v = ${b}$.`,
      `Le terme en $x^{${k}}$ correspond à $j = ${k}$ : $\\binom{${n}}{${k}} (${coefTex(a)}x)^{${k}} \\times ${p(b)}^{${n - k}}$.`,
      `$\\binom{${n}}{${k}} = \\frac{${n}!}{${k}!\\,${n - k}!} = ${C}$.`,
      `Coefficient : $${C} \\times ${p(a)}^{${k}} \\times ${p(b)}^{${n - k}} = ${rep}$.`,
    ];
    const enonce = `Quel est le coefficient de $x^{${k}}$ dans le développement de $${expr}$ ?`;
    const indice = 'Le terme général est $\\binom{n}{j}(ax)^j b^{n-j}$ : quel $j$ donne $x^k$ ?';
    if (forme === 'libre')
      return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: rep };
    const c = (v: number, explication: string): Candidat => ({ texte: `$${v}$`, explication, cle: cleNum(v) });
    return construireQcm({ difficulte, enonce, indice, correction }, c(rep, `$\\binom{${n}}{${k}}a^{${k}}b^{${n - k}} = ${rep}$.`), [
      c(C * a ** k, `Oubli du facteur $b^{n-k} = ${p(b)}^{${n - k}}$.`),
      c(C * a ** (n - k) * b ** k, 'Exposants de $a$ et $b$ inversés : le terme en $x^k$ porte $a^k$.'),
      c(a ** k * b ** (n - k), 'Oubli du coefficient binomial $\\binom{n}{k}$.'),
      c(C * a * b ** (n - k), '$(ax)^k = a^k x^k$ : la puissance porte aussi sur $a$.'),
      c(C, 'On a oublié les puissances de $a$ et de $b$ : seul $\\binom{n}{k}$ reste.'),
    ]);
  },
};

/** Somme géométrique Σ_{k=m}^{n} q^k. */
export const sommeGeometrique: Generateur = {
  id: 'sommes-geometrique',
  titre: 'Sommes géométriques',
  chapitre: 'sommes',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const q = pick(rng, difficulte === 1 ? [2, 3] : difficulte === 2 ? [2, 3, -2] : [-2, 3, -3]);
    const m = difficulte === 1 ? 0 : difficulte === 2 ? pick(rng, [0, 1]) : pick(rng, [1, 2]);
    const n = randInt(rng, 4, difficulte === 3 ? 6 : 7);
    const N = n - m + 1;
    const geo = (premier: number, termes: number) => (premier * (q ** termes - 1)) / (q - 1);
    const S = geo(q ** m, N);
    const p = (v: number) => (v < 0 ? `(${v})` : String(v));
    const enonce = `Calculer $\\displaystyle S = \\sum_{k=${m}}^{${n}} ${p(q)}^{k}$.`;
    const correction = [
      `C'est une somme géométrique de raison $q = ${q} \\neq 1$.`,
      `Nombre de termes : $${n} - ${m} + 1 = ${N}$ ; premier terme : $${p(q)}^{${m}} = ${q ** m}$.`,
      `$S = \\text{(premier terme)} \\times \\frac{1 - q^{\\text{nb termes}}}{1 - q} = ${q ** m} \\times \\frac{1 - ${p(q)}^{${N}}}{1 - ${p(q)}}$.`,
      `$S = ${q ** m} \\times \\frac{${1 - q ** N}}{${1 - q}} = ${S}$.`,
    ];
    const indice = 'Premier terme × (1 − q^{nombre de termes}) / (1 − q). Compte bien les termes !';
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: S };
    const c = (v: number, explication: string): Candidat => ({ texte: `$${v}$`, explication, cle: cleNum(v) });
    return construireQcm({ difficulte, enonce, indice, correction }, c(S, `Formule appliquée avec ${N} termes : $S = ${S}$.`), [
      c(geo(q ** m, N - 1), `Un terme oublié : de $k=${m}$ à $k=${n}$ il y a $${n}-${m}+1 = ${N}$ termes.`),
      c(geo(1, n + 1), `On a sommé à partir de $k = 0$ au lieu de $k = ${m}$.`),
      c(geo(1, N), `Oubli du premier terme $q^{${m}}$ en facteur.`),
      c(-S, 'Erreur de signe : $\\frac{1-q^N}{1-q} = \\frac{q^N-1}{q-1}$, numérateur et dénominateur changent ensemble.'),
      c(geo(q ** m, N + 1), `Un terme de trop : il y a ${N} termes.`),
    ]);
  },
};
