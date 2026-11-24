/**
 * Vérifications MATHÉMATIQUES des générateurs d'exercices : pour chaque
 * générateur, une fonction qui relit l'énoncé AFFICHÉ (LaTeX), recalcule la
 * réponse indépendamment, et vérifie que la bonne réponse est juste et que
 * chaque distracteur de QCM est faux. Elle reçoit une question, libre ou QCM.
 *
 * Familles :
 * - `parValeur` : la réponse est un nombre calculable depuis l'énoncé ;
 * - `parCritere` : la réponse est un objet (fonction, matrice, couple…) qu'on
 *   teste par un critère (f' = dérivée de f, z² = w…), pour la saisie libre
 *   (chaîne math.js) et pour chaque choix de QCM (LaTeX) ;
 * - les autres sont écrites à la main.
 *
 * Physique et informatique ont leurs propres tests (generators-physique,
 * generators-informatique).
 */
import { expect } from 'vitest';
import type { Qcm, Question } from '../../src/core/schema';
import { math, valeurDe } from '../../src/core/checker';
import { createRng } from '../../src/core/random';
import { evalReel, evalTex, segment, segments, texVersMath } from '../tex';
import { sansDollars, bonne, mauvais, proche } from '../outils/generateurs';

type Valeur = number | { re: number; im: number };
type Verification = (q: Question) => void;

/* ------------------------------------------------------------------ */
/* Familles                                                            */
/* ------------------------------------------------------------------ */

const egalV = (a: Valeur, b: Valeur, tol = 1e-6) => {
  const A = typeof a === 'number' ? { re: a, im: 0 } : a;
  const B = typeof b === 'number' ? { re: b, im: 0 } : b;
  if (!Number.isFinite(A.re) || !Number.isFinite(B.re)) return A.re === B.re;
  return proche(A.re, B.re, tol) && proche(A.im, B.im, tol);
};

/** Valeur d'un choix de QCM (LaTeX), ±∞ compris. */
const valeurChoix = (t: string): Valeur => {
  const s = sansDollars(t);
  if (s === '+\\infty') return Infinity;
  if (s === '-\\infty') return -Infinity;
  return evalTex(s);
};

/** Première valeur d'une réponse numérique (saisie libre). */
const valeurReponse = (q: Question): Valeur => {
  if (q.type !== 'numerique') throw new Error(`numérique attendu : ${q.type}`);
  const v = valeurDe(Array.isArray(q.reponse) ? q.reponse[0] : q.reponse);
  return v.im ? v : v.re;
};
const valeurNum = (q: Question): number => {
  if (q.type !== 'numerique') throw new Error(`numérique attendu : ${q.type}`);
  return valeurDe(Array.isArray(q.reponse) ? q.reponse[0] : q.reponse).re;
};

/** QCM : `ok` vrai pour la bonne réponse, faux pour chaque distracteur. */
function seuleLaBonne(q: Qcm, ok: (texte: string) => boolean): void {
  expect(ok(bonne(q).texte), `${q.enonce} → ${bonne(q).texte}`).toBe(true);
  for (const c of mauvais(q)) expect(ok(c.texte), `${q.enonce} : distracteur ${c.texte}`).toBe(false);
}

/**
 * La réponse est la valeur `attendu(q)`. `ignorer` : distracteurs non évaluables
 * (∞, ln d'un négatif…), qu'on ne compare pas.
 */
const parValeur =
  (attendu: (q: Question) => Valeur, tol = 1e-6, ignorer?: RegExp): Verification =>
  (q) => {
    const a = attendu(q);
    if (q.type === 'numerique') {
      const v = valeurReponse(q);
      expect(egalV(v, a, tol), `${q.enonce} → attendu ${JSON.stringify(a)}, obtenu ${JSON.stringify(v)}`).toBe(true);
    } else if (q.type === 'qcm') {
      expect(egalV(valeurChoix(bonne(q).texte), a, tol), `${q.enonce} → ${bonne(q).texte} ≠ ${JSON.stringify(a)}`).toBe(true);
      for (const c of mauvais(q)) {
        if (ignorer?.test(sansDollars(c.texte))) continue;
        expect(egalV(valeurChoix(c.texte), a, tol), `${q.enonce} : distracteur ${c.texte}`).toBe(false);
      }
    } else throw new Error(`type inattendu : ${q.type}`);
  };

