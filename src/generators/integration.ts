/** Générateurs — primitives et intégrales. */
import { randInt, randNonZero, pick, type Rng } from '../core/random';
import type { Difficulte, Question } from '../core/schema';
import { Q, construireQcm, cleExpr, cleNum, polyTex, monomeTex, coefTex, affineTex, type Generateur, type Candidat } from './outils';

interface F {
  tex: string;
  str: string;
}
interface Gabarit {
  f: F;
  F: F;
  etapes: string[];
  erreurs: (F & { explication: string })[];
  domaine?: [number, number];
}

const frac = (n: number, d: number) => new Q(n, d);
/** c·corps en LaTeX avec un coefficient rationnel : (1/3, "e^{3x}") → "\frac{1}{3}e^{3x}". */
const fois = (c: Q, corps: string) => (c.equals(1) ? corps : c.equals(-1) ? `-${corps}` : `${c.tex()}${corps}`);

function puissance(rng: Rng): Gabarit {
  const a = randNonZero(rng, -6, 6);
  const n = randInt(rng, 1, 4);
  const m = (c: Q, k: number): F => ({ tex: monomeTex(c, k), str: `${c.str()}*x^${k}` });
  return {
    f: m(new Q(a), n),
    F: m(frac(a, n + 1), n + 1),
    etapes: [`Une primitive de $x^n$ est $\\frac{x^{n+1}}{n+1}$ (ici $n = ${n}$).`],
    erreurs: [
      { ...m(new Q(a * n), n - 1), explication: 'On a dérivé au lieu de primitiver.' },
      { ...m(frac(a, n), n + 1), explication: 'On divise par le NOUVEL exposant $n+1$, pas par $n$.' },
      { ...m(new Q(a), n + 1), explication: 'Oubli de la division par $n+1$ (dérive ta réponse pour vérifier).' },
    ],
  };
}

function exponentielle(rng: Rng): Gabarit {
  const a = pick(rng, [2, 3, 4, -2, -3]);
  const e = `e^{${coefTex(a)}x}`;
  const s = `exp(${a}*x)`;
  return {
    f: { tex: e, str: s },
    F: { tex: fois(frac(1, a), e), str: `${s}/(${a})` },
    etapes: [`$(e^{ax})' = ae^{ax}$, donc une primitive de $e^{ax}$ est $\\frac{1}{a}e^{ax}$ (ici $a = ${a}$).`],
    erreurs: [
      { tex: fois(new Q(a), e), str: `${a}*${s}`, explication: 'On a dérivé au lieu de primitiver.' },
      { tex: e, str: s, explication: `Oubli du facteur $\\frac{1}{${a}}$ : la dérivée de $${e}$ est $${a}${e}$.` },
      { tex: fois(frac(-1, a), e), str: `-${s}/(${a})`, explication: 'Erreur de signe.' },
    ],
  };
}

function trigo(rng: Rng): Gabarit {
  const a = randInt(rng, 2, 5);
  const u = `${a}x`;
  const us = `(${a}*x)`;
  const k = frac(1, a);
  if (pick(rng, [true, false]))
    return {
      f: { tex: `\\cos(${u})`, str: `cos${us}` },
      F: { tex: fois(k, `\\sin(${u})`), str: `sin${us}/${a}` },
      etapes: [`$(\\sin(ax))' = a\\cos(ax)$, donc une primitive de $\\cos(ax)$ est $\\frac{1}{a}\\sin(ax)$.`],
      erreurs: [
        { tex: fois(k.neg(), `\\sin(${u})`), str: `-sin${us}/${a}`, explication: 'Signe faux : une primitive de $\\cos$ est $\\sin$ (sans moins).' },
        { tex: fois(new Q(a), `\\sin(${u})`), str: `${a}*sin${us}`, explication: `Il faut diviser par $${a}$, pas multiplier.` },
        { tex: `\\sin(${u})`, str: `sin${us}`, explication: `Oubli du facteur $\\frac{1}{${a}}$.` },
      ],
    };
  return {
    f: { tex: `\\sin(${u})`, str: `sin${us}` },
    F: { tex: fois(k.neg(), `\\cos(${u})`), str: `-cos${us}/${a}` },
    etapes: [`$(\\cos(ax))' = -a\\sin(ax)$, donc une primitive de $\\sin(ax)$ est $-\\frac{1}{a}\\cos(ax)$.`],
    erreurs: [
      { tex: fois(k, `\\cos(${u})`), str: `cos${us}/${a}`, explication: 'Signe oublié : une primitive de $\\sin$ est $-\\cos$.' },
      { tex: fois(new Q(-a), `\\cos(${u})`), str: `${-a}*cos${us}`, explication: `Il faut diviser par $${a}$, pas multiplier.` },
      { tex: `-\\cos(${u})`, str: `-cos${us}`, explication: `Oubli du facteur $\\frac{1}{${a}}$.` },
    ],
  };
}

