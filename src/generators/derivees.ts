/**
 * Générateur — dérivées.
 *
 * Chaque gabarit fournit f (LaTeX + math.js), f' et des distracteurs
 * correspondant à des erreurs classiques. Les tests vérifient que f' est
 * bien la dérivée de f (comparaison avec math.derivative) et que les
 * distracteurs sont faux.
 */
import { randInt, randNonZero, pick, type Rng } from '../core/random';
import type { Difficulte, Question } from '../core/schema';
import { Q, construireQcm, cleExpr, polyTex, polyStr, affineTex, coefTex, monomeTex, type Generateur } from './outils';

interface Forme {
  tex: string;
  str: string;
}
interface Erreur extends Forme {
  explication: string;
}
export interface Gabarit {
  f: Forme;
  d: Forme;
  etapes: string[];
  erreurs: Erreur[];
  domaine?: [number, number];
}

const monome = (c: number, k: number): Q[] => Array.from({ length: k + 1 }, (_, i) => new Q(i === k ? c : 0));
const somme = (...ps: Q[][]): Q[] => {
  const n = Math.max(...ps.map((p) => p.length));
  return Array.from({ length: n }, (_, k) => ps.reduce((s, p) => s.add(p[k] ?? new Q(0)), new Q(0)));
};
const poly = (p: Q[]): Forme => ({ tex: polyTex(p), str: polyStr(p) });
/** (a)*x+(b) */
const affStr = (a: number, b: number) => `((${a})*x+(${b}))`;

/* -------------------------- gabarits ------------------------------ */

function puissance(rng: Rng): Gabarit {
  const a = randNonZero(rng, -5, 5);
  const n = randInt(rng, 2, 5);
  const b = randNonZero(rng, -6, 6);
  const f = somme(monome(a, n), monome(b, 1));
  return {
    f: poly(f),
    d: poly(somme(monome(n * a, n - 1), monome(b, 0))),
    etapes: [`$(x^n)' = nx^{n-1}$ et $(bx)' = b$, par linéarité.`],
    erreurs: [
      { ...poly(somme(monome(n * a, n), monome(b, 0))), explication: "L'exposant doit diminuer de 1 : $(x^n)' = nx^{n-1}$." },
      { ...poly(somme(monome(a, n - 1), monome(b, 0))), explication: "Le facteur $n$ descend devant : $(x^n)' = n\\,x^{n-1}$." },
      { ...poly(monome(n * a, n - 1)), explication: "La dérivée de $bx$ est $b$, pas $0$." },
    ],
  };
}

function trigoAffine(rng: Rng): Gabarit {
  const a = pick(rng, [2, 3, 4, 5, -2, -3]);
  const b = randInt(rng, -3, 3);
  const u = affineTex(a, 'x', b);
  const s = affStr(a, b);
  if (pick(rng, [true, false]))
    return {
      f: { tex: `\\sin(${u})`, str: `sin(${s})` },
      d: { tex: `${coefTex(a)}\\cos(${u})`, str: `${a}*cos(${s})` },
      etapes: [`$(\\sin u)' = u'\\cos u$ avec $u = ${u}$, $u' = ${a}$.`],
      erreurs: [
        { tex: `\\cos(${u})`, str: `cos(${s})`, explication: `Oubli de $u' = ${a}$ (dérivée de la fonction intérieure).` },
        { tex: `${coefTex(-a)}\\cos(${u})`, str: `${-a}*cos(${s})`, explication: "Signe faux : $(\\sin)' = \\cos$, sans signe moins." },
        { tex: `${coefTex(-a)}\\sin(${u})`, str: `${-a}*sin(${s})`, explication: "Confusion avec la dérivée du cosinus." },
      ],
    };
  return {
    f: { tex: `\\cos(${u})`, str: `cos(${s})` },
    d: { tex: `${coefTex(-a)}\\sin(${u})`, str: `${-a}*sin(${s})` },
    etapes: [`$(\\cos u)' = -u'\\sin u$ avec $u = ${u}$, $u' = ${a}$.`],
    erreurs: [
      { tex: `-\\sin(${u})`, str: `-sin(${s})`, explication: `Oubli de $u' = ${a}$ (dérivée de la fonction intérieure).` },
      { tex: `${coefTex(a)}\\sin(${u})`, str: `${a}*sin(${s})`, explication: "Signe oublié : $(\\cos)' = -\\sin$." },
      { tex: `${coefTex(a)}\\cos(${u})`, str: `${a}*cos(${s})`, explication: 'Confusion avec la dérivée du sinus.' },
    ],
  };
}

