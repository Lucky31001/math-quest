/**
 * Vérifications MATHÉMATIQUES des générateurs ajoutés (logique, dénombrement,
 * sommes, relations coefficients-racines, matrices, dimension, suites d'ordre 2,
 * limites, tangentes, DL, exp/ln). Même principe : on relit l'énoncé affiché,
 * on recalcule indépendamment, et chaque distracteur de QCM doit être faux.
 */
import { describe, it, expect } from 'vitest';
import type { Question } from '../src/core/schema';
import { math, valeurDe } from '../src/core/checker';
import { createRng } from '../src/core/random';
import { evalReel, evalTex, segment, segments, texVersMath } from './tex';
import type { Forme } from '../src/generators/outils';
import { graines, toutes as toutesQuestions, sansDollars, bonne, mauvais, proche } from './outils/generateurs';

const GRAINES = graines(500, 6271);
const toutes = (id: string, forme: Forme) => toutesQuestions(id, forme, GRAINES);
const valeurNum = (q: Question): number => {
  if (q.type !== 'numerique') throw new Error(q.type);
  return valeurDe(Array.isArray(q.reponse) ? q.reponse[0] : q.reponse).re;
};

/** Vérifie libre + QCM d'un générateur dont la réponse est une valeur calculable depuis l'énoncé. */
function verifierValeur(id: string, attendu: (enonce: string) => number, tol = 1e-6) {
  it(`${id} : valeur recalculée`, () => {
    for (const q of toutes(id, 'libre')) expect(proche(valeurNum(q), attendu(q.enonce), tol), q.enonce).toBe(true);
    for (const q of toutes(id, 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      const a = attendu(q.enonce);
      expect(proche(evalReel(sansDollars(bonne(q).texte)), a, tol), `${q.enonce} → ${bonne(q).texte}`).toBe(true);
      for (const c of mauvais(q)) {
        const t = sansDollars(c.texte);
        if (/infty|\\ln/.test(t)) continue;
        expect(proche(evalReel(t), a, tol), `${q.enonce} : ${c.texte}`).toBe(false);
      }
    }
  });
}

/* --------------------------- logique ------------------------------- */

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
  const fn = new Function('f', 'x', 'y', `return ${js};`) as (f: (v: number) => number, x: number, y: number) => boolean;
  const rec = (k: number, env: Record<string, number>): boolean => {
    if (k === quants.length) return fn(f, env.x ?? 0, env.y ?? 0);
    const { q, v } = quants[k];
    return q === '\\forall' ? D.every((d) => rec(k + 1, { ...env, [v]: d })) : D.some((d) => rec(k + 1, { ...env, [v]: d }));
  };
  return rec(0, {});
}

