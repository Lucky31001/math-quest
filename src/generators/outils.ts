/**
 * Outils partagés par les générateurs d'exercices :
 *  - `Q` : rationnels exacts (pour des coefficients de DL, des inverses de matrices…) ;
 *  - mise en forme LaTeX (affichage) et math.js (vérification) ;
 *  - `construireQcm` : assemble un QCM à partir de la bonne réponse et de
 *    distracteurs issus d'erreurs typiques, en éliminant les doublons.
 */
import type { Difficulte, Qcm, Question } from '../core/schema';
import type { Rng } from '../core/random';
import { math } from '../core/checker';

/* ------------------------------------------------------------------ */
/* Rationnels                                                          */
/* ------------------------------------------------------------------ */

const pgcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

export class Q {
  readonly n: number;
  readonly d: number;
  constructor(n: number, d = 1) {
    if (d === 0) throw new Error('Q : dénominateur nul');
    if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error(`Q : ${n}/${d} non entier`);
    const g = pgcd(n, d);
    const s = d < 0 ? -1 : 1;
    this.n = (s * n) / g || 0; // évite -0
    this.d = (s * d) / g;
  }
  static of(x: number | Q): Q {
    return x instanceof Q ? x : new Q(x);
  }
  add(o: number | Q): Q {
    const b = Q.of(o);
    return new Q(this.n * b.d + b.n * this.d, this.d * b.d);
  }
  sub(o: number | Q): Q {
    return this.add(Q.of(o).neg());
  }
  mul(o: number | Q): Q {
    const b = Q.of(o);
    return new Q(this.n * b.n, this.d * b.d);
  }
  div(o: number | Q): Q {
    const b = Q.of(o);
    return new Q(this.n * b.d, this.d * b.n);
  }
  neg(): Q {
    return new Q(-this.n, this.d);
  }
  pow(k: number): Q {
    let r = new Q(1);
    for (let i = 0; i < k; i++) r = r.mul(this);
    return r;
  }
  get zero(): boolean {
    return this.n === 0;
  }
  get entier(): boolean {
    return this.d === 1;
  }
  equals(o: number | Q): boolean {
    const b = Q.of(o);
    return this.n === b.n && this.d === b.d;
  }
  valueOf(): number {
    return this.n / this.d;
  }
  /** LaTeX : 3, -3, \frac{3}{2}, -\frac{3}{2}. */
  tex(): string {
    if (this.entier) return String(this.n);
    const s = this.n < 0 ? '-' : '';
    return `${s}\\frac{${Math.abs(this.n)}}{${this.d}}`;
  }
  /** Syntaxe math.js, toujours parenthésée si besoin : 3, (-3), (3/2). */
  str(): string {
    if (this.entier) return this.n < 0 ? `(${this.n})` : String(this.n);
    return `(${this.n}/${this.d})`;
  }
  toString(): string {
    return this.entier ? String(this.n) : `${this.n}/${this.d}`;
  }
}

export const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
export const binom = (n: number, k: number): number => (k < 0 || k > n ? 0 : fact(n) / (fact(k) * fact(n - k)));

/* ------------------------------------------------------------------ */
/* Mise en forme                                                       */
/* ------------------------------------------------------------------ */

/** Coefficient devant une expression : 1 → "", -1 → "-", 3 → "3". */
export function coefTex(c: number): string {
  if (c === 1) return '';
  if (c === -1) return '-';
  return String(c);
}

/** `a x + b` proprement : (2, 'x', -3) → "2x - 3", (1,'x',0) → "x". */
export function affineTex(a: number, v: string, b: number): string {
  const t = a === 0 ? '' : `${coefTex(a)}${v}`;
  if (b === 0) return t || '0';
  if (!t) return String(b);
  return `${t} ${b < 0 ? '-' : '+'} ${Math.abs(b)}`;
}

/** Monôme LaTeX c·x^k « façon DL » : \frac{x^3}{6}, -\frac{3x^2}{2}, 2x. */
export function monomeTex(c: Q, k: number, v = 'x'): string {
  const corps = k === 0 ? '' : k === 1 ? v : `${v}^{${k}}`;
  const a = c.n < 0 ? c.neg() : c;
  let s: string;
  if (k === 0) s = a.tex();
  else if (a.entier) s = `${a.n === 1 ? '' : a.n}${corps}`;
  else s = `\\frac{${a.n === 1 ? '' : a.n}${corps}}{${a.d}}`;
  return (c.n < 0 ? '-' : '') + s;
}

/** Polynôme LaTeX à partir des coefficients par degré croissant. */
export function polyTex(coefs: readonly Q[], ordre: 'croissant' | 'decroissant' = 'decroissant', v = 'x'): string {
  const idx = coefs.map((_, k) => k).filter((k) => !coefs[k].zero);
  if (ordre === 'decroissant') idx.reverse();
  if (idx.length === 0) return '0';
  return idx
    .map((k, i) => {
      const m = monomeTex(coefs[k], k, v);
      if (i === 0) return m;
      return m.startsWith('-') ? ` - ${m.slice(1)}` : ` + ${m}`;
    })
    .join('');
}