function inverseAffine(rng: Rng): Gabarit {
  const a = randInt(rng, 2, 4);
  const b = randInt(rng, 1, 5);
  const v = affineTex(a, 'x', b);
  const vs = `(${a}*x+${b})`;
  return {
    f: { tex: `\\frac{1}{${v}}`, str: `1/${vs}` },
    F: { tex: `\\frac{1}{${a}}\\ln|${v}|`, str: `log(abs${vs})/${a}` },
    etapes: [`Forme $\\frac{u'}{u}$ à un facteur près : $\\frac{1}{${v}} = \\frac{1}{${a}} \\cdot \\frac{${a}}{${v}}$.`, 'Une primitive de $\\frac{u\'}{u}$ est $\\ln|u|$.'],
    erreurs: [
      { tex: `\\ln|${v}|`, str: `log(abs${vs})`, explication: `Oubli du facteur $\\frac{1}{${a}}$ : la dérivée de $\\ln|${v}|$ est $\\frac{${a}}{${v}}$.` },
      { tex: `${a}\\ln|${v}|`, str: `${a}*log(abs${vs})`, explication: `Il faut diviser par $${a}$, pas multiplier.` },
      { tex: `-\\frac{${a}}{(${v})^2}`, str: `-${a}/${vs}^2`, explication: 'On a dérivé au lieu de primitiver.' },
    ],
    domaine: [0, 3],
  };
}

function ippExp(rng: Rng): Gabarit {
  const a = pick(rng, [1, 2, -1, -2, 3]);
  const e = `e^{${coefTex(a)}x}`;
  const s = `exp(${a}*x)`;
  const bon = [frac(-1, a * a), frac(1, a)];
  return {
    f: { tex: `x${e}`, str: `x*${s}` },
    F: { tex: `\\left(${polyTex(bon)}\\right)${e}`, str: `(x/(${a}) - 1/${a * a})*${s}` },
    etapes: [
      `IPP avec $u = x$, $v' = ${e}$ : $u' = 1$, $v = ${fois(frac(1, a), e)}$.`,
      `$\\int x${e}\\,dx = ${fois(frac(1, a), `x${e}`)} - \\int ${fois(frac(1, a), e)}\\,dx = ${fois(frac(1, a), `x${e}`)} - ${fois(frac(1, a * a), e)}$.`,
    ],
    erreurs: [
      { tex: fois(frac(1, a), `x${e}`), str: `x/(${a})*${s}`, explication: "IPP incomplète : il manque le terme $-\\int u'v$." },
      { tex: `\\left(${polyTex([frac(1, a * a), frac(1, a)])}\\right)${e}`, str: `(x/(${a}) + 1/${a * a})*${s}`, explication: "Erreur de signe dans l'IPP : $\\int uv' = uv - \\int u'v$." },
      { tex: `\\frac{x^2}{2}\\cdot${fois(frac(1, a), e)}`, str: `x^2/2*${s}/(${a})`, explication: "Une primitive d'un produit n'est pas le produit des primitives." },
    ],
  };
}

function ippTrigo(rng: Rng): Gabarit {
  if (pick(rng, [true, false]))
    return {
      f: { tex: 'x\\cos x', str: 'x*cos(x)' },
      F: { tex: 'x\\sin x + \\cos x', str: 'x*sin(x)+cos(x)' },
      etapes: ["IPP avec $u = x$, $v' = \\cos x$ : $u' = 1$, $v = \\sin x$.", '$\\int x\\cos x\\,dx = x\\sin x - \\int \\sin x\\,dx = x\\sin x + \\cos x$.'],
      erreurs: [
        { tex: 'x\\sin x - \\cos x', str: 'x*sin(x)-cos(x)', explication: 'Erreur de signe : $-\\int\\sin x\\,dx = +\\cos x$.' },
        { tex: '\\frac{x^2}{2}\\sin x', str: 'x^2/2*sin(x)', explication: "Une primitive d'un produit n'est pas le produit des primitives." },
        { tex: 'x\\sin x', str: 'x*sin(x)', explication: "IPP incomplète : il manque $-\\int u'v$." },
      ],
    };
  return {
    f: { tex: 'x\\sin x', str: 'x*sin(x)' },
    F: { tex: '\\sin x - x\\cos x', str: 'sin(x)-x*cos(x)' },
    etapes: ["IPP avec $u = x$, $v' = \\sin x$ : $u' = 1$, $v = -\\cos x$.", '$\\int x\\sin x\\,dx = -x\\cos x + \\int \\cos x\\,dx = -x\\cos x + \\sin x$.'],
    erreurs: [
      { tex: '-x\\cos x - \\sin x', str: '-x*cos(x)-sin(x)', explication: 'Erreur de signe : $-\\int(-\\cos x)\\,dx = +\\sin x$.' },
      { tex: '-\\frac{x^2}{2}\\cos x', str: '-x^2/2*cos(x)', explication: "Une primitive d'un produit n'est pas le produit des primitives." },
      { tex: '-x\\cos x', str: '-x*cos(x)', explication: "IPP incomplète : il manque $-\\int u'v$." },
    ],
  };
}