function produitExp(rng: Rng): Gabarit {
  const n = randInt(rng, 1, 3);
  const a = pick(rng, [2, 3, -2, -3]);
  const e = `e^{${coefTex(a)}x}`;
  const ex = `exp(${a}*x)`;
  const facteur = (p: Q[]): Forme => ({ tex: `\\left(${polyTex(p)}\\right)${e}`, str: `(${polyStr(p)})*${ex}` });
  const xn = monomeTex(new Q(1), n);
  return {
    f: { tex: `${xn}${e}`, str: `x^${n}*${ex}` },
    d: facteur(somme(monome(a, n), monome(n, n - 1))),
    etapes: [
      `Produit $uv$ avec $u = ${xn}$, $v = ${e}$ : $(uv)' = u'v + uv'$.`,
      `$u' = ${monomeTex(new Q(n), n - 1)}$ et $v' = ${a}${e}$ (car $(e^{ax})' = ae^{ax}$).`,
      'On factorise par l\'exponentielle.',
    ],
    erreurs: [
      { tex: `${monomeTex(new Q(n * a), n - 1)}${e}`, str: `${n * a}*x^${n - 1}*${ex}`, explication: "$(uv)' \\neq u'v'$ : on a fait le produit des dérivées." },
      { ...facteur(somme(monome(1, n), monome(n, n - 1))), explication: `Oubli du facteur $${a}$ : $(e^{${a}x})' = ${a}e^{${a}x}$.` },
      { tex: `${monomeTex(new Q(n), n - 1)}${e}`, str: `${n}*x^${n - 1}*${ex}`, explication: "On n'a dérivé que $x^n$ : il manque le terme $uv'$." },
    ],
  };
}

function logarithme(rng: Rng): Gabarit {
  const a = randInt(rng, 1, 4);
  const b = randInt(rng, 1, 4);
  const u = `${coefTex(a)}x^2 + ${b}`;
  const us = `(${a}*x^2+${b})`;
  return {
    f: { tex: `\\ln(${u})`, str: `log${us}` },
    d: { tex: `\\frac{${monomeTex(new Q(2 * a), 1)}}{${u}}`, str: `${2 * a}*x/${us}` },
    etapes: [`$(\\ln u)' = \\frac{u'}{u}$ avec $u = ${u} > 0$ et $u' = ${monomeTex(new Q(2 * a), 1)}$.`],
    erreurs: [
      { tex: `\\frac{1}{${u}}`, str: `1/${us}`, explication: "$(\\ln u)' = \\frac{u'}{u}$ : il manque $u'$ au numérateur." },
      { tex: `\\frac{${monomeTex(new Q(2 * a), 1)}}{(${u})^2}`, str: `${2 * a}*x/${us}^2`, explication: "Confusion avec $\\left(\\frac{1}{u}\\right)' = -\\frac{u'}{u^2}$." },
      { tex: `\\frac{1}{${monomeTex(new Q(2 * a), 1)}}`, str: `1/(${2 * a}*x)`, explication: "On a écrit $\\frac{1}{u'}$ au lieu de $\\frac{u'}{u}$." },
    ],
  };
}