/**
 * La réponse vérifie un critère : `libre` reçoit la réponse attendue (chaîne
 * math.js), `choix` le texte LaTeX d'un choix de QCM.
 */
const parCritere =
  <C>(contexte: (q: Question) => C, critere: { libre?: (c: C, reponse: string) => boolean; choix: (c: C, texte: string) => boolean }): Verification =>
  (q) => {
    const c = contexte(q);
    if (q.type === 'qcm') return seuleLaBonne(q, (t) => critere.choix(c, t));
    if (q.type !== 'expression' || !critere.libre) throw new Error(`type inattendu : ${q.type}`);
    expect(critere.libre(c, q.reponse), `${q.enonce} → ${q.reponse}`).toBe(true);
  };

/* ------------------------------------------------------------------ */
/* Outils numériques                                                   */
/* ------------------------------------------------------------------ */

const POINTS = [0.31, 0.77, 1.23, 1.9];
const fn = (tex: string) => (x: number) => evalReel(tex, { x });
const fnStr = (s: string) => {
  const c = math.compile(s);
  return (x: number) => {
    const v = c.evaluate({ x });
    return typeof v === 'number' ? v : NaN;
  };
};
const deriveeNum = (f: (x: number) => number, x: number, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);
const egalesFonctions = (f: (x: number) => number, g: (x: number) => number, pts = POINTS, tol = 1e-5) =>
  pts.every((x) => proche(f(x), g(x), tol));
const fDeLEnonce = (q: Question) => fn(segment(q.enonce, /\$f\(x\) = (.*?)\$/));

/** Première matrice pmatrix d'un texte, ou toutes. */
const lireMatrices = (t: string) =>
  [...t.matchAll(/\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}/g)].map((m) => m[1].split('\\\\').map((l) => l.split('&').map((x) => evalReel(x.trim()))));
const lireMatrice = (t: string) => lireMatrices(t)[0];
/** Lignes « … = … » d'un environnement cases. */
const lignesCases = (t: string) => segment(t, /\\begin\{cases\}(.*?)\\end\{cases\}/).split('\\\\').map((l) => l.trim());
/** Coefficients d'une forme linéaire LaTeX par évaluation aux vecteurs de base. */
function coefficients(lhs: string, vars: string[]): number[] {
  const zero = Object.fromEntries(vars.map((v) => [v, 0]));
  const c0 = evalReel(lhs, zero);
  return vars.map((v) => evalReel(lhs, { ...zero, [v]: 1 }) - c0);
}
function rangNum(m: number[][]): number {
  const a = m.map((l) => l.slice());
  let r = 0;
  for (let c = 0; c < a[0].length && r < a.length; c++) {
    let p = -1;
    for (let i = r; i < a.length; i++) if (Math.abs(a[i][c]) > 1e-9) p = i;
    if (p < 0) continue;
    [a[r], a[p]] = [a[p], a[r]];
    for (let i = 0; i < a.length; i++) if (i !== r) a[i] = a[i].map((v, j) => v - (a[i][c] / a[r][c]) * a[r][j]);
    r++;
  }
  return r;
}

/** Limite numérique de « \lim_{x \to a} … » (moyenne symétrique : erreur en O(h²)). */
const limite = (e: string, h = 1e-4) => {
  const a = Number(segment(e, /\\lim_\{x \\to (-?\d+)\}/));
  const expr = segment(e, /\\lim_\{x \\to -?\d+\} (.*?)\$/);
  return (evalReel(expr, { x: a + h }) + evalReel(expr, { x: a - h })) / 2;
};

/** Compte par énumération brute les suites de longueur p sur {0..n-1} vérifiant un critère. */
function enumerer(n: number, p: number, ok: (t: number[]) => boolean): number {
  let c = 0;
  const t: number[] = [];
  const rec = () => {
    if (t.length === p) return void (ok(t) && c++);
    for (let v = 0; v < n; v++) {
      t.push(v);
      rec();
      t.pop();
    }
  };
  rec();
  return c;
}
const distincts = (t: number[]) => new Set(t).size === t.length;
const croissants = (t: number[]) => t.every((v, i) => i === 0 || v > t[i - 1]);