const GABARITS: Record<Difficulte, ((rng: Rng) => Gabarit)[]> = {
  1: [puissance, exponentielle],
  2: [trigo, inverseAffine],
  3: [ippExp, ippTrigo],
};

export const primitives: Generateur = {
  id: 'primitives',
  titre: 'Primitives',
  chapitre: 'integration',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const g = pick(rng, GABARITS[difficulte])(rng);
    const correction = [...g.etapes, `Une primitive est $F(x) = ${g.F.tex}$ (+ une constante).`, "Vérification : $F' = f$."];
    const indice = 'Pense à vérifier en dérivant ta réponse.';
    if (forme === 'libre')
      return {
        id: '',
        type: 'expression',
        difficulte,
        enonce: `Donner une primitive de $f(x) = ${g.f.tex}$${g.domaine ? ` sur $[0, +\\infty[$` : ''}.`,
        indice,
        correction,
        reponse: g.F.str,
        variables: ['x'],
        aConstantePres: true,
        ...(g.domaine ? { domaine: g.domaine } : {}),
      };
    return construireQcm(
      { difficulte, enonce: `Laquelle de ces fonctions est une primitive de $f(x) = ${g.f.tex}$ ?`, indice, correction },
      { texte: `$${g.F.tex}$`, explication: "Sa dérivée redonne bien $f$.", cle: cleExpr(g.F.str) },
      g.erreurs.map((e) => ({ texte: `$${e.tex}$`, explication: e.explication, cle: cleExpr(e.str) })),
    );
  },
};

/** ∫_0^b (αx² + βx + γ) dx. */
export const integralePolynome: Generateur = {
  id: 'integrale-polynome',
  titre: 'Intégrale d\'un polynôme',
  chapitre: 'integration',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const p = [randInt(rng, -4, 4), randInt(rng, -4, 4), randNonZero(rng, -3, 3)].map((x) => new Q(x));
    const b = randInt(rng, 1, difficulte + 1);
    const prim = [new Q(0), p[0], p[1].div(2), p[2].div(3)];
    const F = (x: number) => prim.reduce((s, c, k) => s.add(c.mul(new Q(x).pow(k))), new Q(0));
    const I = F(b);
    const f = (x: number) => p.reduce((s, c, k) => s.add(c.mul(new Q(x).pow(k))), new Q(0));
    const enonce = `Calculer $\\displaystyle I = \\int_0^{${b}} \\left(${polyTex(p)}\\right)dx$.`;
    const correction = [
      `Une primitive est $F(x) = ${polyTex(prim)}$.`,
      `$I = F(${b}) - F(0) = ${F(b).tex()} - 0 = ${I.tex()}$.`,
    ];
    const indice = '$\\int_a^b f = F(b) - F(a)$ avec $F$ une primitive de $f$.';
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: I.toString() };
    const c = (v: Q, explication: string): Candidat => ({ texte: `$${v.tex()}$`, explication, cle: cleNum(v.valueOf()) });
    const sansDiv = [new Q(0), p[0], p[1], p[2]];
    return construireQcm({ difficulte, enonce, indice, correction }, c(I, '$F(b) - F(0)$ avec la bonne primitive.'), [
      c(f(b).sub(f(0)), "On a calculé $f(b) - f(0)$ : il faut une PRIMITIVE de $f$."),
      c(sansDiv.reduce((s, ck, k) => s.add(ck.mul(new Q(b).pow(k))), new Q(0)), "Primitive fausse : $x^n$ s'intègre en $\\frac{x^{n+1}}{n+1}$, il manque les divisions."),
      c(I.neg(), 'Bornes inversées : $F(b) - F(a)$, pas $F(a) - F(b)$.'),
      c(p[2].mul(b ** 3).div(2).add(p[1].mul(b * b)).add(p[0].mul(b)), "Primitive fausse : on divise par le NOUVEL exposant ($x^2 \\to \\frac{x^3}{3}$, pas $\\frac{x^3}{2}$)."),
      c(f(b).mul(b), "$b \\times f(b)$ n'est l'aire que si $f$ est constante."),
      c(I.add(p[0]), 'Erreur dans la primitive du terme constant.'),
    ]);
  },
};