function quotient(rng: Rng): Gabarit {
  let a, b, c, d;
  do {
    a = randNonZero(rng, -4, 4);
    b = randNonZero(rng, -5, 5);
    c = randNonZero(rng, -4, 4);
    d = randNonZero(rng, -5, 5);
  } while (a * d - b * c === 0 || a * c === 0);
  const k = a * d - b * c;
  const v = affineTex(c, 'x', d);
  const vs = affStr(c, d);
  return {
    f: { tex: `\\frac{${affineTex(a, 'x', b)}}{${v}}`, str: `${affStr(a, b)}/${vs}` },
    d: { tex: `\\frac{${k}}{(${v})^2}`, str: `(${k})/${vs}^2` },
    etapes: [
      `$\\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}$ avec $u' = ${a}$, $v' = ${c}$.`,
      `Numérateur : $${a}(${v}) - ${c < 0 ? `(${c})` : c}(${affineTex(a, 'x', b)}) = ${a} \\times ${d} - ${b} \\times ${c < 0 ? `(${c})` : c} = ${k}$ (les termes en $x$ s'annulent).`,
    ],
    erreurs: [
      { tex: `\\frac{${-k}}{(${v})^2}`, str: `(${-k})/${vs}^2`, explication: "Ordre inversé au numérateur : c'est $u'v - uv'$, pas $uv' - u'v$." },
      { tex: Q.of(a).div(c).tex(), str: `${a}/(${c})`, explication: "La dérivée d'un quotient n'est pas le quotient des dérivées." },
      { tex: `\\frac{${k}}{${v}}`, str: `(${k})/${vs}`, explication: 'Le dénominateur est $v^2$, pas $v$.' },
    ],
  };
}

function racine(rng: Rng): Gabarit {
  const a = randInt(rng, 1, 4);
  const b = randInt(rng, 1, 4);
  const u = `${coefTex(a)}x^2 + ${b}`;
  const us = `(${a}*x^2+${b})`;
  return {
    f: { tex: `\\sqrt{${u}}`, str: `sqrt${us}` },
    d: { tex: `\\frac{${monomeTex(new Q(a), 1)}}{\\sqrt{${u}}}`, str: `${a}*x/sqrt${us}` },
    etapes: [`$(\\sqrt{u})' = \\frac{u'}{2\\sqrt{u}}$ avec $u' = ${monomeTex(new Q(2 * a), 1)}$, puis on simplifie par 2.`],
    erreurs: [
      { tex: `\\frac{1}{2\\sqrt{${u}}}`, str: `1/(2*sqrt${us})`, explication: "Il manque $u'$ : $(\\sqrt{u})' = \\frac{u'}{2\\sqrt{u}}$." },
      { tex: `\\frac{${monomeTex(new Q(2 * a), 1)}}{\\sqrt{${u}}}`, str: `${2 * a}*x/sqrt${us}`, explication: 'Oubli du facteur $\\frac{1}{2}$.' },
      { tex: `\\sqrt{${monomeTex(new Q(2 * a), 1)}}`, str: `sqrt(${2 * a}*x)`, explication: 'On ne dérive pas « sous la racine ».' },
    ],
    domaine: [0.1, 3],
  };
}

