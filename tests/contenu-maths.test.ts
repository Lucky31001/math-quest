/**
 * Vérification MATHÉMATIQUE indépendante du contenu écrit à la main.
 *
 * Pour chaque question à réponse numérique ou expression (et pour une sélection
 * de QCM à valeur numérique), on recalcule le résultat par une AUTRE méthode
 * que celle de la correction : force brute, intégration numérique (Simpson,
 * Runge-Kutta), différences finies, évaluation directe de limites…
 *
 * Physique : simulation numérique (RK4), lois de Kirchhoff résolues par Gauss,
 * calcul vectoriel, tracé de rayons, principe de Fermat, cycle de Carnot calculé.
 * Informatique : le code C AFFICHÉ dans l'énoncé (ou le cours) est réellement
 * compilé par `gcc -Wall -Werror` puis exécuté.
 */
import { describe, it, expect } from 'vitest';
import { CONTENU } from '../src/core/loader';
import { math, valeurDe } from '../src/core/checker';
import type { Question } from '../src/core/schema';
import { evalTex } from './tex';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* ----------------------------- outils ----------------------------- */

const question = (chap: string, id: string): Question => {
  const q = CONTENU.chapitres.find((c) => c.id === chap)?.exercices.find((x) => x.id === id);
  if (!q) throw new Error(`question ${chap}/${id} introuvable`);
  return q;
};
type C = { re: number; im: number };
const enC = (v: number | C): C => (typeof v === 'number' ? { re: v, im: 0 } : v);
const proche = (a: number | C, b: number | C, tol = 1e-6) => {
  const A = enC(a);
  const B = enC(b);
  return Math.hypot(A.re - B.re, A.im - B.im) <= tol * Math.max(1, Math.hypot(A.re, A.im), Math.hypot(B.re, B.im));
};
/** Valeur(s) attendue(s) d'une question numérique. */
const attendus = (q: Question): C[] => {
  if (q.type !== 'numerique') throw new Error(`${q.id} n'est pas numérique`);
  return (Array.isArray(q.reponse) ? q.reponse : [q.reponse]).map(valeurDe);
};
const attendu = (q: Question): C => attendus(q)[0];
/** Fonction (de x, ou d'une autre variable) correspondant à la réponse d'une question « expression ». */
const fonction = (q: Question) => {
  if (q.type !== 'expression') throw new Error(`${q.id} n'est pas une expression`);
  const c = math.compile(q.reponse.replace(/\bln\(/g, 'log('));
  const v = q.variables;
  return (...xs: number[]) => {
    const scope: Record<string, number> = {};
    v.forEach((nom, i) => (scope[nom] = xs[i]));
    const r = c.evaluate(scope);
    return typeof r === 'number' ? r : NaN;
  };
};
/** Valeur du choix correct d'un QCM (LaTeX évalué). */
const bonChoix = (q: Question): number | C => {
  if (q.type !== 'qcm') throw new Error(`${q.id} n'est pas un QCM`);
  return evalTex(q.choix.find((c) => c.correct)!.texte.replace(/^\$|\$$/g, ''));
};
const derivee = (f: (x: number) => number, x: number, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);
function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}
/** Runge-Kutta 4 pour Y' = F(x, Y). */
function rk4(F: (x: number, y: number[]) => number[], y0: number[], x0: number, x1: number, n = 20000): number[] {
  const h = (x1 - x0) / n;
  let y = y0.slice();
  let x = x0;
  const add = (a: number[], b: number[], k: number) => a.map((v, i) => v + k * b[i]);
  for (let i = 0; i < n; i++) {
    const k1 = F(x, y);
    const k2 = F(x + h / 2, add(y, k1, h / 2));
    const k3 = F(x + h / 2, add(y, k2, h / 2));
    const k4 = F(x + h, add(y, k3, h));
    y = y.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    x += h;
  }
  return y;
}
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const binom = (n: number, k: number) => fact(n) / (fact(k) * fact(n - k));
/** Rang d'une matrice par élimination de Gauss. */
function rang(m: number[][]): number {
  const a = m.map((l) => l.slice());
  let r = 0;
  for (let c = 0; c < a[0].length && r < a.length; c++) {
    const p = a.findIndex((l, i) => i >= r && Math.abs(l[c]) > 1e-12);
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
/** Résout A·x = b (Gauss avec pivot partiel). */
function resoudre(A: number[][], b: number[]): number[] {
  const n = b.length;
  const m = A.map((l, i) => [...l, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(m[i][c]) > Math.abs(m[p][c])) p = i;
    [m[c], m[p]] = [m[p], m[c]];
    for (let i = 0; i < n; i++)
      if (i !== c) {
        const k = m[i][c] / m[c][c];
        m[i] = m[i].map((v, j) => v - k * m[c][j]);
      }
  }
  return m.map((l, i) => l[n] / l[i]);
}
/** Premier instant où `cond(y)` devient vrai en intégrant Y' = F(t, Y) par RK4 (pas h). */
function instant(F: (t: number, y: number[]) => number[], y0: number[], cond: (y: number[]) => boolean, h = 1e-4, tMax = 100): { t: number; y: number[] } {
  let y = y0.slice();
  let t = 0;
  while (t < tMax) {
    const suivant = rk4(F, y, t, t + h, 1);
    if (cond(suivant)) return { t: t + h, y: suivant };
    y = suivant;
    t += h;
  }
  throw new Error('condition jamais atteinte');
}

/* ------------------------- langage C (gcc) ------------------------- */

const ENTETES = '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n';
const dossierC = mkdtempSync(join(tmpdir(), 'math-quest-c-'));
let numeroC = 0;
/**
 * Compile (gcc -Wall -Werror) et exécute un programme C ; renvoie sa sortie standard.
 * `piege` : code volontairement fautif (question « piège ») compilé sans -Werror.
 */
function executerC(source: string, piege = false): string {
  const base = join(dossierC, `p${numeroC++}`);
  writeFileSync(`${base}.c`, source.includes('#include') ? source : ENTETES + source);
  execFileSync('gcc', ['-std=c11', '-Wall', ...(piege ? [] : ['-Werror']), '-O0', '-o', base, `${base}.c`, '-lm'], { stdio: 'pipe' });
  return execFileSync(base, { encoding: 'utf8' }).trim();
}
/** Premier bloc ```c``` d'un texte. */
const blocC = (texte: string): string => {
  const m = texte.match(/```c\n([\s\S]+?)\n```/);
  if (!m) throw new Error(`pas de bloc de code C dans « ${texte.slice(0, 50)} »`);
  return m[1];
};
const codeDe = (q: Question): string => blocC(q.enonce);
/** Bloc de code du cours d'un chapitre contenant `motCle`. */
const codeCours = (chap: string, motCle: string): string => {
  const b = CONTENU.chapitres
    .find((c) => c.id === chap)!
    .cours.flatMap((s) => s.blocs)
    .find((x) => x.texte.includes('```c') && blocC(x.texte).includes(motCle));
  if (!b) throw new Error(`${chap} : pas de code « ${motCle} » dans le cours`);
  return blocC(b.texte);
};
/** Des instructions exécutées dans `main`, puis l'affichage de `expr` au format `fmt`. */
const instructionsC = (code: string, fmt: string, expr: string): string =>
  executerC(`int main(void) {\n${code}\nprintf("${fmt}\\n", ${expr});\nreturn 0;\n}`);
/** Des définitions (fonctions, types), puis un `main` qui affiche `expr`. */
const definitionsC = (code: string, fmt: string, expr: string): string =>
  executerC(`${code}\nint main(void) {\nprintf("${fmt}\\n", ${expr});\nreturn 0;\n}`);
/** Texte du choix correct d'un QCM, sans les accents graves du code. */
const bonChoixCode = (q: Question): string => {
  if (q.type !== 'qcm') throw new Error(`${q.id} n'est pas un QCM`);
  return q.choix.find((c) => c.correct)!.texte.replace(/`/g, '').trim();
};
/** Image du point B (abscisse oa, hauteur 1) par une lentille mince de focale f : intersection de deux rayons. */
function imageParRayons(oa: number, f: number): { x: number; y: number } {
  // Rayon parallèle à l'axe, qui ressort par F'(f, 0) : x/f + y = 1. Rayon par O, non dévié : x/oa − y = 0.
  const [x, y] = resoudre([[1 / f, 1], [1 / oa, -1]], [1, 0]);
  return { x, y };
}
/** Minimum d'une fonction unimodale sur [a, b] (section dorée). */
function minimum(f: (x: number) => number, a: number, b: number): number {
  const r = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 200; k++) {
    const c = b - r * (b - a);
    const d = a + r * (b - a);
    if (f(c) < f(d)) b = d;
    else a = c;
  }
  return (a + b) / 2;
}
/** Racine d'une fonction monotone sur [a, b] (dichotomie). */
function racine(f: (x: number) => number, a: number, b: number): number {
  for (let k = 0; k < 200; k++) {
    const m = (a + b) / 2;
    if (f(a) * f(m) <= 0) b = m;
    else a = m;
  }
  return (a + b) / 2;
}
const POINTS = [0.3, 0.7, 1.1, 1.6];

/* ------------------------ vérifications ---------------------------- */

const verifs: Record<string, () => void> = {
  /* ---------------- Logique ---------------- */
  'logique/table-verite-implication': () => {
    let n = 0;
    for (const P of [true, false]) for (const Q of [true, false]) if (!P || Q) n++;
    expect(attendu(question('logique', 'table-verite-implication')).re).toBe(n);
  },
  'logique/recurrence-suite': () => {
    let u = 1;
    for (let i = 0; i < 10; i++) u = 2 * u + 1;
    expect(attendu(question('logique', 'recurrence-suite')).re).toBe(u);
  },
  'logique/somme-cubes': () => {
    const f = fonction(question('logique', 'somme-cubes'));
    for (let n = 1; n <= 12; n++) {
      let s = 0;
      for (let k = 1; k <= n; k++) s += k ** 3;
      expect(f(n)).toBeCloseTo(s, 8);
    }
  },
  /* ---------------- Ensembles ---------------- */
  'ensembles/nombre-injections': () => {
    let n = 0;
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) for (let c = 0; c < 5; c++) if (a !== b && b !== c && a !== c) n++;
    expect(attendu(question('ensembles', 'nombre-injections')).re).toBe(n);
  },
  'ensembles/cardinal-union': () => {
    const A = new Set([1, 2, 3, 4, 5, 6, 7]);
    const B = new Set([5, 6, 7, 8, 9]); // |A ∩ B| = 3
    expect(attendu(question('ensembles', 'cardinal-union')).re).toBe(new Set([...A, ...B]).size);
  },
  'ensembles/nombre-applications': () => expect(bonChoix(question('ensembles', 'nombre-applications'))).toBe(2 ** 3),
  'ensembles/cardinal-parties': () => expect(bonChoix(question('ensembles', 'cardinal-parties'))).toBe(2 ** 3),
  'ensembles/reciproque-affine': () => {
    const g = fonction(question('ensembles', 'reciproque-affine'));
    for (const y of [-3, 0.5, 7]) expect(3 * g(y) - 5).toBeCloseTo(y, 10);
  },
  'ensembles/reciproque-carre-negatif': () => {
    const g = fonction(question('ensembles', 'reciproque-carre-negatif'));
    for (const y of [1, 2.5, 10]) {
      expect(g(y) ** 2 + 1).toBeCloseTo(y, 10);
      expect(g(y)).toBeLessThanOrEqual(0);
    }
  },
  /* ---------------- Complexes ---------------- */
  'complexes/module-produit': () => {
    const z = math.multiply(math.complex(3, 4), math.complex(1, -1)) as unknown as { re: number; im: number };
    expect(proche(attendu(question('complexes', 'module-produit')), Math.hypot(z.re, z.im))).toBe(true);
  },
  'complexes/second-degre': () => {
    const sols = attendus(question('complexes', 'second-degre'));
    expect(sols).toHaveLength(2);
    expect(proche(sols[0], sols[1])).toBe(false);
    for (const z of sols) {
      const c = math.complex(z.re, z.im);
      const v = math.add(math.add(math.multiply(c, c), math.multiply(2, c)), 5) as unknown as C;
      expect(Math.hypot(v.re, v.im)).toBeLessThan(1e-12);
    }
  },
  'complexes/puissance-1-i-racine3': () => {
    const z = math.pow(math.complex(1, Math.sqrt(3)), 6) as unknown as C;
    expect(proche(attendu(question('complexes', 'puissance-1-i-racine3')), z, 1e-9)).toBe(true);
  },
  'complexes/puissance-1-plus-i': () => {
    const z = math.pow(math.complex(1, 1), 8) as unknown as C;
    expect(proche(bonChoix(question('complexes', 'puissance-1-plus-i')), z, 1e-9)).toBe(true);
  },
  'complexes/module-3-4i': () => expect(bonChoix(question('complexes', 'module-3-4i'))).toBe(Math.hypot(3, 4)),
  'complexes/linearisation-cos3': () => {
    const f = fonction(question('complexes', 'linearisation-cos3'));
    for (const x of POINTS) expect(f(x)).toBeCloseTo(Math.cos(x) ** 3, 12);
  },
  /* ---------------- Sommes ---------------- */
  'sommes/somme-100': () => expect(bonChoix(question('sommes', 'somme-100'))).toBe(Array.from({ length: 100 }, (_, k) => k + 1).reduce((a, b) => a + b)),
  'sommes/binomial-5-2': () => expect(bonChoix(question('sommes', 'binomial-5-2'))).toBe(binom(5, 2)),
  'sommes/somme-carres-10': () => {
    let s = 0;
    for (let k = 1; k <= 10; k++) s += k * k;
    expect(attendu(question('sommes', 'somme-carres-10')).re).toBe(s);
  },
  'sommes/somme-geo-3': () => {
    let s = 0;
    for (let k = 0; k <= 5; k++) s += 3 ** k;
    expect(attendu(question('sommes', 'somme-geo-3')).re).toBe(s);
  },
  'sommes/somme-double': () => {
    let s = 0;
    for (let j = 1; j <= 4; j++) for (let i = 1; i <= j; i++) s += i;
    expect(attendu(question('sommes', 'somme-double')).re).toBe(s);
  },
  'sommes/somme-impairs-decales': () => {
    const f = fonction(question('sommes', 'somme-impairs-decales'));
    for (let n = 1; n <= 10; n++) {
      let s = 0;
      for (let k = 1; k <= n; k++) s += 2 * k + 1;
      expect(f(n)).toBeCloseTo(s, 10);
    }
  },
  'sommes/somme-k-binomial': () => {
    const f = fonction(question('sommes', 'somme-k-binomial'));
    for (let n = 1; n <= 10; n++) {
      let s = 0;
      for (let k = 0; k <= n; k++) s += k * binom(n, k);
      expect(f(n)).toBeCloseTo(s, 8);
    }
  },
  /* ---------------- Polynômes ---------------- */
  'polynomes/evaluation': () => expect(attendu(question('polynomes', 'evaluation')).re).toBe(2 * (-2) ** 3 - -2 + 4),
  'polynomes/reste-x-moins-1': () => expect(bonChoix(question('polynomes', 'reste-x-moins-1'))).toBe(1 + 2 - 1),
  'polynomes/somme-carres-racines': () => {
    const d = Math.sqrt(25 - 24);
    const [a, b] = [(5 + d) / 2, (5 - d) / 2];
    expect(attendu(question('polynomes', 'somme-carres-racines')).re).toBeCloseTo(a * a + b * b, 12);
  },
  'polynomes/multiplicite-1': () => {
    const P = (x: number) => x ** 3 - 3 * x + 2;
    // multiplicité 2 : P(1) = P'(1) = 0, P''(1) ≠ 0
    expect(P(1)).toBe(0);
    expect(derivee(P, 1)).toBeCloseTo(0, 6);
    expect(bonChoix(question('polynomes', 'multiplicite-1'))).toBe(2);
  },
  'polynomes/somme-racines-degre3': () => {
    // somme des racines numériques de X³ − 2X² + 5X − 7
    const r = math.polynomialRoot(-7, 5, -2, 1) as unknown as (number | C)[];
    const s = r.map(enC).reduce((a, z) => ({ re: a.re + z.re, im: a.im + z.im }), { re: 0, im: 0 });
    expect(proche(bonChoix(question('polynomes', 'somme-racines-degre3')), s, 1e-9)).toBe(true);
  },
  'polynomes/quotient-x3-1': () => {
    const Q = fonction(question('polynomes', 'quotient-x3-1'));
    for (const x of POINTS) expect((x - 1) * Q(x)).toBeCloseTo(x ** 3 - 1, 10);
  },
  'polynomes/reste-x5': () => {
    const R = fonction(question('polynomes', 'reste-x5'));
    // X⁵ − R doit s'annuler en ±1 (racines de X² − 1), et R est de degré ≤ 1
    for (const x of [1, -1]) expect(x ** 5 - R(x)).toBeCloseTo(0, 10);
    expect(R(2) - 2 * R(1) + R(0)).toBeCloseTo(0, 10);
  },
  /* ---------------- Matrices ---------------- */
  'matrices/det-2x2': () => expect(bonChoix(question('matrices', 'det-2x2'))).toBeCloseTo(math.det([[2, 3], [1, 4]]), 10),
  'matrices/det-2a': () => {
    const A = [[1, 2, 0], [0, 1, 1], [2, 0, 1]]; // det = 5
    expect(math.det(A)).toBeCloseTo(5, 10);
    expect(bonChoix(question('matrices', 'det-2a'))).toBeCloseTo(math.det(math.multiply(2, A) as number[][]), 10);
  },
  'matrices/det-triangulaire': () => expect(attendu(question('matrices', 'det-triangulaire')).re).toBeCloseTo(math.det([[1, 2, 0], [0, 1, 3], [0, 0, 4]]), 10),
  'matrices/det-3x3': () => expect(attendu(question('matrices', 'det-3x3')).re).toBeCloseTo(math.det([[1, 2, 3], [0, 1, 4], [5, 6, 0]]), 10),
  'matrices/m-non-inversible': () => {
    const m = attendu(question('matrices', 'm-non-inversible')).re;
    expect(math.det([[1, m], [2, 4]])).toBeCloseTo(0, 12);
  },
  'matrices/systeme-parametre': () => {
    const a = attendu(question('matrices', 'systeme-parametre')).re;
    expect(math.det([[1, 1, 1], [1, 2, 3], [1, 3, a]])).toBeCloseTo(0, 12);
    expect(math.det([[1, 1, 1], [1, 2, 3], [1, 3, a + 1]])).not.toBeCloseTo(0, 6);
  },
  'matrices/puissance-matrice-1': () => {
    const f = fonction(question('matrices', 'puissance-matrice-1'));
    for (let n = 1; n <= 8; n++) expect(f(n)).toBeCloseTo((math.pow([[1, 1], [0, 1]], n) as number[][])[0][1], 10);
  },
  'matrices/puissance-matrice-2': () => {
    const f = fonction(question('matrices', 'puissance-matrice-2'));
    for (let n = 1; n <= 8; n++) expect(f(n)).toBeCloseTo((math.pow([[1, 1], [1, 1]], n) as number[][])[0][0], 10);
  },
  /* ---------------- Espaces vectoriels ---------------- */
  'espaces-vectoriels/dim-vect': () => expect(attendu(question('espaces-vectoriels', 'dim-vect')).re).toBe(rang([[1, 0, 0], [0, 1, 0], [1, 1, 0]])),
  'espaces-vectoriels/dim-equations': () => expect(attendu(question('espaces-vectoriels', 'dim-equations')).re).toBe(4 - rang([[1, 1, 0, 0], [0, 0, 1, -1]])),
  'espaces-vectoriels/famille-liee-parametre': () => {
    const a = attendu(question('espaces-vectoriels', 'famille-liee-parametre')).re;
    expect(rang([[1, 0, 1], [0, 1, 1], [1, 1, a]])).toBe(2);
    expect(rang([[1, 0, 1], [0, 1, 1], [1, 1, a + 1]])).toBe(3);
  },
  'espaces-vectoriels/coordonnees': () => {
    const alpha = fonction(question('espaces-vectoriels', 'coordonnees'));
    for (const [x, y] of [[1, 2], [-3, 0.5], [4, -4]]) {
      const beta = x - alpha(x, y); // α + β = x
      expect(alpha(x, y) - beta).toBeCloseTo(y, 12); // α − β = y
    }
  },
  /* ---------------- Fonctions usuelles ---------------- */
  'fonctions-usuelles/ln8-ln2': () => expect(bonChoix(question('fonctions-usuelles', 'ln8-ln2'))).toBeCloseTo(Math.log(8) / Math.log(2), 12),
  'fonctions-usuelles/arcsin-sin': () => expect(bonChoix(question('fonctions-usuelles', 'arcsin-sin'))).toBeCloseTo(Math.asin(Math.sin((3 * Math.PI) / 4)), 12),
  'fonctions-usuelles/exp-2ln3': () => expect(attendu(question('fonctions-usuelles', 'exp-2ln3')).re).toBeCloseTo(Math.exp(2 * Math.log(3)), 10),
  'fonctions-usuelles/arccos-moins-demi': () => expect(attendu(question('fonctions-usuelles', 'arccos-moins-demi')).re).toBeCloseTo(Math.acos(-0.5), 12),
  'fonctions-usuelles/equation-ch': () => {
    const x = attendu(question('fonctions-usuelles', 'equation-ch')).re;
    expect(x).toBeGreaterThan(0);
    expect(Math.cosh(x)).toBeCloseTo(5 / 4, 12);
  },
  'fonctions-usuelles/derivee-x-puissance-x': () => {
    const f = fonction(question('fonctions-usuelles', 'derivee-x-puissance-x'));
    for (const x of POINTS) expect(f(x)).toBeCloseTo(derivee((t) => t ** t, x), 6);
  },
  'fonctions-usuelles/tan-arcsin': () => {
    const f = fonction(question('fonctions-usuelles', 'tan-arcsin'));
    for (const x of [-0.8, -0.2, 0.4, 0.9]) expect(f(x)).toBeCloseTo(Math.tan(Math.asin(x)), 10);
  },
  /* ---------------- Suites ---------------- */
  'suites/limite-rationnelle': () => expect(bonChoix(question('suites', 'limite-rationnelle'))).toBeCloseTo((3 * 1e8 ** 2 + 1) / (1e8 ** 2 + 5), 8),
  'suites/n-sin-1-sur-n': () => expect(bonChoix(question('suites', 'n-sin-1-sur-n'))).toBeCloseTo(1e6 * Math.sin(1e-6), 8),
  'suites/recurrente-racine': () => {
    let u = 0;
    for (let i = 0; i < 200; i++) u = Math.sqrt(u + 2);
    expect(bonChoix(question('suites', 'recurrente-racine'))).toBeCloseTo(u, 10);
  },
  'suites/adjacentes-e': () => {
    let s = 0;
    for (let k = 0; k <= 20; k++) s += 1 / fact(k);
    expect(bonChoix(question('suites', 'adjacentes-e'))).toBeCloseTo(s, 12);
  },
  'suites/limite-2-5': () => expect(attendu(question('suites', 'limite-2-5')).re).toBeCloseTo((2 * 1e9 + 3) / (5 * 1e9 - 1), 8),
  'suites/recurrence-ordre2': () => {
    let [a, b] = [0, 3];
    for (let n = 0; n < 10; n++) [a, b] = [b, b + 2 * a];
    expect(attendu(question('suites', 'recurrence-ordre2')).re).toBe(a);
  },
  'suites/limite-1-plus-2-sur-n': () => expect(attendu(question('suites', 'limite-1-plus-2-sur-n')).re).toBeCloseTo((1 + 2 / 1e7) ** 1e7, 5),
  'suites/arith-geo-formule': () => {
    const f = fonction(question('suites', 'arith-geo-formule'));
    let u = 5;
    for (let n = 0; n <= 10; n++) {
      expect(f(n)).toBeCloseTo(u, 8);
      u = 2 * u - 3;
    }
  },
  /* ---------------- Limites et continuité ---------------- */
  'limites-continuite/conjuguee-0': () => expect(bonChoix(question('limites-continuite', 'conjuguee-0'))).toBeCloseTo((Math.sqrt(1 + 1e-8) - 1) / 1e-8, 6),
  'limites-continuite/limite-quotient-x2': () => {
    const f = (x: number) => (x * x - 4) / (x - 2);
    expect(attendu(question('limites-continuite', 'limite-quotient-x2')).re).toBeCloseTo((f(2 + 1e-6) + f(2 - 1e-6)) / 2, 8);
  },
  'limites-continuite/conjuguee-infini': () => {
    const x = 1e7;
    expect(attendu(question('limites-continuite', 'conjuguee-infini')).re).toBeCloseTo(Math.sqrt(x * x + 3 * x) - x, 5);
  },
  'limites-continuite/prolongement-sin3x': () => expect(attendu(question('limites-continuite', 'prolongement-sin3x')).re).toBeCloseTo(Math.sin(3e-7) / 1e-7, 8),
  'limites-continuite/exp-sur-sin': () => {
    const f = (x: number) => (Math.exp(3 * x) - 1) / Math.sin(2 * x);
    expect(attendu(question('limites-continuite', 'exp-sur-sin')).re).toBeCloseTo((f(1e-5) + f(-1e-5)) / 2, 8);
  },
  /* ---------------- Dérivabilité ---------------- */
  'derivabilite/rolle-c': () => {
    const c = bonChoix(question('derivabilite', 'rolle-c')) as number;
    expect(derivee((x) => x * x - 4 * x, c)).toBeCloseTo(0, 8);
  },
  'derivabilite/taf-c': () => {
    const c = bonChoix(question('derivabilite', 'taf-c')) as number;
    expect(derivee((x) => x ** 3, c)).toBeCloseTo((27 - 0) / 3, 6);
  },
  'derivabilite/derivee-reciproque': () => {
    // (f⁻¹)'(2) par différences finies sur la réciproque calculée par dichotomie
    const inv = (y: number) => {
      let [a, b] = [-10, 10];
      for (let i = 0; i < 200; i++) {
        const m = (a + b) / 2;
        if (m ** 3 + m < y) a = m;
        else b = m;
      }
      return (a + b) / 2;
    };
    expect(bonChoix(question('derivabilite', 'derivee-reciproque'))).toBeCloseTo(derivee(inv, 2, 1e-4), 6);
  },
  'derivabilite/derivee-en-2': () => expect(attendu(question('derivabilite', 'derivee-en-2')).re).toBeCloseTo(derivee((x) => 3 * x * x - 5 * x + 1, 2), 6),
  'derivabilite/pente-racine': () => expect(attendu(question('derivabilite', 'pente-racine')).re).toBeCloseTo(derivee(Math.sqrt, 4), 8),
  'derivabilite/leibniz': () => {
    // x²eˣ = Σ x^(k+2)/k! : le coefficient de x¹⁰ est 1/8!, donc f⁽¹⁰⁾(0) = 10!/8!
    expect(attendu(question('derivabilite', 'leibniz')).re).toBe(fact(10) / fact(8));
  },
  'derivabilite/derivee-ln-cos': () => {
    const f = fonction(question('derivabilite', 'derivee-ln-cos'));
    for (const x of [-1, -0.3, 0.5, 1.2]) expect(f(x)).toBeCloseTo(derivee((t) => Math.log(Math.cos(t)), x), 6);
  },
  'derivabilite/derivee-arctan-exp': () => {
    const f = fonction(question('derivabilite', 'derivee-arctan-exp'));
    for (const x of POINTS) expect(f(x)).toBeCloseTo(derivee((t) => Math.atan(Math.exp(t)), x), 8);
  },
  /* ---------------- DL ---------------- */
  'developpements-limites/limite-exp-x2': () => {
    const f = (x: number) => (Math.exp(x) - 1 - x) / (x * x);
    expect(bonChoix(question('developpements-limites', 'limite-exp-x2'))).toBeCloseTo((f(1e-4) + f(-1e-4)) / 2, 6);
  },
  'developpements-limites/coeff-sin2x': () => {
    const h = 1e-3;
    const c3 = ((Math.sin(2 * h) - 2 * h) / h ** 3 + (Math.sin(-2 * h) + 2 * h) / -(h ** 3)) / 2;
    expect(attendu(question('developpements-limites', 'coeff-sin2x')).re).toBeCloseTo(c3, 4);
  },
  'developpements-limites/limite-sin-x3': () => {
    const h = 1e-3;
    expect(attendu(question('developpements-limites', 'limite-sin-x3')).re).toBeCloseTo((Math.sin(h) - h) / h ** 3, 5);
  },
  'developpements-limites/limite-inverse-sin2': () => {
    const x = 1e-3;
    expect(attendu(question('developpements-limites', 'limite-inverse-sin2')).re).toBeCloseTo(1 / Math.sin(x) ** 2 - 1 / (x * x), 4);
  },
  'developpements-limites/dl-exp-sin': () => {
    const P = fonction(question('developpements-limites', 'dl-exp-sin'));
    for (const h of [1e-3, -1e-3]) expect(Math.abs((Math.exp(h) * Math.sin(h) - P(h)) / h ** 3)).toBeLessThan(0.01);
  },
  'developpements-limites/dl-sqrt-exp': () => {
    const P = fonction(question('developpements-limites', 'dl-sqrt-exp'));
    for (const h of [1e-4, -1e-4]) expect(Math.abs((Math.sqrt(1 + h) * Math.exp(-h) - P(h)) / h ** 2)).toBeLessThan(0.01);
  },
  /* ---------------- Intégration ---------------- */
  'integration/integrale-x2': () => expect(bonChoix(question('integration', 'integrale-x2'))).toBeCloseTo(simpson((x) => x * x, 0, 1), 10),
  'integration/ipp-x-exp': () => expect(bonChoix(question('integration', 'ipp-x-exp'))).toBeCloseTo(simpson((x) => x * Math.exp(x), 0, 1), 10),
  'integration/cdv-2x-exp': () => expect(bonChoix(question('integration', 'cdv-2x-exp'))).toBeCloseTo(simpson((x) => 2 * x * Math.exp(x * x), 0, 1), 10),
  'integration/riemann-arctan': () => {
    const n = 200000;
    let s = 0;
    for (let k = 1; k <= n; k++) s += n / (n * n + k * k);
    expect(bonChoix(question('integration', 'riemann-arctan'))).toBeCloseTo(s, 5);
  },
  'integration/integrale-1-sur-x': () => expect(attendu(question('integration', 'integrale-1-sur-x')).re).toBeCloseTo(simpson((x) => 1 / x, 1, Math.E), 10),
  'integration/integrale-cos-sin': () => expect(attendu(question('integration', 'integrale-cos-sin')).re).toBeCloseTo(simpson((x) => Math.cos(x) * Math.sin(x), 0, Math.PI / 2), 10),
  'integration/ipp-double': () => expect(attendu(question('integration', 'ipp-double')).re).toBeCloseTo(simpson((x) => x * x * Math.exp(x), 0, 1), 10),
  'integration/primitive-x-ln': () => {
    const F = fonction(question('integration', 'primitive-x-ln'));
    for (const x of [0.5, 1.2, 2.5]) expect(derivee(F, x)).toBeCloseTo(x * Math.log(x), 6);
  },
  'integration/primitive-fraction': () => {
    const F = fonction(question('integration', 'primitive-fraction'));
    for (const x of [1.5, 2, 4]) expect(derivee(F, x)).toBeCloseTo(1 / (x * x - 1), 6);
  },
  /* ---------------- Équations différentielles ---------------- */
  'equations-differentielles/cauchy-y-2y': () => {
    const [y1] = rk4((_x, [y]) => [2 * y], [3], 0, 1);
    expect(attendu(question('equations-differentielles', 'cauchy-y-2y')).re).toBeCloseTo(y1, 6);
  },
  'equations-differentielles/cauchy-y-plus-y': () => {
    const [y1] = rk4((_x, [y]) => [1 - y], [0], 0, Math.log(2));
    expect(attendu(question('equations-differentielles', 'cauchy-y-plus-y')).re).toBeCloseTo(y1, 8);
  },
  'equations-differentielles/cauchy-ordre2': () => {
    const [y1] = rk4((_x, [y, yp]) => [yp, 3 * yp - 2 * y], [0, 1], 0, Math.log(3));
    expect(attendu(question('equations-differentielles', 'cauchy-ordre2')).re).toBeCloseTo(y1, 6);
  },
  'equations-differentielles/resoudre-y-moins-y-x': () => {
    const y = fonction(question('equations-differentielles', 'resoudre-y-moins-y-x'));
    const [y1] = rk4((x, [v]) => [v + x], [0], 0, 1.3);
    expect(y(1.3)).toBeCloseTo(y1, 6);
  },
  'equations-differentielles/resoudre-y-seconde-plus-y': () => {
    const y = fonction(question('equations-differentielles', 'resoudre-y-seconde-plus-y'));
    const [y1] = rk4((_x, [v, vp]) => [vp, -v], [1, 2], 0, 2.1);
    expect(y(2.1)).toBeCloseTo(y1, 6);
  },
  /* ---------------- Ajouts (2e vague) ---------------- */
  'logique/recurrence-forte-somme': () => {
    const u = [1];
    for (let n = 0; n < 6; n++) u.push(u.reduce((a, b) => a + b, 0));
    expect(attendu(question('logique', 'recurrence-forte-somme')).re).toBe(u[6]);
  },
  'ensembles/parties-produit': () => expect(attendu(question('ensembles', 'parties-produit')).re).toBe(2 ** (2 * 3)),
  'ensembles/reciproque-exp-affine': () => {
    const g = fonction(question('ensembles', 'reciproque-exp-affine'));
    for (const y of [0.5, 1, 7]) expect(Math.exp(2 * g(y) + 1)).toBeCloseTo(y, 10);
  },
  'complexes/argument-quotient': () => {
    const z = math.divide(math.complex(1, 1), math.complex(1, -1)) as unknown as C;
    expect(attendu(question('complexes', 'argument-quotient')).re).toBeCloseTo(Math.atan2(z.im, z.re), 12);
  },
  'complexes/linearisation-sin2cos2': () => {
    const f = fonction(question('complexes', 'linearisation-sin2cos2'));
    for (const x of POINTS) expect(f(x)).toBeCloseTo(Math.sin(x) ** 2 * Math.cos(x) ** 2, 12);
  },
  'sommes/somme-alternee': () => {
    let s = 0;
    for (let k = 1; k <= 20; k++) s += (-1) ** k * k;
    expect(attendu(question('sommes', 'somme-alternee')).re).toBe(s);
  },
  'sommes/somme-k-factorielle': () => {
    let s = 0;
    for (let k = 1; k <= 5; k++) s += k * fact(k);
    expect(attendu(question('sommes', 'somme-k-factorielle')).re).toBe(s);
  },
  'polynomes/reste-x-plus-2': () => expect(attendu(question('polynomes', 'reste-x-plus-2')).re).toBe((-2) ** 4 + -2 + 1),
  'polynomes/quotient-x4-1': () => {
    const Q = fonction(question('polynomes', 'quotient-x4-1'));
    for (const x of POINTS) expect(Q(x) * (x * x + 1)).toBeCloseTo(x ** 4 - 1, 10);
  },
  'matrices/coefficient-inverse': () => expect(attendu(question('matrices', 'coefficient-inverse')).re).toBeCloseTo((math.inv([[2, 1], [5, 3]]) as number[][])[0][1], 10),
  'matrices/vandermonde': () => expect(attendu(question('matrices', 'vandermonde')).re).toBeCloseTo(math.det([[1, 1, 1], [1, 2, 4], [1, 3, 9]]), 10),
  'espaces-vectoriels/dim-matrices-2-3': () => expect(attendu(question('espaces-vectoriels', 'dim-matrices-2-3')).re).toBe(2 * 3),
  'espaces-vectoriels/dim-intersection': () => expect(attendu(question('espaces-vectoriels', 'dim-intersection')).re).toBe(3 - rang([[1, 1, 1], [1, -1, 0]])),
  'fonctions-usuelles/somme-arctan': () => expect(attendu(question('fonctions-usuelles', 'somme-arctan')).re).toBeCloseTo(Math.atan(1) + Math.atan(Math.sqrt(3)), 12),
  'fonctions-usuelles/equation-ln-somme': () => {
    const x = attendu(question('fonctions-usuelles', 'equation-ln-somme')).re;
    expect(x).toBeGreaterThan(0);
    expect(Math.log(x) + Math.log(x + 1)).toBeCloseTo(Math.log(6), 12);
  },
  'suites/limite-n-racine': () => {
    const n = 1e6;
    expect(attendu(question('suites', 'limite-n-racine')).re).toBeCloseTo(n * (Math.sqrt(1 + 1 / n) - 1), 5);
  },
  'suites/heron': () => {
    let u = 1;
    for (let i = 0; i < 50; i++) u = (u + 2 / u) / 2;
    expect(attendu(question('suites', 'heron')).re).toBeCloseTo(u, 12);
  },
  'suites/geometrique-formule': () => {
    const f = fonction(question('suites', 'geometrique-formule'));
    let u = 5;
    for (let n = 0; n <= 8; n++) {
      expect(f(n)).toBeCloseTo(u, 12);
      u /= 3;
    }
  },
  'limites-continuite/tan-3x': () => {
    const f = (x: number) => Math.tan(3 * x) / x;
    expect(attendu(question('limites-continuite', 'tan-3x')).re).toBeCloseTo((f(1e-5) + f(-1e-5)) / 2, 8);
  },
  'limites-continuite/x-exp-inverse': () => {
    const x = 1e6;
    expect(attendu(question('limites-continuite', 'x-exp-inverse')).re).toBeCloseTo(x * Math.expm1(1 / x), 5);
  },
  'derivabilite/maximum-x-exp': () => {
    // maximum par balayage fin
    let best = -Infinity;
    let argmax = 0;
    for (let x = -2; x <= 5; x += 1e-4) {
      const v = x * Math.exp(-x);
      if (v > best) [best, argmax] = [v, x];
    }
    expect(attendu(question('derivabilite', 'maximum-x-exp')).re).toBeCloseTo(argmax, 3);
  },
  'derivabilite/nombre-racines-cubique': () => {
    // changements de signe sur une grille fine (les racines sont dans [-3, 3])
    const f = (x: number) => x ** 3 - 3 * x + 1;
    let n = 0;
    for (let x = -3; x < 3; x += 1e-3) if (f(x) * f(x + 1e-3) < 0) n++;
    expect(attendu(question('derivabilite', 'nombre-racines-cubique')).re).toBe(n);
  },
  'developpements-limites/limite-ln-dl': () => {
    const f = (x: number) => (Math.log1p(x) - x) / (x * x);
    expect(attendu(question('developpements-limites', 'limite-ln-dl')).re).toBeCloseTo((f(1e-4) + f(-1e-4)) / 2, 6);
  },
  'developpements-limites/limite-exp-sin': () => {
    const f = (x: number) => (Math.expm1(x) - Math.sin(x)) / (x * x);
    expect(attendu(question('developpements-limites', 'limite-exp-sin')).re).toBeCloseTo((f(1e-4) + f(-1e-4)) / 2, 6);
  },
  'developpements-limites/dl-cos-exp': () => {
    const P = fonction(question('developpements-limites', 'dl-cos-exp'));
    for (const h of [1e-4, -1e-4]) expect(Math.abs((Math.exp(h) * Math.cos(h) - P(h)) / h ** 2)).toBeLessThan(0.01);
  },
  'integration/integrale-x-1-moins-x': () => expect(attendu(question('integration', 'integrale-x-1-moins-x')).re).toBeCloseTo(simpson((x) => x * (1 - x), 0, 1), 10),
  'integration/integrale-ln': () => expect(attendu(question('integration', 'integrale-ln')).re).toBeCloseTo(simpson(Math.log, 1, Math.E), 10),
  'integration/primitive-x-sur-1-plus-x2': () => {
    const F = fonction(question('integration', 'primitive-x-sur-1-plus-x2'));
    for (const x of [-1.5, 0.5, 2]) expect(derivee(F, x)).toBeCloseTo(x / (1 + x * x), 6);
  },
  'equations-differentielles/cauchy-oscillateur': () => {
    const [y1] = rk4((_x, [y, yp]) => [yp, -y], [0, 3], 0, Math.PI / 2);
    expect(attendu(question('equations-differentielles', 'cauchy-oscillateur')).re).toBeCloseTo(y1, 6);
  },
  'equations-differentielles/cauchy-y-plus-x': () => {
    const [y1] = rk4((x, [y]) => [y + x], [1], 0, 1);
    expect(attendu(question('equations-differentielles', 'cauchy-y-plus-x')).re).toBeCloseTo(y1, 6);
  },
  'equations-differentielles/resoudre-second-membre-constant': () => {
    const y = fonction(question('equations-differentielles', 'resoudre-second-membre-constant'));
    const [y1] = rk4((_x, [v, vp]) => [vp, 2 + 3 * vp - 2 * v], [2, 0], 0, 0.9);
    expect(y(0.9)).toBeCloseTo(y1, 6);
  },
  /* =============================== PHYSIQUE =============================== */
  /* ---------------- Grandeurs et unités ---------------- */
  'grandeurs-unites/masse-volumique': () => expect(proche(attendu(question('grandeurs-unites', 'masse-volumique')), 1e-3 / 1e-6)).toBe(true),
  'grandeurs-unites/exposant-onde': () => {
    // Recherche exhaustive des exposants demi-entiers rendant λ^α g^β homogène à une vitesse.
    const sols: number[] = [];
    for (let a = -3; a <= 3; a += 0.5) for (let b = -3; b <= 3; b += 0.5) if (a + b === 1 && -2 * b === -1) sols.push(a);
    expect(sols).toEqual([attendu(question('grandeurs-unites', 'exposant-onde')).re]);
  },
  'grandeurs-unites/incertitude-surface': () => {
    const S = (a: number, b: number) => a * b;
    const dSa = (S(20 + 1e-6, 15) - S(20 - 1e-6, 15)) / 2e-6;
    const dSb = (S(20, 15 + 1e-6) - S(20, 15 - 1e-6)) / 2e-6;
    const relatif = (100 * Math.hypot(dSa * 0.2, dSb * 0.3)) / S(20, 15);
    expect(attendu(question('grandeurs-unites', 'incertitude-surface')).re).toBeCloseTo(relatif, 5);
  },
  /* ---------------- Cinématique ---------------- */
  'cinematique/distance-freinage': () => {
    const { y } = instant((_t, [, v]) => [v, -5], [0, 20], ([, v]) => v <= 0);
    expect(attendu(question('cinematique', 'distance-freinage')).re).toBeCloseTo(y[0], 2);
  },
  'cinematique/temps-chute': () => {
    const { t } = instant((_t, [, v]) => [v, 9.81], [0, 0], ([z]) => z >= 20, 1e-5);
    expect(Math.abs(attendu(question('cinematique', 'temps-chute')).re - t)).toBeLessThan(1e-4);
  },
  'cinematique/vitesse-position': () => {
    const v = fonction(question('cinematique', 'vitesse-position'));
    for (const t of [0.5, 1, 2.5]) {
      const [x, vx] = rk4((_t, [, w]) => [w, 2], [0, 3], 0, t);
      expect(v(x)).toBeCloseTo(vx, 6);
    }
  },
  'cinematique/rattrapage': () => {
    const { t } = instant((_t, [, , vb]) => [10, vb, 2], [0, 0, 0], ([xa, xb]) => xb >= xa, 1e-4, 50);
    expect(Math.abs(attendu(question('cinematique', 'rattrapage')).re - t)).toBeLessThan(1e-3);
  },
  'cinematique/vitesse-moyenne': () => {
    const d = 120; // km, valeur arbitraire
    expect(attendu(question('cinematique', 'vitesse-moyenne')).re).toBeCloseTo((2 * d) / (d / 60 + d / 40), 10);
  },
  /* ---------------- Dynamique ---------------- */
  'dynamique/pfd-simple': () => {
    // Position après 2 s sous la force constante, comparée à ½·a·t².
    const [x] = rk4((_t, [, v]) => [v, 12 / 4], [0, 0], 0, 2);
    expect((attendu(question('dynamique', 'pfd-simple')).re * 4) / 2).toBeCloseTo(x, 6);
  },
  'dynamique/plan-incline': () => {
    // Somme vectorielle poids + réaction normale (m = 1), dans le repère (horizontal, vertical).
    const al = Math.PI / 6;
    const g = 9.81;
    const N = g * Math.cos(al);
    const a = [N * Math.sin(al), -g + N * Math.cos(al)];
    expect(attendu(question('dynamique', 'plan-incline')).re).toBeCloseTo(Math.hypot(a[0], a[1]), 10);
  },
  'dynamique/vitesse-limite': () => {
    const [v] = rk4((_t, [w]) => [9.81 - (0.25 / 0.5) * w], [0], 0, 60);
    expect(attendu(question('dynamique', 'vitesse-limite')).re).toBeCloseTo(v, 6);
  },
  'dynamique/vitesse-frottement': () => {
    const v = fonction(question('dynamique', 'vitesse-frottement'));
    for (const t of [0.5, 2, 7]) {
      const [w] = rk4((_t, [u]) => [10 - (0.05 / 0.2) * u], [0], 0, t);
      expect(v(t)).toBeCloseTo(w, 6);
    }
  },
  'dynamique/deux-blocs': () => {
    // Inconnues (a, N) : m1·a + N = F et m2·a − N = 0.
    const [, N] = resoudre([[2, 1], [3, -1]], [10, 0]);
    expect(attendu(question('dynamique', 'deux-blocs')).re).toBeCloseTo(N, 10);
  },
  /* ---------------- Énergie ---------------- */
  'energie-mecanique/travail-poids': () => {
    // Intégrale curviligne de P·dl le long d'un chemin courbe de z = 5 à z = 0.
    const m = 3;
    const g = 9.81;
    const chemin = (s: number) => ({ x: Math.sin(3 * s), z: 5 * (1 - s) ** 2 });
    const W = simpson((s) => {
      const h = 1e-6;
      const dz = (chemin(s + h).z - chemin(s - h).z) / (2 * h);
      return -m * g * dz;
    }, 0, 1);
    expect(attendu(question('energie-mecanique', 'travail-poids')).re).toBeCloseTo(W, 4);
  },
  'energie-mecanique/vitesse-chute': () => {
    const { y } = instant((_t, [, v]) => [v, 10], [0, 0], ([z]) => z >= 45, 1e-5);
    expect(Math.abs(attendu(question('energie-mecanique', 'vitesse-chute')).re - y[1])).toBeLessThan(1e-3);
  },
  'energie-mecanique/vitesse-altitude': () => {
    // Glissade sur une rampe à 30° partant de z = 10 : abscisse curviligne s, ṡ' = g·sin α.
    const v = fonction(question('energie-mecanique', 'vitesse-altitude'));
    const al = Math.PI / 6;
    for (const t of [0.4, 1, 1.6]) {
      const [s, vs] = rk4((_t, [, w]) => [w, 10 * Math.sin(al)], [0, 0], 0, t);
      expect(v(10 - s * Math.sin(al))).toBeCloseTo(vs, 6);
    }
  },
  'energie-mecanique/travail-frottements': () => {
    const Em = (v: number, z: number) => 0.5 * 2 * v * v + 2 * 10 * z;
    expect(attendu(question('energie-mecanique', 'travail-frottements')).re).toBeCloseTo(Em(8, 0) - Em(0, 5), 10);
  },
  /* ---------------- Oscillateurs ---------------- */
  'oscillateurs/periode-ressort': () => {
    // Départ au maximum : la vitesse redevient nulle après une demi-période.
    const { t } = instant((_t, [x, v]) => [v, -(20 / 0.2) * x], [1, 0], ([, v]) => v >= 0, 1e-5);
    expect(Math.abs(attendu(question('oscillateurs', 'periode-ressort')).re - 2 * t)).toBeLessThan(1e-3);
  },
  'oscillateurs/periode-pendule': () => {
    // Pendule NON linéarisé, petite amplitude.
    const { t } = instant((_t, [th, w]) => [w, -9.81 * Math.sin(th)], [1e-3, 0], ([, w]) => w >= 0, 1e-5);
    expect(Math.abs(attendu(question('oscillateurs', 'periode-pendule')).re - 2 * t)).toBeLessThan(1e-3);
  },
  'oscillateurs/solution-ci': () => {
    const x = fonction(question('oscillateurs', 'solution-ci'));
    for (const t of [0.3, 1.2, 2.5]) expect(x(t)).toBeCloseTo(rk4((_t, [u, v]) => [v, -4 * u], [0.1, 0.4], 0, t)[0], 8);
  },
  'oscillateurs/amplitude-cm': () => {
    let max = 0;
    let y = [0.1, 0.4];
    for (let k = 0; k < 4000; k++) {
      y = rk4((_t, [u, v]) => [v, -4 * u], y, 0, 1e-3, 1);
      max = Math.max(max, Math.abs(y[0]));
    }
    expect(Math.abs(attendu(question('oscillateurs', 'amplitude-cm')).re - 100 * max)).toBeLessThan(1e-3);
  },
  /* ---------------- Électrocinétique ---------------- */
  'electrocinetique/resistance-equivalente': () => {
    // Kirchhoff sous 1 V : I3 = I1 + I2 ; 6·I1 = 3·I2 ; 6·I1 + 4·I3 = 1.
    const [, , I3] = resoudre([[1, 1, -1], [6, -3, 0], [6, 0, 4]], [0, 0, 1]);
    expect(attendu(question('electrocinetique', 'resistance-equivalente')).re).toBeCloseTo(1 / I3, 10);
  },
  'electrocinetique/diviseur-tension': () => {
    // Potentiel du nœud intermédiaire V (R2 relié à la masse) : (12 − V)/R1 = V/R2.
    const [V] = resoudre([[1 / 1000 + 1 / 2000]], [12 / 1000]);
    expect(attendu(question('electrocinetique', 'diviseur-tension')).re).toBeCloseTo(V, 10);
  },
  'electrocinetique/charge-rc': () => {
    const [u] = rk4((_t, [w]) => [(10 - w) / (1e4 * 1e-4)], [0], 0, 1);
    expect(attendu(question('electrocinetique', 'charge-rc')).re).toBeCloseTo(u, 8);
  },
  'electrocinetique/rc-condition-initiale': () => {
    const u = fonction(question('electrocinetique', 'rc-condition-initiale'));
    for (const t of [0.1, 0.5, 2]) expect(u(t)).toBeCloseTo(rk4((_t, [w]) => [(6 - w) / 0.5], [2], 0, t)[0], 8);
  },

  /* ---------------- Pensée scientifique ---------------- */
  'pensee-scientifique/ordre-grandeur': () => {
    const annee = 365 * 24 * 3600;
    const n = attendu(question('pensee-scientifique', 'ordre-grandeur')).re;
    expect(annee / 10 ** n).toBeGreaterThan(2.5);
    expect(annee / 10 ** n).toBeLessThan(3.5);
  },
  /* ---------------- Optique géométrique ---------------- */
  'optique-geometrique/vergence': () => expect(attendu(question('optique-geometrique', 'vergence')).re).toBeCloseTo(1 / 0.2, 10),
  'optique-geometrique/refraction-eau': () => {
    // Principe de Fermat : A dans l'air, B dans l'eau sur le rayon réfracté annoncé ; le chemin optique
    // n1·AI + n2·IB doit être minimal au point d'incidence I prévu.
    const r = (attendu(question('optique-geometrique', 'refraction-eau')).re * Math.PI) / 180;
    const xI = Math.tan(Math.PI / 6); // A = (0, 1), incidence 30°
    const B = { x: xI + Math.tan(r), y: -1 };
    const chemin = (x: number) => Math.hypot(x, 1) + 1.33 * Math.hypot(B.x - x, B.y);
    expect(minimum(chemin, -2, 3)).toBeCloseTo(xI, 4);
  },
  'optique-geometrique/angle-limite': () => {
    // Plus grand angle d'incidence pour lequel un rayon réfracté existe encore (sin i2 ≤ 1).
    const il = racine((i) => 1.5 * Math.sin(i) - 1, 0, Math.PI / 2);
    expect(attendu(question('optique-geometrique', 'angle-limite')).re).toBeCloseTo((il * 180) / Math.PI, 6);
  },
  'optique-geometrique/conjugaison': () =>
    expect(attendu(question('optique-geometrique', 'conjugaison')).re).toBeCloseTo(imageParRayons(-30, 10).x, 8),
  'optique-geometrique/position-image': () => {
    const g = fonction(question('optique-geometrique', 'position-image'));
    for (const x of [-50, -30, -12.5]) expect(g(x)).toBeCloseTo(imageParRayons(x, 10).x, 8);
  },
  'optique-geometrique/grandissement': () => {
    const q = question('optique-geometrique', 'grandissement');
    if (q.type !== 'qcm') throw new Error('QCM attendu');
    expect(q.choix.find((c) => c.correct)!.texte).toContain('-0{,}5');
    expect(imageParRayons(-30, 10).y).toBeCloseTo(-0.5, 10);
  },
  /* ---------------- Thermodynamique ---------------- */
  'thermodynamique/pression-gp': () => {
    // P·V/(n·T) doit redonner R.
    expect((attendu(question('thermodynamique', 'pression-gp')).re * 1000 * 24.9e-3) / 300).toBeCloseTo(8.314, 6);
  },
  'thermodynamique/travail-isobare': () =>
    expect(attendu(question('thermodynamique', 'travail-isobare')).re).toBeCloseTo(simpson(() => -2e5, 1e-3, 3e-3), 6),
  'thermodynamique/travail-isotherme': () =>
    expect(attendu(question('thermodynamique', 'travail-isotherme')).re).toBeCloseTo(simpson((V) => (-8.314 * 300) / V, 1e-3, 2e-3), 4),
  'thermodynamique/chauffer-eau': () => {
    let Q = 0;
    for (let T = 20; T < 80; T += 0.5) Q += 2 * 4180 * 0.5;
    expect(attendu(question('thermodynamique', 'chauffer-eau')).re).toBeCloseTo(Q / 1000, 6);
  },
  'thermodynamique/temperature-melange': () => {
    const T = fonction(question('thermodynamique', 'temperature-melange'));
    for (const m of [0.25, 1, 3]) expect(T(m)).toBeCloseTo(racine((t) => 1 * (t - 20) + m * (t - 80), 20, 80), 8);
  },
  'thermodynamique/rendement-carnot': () => {
    // Cycle de Carnot d'un gaz parfait monoatomique (γ = 5/3), calculé étape par étape.
    const [n, R, Tc, Tf, g] = [1, 8.314, 600, 300, 5 / 3];
    const V1 = 1e-3;
    const V2 = 3e-3;
    const V3 = V2 * (Tc / Tf) ** (1 / (g - 1));
    const V4 = V1 * (Tc / Tf) ** (1 / (g - 1));
    const Qc = simpson((V) => (n * R * Tc) / V, V1, V2); // isotherme chaude : Q = −W
    const Qf = simpson((V) => (n * R * Tf) / V, V3, V4); // isotherme froide
    expect(attendu(question('thermodynamique', 'rendement-carnot')).re).toBeCloseTo((100 * (Qc + Qf)) / Qc, 4);
  },

  /* ========================= INFORMATIQUE (langage C) ========================= */
  /* ---------------- Bases ---------------- */
  'c-bases/modulo': () => expect(attendu(question('c-bases', 'modulo')).re).toBe(Number(instructionsC('', '%d', '17 % 5'))),
  'c-bases/division-negative': () => expect(attendu(question('c-bases', 'division-negative')).re).toBe(Number(instructionsC('', '%d', '-7 / 2'))),
  'c-bases/cast': () => {
    const q = question('c-bases', 'cast');
    expect(attendu(q).re).toBeCloseTo(Number(instructionsC(codeDe(q), '%f', 'x + y')), 10);
  },
  'c-bases/incrementation': () => {
    const q = question('c-bases', 'incrementation');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'a + b')));
  },
  'c-bases/qcm': () => {
    expect(instructionsC('', '%d', '7 / 2')).toBe(bonChoixCode(question('c-bases', 'division-entiere')));
    expect(instructionsC('', '%d', '-7 % 2')).toBe(bonChoixCode(question('c-bases', 'modulo-negatif')));
    expect(instructionsC(codeDe(question('c-bases', 'char-ascii')), '%s', '""')).toBe(bonChoixCode(question('c-bases', 'char-ascii')));
    expect(instructionsC('int x = 0;', '%d', 'x != 0 && 10 / x > 1')).toBe('0');
    expect(instructionsC('int s = 12 + 15 + 10;\ndouble m = s / 3;', '%.2f', 'm')).toBe('12.00');
  },
  /* ---------------- Conditions et boucles ---------------- */
  'c-controle/somme-for': () => {
    const q = question('c-controle', 'somme-for');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 's')));
  },
  'c-controle/while-divisions': () => {
    const q = question('c-controle', 'while-divisions');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'k')));
  },
  'c-controle/syracuse': () => {
    const q = question('c-controle', 'syracuse');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'etapes')));
  },
  'c-controle/boucles-imbriquees': () => {
    const q = question('c-controle', 'boucles-imbriquees');
    const f = fonction(q);
    for (const n of [1, 2, 5, 9]) expect(f(n)).toBeCloseTo(Number(instructionsC(`int n = ${n};\n${codeDe(q)}`, '%d', 'c')), 10);
  },
  'c-controle/qcm': () => {
    const qc = (id: string) => question('c-controle', id);
    expect(instructionsC(codeDe(qc('do-while')), '%s', '""')).toBe(bonChoixCode(qc('do-while')));
    expect(instructionsC(codeDe(qc('switch-sans-break')), '%s', '""')).toBe(bonChoixCode(qc('switch-sans-break')));
    expect(instructionsC(codeDe(qc('break-continue')), '%d', 's')).toBe(bonChoixCode(qc('break-continue')));
    // Piège volontaire (gcc -Wall le signale : « misleading indentation »).
    expect(executerC(`int main(void) {\n${codeDe(qc('vf-point-virgule'))}\nreturn 0;\n}`, true)).toBe('10');
    // 10 additions de 0.1 ne donnent pas exactement 1.0.
    expect(instructionsC('double x = 0;\nfor (int k = 0; k < 10; k++) x += 0.1;', '%d', 'x != 1.0')).toBe('1');
  },
  /* ---------------- Fonctions et tableaux ---------------- */
  'c-fonctions-tableaux/appel-simple': () => {
    const q = question('c-fonctions-tableaux', 'appel-simple');
    expect(attendu(q).re).toBe(Number(definitionsC(codeDe(q), '%d', 'carre(3) + carre(4)')));
  },
  'c-fonctions-tableaux/somme-tableau': () => {
    const somme = codeCours('c-fonctions-tableaux', 'int somme(');
    const sortie = executerC(`${somme}\nint main(void) {\nint t[] = {3, 1, 4, 1, 5, 9};\nprintf("%d\\n", somme(t, 6));\nreturn 0;\n}`);
    expect(attendu(question('c-fonctions-tableaux', 'somme-tableau')).re).toBe(Number(sortie));
  },
  'c-fonctions-tableaux/return-boucle': () => {
    const q = question('c-fonctions-tableaux', 'return-boucle');
    expect(attendu(q).re).toBe(Number(definitionsC(codeDe(q), '%d', 'h(10)')));
  },
  'c-fonctions-tableaux/composition': () => {
    const q = question('c-fonctions-tableaux', 'composition');
    const f = fonction(q);
    for (const x of [-2, 0.5, 3]) expect(f(x)).toBeCloseTo(Number(definitionsC(codeDe(q), '%f', `g(${x})`)), 6);
  },
  'c-fonctions-tableaux/anti-diagonale': () => {
    const q = question('c-fonctions-tableaux', 'anti-diagonale');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 's')));
  },
  'c-fonctions-tableaux/qcm': () => {
    const qc = (id: string) => question('c-fonctions-tableaux', id);
    expect(executerC(codeDe(qc('passage-valeur')))).toBe(bonChoixCode(qc('passage-valeur')));
    expect(executerC(codeDe(qc('tableau-modifie')))).toBe(bonChoixCode(qc('tableau-modifie')));
    expect(instructionsC('int m[3][4];', '%zu', 'sizeof(m) / sizeof(m[0][0])')).toBe(bonChoixCode(qc('taille-2d')));
  },
  /* ---------------- Chaînes ---------------- */
  'c-chaines/strlen': () => expect(attendu(question('c-chaines', 'strlen')).re).toBe(Number(instructionsC('', '%zu', 'strlen("bonjour")'))),
  'c-chaines/octets-chaine': () => {
    const f = fonction(question('c-chaines', 'octets-chaine'));
    for (const n of [0, 1, 4, 11]) expect(f(n)).toBe(Number(instructionsC('', '%zu', `sizeof("${'x'.repeat(n)}")`)));
  },
  'c-chaines/chiffre-valeur': () => {
    const q = question('c-chaines', 'chiffre-valeur');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'v')));
  },
  'c-chaines/compte-lettre': () => {
    const q = question('c-chaines', 'compte-lettre');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'n')));
  },
  'c-chaines/conversion-entier': () => {
    const q = question('c-chaines', 'conversion-entier');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'v + 1')));
  },
  'c-chaines/qcm': () => {
    const qc = (id: string) => question('c-chaines', id);
    expect(instructionsC('', '%d', "'A'")).toBe(bonChoixCode(qc('code-ascii')));
    expect(instructionsC('char s[] = "chat";', '%zu', 'sizeof(s)')).toBe(bonChoixCode(qc('taille-chaine')));
    expect(`'${instructionsC(codeDe(qc('majuscule')), '%c', 'c')}'`).toBe(bonChoixCode(qc('majuscule')));
    expect(instructionsC(codeDe(qc('inverser')), '%s', '""')).toBe(bonChoixCode(qc('inverser')));
    expect(definitionsC(codeCours('c-chaines', 'int longueur('), '%d', 'longueur("abc")')).toBe('3');
  },
  /* ---------------- Pointeurs ---------------- */
  'c-pointeurs/somme-pointeurs': () => {
    const q = question('c-pointeurs', 'somme-pointeurs');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', '*p + *q')));
  },
  'c-pointeurs/arithmetique': () => {
    const q = question('c-pointeurs', 'arithmetique');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', '*(p + 2)')));
  },
  'c-pointeurs/struct-acces': () => {
    const q = question('c-pointeurs', 'struct-acces');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'p.x')));
  },
  'c-pointeurs/decalage-octets': () => {
    const f = fonction(question('c-pointeurs', 'decalage-octets'));
    for (const k of [0, 1, 3, 10]) expect(f(k)).toBe(Number(instructionsC('int t[32];\nint *p = t;', '%td', `(char *)(p + ${k}) - (char *)p`)));
  },
  'c-pointeurs/qcm': () => {
    const qc = (id: string) => question('c-pointeurs', id);
    expect(instructionsC(codeDe(qc('dereferencement')), '%d', 'x')).toBe(bonChoixCode(qc('dereferencement')));
    expect(instructionsC('', '%zu', 'sizeof(int *)')).toBe(bonChoixCode(qc('sizeof-pointeur')));
    const echange = codeCours('c-pointeurs', 'void echange(');
    expect(executerC(`${echange}\nint main(void) {\nint x = 1, y = 2;\nechange(&x, &y);\nprintf("%d %d\\n", x, y);\nreturn 0;\n}`)).toBe('2 1');
  },
  /* ---------------- Algorithmes ---------------- */
  'c-algorithmes/factorielle-rec': () =>
    expect(attendu(question('c-algorithmes', 'factorielle-rec')).re).toBe(Number(definitionsC(codeCours('c-algorithmes', 'int fact('), '%d', 'fact(5)'))),
  'c-algorithmes/appels-fibonacci': () => {
    const q = question('c-algorithmes', 'appels-fibonacci');
    const instrumente = codeDe(q).replace('int fib(int n) {\n', 'int fib(int n) {\n    appels++;\n');
    expect(attendu(q).re).toBe(Number(executerC(`int appels = 0;\n${instrumente}\nint main(void) {\nfib(5);\nprintf("%d\\n", appels);\nreturn 0;\n}`)));
  },
  'c-algorithmes/comparaisons-selection': () => {
    const q = question('c-algorithmes', 'comparaisons-selection');
    const f = fonction(q);
    const instrumente = codeDe(q).replace('if (t[j] < t[m])', 'if (comparaisons++, t[j] < t[m])');
    for (const n of [1, 2, 5, 9]) {
      const sortie = executerC(
        `int comparaisons = 0;\n${instrumente}\nint main(void) {\nint t[${n}];\nfor (int i = 0; i < ${n}; i++) t[i] = ${n} - i;\ntri_selection(t, ${n});\nprintf("%d\\n", comparaisons);\nreturn 0;\n}`,
      );
      expect(f(n)).toBeCloseTo(Number(sortie), 10);
    }
  },
  'c-algorithmes/dicho-tours': () => {
    // La dichotomie du cours, instrumentée, sur toutes les valeurs présentes et absentes d'un tableau de 1000 éléments.
    const dicho = codeCours('c-algorithmes', 'int dicho(').replace('while (g <= d) {', 'while (g <= d) {\n        tours++;');
    const sortie = executerC(
      `int tours;\n${dicho}\nint main(void) {\nint t[1000], pire = 0;\nfor (int i = 0; i < 1000; i++) t[i] = 2 * i;\nfor (int x = -1; x <= 2000; x++) {\ntours = 0;\ndicho(t, 1000, x);\nif (tours > pire) pire = tours;\n}\nprintf("%d\\n", pire);\nreturn 0;\n}`,
    );
    expect(attendu(question('c-algorithmes', 'dicho-tours')).re).toBe(Number(sortie));
  },
  'c-algorithmes/qcm': () => {
    const q = question('c-algorithmes', 'recursion-trace');
    expect(definitionsC(codeDe(q), '%d', 'g(7)')).toBe(bonChoixCode(q));
  },
  /* ---------------- Listes chaînées ---------------- */
  'c-listes-chainees/liste-construite': () => {
    const q = question('c-listes-chainees', 'liste-construite');
    expect(attendu(q).re).toBe(Number(executerC(codeDe(q))));
  },
  'c-listes-chainees/insertion-queue': () => {
    const q = question('c-listes-chainees', 'insertion-queue');
    const f = fonction(q);
    const type = codeCours('c-listes-chainees', 'typedef struct Maillon');
    const instrumente = codeDe(q).replace('p = p->suiv;', '{ p = p->suiv; pas++; }');
    for (const n of [1, 2, 3, 7, 12]) {
      const sortie = executerC(
        `${type}\nint pas = 0;\n${instrumente}\nint main(void) {\nMaillon *l = NULL;\nfor (int i = 0; i < ${n}; i++) l = ajouter_queue(l, i);\nprintf("%d\\n", pas);\nreturn 0;\n}`,
      );
      expect(f(n)).toBeCloseTo(Number(sortie), 10);
    }
  },
  'c-listes-chainees/pile-sequence': () => {
    const pile: number[] = [];
    const depilees: number[] = [];
    for (const op of ['+1', '+2', '+3', '-', '+4', '-', '-']) op === '-' ? depilees.push(pile.pop()!) : pile.push(Number(op));
    expect(attendu(question('c-listes-chainees', 'pile-sequence')).re).toBe(depilees.at(-1));
  },
  'c-listes-chainees/file-sequence': () => {
    const file: number[] = [];
    for (const op of ['+1', '+2', '+3', '-', '+4', '-']) op === '-' ? file.shift() : file.push(Number(op));
    expect(attendu(question('c-listes-chainees', 'file-sequence')).re).toBe(file[0]);
  },
  'c-listes-chainees/cours': () => {
    // Le code du cours compile et fonctionne : insertion en tête puis libération.
    const type = codeCours('c-listes-chainees', 'typedef struct Maillon');
    const ajout = codeCours('c-listes-chainees', 'Maillon *ajouter_tete(');
    const liberer = codeCours('c-listes-chainees', 'void liberer(');
    const sortie = executerC(
      `${type}\n${ajout}\n${liberer}\nint main(void) {\nMaillon *l = NULL;\nfor (int i = 1; i <= 3; i++) l = ajouter_tete(l, i);\nint s = 0;\nfor (Maillon *p = l; p != NULL; p = p->suiv) s = 10 * s + p->val;\nliberer(l);\nprintf("%d\\n", s);\nreturn 0;\n}`,
    );
    expect(sortie).toBe('321');
  },
};

describe('exactitude mathématique du contenu', () => {
  for (const [nom, f] of Object.entries(verifs)) it(nom, f);

  it('toutes les questions numériques et « expression » sont vérifiées indépendamment', () => {
    const nonVerifiees = CONTENU.chapitres.flatMap((c) =>
      c.exercices.filter((q) => (q.type === 'numerique' || q.type === 'expression') && !verifs[`${c.id}/${q.id}`]).map((q) => `${c.id}/${q.id}`),
    );
    expect(nonVerifiees).toEqual([]);
  });
});
