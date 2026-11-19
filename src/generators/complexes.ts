/** Générateurs — nombres complexes. */
import { randInt, randNonZero, pick } from '../core/random';
import type { Question } from '../core/schema';
import { Q, construireQcm, piTex, piStr, type Generateur, type Candidat } from './outils';

/** a + bi en LaTeX : (3,-2) → "3 - 2i", (0,1) → "i", (-1,0) → "-1". */
export function complexeTex(a: number, b: number): string {
  const im = (v: number) => (Math.abs(v) === 1 ? 'i' : `${Math.abs(v)}i`);
  if (b === 0) return String(a);
  if (a === 0) return (b < 0 ? '-' : '') + im(b);
  return `${a} ${b < 0 ? '-' : '+'} ${im(b)}`;
}
export const complexeStr = (a: number, b: number): string => `(${a})+(${b})*i`;

/* ------------------------------------------------------------------ */
/* Racines carrées d'un complexe : z² = w                               */
/* ------------------------------------------------------------------ */

export const racineCarree: Generateur = {
  id: 'complexes-racine-carree',
  titre: 'Racines carrées complexes',
  chapitre: 'complexes',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const R = [3, 4, 6][difficulte - 1];
    let p = 0;
    let q = 0;
    do {
      p = randNonZero(rng, -R, R);
      q = randNonZero(rng, -R, R);
    } while (Math.abs(p) === Math.abs(q));
    if (p < 0) [p, q] = [-p, -q]; // représentant de ±(p+qi) avec p > 0
    const re = p * p - q * q;
    const im = 2 * p * q;
    const wTex = complexeTex(re, im);
    const correction = [
      `On cherche $z = a + ib$ ($a, b$ réels) : $z^2 = (a^2 - b^2) + 2ab\\,i$.`,
      `Identification : $a^2 - b^2 = ${re}$ et $2ab = ${im}$.`,
      `Avec les modules : $a^2 + b^2 = |z|^2 = |w| = \\sqrt{(${re})^2 + (${im})^2} = ${p * p + q * q}$.`,
      `D'où $a^2 = ${p * p}$ et $b^2 = ${q * q}$, avec $ab$ du signe de $${im}$ : $ab ${im > 0 ? '> 0' : '< 0'}$.`,
      `Les deux solutions sont $z_1 = ${complexeTex(p, q)}$ et $z_2 = -z_1 = ${complexeTex(-p, -q)}$.`,
    ];
    const indice = 'Pose $z = a+ib$, identifie parties réelles et imaginaires, et utilise aussi $|z|^2 = |w|$.';
    const enonce = `Résoudre dans $\\mathbb{C}$ l'équation $z^2 = ${wTex}$.`;

    if (forme === 'libre')
      return {
        id: '',
        type: 'numerique',
        difficulte,
        enonce: `${enonce} Donne les deux solutions sous la forme $a+bi$, séparées par « ; ».`,
        indice,
        correction,
        reponse: [complexeStr(p, q), complexeStr(-p, -q)],
      };

    const pm = (a: number, b: number): Candidat => {
      const [x, y] = a > 0 || (a === 0 && b > 0) ? [a, b] : [-a, -b];
      return { texte: `$z = \\pm(${complexeTex(x, y)})$`, explication: '', cle: `${x},${y}` };
    };
    const bonne = { ...pm(p, q), explication: `$(${complexeTex(p, q)})^2 = ${wTex}$ : c'est juste.` };
    return construireQcm({ difficulte, enonce, indice, correction }, bonne, [
      { ...pm(q, p), explication: 'Parties réelle et imaginaire inversées : on a mélangé $a^2$ et $b^2$.' },
      {
        ...pm(p, -q),
        explication: `Mauvais signe de $b$ : on doit avoir $2ab = ${im}$, donc $a$ et $b$ ${im > 0 ? 'de même signe' : 'de signes contraires'}.`,
      },
      {
        ...pm(-q, p),
        explication: `Ce sont les racines de $-w$ : leur carré vaut $${complexeTex(-re, -im)}$ (erreur de signe sur $a^2 - b^2$).`,
      },
    ]);
  },
};

/* ------------------------------------------------------------------ */
/* Forme exponentielle                                                 */
/* ------------------------------------------------------------------ */

/** Ramène t (multiple de π) dans ]-1, 1]. */
const normaliser = (t: Q): Q => {
  let r = t;
  while (r.valueOf() <= -1) r = r.add(2);
  while (r.valueOf() > 1) r = r.sub(2);
  return r;
};

interface FormeAlg {
  zTex: string;
  rTex: string;
  r2Tex: string;
  rKey: number;
  r2Key: number;
  t: Q;
}

