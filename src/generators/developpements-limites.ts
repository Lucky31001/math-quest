/**
 * Générateur — développements limités en 0 à l'ordre 3.
 * Les coefficients sont calculés exactement (rationnels) à partir des DL usuels,
 * avec composition par u = a·x et produit de DL tronqué.
 */
import { pick, type Rng } from '../core/random';
import type { Question } from '../core/schema';
import { Q, fact, construireQcm, polyTex, polyStr, cleNum, type Generateur, type Candidat } from './outils';

const ORDRE = 3;

export interface Usuelle {
  nom: string;
  /** LaTeX de f(u) en fonction de l'argument LaTeX `u`. */
  tex: (u: string) => string;
  /** math.js de f(u). */
  str: (u: string) => string;
  /** Coefficients du DL de f(u) en 0 (ordre 0..3). */
  coefs: Q[];
  /** Rappel du DL usuel en LaTeX. */
  rappel: string;
  /** Erreur « factorielles oubliées » pertinente pour cette fonction ? */
  factorielles: boolean;
}

export const USUELLES: Usuelle[] = [
  {
    nom: 'exp',
    tex: (u) => `e^{${u}}`,
    str: (u) => `exp(${u})`,
    coefs: [0, 1, 2, 3].map((k) => new Q(1, fact(k))),
    rappel: 'e^u = 1 + u + \\frac{u^2}{2} + \\frac{u^3}{6} + o(u^3)',
    factorielles: true,
  },
  {
    nom: 'ln',
    tex: (u) => `\\ln(1 + ${u})`,
    str: (u) => `log(1+${u})`,
    coefs: [new Q(0), new Q(1), new Q(-1, 2), new Q(1, 3)],
    rappel: '\\ln(1+u) = u - \\frac{u^2}{2} + \\frac{u^3}{3} + o(u^3)',
    factorielles: false,
  },
  {
    nom: 'sin',
    tex: (u) => `\\sin(${u})`,
    str: (u) => `sin(${u})`,
    coefs: [new Q(0), new Q(1), new Q(0), new Q(-1, 6)],
    rappel: '\\sin u = u - \\frac{u^3}{6} + o(u^3)',
    factorielles: true,
  },
  {
    nom: 'cos',
    tex: (u) => `\\cos(${u})`,
    str: (u) => `cos(${u})`,
    coefs: [new Q(1), new Q(0), new Q(-1, 2), new Q(0)],
    rappel: '\\cos u = 1 - \\frac{u^2}{2} + o(u^3)',
    factorielles: true,
  },
  {
    nom: 'inv',
    tex: (u) => `\\frac{1}{1 - ${u}}`,
    str: (u) => `1/(1-${u})`,
    coefs: [1, 1, 1, 1].map((k) => new Q(k)),
    rappel: '\\frac{1}{1-u} = 1 + u + u^2 + u^3 + o(u^3)',
    factorielles: false,
  },
  {
    nom: 'sqrt',
    tex: (u) => `\\sqrt{1 + ${u}}`,
    str: (u) => `sqrt(1+${u})`,
    coefs: [new Q(1), new Q(1, 2), new Q(-1, 8), new Q(1, 16)],
    rappel: '\\sqrt{1+u} = 1 + \\frac{u}{2} - \\frac{u^2}{8} + \\frac{u^3}{16} + o(u^3)',
    factorielles: false,
  },
  {
    nom: 'arctan',
    tex: (u) => `\\arctan(${u})`,
    str: (u) => `atan(${u})`,
    coefs: [new Q(0), new Q(1), new Q(0), new Q(-1, 3)],
    rappel: '\\arctan u = u - \\frac{u^3}{3} + o(u^3)',
    factorielles: false,
  },
  {
    nom: 'sh',
    tex: (u) => `\\operatorname{sh}(${u})`,
    str: (u) => `sinh(${u})`,
    coefs: [new Q(0), new Q(1), new Q(0), new Q(1, 6)],
    rappel: '\\operatorname{sh} u = u + \\frac{u^3}{6} + o(u^3)',
    factorielles: true,
  },
  {
    nom: 'ch',
    tex: (u) => `\\operatorname{ch}(${u})`,
    str: (u) => `cosh(${u})`,
    coefs: [new Q(1), new Q(0), new Q(1, 2), new Q(0)],
    rappel: '\\operatorname{ch} u = 1 + \\frac{u^2}{2} + o(u^3)',
    factorielles: true,
  },
];

