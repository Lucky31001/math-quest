/**
 * Tests des générateurs d'exercices.
 *
 * 1. Tests structurels (tous les générateurs) : question valide pour le schéma,
 *    QCM avec 4 choix distincts dont un seul correct, réponse attendue évaluable.
 * 2. Tests MATHÉMATIQUES : on relit l'énoncé AFFICHÉ (LaTeX), on recalcule la
 *    réponse indépendamment, et on vérifie que la bonne réponse est juste et que
 *    chaque distracteur de QCM est faux.
 */
import { describe, it, expect } from 'vitest';
import { GENERATEURS, generer, type Generateur } from '../src/generators';
import { QuestionSchema, type Question } from '../src/core/schema';
import type { Forme } from '../src/generators/outils';
import { math, verifierExpression, verifierNumerique, valeurDe } from '../src/core/checker';
import { evalTex, evalReel, segment, texVersMath } from './tex';
import { toutVerifier } from './outils/tout-verifier';
import { DIFFICULTES, graines, toutes, sansDollars, bonne, mauvais, proche } from './outils/generateurs';

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
/* Outils de vérification numérique                                    */
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

/* ------------------------------------------------------------------ */
describe('dérivées : f\' affichée = dérivée de f affichée', () => {
  const pts = [0.05, 0.11, 0.17]; // dans tous les domaines (arctan, √, ln)
  it('saisie libre', () => {
    for (const q of toutes('derivees', 'libre')) {
      if (q.type !== 'expression') throw new Error();
      const f = fn(segment(q.enonce, /\$f\(x\) = (.*?)\$/));
      const d = fnStr(q.reponse);
      expect(egalesFonctions((x) => deriveeNum(f, x), d, pts, 1e-5), q.enonce).toBe(true);
    }
  });
  it('QCM : seule la bonne réponse est la dérivée', () => {
    for (const q of toutes('derivees', 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      const f = fn(segment(q.enonce, /\$f\(x\) = (.*?)\$/));
      const fp = (x: number) => deriveeNum(f, x);
      expect(egalesFonctions(fp, fn(sansDollars(bonne(q).texte)), pts), `${q.enonce} → ${bonne(q).texte}`).toBe(true);
      for (const c of mauvais(q)) expect(egalesFonctions(fp, fn(sansDollars(c.texte)), pts), `${q.enonce} : ${c.texte}`).toBe(false);
    }
  });
});

describe('primitives : F\' = f', () => {
  const pts = [0.3, 0.8, 1.4];
  it('saisie libre', () => {
    for (const q of toutes('primitives', 'libre')) {
      if (q.type !== 'expression') throw new Error();
      const f = fn(segment(q.enonce, /\$f\(x\) = (.*?)\$/));
      const F = fnStr(q.reponse);
      expect(egalesFonctions((x) => deriveeNum(F, x), f, pts), q.enonce).toBe(true);
    }
  });
  it('QCM', () => {
    for (const q of toutes('primitives', 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      const f = fn(segment(q.enonce, /\$f\(x\) = (.*?)\$/));
      const deriv = (t: string) => (x: number) => deriveeNum(fn(sansDollars(t)), x);
      expect(egalesFonctions(deriv(bonne(q).texte), f, pts), `${q.enonce} → ${bonne(q).texte}`).toBe(true);
      for (const c of mauvais(q)) expect(egalesFonctions(deriv(c.texte), f, pts), c.texte).toBe(false);
    }
  });
});

describe('développements limités : f(h) − P(h) = o(h³)', () => {
  // (f(h) − P(h)) / h³ doit tendre vers 0 : on teste en h = ±10⁻⁴.
  const reste = (f: (x: number) => number, P: (x: number) => number) =>
    Math.max(...[1e-4, -1e-4].map((h) => Math.abs((f(h) - P(h)) / h ** 3)));
  it('saisie libre', () => {
    for (const q of toutes('dl-ordre-3', 'libre')) {
      if (q.type !== 'expression') throw new Error();
      const f = fn(segment(q.enonce, /\$f\(x\) = (.*?)\$/));
      expect(reste(f, fnStr(q.reponse)), q.enonce).toBeLessThan(0.01);
    }
  });
  it('QCM', () => {
    for (const q of toutes('dl-ordre-3', 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      const f = fn(segment(q.enonce, /\$f\(x\) = (.*?)\$/));
      const P = (t: string) => fn(sansDollars(t).replace(' + o(x^3)', ''));
      expect(reste(f, P(bonne(q).texte)), `${q.enonce} → ${bonne(q).texte}`).toBeLessThan(0.01);
      for (const c of mauvais(q)) expect(reste(f, P(c.texte)), c.texte).toBeGreaterThan(0.02);
    }
  });
});

describe('EDO d\'ordre 1 : la solution vérifie l\'équation et la condition initiale', () => {
  const verifie = (enonce: string, y: (x: number) => number) => {
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
  };
  it('saisie libre', () => {
    for (const q of toutes('edo-ordre-1', 'libre')) {
      if (q.type !== 'expression') throw new Error();
      expect(verifie(q.enonce, fnStr(q.reponse)), q.enonce).toBe(true);
    }
  });
  it('QCM', () => {
    for (const q of toutes('edo-ordre-1', 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      const y = (t: string) => fn(sansDollars(t).replace(/^y = /, ''));
      expect(verifie(q.enonce, y(bonne(q).texte)), `${q.enonce} → ${bonne(q).texte}`).toBe(true);
      for (const c of mauvais(q)) expect(verifie(q.enonce, y(c.texte)), c.texte).toBe(false);
    }
  });
});

describe('EDO d\'ordre 2 : la bonne famille de solutions vérifie l\'équation', () => {
  it('QCM', () => {
    for (const q of toutes('edo-ordre-2', 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      const eq = segment(q.enonce, /de \$(.*?) = 0\$/);
      const lhs = math.compile(texVersMath(eq.replace(/y''/g, 'ypp').replace(/y'/g, 'yp')));
      // Deux choix de (λ, μ) : la famille doit être solution pour les deux.
      const solution = (t: string) =>
        [
          [1.3, -0.7],
          [0, 1],
          [1, 0],
        ].every(([lam, mu]) => {
          const y = (x: number) => evalReel(sansDollars(t).replace(/^y = /, ''), { x, lam, mu });
          return POINTS.every((x) => {
            const h = 1e-4;
            const scope = { y: y(x), yp: (y(x + h) - y(x - h)) / (2 * h), ypp: (y(x + h) - 2 * y(x) + y(x - h)) / (h * h) };
            return Math.abs(lhs.evaluate(scope)) < 1e-3 * Math.max(1, Math.abs(scope.ypp));
          });
        });
      // Solution GÉNÉRALE : la famille doit aussi dépendre de μ (dimension 2).
      const dependDeMu = (t: string) => POINTS.some((x) => Math.abs(evalReel(sansDollars(t).replace(/^y = /, ''), { x, lam: 0, mu: 1 })) > 1e-9);
      const generale = (t: string) => solution(t) && dependDeMu(t);
      expect(generale(bonne(q).texte), `${q.enonce} → ${bonne(q).texte}`).toBe(true);
      for (const c of mauvais(q)) expect(generale(c.texte), c.texte).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/** Valeur d'une réponse (libre) ou du texte d'un choix (QCM). */
const valeursQuestion = (q: Question): { bonne: number | { re: number; im: number }; mauvaises: (number | { re: number; im: number })[] } => {
  if (q.type === 'numerique') {
    const v = valeurDe(Array.isArray(q.reponse) ? q.reponse[0] : q.reponse);
    return { bonne: v.im ? v : v.re, mauvaises: [] };
  }
  if (q.type !== 'qcm') throw new Error(q.type);
  const val = (t: string) => {
    const s = sansDollars(t);
    if (s === '+\\infty') return Infinity;
    if (s === '-\\infty') return -Infinity;
    return evalTex(s);
  };
  return { bonne: val(bonne(q).texte), mauvaises: mauvais(q).map((c) => val(c.texte)) };
};
const egalV = (a: number | { re: number; im: number }, b: number | { re: number; im: number }, tol = 1e-6) => {
  const A = typeof a === 'number' ? { re: a, im: 0 } : a;
  const B = typeof b === 'number' ? { re: b, im: 0 } : b;
  if (!Number.isFinite(A.re) || !Number.isFinite(B.re)) return A.re === B.re;
  return proche(A.re, B.re, tol) && proche(A.im, B.im, tol);
};

/** Vérifie une famille de questions dont la réponse est une valeur calculable depuis l'énoncé. */
function verifierValeurs(id: string, attendu: (q: Question) => number | { re: number; im: number }, tol = 1e-6) {
  for (const forme of ['libre', 'qcm'] as Forme[])
    it(`${id} (${forme})`, () => {
      for (const q of toutes(id, forme)) {
        const a = attendu(q);
        const v = valeursQuestion(q);
        expect(egalV(v.bonne, a, tol), `${q.enonce} → attendu ${JSON.stringify(a)}, obtenu ${JSON.stringify(v.bonne)}`).toBe(true);
        for (const m of v.mauvaises) expect(egalV(m, a, tol), `${q.enonce} : distracteur ${JSON.stringify(m)}`).toBe(false);
      }
    });
}

describe('valeurs recalculées depuis l’énoncé affiché', () => {
  verifierValeurs('limites-usuelles', (q) => {
    const expr = segment(q.enonce, /\\lim_\{x \\to 0\} (.*?)\$/);
    // Moyenne symétrique : l'erreur est en O(h²).
    return (evalReel(expr, { x: 1e-4 }) + evalReel(expr, { x: -1e-4 })) / 2;
  }, 1e-4);

  verifierValeurs('suites-limite', (q) => {
    const expr = segment(q.enonce, /u_n = (.*?)\$/);
    const v1 = evalReel(expr, { n: 1e6 });
    const v2 = evalReel(expr, { n: 1e7 });
    if (Math.abs(v2) > 1e5 && Math.abs(v2) > Math.abs(v1)) return v2 > 0 ? Infinity : -Infinity;
    return v2;
  }, 1e-4);

  verifierValeurs('suites-arithmetico-geometrique', (q) => {
    const u0 = Number(segment(q.enonce, /u_0 = (-?\d+)/));
    const rec = segment(q.enonce, /u_\{n\+1\} = (.*?)\$/).replace('u_n', 'u');
    let u = u0;
    for (let i = 0; i < 300; i++) u = evalReel(rec, { u });
    return u;
  });

  verifierValeurs('trigo-reciproques', (q) => evalReel(segment(q.enonce, /Calculer \$(.*?)\$/)));

  verifierValeurs('sommes-binome', (q) => {
    const k = Number(segment(q.enonce, /de \$x\^\{(\d+)\}\$/));
    const expr = texVersMath(segment(q.enonce, /développement de \$(.*?)\$/));
    let d = math.parse(expr);
    for (let i = 0; i < k; i++) d = math.derivative(d, 'x');
    return Math.round(d.evaluate({ x: 0 }) / [1, 1, 2, 6, 24, 120, 720, 5040][k]);
  });

  verifierValeurs('sommes-geometrique', (q) => {
    const m = q.enonce.match(/sum_\{k=(\d+)\}\^\{(\d+)\} \(?(-?\d+)\)?\^\{k\}/)!;
    let s = 0;
    for (let k = Number(m[1]); k <= Number(m[2]); k++) s += Number(m[3]) ** k;
    return s;
  });

  verifierValeurs('integrale-polynome', (q) => {
    const b = Number(segment(q.enonce, /\\int_0\^\{(\d+)\}/));
    const f = fn(segment(q.enonce, /\\left\((.*?)\\right\)dx/));
    // Simpson (exact pour un polynôme de degré ≤ 3)
    return (b / 6) * (f(0) + 4 * f(b / 2) + f(b));
  });

  verifierValeurs('matrices-det-3x3', (q) => math.det(lireMatrice(q.enonce)));

  verifierValeurs('complexes-forme-exp', (q) => {
    if (q.type === 'numerique') return math.arg(math.complex(evalTex(segment(q.enonce, /z = (.*?)\$/)) as never));
    return evalTex(segment(q.enonce, /z = (.*?)\$/));
  });
});

/** Lit la première matrice pmatrix d'un texte. */
function lireMatrice(texte: string): number[][] {
  const m = texte.match(/\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}/)!;
  return m[1].split('\\\\').map((l) => l.split('&').map((x) => Number(x.trim())));
}

describe('algèbre : vérifications spécifiques', () => {
  it('reste par (x − a) = P(a)', () => {
    for (const forme of ['libre', 'qcm'] as Forme[])
      for (const q of toutes('polynomes-reste', forme)) {
        const P = segment(q.enonce, /P = (.*?)\$/);
        if (q.type === 'expression') {
          // Reste par (x − a)(x − b) : P − R s'annule en a et b.
          const racines = [...q.enonce.matchAll(/\(x(?: ([+-]) (\d+))?\)/g)].map((m) => (m[1] ? (m[1] === '-' ? 1 : -1) * Number(m[2]) : 0));
          expect(racines).toHaveLength(2);
          for (const r of racines) expect(proche(evalReel(P, { x: r }), fnStr(q.reponse)(r)), q.enonce).toBe(true);
          continue;
        }
        const m = q.enonce.match(/par \$x(?: ([+-]) (\d+))?\$/)!;
        const a = m[1] ? (m[1] === '-' ? 1 : -1) * Number(m[2]) : 0;
        const v = valeursQuestion(q);
        expect(egalV(v.bonne, evalReel(P, { x: a })), q.enonce).toBe(true);
        for (const w of v.mauvaises) expect(egalV(w, evalReel(P, { x: a }))).toBe(false);
      }
  });

  it('division euclidienne : A = BQ + R avec deg R < deg B', () => {
    for (const q of toutes('polynomes-division', 'libre')) {
      if (q.type !== 'expression') throw new Error();
      const A = fn(segment(q.enonce, /A = (.*?)\$/));
      const B = fn(segment(q.enonce, /B = (.*?)\$/));
      const degB = /x\^\{2\}/.test(segment(q.enonce, /B = (.*?)\$/)) ? 2 : 1;
      const rep = fnStr(q.reponse);
      const X = 1e3;
      if (q.enonce.includes('**quotient**')) {
        // R = A − BQ doit être de degré < deg B : R(X)/X^degB → 0
        expect(Math.abs((A(X) - B(X) * rep(X)) / X ** degB), q.enonce).toBeLessThan(0.05);
      } else {
        // (A − R)/B doit être un polynôme : on vérifie que le quotient est « lisse » (pas de reste)
        expect(Math.abs(rep(X)) / X ** degB, q.enonce).toBeLessThan(0.05);
        const quotientNum = (x: number) => (A(x) - rep(x)) / B(x);
        // un polynôme de degré ≤ 2 a une dérivée troisième nulle
        const h = 0.5;
        const d3 = (x: number) => (quotientNum(x + 2 * h) - 2 * quotientNum(x + h) + 2 * quotientNum(x - h) - quotientNum(x - 2 * h)) / (2 * h ** 3);
        expect(Math.abs(d3(7.3)), q.enonce).toBeLessThan(1e-3);
      }
    }
  });

  it('inverse 2×2 : coefficient demandé et matrice du QCM', () => {
    for (const q of toutes('matrices-inverse-2x2', 'libre')) {
      if (q.type !== 'numerique') throw new Error();
      const inv = math.inv(lireMatrice(q.enonce)) as number[][];
      const m = q.enonce.match(/ligne (\d), colonne (\d)/)!;
      expect(proche(valeurDe(q.reponse as string).re, inv[Number(m[1]) - 1][Number(m[2]) - 1]), q.enonce).toBe(true);
    }
    for (const q of toutes('matrices-inverse-2x2', 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      const inv = (math.inv(lireMatrice(q.enonce)) as number[][]).flat();
      const lire = (t: string) => {
        const s = sansDollars(t);
        const pre = s.slice(0, s.indexOf('\\begin'));
        const k = pre === '' ? 1 : pre === '-' ? -1 : evalReel(pre);
        return lireMatrice(s).flat().map((x) => x * k);
      };
      const eq = (a: number[]) => a.every((x, i) => proche(x, inv[i]));
      expect(eq(lire(bonne(q).texte)), q.enonce).toBe(true);
      for (const c of mauvais(q)) expect(eq(lire(c.texte)), c.texte).toBe(false);
    }
  });

  it('famille libre : rang et réponse du QCM cohérents avec le déterminant', () => {
    for (const forme of ['libre', 'qcm'] as Forme[])
      for (const q of toutes('ev-famille-libre', forme)) {
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
      }
  });

  it('racines carrées complexes : z² = w', () => {
    for (const forme of ['libre', 'qcm'] as Forme[])
      for (const q of toutes('complexes-racine-carree', forme)) {
        const w = math.evaluate(texVersMath(segment(q.enonce, /z\^2 = (.*?)\$/)));
        const carreEgal = (z: unknown) => {
          const d = math.subtract(math.square(z as never), w) as unknown;
          return (math.abs(d as never) as unknown as number) < 1e-9;
        };
        if (q.type === 'numerique') {
          for (const r of q.reponse as string[]) expect(carreEgal(math.evaluate(r)), q.enonce).toBe(true);
        } else if (q.type === 'qcm') {
          const z = (t: string) => math.evaluate(texVersMath(sansDollars(t).replace(/^z = \\pm/, '')));
          expect(carreEgal(z(bonne(q).texte)), q.enonce).toBe(true);
          for (const c of mauvais(q)) expect(carreEgal(z(c.texte)), c.texte).toBe(false);
        }
      }
  });
});