function tirerComplexe(rng: () => number, difficulte: number): FormeAlg {
  const familles = difficulte === 1 ? ['4', '2', '1'] : difficulte === 2 ? ['4', '3', '6'] : ['3', '6', '4'];
  const fam = pick(rng, familles);
  const a = randInt(rng, 1, difficulte === 1 ? 2 : 3);
  const s1 = pick(rng, [1, -1]);
  const s2 = pick(rng, [1, -1]);
  const k = (v: number) => (v === 1 ? '' : String(v)); // coefficient muet
  switch (fam) {
    case '4': {
      const t = new Q(s1 > 0 ? 1 : 3, 4).mul(s2);
      return {
        zTex: complexeTex(s1 * a, s2 * a),
        rTex: `${k(a)}\\sqrt{2}`,
        r2Tex: String(2 * a * a),
        rKey: a * Math.SQRT2,
        r2Key: 2 * a * a,
        t,
      };
    }
    case '6': {
      const t = new Q(s1 > 0 ? 1 : 5, 6).mul(s2);
      return {
        zTex: `${s1 < 0 ? '-' : ''}${k(a)}\\sqrt{3} ${s2 < 0 ? '-' : '+'} ${k(a)}i`,
        rTex: String(2 * a),
        r2Tex: String(4 * a * a),
        rKey: 2 * a,
        r2Key: 4 * a * a,
        t,
      };
    }
    case '3': {
      const t = new Q(s1 > 0 ? 1 : 2, 3).mul(s2);
      return {
        zTex: `${s1 * a} ${s2 < 0 ? '-' : '+'} ${k(a)}i\\sqrt{3}`,
        rTex: String(2 * a),
        r2Tex: String(4 * a * a),
        rKey: 2 * a,
        r2Key: 4 * a * a,
        t,
      };
    }
    case '2':
      return {
        zTex: `${s2 < 0 ? '-' : ''}${k(a + 1)}i`,
        rTex: String(a + 1),
        r2Tex: String((a + 1) ** 2),
        rKey: a + 1,
        r2Key: (a + 1) ** 2,
        t: new Q(s2, 2),
      };
    default:
      return {
        zTex: String(-(a + 1)),
        rTex: String(a + 1),
        r2Tex: String((a + 1) ** 2),
        rKey: a + 1,
        r2Key: (a + 1) ** 2,
        t: new Q(1),
      };
  }
}

export const formeExponentielle: Generateur = {
  id: 'complexes-forme-exp',
  titre: 'Forme exponentielle',
  chapitre: 'complexes',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const z = tirerComplexe(rng, difficulte);
    const expo = (r: string, t: Q) => (t.zero ? r : `${r}\\,e^{i${t.equals(1) ? '\\pi' : `\\left(${piTex(t)}\\right)`}}`);
    const correction = [
      `Module : $|z| = \\sqrt{a^2 + b^2} = ${z.rTex}$.`,
      `On factorise : $z = ${z.rTex}\\left(\\cos\\theta + i\\sin\\theta\\right)$ où $\\cos\\theta$ et $\\sin\\theta$ se lisent sur $\\frac{z}{|z|}$.`,
      `Le cercle trigonométrique donne $\\theta = ${piTex(z.t)}$ (attention au signe de la partie réelle).`,
      `Donc $z = ${expo(z.rTex, z.t)}$.`,
    ];
    const indice = 'Calcule $|z|$, puis cherche l\'angle $\\theta$ tel que $\\cos\\theta = \\frac{a}{|z|}$ et $\\sin\\theta = \\frac{b}{|z|}$.';

    if (forme === 'libre')
      return {
        id: '',
        type: 'numerique',
        difficulte,
        enonce: `Soit $z = ${z.zTex}$. Donne son argument principal (dans $]-\\pi, \\pi]$), par exemple « 3pi/4 ».`,
        indice,
        correction,
        reponse: piStr(z.t),
      };

    const c = (rTex: string, rKey: number, t: Q, explication: string): Candidat => {
      const tn = normaliser(t);
      return { texte: `$${expo(rTex, tn)}$`, explication, cle: `${rKey.toFixed(6)}|${tn}` };
    };
    return construireQcm(
      { difficulte, enonce: `Quelle est la forme exponentielle de $z = ${z.zTex}$ ?`, indice, correction },
      c(z.rTex, z.rKey, z.t, `Module $${z.rTex}$ et argument $${piTex(z.t)}$ : c'est juste.`),
      [
        c(z.rTex, z.rKey, z.t.neg(), "Signe de l'argument faux : c'est la forme exponentielle du conjugué $\\bar z$."),
        c(
          z.rTex,
          z.rKey,
          z.t.add(1),
          "Argument décalé de $\\pi$ : la formule $\\arctan(b/a)$ ne tient pas compte du signe de $a$ (c'est $-z$).",
        ),
        c(z.r2Tex, z.r2Key, z.t, 'Module faux : on a oublié la racine carrée dans $|z| = \\sqrt{a^2+b^2}$.'),
        c(z.rTex, z.rKey, new Q(1, 2).sub(z.t), '$\\cos$ et $\\sin$ inversés : on a pris $\\frac{\\pi}{2} - \\theta$.'),
      ],
    );
  },
};