/** Argument u = a·x en LaTeX (et math.js). Pour « 1 − u » et « 1 + u » on adapte le signe. */
const argTex = (a: number) => (a === 1 ? 'x' : a === -1 ? '-x' : `${a}x`);
const argStr = (a: number) => `(${a}*x)`;

/** f(a·x) : coefficients c_k·a^k. */
export const substituer = (c: Q[], a: number): Q[] => c.map((ck, k) => ck.mul(new Q(a).pow(k)));

/** Produit de deux DL tronqué à l'ordre 3. */
export function produitTronque(p: Q[], q: Q[]): Q[] {
  return [0, 1, 2, 3].map((k) => {
    let s = new Q(0);
    for (let i = 0; i <= k; i++) s = s.add(p[i].mul(q[k - i]));
    return s;
  });
}

/** LaTeX de f(a x), en simplifiant « 1 + -2x » → « 1 - 2x ». */
function texDe(f: Usuelle, a: number): string {
  const t = f.tex(argTex(a));
  return t.replace('1 + -', '1 - ').replace('1 - -', '1 + ');
}

interface Cible {
  tex: string;
  str: string;
  coefs: Q[];
  etapes: string[];
  /** Erreurs typiques sous forme de coefficients. */
  erreurs: { coefs: Q[]; explication: string }[];
}