function composee(rng: Rng): Gabarit {
  const n = randInt(rng, 2, 3);
  const xn = `x^{${n}}`;
  const dn = monomeTex(new Q(n), n - 1);
  if (pick(rng, [true, false]))
    return {
      f: { tex: `\\cos(${xn})`, str: `cos(x^${n})` },
      d: { tex: `-${dn}\\sin(${xn})`, str: `-${n}*x^${n - 1}*sin(x^${n})` },
      etapes: [`$(\\cos u)' = -u'\\sin u$ avec $u = ${xn}$, $u' = ${dn}$.`],
      erreurs: [
        { tex: `-\\sin(${xn})`, str: `-sin(x^${n})`, explication: `Oubli de $u' = ${dn}$.` },
        { tex: `${dn}\\sin(${xn})`, str: `${n}*x^${n - 1}*sin(x^${n})`, explication: "Signe oublié : $(\\cos)' = -\\sin$." },
        { tex: `-\\sin(${dn})`, str: `-sin(${n}*x^${n - 1})`, explication: "On a dérivé l'intérieur sans appliquer la formule $(f\\circ u)' = u' \\times f'\\circ u$." },
      ],
    };
  return {
    f: { tex: `e^{${xn}}`, str: `exp(x^${n})` },
    d: { tex: `${dn}e^{${xn}}`, str: `${n}*x^${n - 1}*exp(x^${n})` },
    etapes: [`$(e^u)' = u'e^u$ avec $u = ${xn}$, $u' = ${dn}$.`],
    erreurs: [
      { tex: `e^{${xn}}`, str: `exp(x^${n})`, explication: `L'exponentielle se recopie, mais il faut multiplier par $u' = ${dn}$.` },
      { tex: `${xn}e^{${xn} - 1}`, str: `x^${n}*exp(x^${n}-1)`, explication: "$e^u$ n'est pas une puissance de $u$ : la règle $nx^{n-1}$ ne s'applique pas." },
      { tex: `${dn}e^{${dn}}`, str: `${n}*x^${n - 1}*exp(${n}*x^${n - 1})`, explication: "On ne dérive pas l'exposant à l'intérieur de l'exponentielle : $(e^u)' = u'e^{u}$." },
    ],
  };
}

function arctangente(rng: Rng): Gabarit {
  const a = randInt(rng, 2, 4);
  return {
    f: { tex: `\\arctan(${a}x)`, str: `atan(${a}*x)` },
    d: { tex: `\\frac{${a}}{1 + ${a * a}x^2}`, str: `${a}/(1+${a * a}*x^2)` },
    etapes: [`$(\\arctan u)' = \\frac{u'}{1 + u^2}$ avec $u = ${a}x$ : $u^2 = ${a * a}x^2$.`],
    erreurs: [
      { tex: `\\frac{1}{1 + ${a * a}x^2}`, str: `1/(1+${a * a}*x^2)`, explication: `Oubli de $u' = ${a}$.` },
      { tex: `\\frac{${a}}{1 + ${a}x^2}`, str: `${a}/(1+${a}*x^2)`, explication: `$(${a}x)^2 = ${a * a}x^2$, pas $${a}x^2$.` },
      { tex: `\\frac{${a}}{\\sqrt{1 - ${a * a}x^2}}`, str: `${a}/sqrt(1-${a * a}*x^2)`, explication: 'Confusion avec la dérivée de $\\arcsin$.' },
    ],
    domaine: [-0.2, 0.2],
  };
}

export const GABARITS: Record<Difficulte, ((rng: Rng) => Gabarit)[]> = {
  1: [puissance, trigoAffine],
  2: [produitExp, logarithme, composee],
  3: [quotient, racine, arctangente],
};

export const derivees: Generateur = {
  id: 'derivees',
  titre: 'Calcul de dérivées',
  chapitre: 'derivabilite',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const g = pick(rng, GABARITS[difficulte])(rng);
    const correction = [...g.etapes, `Donc $f'(x) = ${g.d.tex}$.`];
    const indice = 'Repère la structure de $f$ (somme, produit, quotient, composée) et applique la formule adaptée.';
    if (forme === 'libre')
      return {
        id: '',
        type: 'expression',
        difficulte,
        enonce: `Calculer la dérivée de $f(x) = ${g.f.tex}$.`,
        indice,
        correction,
        reponse: g.d.str,
        variables: ['x'],
        ...(g.domaine ? { domaine: g.domaine } : {}),
      };
    return construireQcm(
      { difficulte, enonce: `Soit $f(x) = ${g.f.tex}$. Que vaut $f'(x)$ ?`, indice, correction },
      { texte: `$${g.d.tex}$`, explication: 'Formule correctement appliquée.', cle: cleExpr(g.d.str) },
      g.erreurs.map((e) => ({ texte: `$${e.tex}$`, explication: e.explication, cle: cleExpr(e.str) })),
    );
  },
};