/* ------------------------------------------------------------------ */
/* Logique                                                             */
/* ------------------------------------------------------------------ */

/** Analyse une formule propositionnelle LaTeX (sous-formules binaires parenthésées). */
function evalFormule(tex: string, env: Record<string, boolean>): boolean {
  const tokens = tex.match(/\\neg|\\land|\\lor|\\Rightarrow|\\Leftrightarrow|[PQR]|\(|\)/g)!;
  let i = 0;
  const atome = (): boolean => {
    const t = tokens[i++];
    if (t === '\\neg') return !atome();
    if (t === '(') {
      const v = expr();
      i++; // ')'
      return v;
    }
    return env[t];
  };
  const expr = (): boolean => {
    const a = atome();
    const op = tokens[i];
    if (!op || op === ')') return a;
    i++;
    const b = atome();
    return op === '\\land' ? a && b : op === '\\lor' ? a || b : op === '\\Rightarrow' ? !a || b : a === b;
  };
  return expr();
}

/** Évalue une phrase quantifiée « \forall x \in \mathbb{R},\ … » sur un modèle fini. */
function evalPhrase(tex: string, D: number[], f: (v: number) => number): boolean {
  const parts = tex.split(',\\ ');
  const pred = parts.pop()!;
  const quants = parts.map((p) => {
    const m = p.match(/^(\\forall|\\exists) (\w) \\in \\mathbb\{R\}$/);
    if (!m) throw new Error(`quantificateur illisible : ${p}`);
    return { q: m[1], v: m[2] };
  });
  const versJs = (s: string) =>
    s
      .replace(/\\leq/g, '<=')
      .replace(/\\geq/g, '>=')
      .replace(/\\neq/g, '!=')
      .replace(/([^<>!=])=([^=])/g, '$1==$2');
  let js: string;
  if (pred.includes('\\Rightarrow')) {
    const [a, b] = pred.split('\\Rightarrow');
    js = `!(${versJs(a)}) || (${versJs(b)})`;
  } else js = pred.split('\\text{ et }').map((x) => `(${versJs(x)})`).join(' && ');
  const f2 = new Function('f', 'x', 'y', `return ${js};`) as (f: (v: number) => number, x: number, y: number) => boolean;
  const rec = (k: number, env: Record<string, number>): boolean => {
    if (k === quants.length) return f2(f, env.x ?? 0, env.y ?? 0);
    const { q, v } = quants[k];
    return q === '\\forall' ? D.every((d) => rec(k + 1, { ...env, [v]: d })) : D.some((d) => rec(k + 1, { ...env, [v]: d }));
  };
  return rec(0, {});
}

/** Modèles finis pour les négations : constantes, identité, carré… et 300 fonctions aléatoires. */
const DOMAINE = [-2, -1, 0, 1, 2];
const MODELES: ((v: number) => number)[] = (() => {
  const rng = createRng(7);
  return [
    ...DOMAINE.map((c) => () => c),
    (v: number) => v,
    (v: number) => -v,
    (v: number) => v * v,
    (v: number) => v + 1,
    ...Array.from({ length: 300 }, () => {
      const table = new Map(DOMAINE.map((d) => [d, Math.floor(rng() * 5) - 2]));
      return (v: number) => table.get(v) ?? 0;
    }),
  ];
})();

const lignesVraies = (q: Question) => {
  const f = segment(q.enonce, /table de vérité de \$(.*?)\$/);
  const vars = /(^|[^a-zA-Z\\])R(?![a-z])/.test(f) ? ['P', 'Q', 'R'] : ['P', 'Q'];
  let n = 0;
  for (let m = 0; m < 2 ** vars.length; m++) if (evalFormule(f, Object.fromEntries(vars.map((v, i) => [v, !!((m >> i) & 1)])))) n++;
  return n;
};

/* ------------------------------------------------------------------ */
/* Vérifications, par générateur                                       */
/* ------------------------------------------------------------------ */