function tirer(rng: Rng, difficulte: number): Cible {
  if (difficulte < 3) {
    const f = pick(rng, USUELLES);
    const a = difficulte === 1 ? pick(rng, [1, 2]) : pick(rng, [-1, 2, -2, 3]);
    const c = substituer(f.coefs, a);
    const erreurs: Cible['erreurs'] = [];
    erreurs.push({ coefs: [c[0], c[1], c[2], new Q(0)], explication: "DL à l'ordre 2 seulement : il manque le terme en $x^3$." });
    if (a !== 1 && a !== -1)
      erreurs.push({
        coefs: c.map((ck, k) => (k === 0 ? ck : f.coefs[k].mul(a))),
        explication: `On doit remplacer $u$ par $${argTex(a)}$ partout : $u^k = ${a < 0 ? `(${a})` : a}^k x^k$, pas $${a}x^k$.`,
      });
    if (f.factorielles)
      erreurs.push({ coefs: c.map((ck, k) => ck.mul(fact(k))), explication: 'Factorielles oubliées : le terme d\'ordre $k$ est divisé par $k!$.' });
    else erreurs.push({ coefs: c.map((ck, k) => (k >= 2 ? ck.neg() : ck)), explication: 'Signes faux sur les termes d\'ordre 2 et 3.' });
    erreurs.push({ coefs: c.map((ck, k) => (k === 3 ? ck.neg() : ck)), explication: 'Signe faux sur le terme en $x^3$.' });
    erreurs.push({ coefs: c.map((ck, k) => (k === 2 ? ck.neg() : ck)), explication: 'Signe faux sur le terme en $x^2$.' });
    erreurs.push({ coefs: substituer(f.coefs, 1), explication: `On a oublié de remplacer $u$ par $${argTex(a)}$.` });
    erreurs.push({ coefs: c.map((ck, k) => (k === 1 ? ck.neg() : ck)), explication: 'Signe faux sur le terme en $x$.' });
    erreurs.push({ coefs: [c[0], c[1], new Q(0), new Q(0)], explication: "On s'est arrêté à l'ordre 1 : l'ordre 3 demande les termes jusqu'à $x^3$." });
    return {
      tex: texDe(f, a),
      str: f.str(argStr(a)),
      coefs: c,
      etapes: [
        `DL usuel : $${f.rappel}$.`,
        a === 1 ? 'Ici $u = x$.' : `On pose $u = ${argTex(a)} \\to 0$ et on remplace : chaque $u^k$ devient $${a < 0 ? `(${a})` : a}^k x^k$.`,
      ],
      erreurs,
    };
  }
  // Difficulté 3 : produit de deux fonctions usuelles.
  const candidats = USUELLES.filter((f) => ['exp', 'sin', 'cos', 'ln', 'inv'].includes(f.nom));
  const f = pick(rng, candidats);
  let g = pick(rng, candidats);
  while (g === f) g = pick(rng, candidats);
  const a = pick(rng, [1, -1, 2]);
  const b = pick(rng, [1, -1, 2]);
  const p = substituer(f.coefs, a);
  const q = substituer(g.coefs, b);
  const c = produitTronque(p, q);
  // Erreur : produit « terme à terme » (sans les termes croisés).
  const termeATerme = p.map((pk, k) => pk.mul(q[k]));
  return {
    tex: `${texDe(f, a)}\\,${texDe(g, b)}`,
    str: `${f.str(argStr(a))}*${g.str(argStr(b))}`,
    coefs: c,
    etapes: [
      `DL usuels : $${f.rappel}$ et $${g.rappel}$.`,
      `$${texDe(f, a)} = ${polyTex(p, 'croissant')} + o(x^3)$ et $${texDe(g, b)} = ${polyTex(q, 'croissant')} + o(x^3)$.`,
      'On multiplie en ne gardant que les termes de degré $\\leq 3$.',
    ],
    erreurs: [
      { coefs: [c[0], c[1], c[2], new Q(0)], explication: "DL à l'ordre 2 seulement : il manque le terme en $x^3$." },
      { coefs: termeATerme, explication: 'On ne multiplie pas terme à terme : il faut tous les produits croisés de degré $\\leq 3$.' },
      { coefs: c.map((ck, k) => (k === 3 ? ck.sub(p[1].mul(q[2])) : ck)), explication: 'Produit croisé oublié : (terme en $x$) × (terme en $x^2$) contribue au degré 3.' },
      { coefs: c.map((ck, k) => (k === 3 ? ck.sub(p[2].mul(q[1])) : ck)), explication: 'Produit croisé oublié : (terme en $x^2$) × (terme en $x$) contribue au degré 3.' },
      { coefs: c.map((ck, k) => (k === 2 ? ck.neg() : ck)), explication: 'Signe faux sur le terme en $x^2$.' },
      { coefs: c.map((ck, k) => (k === 1 ? ck.neg() : ck)), explication: 'Signe faux sur le terme en $x$.' },
      { coefs: c.map((ck, k) => (k === 3 ? ck.neg() : ck)), explication: 'Signe faux sur le terme en $x^3$.' },
    ],
  };
}

export const dlOrdre3: Generateur = {
  id: 'dl-ordre-3',
  titre: 'DL en 0 à l\'ordre 3',
  chapitre: 'developpements-limites',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const t = tirer(rng, difficulte);
    const correction = [...t.etapes, `$${t.tex} = ${polyTex(t.coefs, 'croissant')} + o(x^3)$.`];
    const indice = 'Pars des DL usuels en 0 et remplace $u$ par l\'argument (qui tend bien vers 0).';
    if (forme === 'libre')
      return {
        id: '',
        type: 'expression',
        difficulte,
        enonce: `Donner la partie régulière du développement limité à l'ordre 3 en 0 de $f(x) = ${t.tex}$ (le polynôme, sans le $o(x^3)$).`,
        indice,
        correction,
        reponse: polyStr(t.coefs),
        variables: ['x'],
        domaine: [-1, 1],
      };
    const c = (coefs: Q[], explication: string): Candidat => ({
      texte: `$${polyTex(coefs, 'croissant')} + o(x^3)$`,
      explication,
      cle: cleNum(...coefs.map(Number)),
    });
    return construireQcm(
      { difficulte, enonce: `Quel est le développement limité à l'ordre 3 en 0 de $f(x) = ${t.tex}$ ?`, indice, correction },
      c(t.coefs, 'DL usuel correctement composé et tronqué à l\'ordre 3.'),
      t.erreurs.map((e) => c(e.coefs, e.explication)),
    );
  },
};

/** Exposé pour les tests : la fonction cible et son DL. */
export const _tirerDl = tirer;
export { ORDRE };