describe('logique', () => {
  it('tables de vérité : nombre de lignes vraies', () => {
    const compter = (enonce: string) => {
      const f = segment(enonce, /table de vérité de \$(.*?)\$/);
      const vars = /(^|[^a-zA-Z\\])R(?![a-z])/.test(f) ? ['P', 'Q', 'R'] : ['P', 'Q'];
      let n = 0;
      for (let m = 0; m < 2 ** vars.length; m++) if (evalFormule(f, Object.fromEntries(vars.map((v, i) => [v, !!((m >> i) & 1)])))) n++;
      return n;
    };
    for (const q of toutes('logique-table-verite', 'libre')) expect(valeurNum(q), q.enonce).toBe(compter(q.enonce));
    for (const q of toutes('logique-table-verite', 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      expect(evalReel(sansDollars(bonne(q).texte))).toBe(compter(q.enonce));
      for (const c of mauvais(q)) expect(evalReel(sansDollars(c.texte))).not.toBe(compter(q.enonce));
    }
  });

  it('négations : la bonne réponse est la négation sur tous les modèles, les distracteurs non', () => {
    const rng = createRng(7);
    const D = [-2, -1, 0, 1, 2];
    // Modèles aléatoires + fonctions remarquables (constantes, identité, injective, paire…).
    const modeles: ((v: number) => number)[] = [
      ...[-2, -1, 0, 1, 2].map((c) => () => c),
      (v: number) => v,
      (v: number) => -v,
      (v: number) => v * v,
      (v: number) => v + 1,
      ...Array.from({ length: 300 }, () => {
        const table = new Map(D.map((d) => [d, Math.floor(rng() * 5) - 2]));
        return (v: number) => table.get(v) ?? 0;
      }),
    ];
    for (const q of toutes('logique-negation', 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      const phrase = segments(q.enonce)[1];
      const estNegation = (t: string) => modeles.every((f) => evalPhrase(t, D, f) === !evalPhrase(phrase, D, f));
      expect(estNegation(sansDollars(bonne(q).texte)), `${phrase} → ${bonne(q).texte}`).toBe(true);
      // Les distracteurs de MÊME préfixe que la bonne réponse sont testés sémantiquement sur les modèles finis.
      // Ceux qui changent les quantificateurs ne sont pas équivalents sur ℝ (phrases non triviales, cf. générateur),
      // mais un domaine fini (qui a toujours un max) ne permet pas toujours de le voir.
      const prefixe = (t: string) => sansDollars(t).split(',\\ ').slice(0, -1).join();
      for (const c of mauvais(q)) {
        if (prefixe(c.texte) !== prefixe(bonne(q).texte)) continue;
        expect(estNegation(sansDollars(c.texte)), `${phrase} : ${c.texte}`).toBe(false);
      }
    }
  });
});

/* --------------------------- ensembles ----------------------------- */

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

describe('ensembles', () => {
  verifierValeur('ensembles-denombrement', (e) => {
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
  });
});

/* ---------------------------- algèbre ------------------------------ */

const lireMatrices = (t: string) =>
  [...t.matchAll(/\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}/g)].map((m) => m[1].split('\\\\').map((l) => l.split('&').map((x) => evalReel(x.trim()))));
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

describe('algèbre', () => {
  verifierValeur('sommes-usuelles', (e) => {
    const m = e.match(/\\sum_\{k=(\d+)\}\^\{(\d+)\} (.*?)\$/)!;
    let s = 0;
    for (let k = Number(m[1]); k <= Number(m[2]); k++) s += evalReel(m[3], { k });
    return s;
  });

  verifierValeur('polynomes-relations', (e) => {
    const P = segment(e, /racines de \$(.*?)\$/).replace(/X/g, 'x');
    const [c, b] = [evalReel(P, { x: 0 }), evalReel(P, { x: 1 }) - evalReel(P, { x: 0 }) - 1];
    const d = Math.sqrt(b * b - 4 * c);
    const [ra, rb] = [(-b + d) / 2, (-b - d) / 2];
    return evalReel(segment(e, /Calculer \$(.*?)\$/).replace(/ab/g, 'a*b'), { a: ra, b: rb });
  });

  it('matrices-produit : AB recalculé', () => {
    for (const forme of ['libre', 'qcm'] as Forme[])
      for (const q of toutes('matrices-produit', forme)) {
        const [A, B] = lireMatrices(q.enonce);
        const AB = math.multiply(A, B) as number[][];
        if (q.type === 'numerique') {
          const m = q.enonce.match(/ligne (\d), colonne (\d)/)!;
          expect(valeurNum(q)).toBe(AB[Number(m[1]) - 1][Number(m[2]) - 1]);
        } else if (q.type === 'qcm') {
          const eq = (t: string) => JSON.stringify(lireMatrices(t)[0]) === JSON.stringify(AB);
          expect(eq(bonne(q).texte), q.enonce).toBe(true);
          for (const c of mauvais(q)) expect(eq(c.texte), c.texte).toBe(false);
        }
      }
  });

  it('matrices-systeme : solution recalculée (Cramer)', () => {
    for (const forme of ['libre', 'qcm'] as Forme[])
      for (const q of toutes('matrices-systeme', forme)) {
        const eqs = lignesCases(q.enonce).map((l) => l.split('='));
        const M = eqs.map(([g]) => coefficients(g, ['x', 'y']));
        const rhs = eqs.map(([, d]) => evalReel(d));
        const [x, y] = math.lusolve(M, rhs).map((r) => (r as number[])[0]);
        if (q.type === 'numerique') expect(proche(valeurNum(q), /valeur de \$x\$/.test(q.enonce) ? x : y), q.enonce).toBe(true);
        else if (q.type === 'qcm') {
          const lire = (t: string) => {
            const [u, v] = sansDollars(t).replace(/^\(x, y\) = \(/, '').replace(/\)$/, '').split(', ');
            return [evalReel(u), evalReel(v)];
          };
          const ok = (t: string) => {
            const [u, v] = lire(t);
            return proche(u, x) && proche(v, y);
          };
          expect(ok(bonne(q).texte), q.enonce).toBe(true);
          for (const c of mauvais(q)) expect(ok(c.texte), c.texte).toBe(false);
        }
      }
  });

  verifierValeur('ev-dimension', (e) => {
    const n = Number(segment(e, /\\mathbb\{R\}\^(\d)/));
    const vars = ['x', 'y', 'z', 't'].slice(0, n);
    const M = lignesCases(e).map((l) => coefficients(l.split('=')[0], vars));
    return n - rangNum(M);
  });
});

/* ----------------------------- analyse ----------------------------- */

/** Limite numérique de « \lim_{x \to a} … » (moyenne symétrique : erreur en O(h²)). */
const limite = (e: string, h = 1e-4) => {
  const a = Number(segment(e, /\\lim_\{x \\to (-?\d+)\}/));
  const expr = segment(e, /\\lim_\{x \\to -?\d+\} (.*?)\$/);
  return (evalReel(expr, { x: a + h }) + evalReel(expr, { x: a - h })) / 2;
};

describe('analyse', () => {
  it('suites-ordre-2 : itération de la récurrence', () => {
    const suite = (e: string, N: number) => {
      const u0 = Number(segment(e, /u_0 = (-?\d+)/));
      const u1 = Number(segment(e, /u_1 = (-?\d+)/));
      const rec = segment(e, /u_\{n\+2\} = (.*?)\$/).replace(/u_\{n\+1\}/g, ' A ').replace(/u_n/g, ' B ');
      const u = [u0, u1];
      for (let n = 2; n <= N; n++) u.push(evalReel(rec, { A: u[n - 1], B: u[n - 2] }));
      return u;
    };
    for (const q of toutes('suites-ordre-2', 'libre')) {
      const k = Number(segment(q.enonce, /Calculer \$u_\{(\d+)\}\$/));
      expect(valeurNum(q), q.enonce).toBe(suite(q.enonce, k)[k]);
    }
    for (const q of toutes('suites-ordre-2', 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      const u = suite(q.enonce, 6);
      const ok = (t: string) => u.every((v, n) => proche(evalReel(sansDollars(t).replace(/^u_n = /, ''), { n }), v));
      expect(ok(bonne(q).texte), `${q.enonce} → ${bonne(q).texte}`).toBe(true);
      for (const c of mauvais(q)) expect(ok(c.texte), c.texte).toBe(false);
    }
  });

  verifierValeur('limites-factorisation', (e) => limite(e), 1e-5);
  verifierValeur('dl-limite', (e) => limite(e, 1e-3), 1e-4);

  it('derivabilite-tangente : y = f\'(a)(x − a) + f(a)', () => {
    const pts = [-1.3, 0.4, 2.2];
    const tangente = (e: string) => {
      const f = segment(e, /\$f\(x\) = (.*?)\$/);
      const a = Number(segment(e, /abscisse \$(-?\d+)\$/));
      const fa = evalReel(f, { x: a });
      const h = 1e-5;
      const fpa = (evalReel(f, { x: a + h }) - evalReel(f, { x: a - h })) / (2 * h);
      return (x: number) => fpa * (x - a) + fa;
    };
    for (const q of toutes('derivabilite-tangente', 'libre')) {
      if (q.type !== 'expression') throw new Error();
      const T = tangente(q.enonce);
      for (const x of pts) expect(proche(math.evaluate(q.reponse, { x }), T(x), 1e-5), q.enonce).toBe(true);
    }
    for (const q of toutes('derivabilite-tangente', 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      const T = tangente(q.enonce);
      const ok = (t: string) => pts.every((x) => proche(evalReel(sansDollars(t).replace(/^y = /, ''), { x }), T(x), 1e-5));
      expect(ok(bonne(q).texte), `${q.enonce} → ${bonne(q).texte}`).toBe(true);
      for (const c of mauvais(q)) expect(ok(c.texte), c.texte).toBe(false);
    }
  });

  it('fonctions-exp-ln : simplifications et équation en e^x', () => {
    for (const forme of ['libre', 'qcm'] as Forme[])
      for (const q of toutes('fonctions-exp-ln', forme)) {
        if (q.enonce.startsWith('Résoudre')) {
          const eq = segment(q.enonce, /: \$(.*?) = 0\$/);
          const racine = (x: number) => Math.abs(evalReel(eq, { x })) < 1e-9;
          if (q.type === 'numerique') for (const r of q.reponse as string[]) expect(racine(valeurDe(r).re), q.enonce).toBe(true);
          else if (q.type === 'qcm') {
            const sol = (t: string) => sansDollars(t).replace(/^\\\{|\\\}$/g, '').split(',\\ ').every((s) => racine(evalReel(s)));
            expect(sol(bonne(q).texte), q.enonce).toBe(true);
            for (const c of mauvais(q)) expect(sol(c.texte), c.texte).toBe(false);
          }
          continue;
        }
        const v = evalReel(segment(q.enonce, /Simplifier \$(.*?)\$/));
        if (q.type === 'numerique') expect(proche(valeurNum(q), v)).toBe(true);
        else if (q.type === 'qcm') {
          expect(proche(evalReel(sansDollars(bonne(q).texte)), v), q.enonce).toBe(true);
          for (const c of mauvais(q)) expect(proche(evalReel(sansDollars(c.texte)), v), c.texte).toBe(false);
        }
      }
  });
});

// Garde-fou : les utilitaires de conversion savent lire les notations utilisées ici.
it('texVersMath lit \\dfrac et les puissances de suites', () => {
  expect(evalTex('\\dfrac{3}{4}')).toBe(0.75);
  expect(texVersMath('(-2)^n')).toBe('(-2)^n');
});