/** Une solution d'EDO d'ordre 1 vérifie l'équation et la condition initiale. */
function verifieEdo1(enonce: string, y: (x: number) => number): boolean {
  const eq = segment(enonce, /Résoudre \$(.*?)\$/);
  const y0 = Number(segment(enonce, /\$y\(0\) = (-?\d+)\$/));
  const [g, d] = eq.split('=');
  const lhs = math.compile(texVersMath(g.replace(/y'/g, 'yp')));
  const rhs = math.compile(texVersMath(d.replace(/y'/g, 'yp')));
  const okEq = POINTS.every((x) => {
    const scope = { y: y(x), yp: deriveeNum(y, x) };
    return proche(lhs.evaluate(scope), rhs.evaluate(scope), 1e-5);
  });
  return okEq && proche(y(0), y0);
}

/** Solution GÉNÉRALE d'une EDO d'ordre 2 homogène : solution pour plusieurs (λ, μ), et dépend de μ. */
function solutionGeneraleEdo2(enonce: string, t: string): boolean {
  const eq = segment(enonce, /de \$(.*?) = 0\$/);
  const lhs = math.compile(texVersMath(eq.replace(/y''/g, 'ypp').replace(/y'/g, 'yp')));
  const famille = sansDollars(t).replace(/^y = /, '');
  const solution = [
    [1.3, -0.7],
    [0, 1],
    [1, 0],
  ].every(([lam, mu]) => {
    const y = (x: number) => evalReel(famille, { x, lam, mu });
    return POINTS.every((x) => {
      const h = 1e-4;
      const scope = { y: y(x), yp: (y(x + h) - y(x - h)) / (2 * h), ypp: (y(x + h) - 2 * y(x) + y(x - h)) / (h * h) };
      return Math.abs(lhs.evaluate(scope)) < 1e-3 * Math.max(1, Math.abs(scope.ypp));
    });
  });
  const dependDeMu = POINTS.some((x) => Math.abs(evalReel(famille, { x, lam: 0, mu: 1 })) > 1e-9);
  return solution && dependDeMu;
}

/** (f(h) − P(h)) / h³ en h = ±10⁻⁴ : doit tendre vers 0 pour un DL à l'ordre 3. */
const resteDl = (f: (x: number) => number, P: (x: number) => number) =>
  Math.max(...[1e-4, -1e-4].map((h) => Math.abs((f(h) - P(h)) / h ** 3)));

/** Tangente en l'abscisse affichée, recalculée par dérivée numérique. */
function tangente(e: string) {
  const f = segment(e, /\$f\(x\) = (.*?)\$/);
  const a = Number(segment(e, /abscisse \$(-?\d+)\$/));
  const fa = evalReel(f, { x: a });
  const fpa = deriveeNum((x) => evalReel(f, { x }), a);
  return (x: number) => fpa * (x - a) + fa;
}

/** Termes u_0..u_N d'une récurrence linéaire d'ordre 2 lue dans l'énoncé. */
function suiteOrdre2(e: string, N: number): number[] {
  const u = [Number(segment(e, /u_0 = (-?\d+)/)), Number(segment(e, /u_1 = (-?\d+)/))];
  const rec = segment(e, /u_\{n\+2\} = (.*?)\$/).replace(/u_\{n\+1\}/g, ' A ').replace(/u_n/g, ' B ');
  for (let n = 2; n <= N; n++) u.push(evalReel(rec, { A: u[n - 1], B: u[n - 2] }));
  return u;
}

export const VERIFICATIONS_GENERATEURS: Record<string, Verification> = {
  /* ---------------------------- logique, ensembles ---------------------------- */
  'logique-table-verite': (q) => {
    const n = lignesVraies(q);
    if (q.type === 'numerique') expect(valeurNum(q), q.enonce).toBe(n);
    else if (q.type === 'qcm') seuleLaBonne(q, (t) => evalReel(sansDollars(t)) === n);
  },

  'logique-negation': (q) => {
    if (q.type !== 'qcm') throw new Error(q.type);
    const phrase = segments(q.enonce)[1];
    const estNegation = (t: string) => MODELES.every((f) => evalPhrase(t, DOMAINE, f) === !evalPhrase(phrase, DOMAINE, f));
    expect(estNegation(sansDollars(bonne(q).texte)), `${phrase} → ${bonne(q).texte}`).toBe(true);
    // Seuls les distracteurs de MÊME préfixe sont testés sur les modèles finis : ceux qui changent les
    // quantificateurs ne sont pas équivalents sur ℝ, mais un domaine fini ne permet pas toujours de le voir.
    const prefixe = (t: string) => sansDollars(t).split(',\\ ').slice(0, -1).join();
    for (const c of mauvais(q)) {
      if (prefixe(c.texte) !== prefixe(bonne(q).texte)) continue;
      expect(estNegation(sansDollars(c.texte)), `${phrase} : ${c.texte}`).toBe(false);
    }
  },

  'ensembles-denombrement': parValeur(
    ({ enonce: e }) => {
      const nums = [...e.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
      if (/parties \(sous-ensembles\)/.test(e)) return 2 ** nums[1];
      if (/applications de/.test(e)) return enumerer(nums[3], nums[1], () => true);
      if (/injections/.test(e)) return enumerer(nums[3], nums[1], distincts);
      if (/lettres DISTINCTES/.test(e)) return enumerer(nums[1], nums[0], distincts);
      if (/parties à/.test(e)) return enumerer(nums[0], nums[1], croissants);
      if (/délégués/.test(e)) return enumerer(nums[1], nums[0], croissants);
      if (/bijections/.test(e)) return enumerer(nums[1], nums[1], distincts);
      if (/livres/.test(e)) return enumerer(nums[0], nums[0], distincts);
      throw new Error(`énoncé non reconnu : ${e}`);
    },
    1e-6,
    /infty|\\ln/,
  ),

  /* ---------------------------- sommes ---------------------------- */
  'sommes-usuelles': parValeur(
    ({ enonce }) => {
      const m = enonce.match(/\\sum_\{k=(\d+)\}\^\{(\d+)\} (.*?)\$/)!;
      let s = 0;
      for (let k = Number(m[1]); k <= Number(m[2]); k++) s += evalReel(m[3], { k });
      return s;
    },
    1e-6,
    /infty|\\ln/,
  ),

  'sommes-binome': parValeur(({ enonce }) => {
    const k = Number(segment(enonce, /de \$x\^\{(\d+)\}\$/));
    let d = math.parse(texVersMath(segment(enonce, /développement de \$(.*?)\$/)));
    for (let i = 0; i < k; i++) d = math.derivative(d, 'x');
    return Math.round(d.evaluate({ x: 0 }) / [1, 1, 2, 6, 24, 120, 720, 5040][k]);
  }),

  'sommes-geometrique': parValeur(({ enonce }) => {
    const m = enonce.match(/sum_\{k=(\d+)\}\^\{(\d+)\} \(?(-?\d+)\)?\^\{k\}/)!;
    let s = 0;
    for (let k = Number(m[1]); k <= Number(m[2]); k++) s += Number(m[3]) ** k;
    return s;
  }),

  /* ---------------------------- polynômes ---------------------------- */
  'polynomes-reste': (q) => {
    const P = segment(q.enonce, /P = (.*?)\$/);
    if (q.type === 'expression') {
      // Reste par (x − a)(x − b) : P − R s'annule en a et b.
      const racines = [...q.enonce.matchAll(/\(x(?: ([+-]) (\d+))?\)/g)].map((m) => (m[1] ? (m[1] === '-' ? 1 : -1) * Number(m[2]) : 0));
      expect(racines).toHaveLength(2);
      for (const r of racines) expect(proche(evalReel(P, { x: r }), fnStr(q.reponse)(r)), q.enonce).toBe(true);
      return;
    }
    const m = q.enonce.match(/par \$x(?: ([+-]) (\d+))?\$/)!;
    const a = m[1] ? (m[1] === '-' ? 1 : -1) * Number(m[2]) : 0;
    parValeur(() => evalReel(P, { x: a }))(q);
  },

  'polynomes-division': (q) => {
    if (q.type !== 'expression') throw new Error(q.type);
    const A = fn(segment(q.enonce, /A = (.*?)\$/));
    const B = fn(segment(q.enonce, /B = (.*?)\$/));
    const degB = /x\^\{2\}/.test(segment(q.enonce, /B = (.*?)\$/)) ? 2 : 1;
    const rep = fnStr(q.reponse);
    const X = 1e3;
    if (q.enonce.includes('**quotient**')) {
      // R = A − BQ doit être de degré < deg B : R(X)/X^degB → 0
      expect(Math.abs((A(X) - B(X) * rep(X)) / X ** degB), q.enonce).toBeLessThan(0.05);
    } else {
      // Reste de degré < deg B, et (A − R)/B polynomial (de degré ≤ 2 : dérivée troisième nulle).
      expect(Math.abs(rep(X)) / X ** degB, q.enonce).toBeLessThan(0.05);
      const quotient = (x: number) => (A(x) - rep(x)) / B(x);
      const h = 0.5;
      const d3 = (x: number) => (quotient(x + 2 * h) - 2 * quotient(x + h) + 2 * quotient(x - h) - quotient(x - 2 * h)) / (2 * h ** 3);
      expect(Math.abs(d3(7.3)), q.enonce).toBeLessThan(1e-3);
    }
  },

  'polynomes-relations': parValeur(
    ({ enonce: e }) => {
      const P = segment(e, /racines de \$(.*?)\$/).replace(/X/g, 'x');
      const [c, b] = [evalReel(P, { x: 0 }), evalReel(P, { x: 1 }) - evalReel(P, { x: 0 }) - 1];
      const d = Math.sqrt(b * b - 4 * c);
      return evalReel(segment(e, /Calculer \$(.*?)\$/).replace(/ab/g, 'a*b'), { a: (-b + d) / 2, b: (-b - d) / 2 });
    },
    1e-6,
    /infty|\\ln/,
  ),

  /* ---------------------------- complexes ---------------------------- */
  'complexes-forme-exp': parValeur((q) => {
    const z = evalTex(segment(q.enonce, /z = (.*?)\$/));
    return q.type === 'numerique' ? math.arg(math.complex(z as never)) : z;
  }),

  'complexes-racine-carree': (q) => {
    const w = math.evaluate(texVersMath(segment(q.enonce, /z\^2 = (.*?)\$/)));
    const carreEgal = (z: unknown) => (math.abs(math.subtract(math.square(z as never), w) as never) as unknown as number) < 1e-9;
    if (q.type === 'numerique') for (const r of q.reponse as string[]) expect(carreEgal(math.evaluate(r)), q.enonce).toBe(true);
    else if (q.type === 'qcm') seuleLaBonne(q, (t) => carreEgal(math.evaluate(texVersMath(sansDollars(t).replace(/^z = \\pm/, '')))));
  },

  /* ---------------------------- matrices, espaces vectoriels ---------------------------- */
  'matrices-det-3x3': parValeur((q) => math.det(lireMatrice(q.enonce))),

  'matrices-inverse-2x2': (q) => {
    const inv = math.inv(lireMatrice(q.enonce)) as number[][];
    if (q.type === 'numerique') {
      const m = q.enonce.match(/ligne (\d), colonne (\d)/)!;
      expect(proche(valeurDe(q.reponse as string).re, inv[Number(m[1]) - 1][Number(m[2]) - 1]), q.enonce).toBe(true);
    } else if (q.type === 'qcm') {
      const lire = (t: string) => {
        const s = sansDollars(t);
        const pre = s.slice(0, s.indexOf('\\begin'));
        const k = pre === '' ? 1 : pre === '-' ? -1 : evalReel(pre);
        return lireMatrice(s).flat().map((x) => x * k);
      };
      seuleLaBonne(q, (t) => lire(t).every((x, i) => proche(x, inv.flat()[i])));
    }
  },

  'matrices-produit': (q) => {
    const [A, B] = lireMatrices(q.enonce);
    const AB = math.multiply(A, B) as number[][];
    if (q.type === 'numerique') {
      const m = q.enonce.match(/ligne (\d), colonne (\d)/)!;
      expect(valeurNum(q)).toBe(AB[Number(m[1]) - 1][Number(m[2]) - 1]);
    } else if (q.type === 'qcm') seuleLaBonne(q, (t) => JSON.stringify(lireMatrices(t)[0]) === JSON.stringify(AB));
  },

  'matrices-systeme': (q) => {
    const eqs = lignesCases(q.enonce).map((l) => l.split('='));
    const M = eqs.map(([g]) => coefficients(g, ['x', 'y']));
    const [x, y] = math.lusolve(M, eqs.map(([, d]) => evalReel(d))).map((r) => (r as number[])[0]);
    if (q.type === 'numerique') expect(proche(valeurNum(q), /valeur de \$x\$/.test(q.enonce) ? x : y), q.enonce).toBe(true);
    else if (q.type === 'qcm')
      seuleLaBonne(q, (t) => {
        const [u, v] = sansDollars(t).replace(/^\(x, y\) = \(/, '').replace(/\)$/, '').split(', ');
        return proche(evalReel(u), x) && proche(evalReel(v), y);
      });
  },

  'ev-dimension': parValeur(
    ({ enonce: e }) => {
      const n = Number(segment(e, /\\mathbb\{R\}\^(\d)/));
      const vars = ['x', 'y', 'z', 't'].slice(0, n);
      return n - rangNum(lignesCases(e).map((l) => coefficients(l.split('=')[0], vars)));
    },
    1e-6,
    /infty|\\ln/,
  ),

  'ev-famille-libre': (q) => {
    const vs = [...q.enonce.matchAll(/v_\d = \((.*?)\)\$/g)].map((m) => m[1].split(',\\ ').map(Number));
    expect(vs).toHaveLength(3);
    const libre = Math.abs(math.det(vs)) > 1e-9;
    if (q.type === 'numerique') expect(q.reponse).toBe(libre ? 3 : 2);
    else if (q.type === 'qcm') {
      expect(bonne(q).texte.startsWith(libre ? 'Libre' : 'Liée'), q.enonce).toBe(true);
      // Toute relation « v_3 = … » proposée doit être vraie si et seulement si c'est la bonne réponse.
      for (const c of q.choix) {
        const rel = c.texte.match(/v_3 = (.*?)\$/);
        if (!rel) continue;
        const expr = texVersMath(rel[1].replace(/v_1/g, 'v1').replace(/v_2/g, 'v2'));
        const ok = [0, 1, 2].every((k) => proche(math.evaluate(expr, { v1: vs[0][k], v2: vs[1][k] }), vs[2][k]));
        expect(ok, c.texte).toBe(c.correct);
      }
    }
  },

  /* ---------------------------- suites, limites ---------------------------- */
  'suites-limite': parValeur(({ enonce }) => {
    const expr = segment(enonce, /u_n = (.*?)\$/);
    const v1 = evalReel(expr, { n: 1e6 });
    const v2 = evalReel(expr, { n: 1e7 });
    if (Math.abs(v2) > 1e5 && Math.abs(v2) > Math.abs(v1)) return v2 > 0 ? Infinity : -Infinity;
    return v2;
  }, 1e-4),

  'suites-arithmetico-geometrique': parValeur(({ enonce }) => {
    const rec = segment(enonce, /u_\{n\+1\} = (.*?)\$/).replace('u_n', 'u');
    let u = Number(segment(enonce, /u_0 = (-?\d+)/));
    for (let i = 0; i < 300; i++) u = evalReel(rec, { u });
    return u;
  }),

  'suites-ordre-2': (q) => {
    if (q.type === 'numerique') {
      const k = Number(segment(q.enonce, /Calculer \$u_\{(\d+)\}\$/));
      expect(valeurNum(q), q.enonce).toBe(suiteOrdre2(q.enonce, k)[k]);
    } else if (q.type === 'qcm') {
      const u = suiteOrdre2(q.enonce, 6);
      seuleLaBonne(q, (t) => u.every((v, n) => proche(evalReel(sansDollars(t).replace(/^u_n = /, ''), { n }), v)));
    }
  },

  'limites-usuelles': parValeur(({ enonce }) => {
    const expr = segment(enonce, /\\lim_\{x \\to 0\} (.*?)\$/);
    return (evalReel(expr, { x: 1e-4 }) + evalReel(expr, { x: -1e-4 })) / 2;
  }, 1e-4),

  'limites-factorisation': parValeur(({ enonce }) => limite(enonce), 1e-5, /infty|\\ln/),

  'trigo-reciproques': parValeur(({ enonce }) => evalReel(segment(enonce, /Calculer \$(.*?)\$/))),

  /* ---------------------------- dérivation, DL ---------------------------- */
  derivees: parCritere(
    (q) => {
      const f = fDeLEnonce(q);
      return (x: number) => deriveeNum(f, x);
    },
    {
      // Points dans tous les domaines (arctan, √, ln).
      libre: (fp, rep) => egalesFonctions(fp, fnStr(rep), [0.05, 0.11, 0.17]),
      choix: (fp, t) => egalesFonctions(fp, fn(sansDollars(t)), [0.05, 0.11, 0.17]),
    },
  ),

  'derivabilite-tangente': parCritere((q) => tangente(q.enonce), {
    libre: (T, rep) => [-1.3, 0.4, 2.2].every((x) => proche(math.evaluate(rep, { x }), T(x), 1e-5)),
    choix: (T, t) => [-1.3, 0.4, 2.2].every((x) => proche(evalReel(sansDollars(t).replace(/^y = /, ''), { x }), T(x), 1e-5)),
  }),

  'dl-ordre-3': (q) => {
    const f = fDeLEnonce(q);
    if (q.type === 'expression') expect(resteDl(f, fnStr(q.reponse)), q.enonce).toBeLessThan(0.01);
    else if (q.type === 'qcm') {
      const P = (t: string) => fn(sansDollars(t).replace(' + o(x^3)', ''));
      expect(resteDl(f, P(bonne(q).texte)), `${q.enonce} → ${bonne(q).texte}`).toBeLessThan(0.01);
      for (const c of mauvais(q)) expect(resteDl(f, P(c.texte)), c.texte).toBeGreaterThan(0.02);
    }
  },

  'dl-limite': parValeur(({ enonce }) => limite(enonce, 1e-3), 1e-4, /infty|\\ln/),

  'fonctions-exp-ln': (q) => {
    if (q.enonce.startsWith('Résoudre')) {
      const eq = segment(q.enonce, /: \$(.*?) = 0\$/);
      const racine = (x: number) => Math.abs(evalReel(eq, { x })) < 1e-9;
      if (q.type === 'numerique') for (const r of q.reponse as string[]) expect(racine(valeurDe(r).re), q.enonce).toBe(true);
      else if (q.type === 'qcm')
        seuleLaBonne(q, (t) =>
          sansDollars(t)
            .replace(/^\\\{|\\\}$/g, '')
            .split(',\\ ')
            .every((s) => racine(evalReel(s))),
        );
      return;
    }
    const v = evalReel(segment(q.enonce, /Simplifier \$(.*?)\$/));
    if (q.type === 'numerique') expect(proche(valeurNum(q), v), q.enonce).toBe(true);
    else if (q.type === 'qcm') seuleLaBonne(q, (t) => proche(evalReel(sansDollars(t)), v));
  },

  /* ---------------------------- intégration, équations différentielles ---------------------------- */
  primitives: parCritere(fDeLEnonce, {
    libre: (f, rep) => egalesFonctions((x) => deriveeNum(fnStr(rep), x), f, [0.3, 0.8, 1.4]),
    choix: (f, t) => egalesFonctions((x) => deriveeNum(fn(sansDollars(t)), x), f, [0.3, 0.8, 1.4]),
  }),

  'integrale-polynome': parValeur(({ enonce }) => {
    const b = Number(segment(enonce, /\\int_0\^\{(\d+)\}/));
    const f = fn(segment(enonce, /\\left\((.*?)\\right\)dx/));
    // Simpson (exact pour un polynôme de degré ≤ 3)
    return (b / 6) * (f(0) + 4 * f(b / 2) + f(b));
  }),

  'edo-ordre-1': parCritere((q) => q.enonce, {
    libre: (e, rep) => verifieEdo1(e, fnStr(rep)),
    choix: (e, t) => verifieEdo1(e, fn(sansDollars(t).replace(/^y = /, ''))),
  }),

  'edo-ordre-2': parCritere((q) => q.enonce, { choix: solutionGeneraleEdo2 }),
};
