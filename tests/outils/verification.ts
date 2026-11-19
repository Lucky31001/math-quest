/**
 * Outils des vérifications indépendantes du contenu (tests/verifications/) :
 * accès aux questions, méthodes numériques (Simpson, RK4, Gauss, dichotomie…),
 * exécution de code C avec gcc, tracé de rayons.
 */
import { CONTENU } from '../../src/core/loader';
import { math, valeurDe } from '../../src/core/checker';
import type { Question } from '../../src/core/schema';
import { evalTex } from '../tex';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* ----------------------------- outils ----------------------------- */

export const question = (chap: string, id: string): Question => {
  const q = CONTENU.chapitres.find((c) => c.id === chap)?.exercices.find((x) => x.id === id);
  if (!q) throw new Error(`question ${chap}/${id} introuvable`);
  return q;
};
export type C = { re: number; im: number };
export const enC = (v: number | C): C => (typeof v === 'number' ? { re: v, im: 0 } : v);
export const proche = (a: number | C, b: number | C, tol = 1e-6) => {
  const A = enC(a);
  const B = enC(b);
  return Math.hypot(A.re - B.re, A.im - B.im) <= tol * Math.max(1, Math.hypot(A.re, A.im), Math.hypot(B.re, B.im));
};
/** Valeur(s) attendue(s) d'une question numérique. */
export const attendus = (q: Question): C[] => {
  if (q.type !== 'numerique') throw new Error(`${q.id} n'est pas numérique`);
  return (Array.isArray(q.reponse) ? q.reponse : [q.reponse]).map(valeurDe);
};
export const attendu = (q: Question): C => attendus(q)[0];
/** Fonction (de x, ou d'une autre variable) correspondant à la réponse d'une question « expression ». */
export const fonction = (q: Question) => {
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
export const bonChoix = (q: Question): number | C => {
  if (q.type !== 'qcm') throw new Error(`${q.id} n'est pas un QCM`);
  return evalTex(q.choix.find((c) => c.correct)!.texte.replace(/^\$|\$$/g, ''));
};
export const derivee = (f: (x: number) => number, x: number, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);
export function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}
/** Runge-Kutta 4 pour Y' = F(x, Y). */
export function rk4(F: (x: number, y: number[]) => number[], y0: number[], x0: number, x1: number, n = 20000): number[] {
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
export const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
export const binom = (n: number, k: number) => fact(n) / (fact(k) * fact(n - k));
/** Rang d'une matrice par élimination de Gauss. */
export function rang(m: number[][]): number {
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
export function resoudre(A: number[][], b: number[]): number[] {
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
export function instant(F: (t: number, y: number[]) => number[], y0: number[], cond: (y: number[]) => boolean, h = 1e-4, tMax = 100): { t: number; y: number[] } {
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
export function executerC(source: string, piege = false): string {
  const base = join(dossierC, `p${numeroC++}`);
  writeFileSync(`${base}.c`, source.includes('#include') ? source : ENTETES + source);
  execFileSync('gcc', ['-std=c11', '-Wall', ...(piege ? [] : ['-Werror']), '-O0', '-o', base, `${base}.c`, '-lm'], { stdio: 'pipe' });
  return execFileSync(base, { encoding: 'utf8' }).trim();
}
/** Premier bloc ```c``` d'un texte. */
export const blocC = (texte: string): string => {
  const m = texte.match(/```c\n([\s\S]+?)\n```/);
  if (!m) throw new Error(`pas de bloc de code C dans « ${texte.slice(0, 50)} »`);
  return m[1];
};
export const codeDe = (q: Question): string => blocC(q.enonce);
/** Bloc de code du cours d'un chapitre contenant `motCle`. */
export const codeCours = (chap: string, motCle: string): string => {
  const b = CONTENU.chapitres
    .find((c) => c.id === chap)!
    .cours.flatMap((s) => s.blocs)
    .find((x) => x.texte.includes('```c') && blocC(x.texte).includes(motCle));
  if (!b) throw new Error(`${chap} : pas de code « ${motCle} » dans le cours`);
  return blocC(b.texte);
};
/** Des instructions exécutées dans `main`, puis l'affichage de `expr` au format `fmt`. */
export const instructionsC = (code: string, fmt: string, expr: string): string =>
  executerC(`int main(void) {\n${code}\nprintf("${fmt}\\n", ${expr});\nreturn 0;\n}`);
/** Des définitions (fonctions, types), puis un `main` qui affiche `expr`. */
export const definitionsC = (code: string, fmt: string, expr: string): string =>
  executerC(`${code}\nint main(void) {\nprintf("${fmt}\\n", ${expr});\nreturn 0;\n}`);
/** Texte du choix correct d'un QCM, sans les accents graves du code. */
export const bonChoixCode = (q: Question): string => {
  if (q.type !== 'qcm') throw new Error(`${q.id} n'est pas un QCM`);
  return q.choix.find((c) => c.correct)!.texte.replace(/`/g, '').trim();
};
/** Image du point B (abscisse oa, hauteur 1) par une lentille mince de focale f : intersection de deux rayons. */
export function imageParRayons(oa: number, f: number): { x: number; y: number } {
  // Rayon parallèle à l'axe, qui ressort par F'(f, 0) : x/f + y = 1. Rayon par O, non dévié : x/oa − y = 0.
  const [x, y] = resoudre([[1 / f, 1], [1 / oa, -1]], [1, 0]);
  return { x, y };
}
/** Minimum d'une fonction unimodale sur [a, b] (section dorée). */
export function minimum(f: (x: number) => number, a: number, b: number): number {
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
export function racine(f: (x: number) => number, a: number, b: number): number {
  for (let k = 0; k < 200; k++) {
    const m = (a + b) / 2;
    if (f(a) * f(m) <= 0) b = m;
    else a = m;
  }
  return (a + b) / 2;
}
export const POINTS = [0.3, 0.7, 1.1, 1.6];

/* ------------------------ vérifications ---------------------------- */