/** Polynôme en syntaxe math.js. */
export function polyStr(coefs: readonly Q[], v = 'x'): string {
  const t = coefs.map((c, k) => (c.zero ? '' : `${c.str()}*${v}^${k}`)).filter(Boolean);
  return t.length ? t.join(' + ') : '0';
}

export const qs = (...xs: number[]): Q[] => xs.map((x) => new Q(x));

/** Matrice LaTeX. */
export function matTex(m: readonly (readonly (number | Q | string)[])[]): string {
  const lignes = m.map((l) => l.map((c) => (c instanceof Q ? c.tex() : String(c))).join(' & '));
  return `\\begin{pmatrix} ${lignes.join(' \\\\ ')} \\end{pmatrix}`;
}

/* ------------------------------------------------------------------ */
/* Construction des QCM                                                */
/* ------------------------------------------------------------------ */

export interface Candidat {
  texte: string;
  explication: string;
  /** Clé de comparaison (valeur canonique) pour éliminer les doublons ; défaut : texte. */
  cle?: string;
}

export interface BaseQuestion {
  difficulte: Difficulte;
  enonce: string;
  indice?: string;
  correction: string[];
}

/**
 * Assemble un QCM à réponse unique : la bonne réponse + jusqu'à `n` distracteurs
 * DISTINCTS (pris dans l'ordre de priorité de la liste fournie).
 */
export function construireQcm(base: BaseQuestion, bonne: Candidat, distracteurs: Candidat[], n = 3): Qcm {
  const vues = new Set([bonne.cle ?? bonne.texte]);
  const retenus: Candidat[] = [];
  for (const d of distracteurs) {
    const k = d.cle ?? d.texte;
    if (vues.has(k)) continue;
    vues.add(k);
    retenus.push(d);
    if (retenus.length === n) break;
  }
  return {
    id: '',
    type: 'qcm',
    multiple: false,
    ...base,
    choix: [
      { texte: bonne.texte, correct: true, explication: bonne.explication },
      ...retenus.map((d) => ({ texte: d.texte, correct: false, explication: d.explication })),
    ],
  };
}

/** Clé numérique arrondie (pour dédoublonner des valeurs). */
export const cleNum = (...xs: number[]): string => xs.map((x) => (Math.round(x * 1e6) / 1e6).toString()).join('|');

/* ------------------------------------------------------------------ */
/* Interface des générateurs                                           */
/* ------------------------------------------------------------------ */

/** « qcm » : forcer un QCM ; « libre » : forcer une réponse à saisir ; undefined : au hasard. */
export type Forme = 'qcm' | 'libre';

export interface Generateur {
  id: string;
  /** Libellé affiché, ex. « Dérivées ». */
  titre: string;
  /** Identifiant du chapitre de rattachement. */
  chapitre: string;
  /** Formes possibles. */
  formes: readonly Forme[];
  generer(rng: Rng, difficulte: Difficulte, forme: Forme): Question;
}

/**
 * Combinaison linéaire LaTeX : [[3, ''], [-2, 'e^{-2x}'], [1, 'x']] → "3 - 2e^{-2x} + x".
 * Les coefficients nuls sont omis ; 1 et -1 ne sont pas écrits devant un « corps ».
 */
export function combinaisonTex(termes: readonly (readonly [number | Q, string])[]): string {
  const parts = termes.filter(([c]) => !Q.of(c).zero);
  if (parts.length === 0) return '0';
  return parts
    .map(([c, corps], i) => {
      const q = Q.of(c);
      const abs = q.n < 0 ? q.neg() : q;
      const coef = corps === '' ? abs.tex() : abs.equals(1) ? '' : abs.tex();
      const t = `${coef}${corps}`;
      if (i === 0) return q.n < 0 ? `-${t}` : t;
      return q.n < 0 ? ` - ${t}` : ` + ${t}`;
    })
    .join('');
}

/** Multiple rationnel de π en LaTeX : 1/3 → \frac{\pi}{3}, -3/4 → -\frac{3\pi}{4}. */
export function piTex(t: Q): string {
  if (t.zero) return '0';
  const s = t.n < 0 ? '-' : '';
  const n = Math.abs(t.n);
  const num = n === 1 ? '\\pi' : `${n}\\pi`;
  return t.d === 1 ? `${s}${num}` : `${s}\\frac{${num}}{${t.d}}`;
}

/** Multiple rationnel de π en syntaxe math.js. */
export const piStr = (t: Q): string => `(${t.n}*pi/${t.d})`;

/** Clé d'une expression en x : ses valeurs en quelques points (pour dédoublonner des distracteurs). */
export function cleExpr(expr: string): string {
  const f = math.compile(expr);
  return [0.37, 0.81, 1.53]
    .map((x) => {
      const v = f.evaluate({ x });
      return typeof v === 'number' ? (Math.round(v * 1e6) / 1e6).toString() : String(v);
    })
    .join('|');
}
