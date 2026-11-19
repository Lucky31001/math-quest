/**
 * Conversion (limitée) LaTeX → math.js, utilisée par les tests pour vérifier
 * que ce qui est AFFICHÉ correspond bien à ce qui est attendu.
 */
import { math } from '../src/core/checker';

function groupe(s: string, i: number): [string, number] {
  while (s[i] === ' ') i++;
  if (s[i] !== '{') return [s[i], i + 1];
  let prof = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') prof++;
    else if (s[j] === '}' && --prof === 0) return [s.slice(i + 1, j), j + 1];
  }
  throw new Error(`accolade non fermée : ${s}`);
}

function commandes(s: string): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const frac = s.startsWith('\\dfrac', i) ? 6 : s.startsWith('\\frac', i) ? 5 : 0;
    if (frac) {
      const [a, j] = groupe(s, i + frac);
      const [b, k] = groupe(s, j);
      out += ` ((${commandes(a)})/(${commandes(b)})) `;
      i = k;
    } else if (s.startsWith('\\sqrt', i)) {
      const [a, j] = groupe(s, i + 5);
      out += ` sqrt(${commandes(a)}) `;
      i = j;
    } else if (s.startsWith('\\operatorname', i)) {
      const [a, j] = groupe(s, i + 13);
      out += ` ${({ sh: 'sinh', ch: 'cosh', th: 'tanh' } as Record<string, string>)[a] ?? a} `;
      i = j;
    } else if (s[i] === '{') {
      const [a, j] = groupe(s, i);
      out += `(${commandes(a)})`;
      i = j;
    } else {
      out += s[i];
      i++;
    }
  }
  return out;
}

export function texVersMath(tex: string): string {
  let s = tex.replace(/\\left|\\right|\\displaystyle|\\,|\\;/g, ' ');
  s = s.replace(/\\ln\|([^|]*)\|/g, ' log(abs($1)) ');
  s = commandes(s);
  const noms: [RegExp, string][] = [
    [/\\arctan/g, ' atan '],
    [/\\arcsin/g, ' asin '],
    [/\\arccos/g, ' acos '],
    [/\\sin/g, ' sin '],
    [/\\cos/g, ' cos '],
    [/\\tan/g, ' tan '],
    [/\\ln/g, ' log '],
    [/\\exp/g, ' exp '],
    [/\\pi/g, ' pi '],
    [/\\cdot|\\times/g, ' * '],
    [/\\lambda/g, ' lam '],
    [/\\mu/g, ' mu '],
  ];
  for (const [re, r] of noms) s = s.replace(re, r);
  s = s.replace(/\|([^|]*)\|/g, ' abs($1) ');
  s = s.replace(/e\^/g, ' e^');
  // « i(…) » est une multiplication, pas un appel de fonction
  s = s.replace(/\bi\s*\(/g, 'i*(');
  // « sin x » → « sin(x) »
  s = s.replace(/\b(sin|cos|tan|log|atan|sinh|cosh) +([a-z0-9.]+)/g, '$1($2)');
  return s.replace(/\s+/g, ' ').trim();
}

/** Évalue une expression LaTeX (en complexes si besoin). */
export function evalTex(tex: string, scope: Record<string, number> = {}): number | { re: number; im: number } {
  const v = math.evaluate(texVersMath(tex), { ...scope });
  if (typeof v === 'number') return v;
  if (math.isComplex(v)) return { re: v.re, im: v.im };
  if (math.isFraction(v)) return Number(v);
  throw new Error(`Valeur non scalaire pour ${tex}`);
}

export function evalReel(tex: string, scope: Record<string, number> = {}): number {
  const v = evalTex(tex, scope);
  if (typeof v === 'number') return v;
  if (Math.abs(v.im) > 1e-9) throw new Error(`Valeur complexe pour ${tex}`);
  return v.re;
}

/** Contenu du premier segment $…$ qui suit `avant` dans `texte`. */
export function segment(texte: string, motif: RegExp): string {
  const m = texte.match(motif);
  if (!m) throw new Error(`Motif ${motif} introuvable dans : ${texte}`);
  return m[1];
}

/** Tous les segments mathématiques $…$ d'un texte. */
export const segments = (texte: string): string[] => [...texte.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
