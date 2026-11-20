/**
 * Défi entre camarades : le même examen blanc pour tous, via un lien, sans
 * serveur. Le code contient la matière, la LISTE des questions (clés
 * « chapitre/question », ou identifiants « gen~… » des questions générées,
 * qui se régénèrent à l'identique) et, si on la donne, la note à battre.
 *
 * On transmet les questions plutôt qu'une graine : le sujet reste le même
 * même si la façon de tirer un examen évolue d'une version à l'autre.
 */

export interface Defi {
  matiere: string;
  /** Questions, dans l'ordre du sujet. */
  questions: string[];
  /** Note de celui qui lance le défi (sur 20). */
  note?: number;
}

/** Préfixe du code (version du format). */
export const PREFIXE_DEFI = 'D1-';

const versBase64Url = (texte: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(texte)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function depuisBase64Url(texte: string): string {
  const b64 = texte.replace(/-/g, '+').replace(/_/g, '/');
  const binaire = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binaire, (c) => c.charCodeAt(0)));
}

export function encoderDefi(d: Defi): string {
  return PREFIXE_DEFI + versBase64Url(JSON.stringify({ m: d.matiere, q: d.questions, n: d.note }));
}

/** Lit un code de défi ; null s'il est invalide. */
export function decoderDefi(code: string): Defi | null {
  if (!code.startsWith(PREFIXE_DEFI)) return null;
  try {
    const o = JSON.parse(depuisBase64Url(code.slice(PREFIXE_DEFI.length))) as { m?: unknown; q?: unknown; n?: unknown };
    const valide = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length < 200;
    if (!valide(o.m) || !Array.isArray(o.q) || !o.q.length || o.q.length > 50 || !o.q.every(valide)) return null;
    const note = typeof o.n === 'number' && o.n >= 0 && o.n <= 20 ? o.n : undefined;
    return { matiere: o.m, questions: o.q, note };
  } catch {
    return null;
  }
}

/** Chemin de l'écran d'accueil du défi. */
export const routeDefi = (code: string): string => `#/defi/${code}`;
