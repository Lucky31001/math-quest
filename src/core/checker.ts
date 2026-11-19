/**
 * Vérification automatique des réponses tapées par l'élève (math.js).
 *
 * Principe pour les expressions : deux expressions sont considérées équivalentes
 * si elles prennent la même valeur (à une tolérance près) en une douzaine de points
 * tirés au hasard dans le domaine. C'est bien plus robuste que la simplification
 * symbolique : « 2x+2 », « 2(x+1) » et « (x+1)*2 » sont toutes acceptées.
 *
 * Les calculs se font dans ℂ (math.js renvoie des complexes pour sqrt(-1), log(-2)…),
 * ce qui permet aussi de vérifier des réponses complexes comme « 1+i ».
 */
import { create, all, type MathNode, type EvalFunction } from 'mathjs';
import { createRng } from './random';

export const math = create(all, {});

export type Statut = 'correct' | 'incorrect' | 'invalide';

export interface Verdict {
  statut: Statut;
  /** Message à afficher (erreur de syntaxe, nombre de valeurs attendu…). */
  message?: string;
}

interface C {
  re: number;
  im: number;
}

/** Symboles reconnus comme constantes. */
const CONSTANTES = new Set(['e', 'i', 'pi']);

/**
 * Convertit l'écriture « naturelle » d'un étudiant en syntaxe math.js :
 * ln → log, arctan → atan, ch/sh → cosh/sinh, virgule décimale, π, √, ², ×…
 */
export function normaliser(saisie: string): string {
  return saisie
    .trim()
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/π/g, 'pi')
    .replace(/√\s*(\d+(?:\.\d+)?|[a-zA-Z])(?![\w(])/g, 'sqrt($1)')
    .replace(/√/g, 'sqrt')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\barc(sin|cos|tan)\b/g, 'a$1')
    .replace(/\bln\b/g, 'log')
    .replace(/\bch\b/g, 'cosh')
    .replace(/\bsh\b/g, 'sinh')
    .replace(/\bth\b/g, 'tanh')
    .replace(/\btg\b/g, 'tan');
}

type Analyse = { ok: true; node: MathNode; code: EvalFunction } | { ok: false; message: string };

/**
 * Analyse une saisie : normalisation, parsing, puis contrôle des symboles.
 * `x(x+1)` est lu comme `x*(x+1)` (math.js y verrait un appel de fonction).
 */
export function analyser(saisie: string, variables: readonly string[] = []): Analyse {
  const texte = normaliser(saisie);
  if (!texte) return { ok: false, message: 'Réponse vide.' };
  let node: MathNode;
  try {
    node = math.parse(texte);
  } catch (e) {
    return { ok: false, message: `Syntaxe incorrecte : ${(e as Error).message}` };
  }
  const autorises = new Set([...variables, ...CONSTANTES]);

  // x(…) → x*(…) lorsque x est une variable ou une constante.
  node = node.transform((n) => {
    if (n.type === 'FunctionNode') {
      const f = n as unknown as { fn: MathNode & { name?: string }; args: MathNode[] };
      const nom = f.fn.name;
      if (nom && autorises.has(nom) && f.args.length === 1) {
        return new math.OperatorNode('*', 'multiply', [
          new math.SymbolNode(nom),
          new math.ParenthesisNode(f.args[0]),
        ]);
      }
    }
    return n;
  });

  let inconnu: string | null = null;
  node.traverse((n, chemin, parent) => {
    if (n.type !== 'SymbolNode') return;
    const nom = (n as unknown as { name: string }).name;
    const estFonction = parent?.type === 'FunctionNode' && chemin === 'fn';
    if (estFonction) {
      if (typeof (math as unknown as Record<string, unknown>)[nom] !== 'function') inconnu ??= `${nom}(…)`;
    } else if (!autorises.has(nom)) {
      inconnu ??= nom;
    }
  });
  if (inconnu) {
    const conseil = /^[a-z]{3,}[a-z]$/.test(inconnu) ? ' (pense aux parenthèses : sin(x), pas sinx)' : '';
    return { ok: false, message: `Symbole inconnu : « ${inconnu} »${conseil}.` };
  }
  try {
    return { ok: true, node, code: node.compile() };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Évalue et convertit le résultat en complexe, ou null si ce n'est pas un scalaire. */
function evaluer(code: EvalFunction, scope: Record<string, number>): C | null {
  let v: unknown;
  try {
    v = code.evaluate({ ...scope });
  } catch {
    return null;
  }
  if (typeof v === 'number') return { re: v, im: 0 };
  if (typeof v === 'boolean') return null;
  if (math.isComplex(v)) return { re: v.re, im: v.im };
  if (math.isFraction(v) || math.isBigNumber(v)) return { re: math.number(v as never) as number, im: 0 };
  return null;
}

const fini = (z: C | null): z is C => !!z && Number.isFinite(z.re) && Number.isFinite(z.im);
const module_ = (z: C) => Math.hypot(z.re, z.im);
const moins = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });

/** a ≈ b à `tol` près (relatif si les nombres sont grands, absolu sinon). */
export function proches(a: C, b: C, tol: number): boolean {
  const echelle = Math.max(1, module_(a), module_(b));
  return module_(moins(a, b)) <= tol * echelle;
}

/** Évalue une valeur attendue (nombre ou expression constante comme "sqrt(3)/2"). */
export function valeurDe(v: number | string): C {
  if (typeof v === 'number') return { re: v, im: 0 };
  const a = analyser(v);
  if (!a.ok) throw new Error(`Valeur attendue invalide « ${v} » : ${a.message}`);
  const z = evaluer(a.code, {});
  if (!fini(z)) throw new Error(`Valeur attendue non numérique : « ${v} »`);
  return z;
}

/**
 * Tolérance accordée à une saisie décimale : « 1.414 » est accepté pour √2
 * (3 décimales ou plus, à une unité du dernier chiffre près).
 */
function toleranceDecimale(saisie: string): number | null {
  const m = normaliser(saisie).match(/^-?\d+\.(\d+)$/);
  if (!m || m[1].length < 3) return null;
  return 10 ** -m[1].length;
}

/** Vérifie UNE valeur numérique. */
function verifierUneValeur(saisie: string, attendu: C, tol: number): Verdict {
  const a = analyser(saisie);
  if (!a.ok) return { statut: 'invalide', message: a.message };
  const z = evaluer(a.code, {});
  if (!fini(z)) return { statut: 'invalide', message: `« ${saisie} » n'est pas un nombre.` };
  const tolDec = toleranceDecimale(saisie);
  if (tolDec !== null && module_(moins(z, attendu)) <= tolDec) return { statut: 'correct' };
  return { statut: proches(z, attendu, tol) ? 'correct' : 'incorrect' };
}

/**
 * Réponse numérique. Si `attendu` est une liste, l'élève sépare ses valeurs
 * par « ; » et l'ordre n'a pas d'importance.
 */
export function verifierNumerique(
  saisie: string,
  attendu: number | string | (number | string)[],
  tol = 1e-6,
): Verdict {
  if (!Array.isArray(attendu)) return verifierUneValeur(saisie, valeurDe(attendu), tol);

  const morceaux = saisie
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (morceaux.length !== attendu.length)
    return {
      statut: morceaux.length === 0 ? 'invalide' : 'incorrect',
      message: `${attendu.length} valeur(s) attendue(s), séparées par « ; » — tu en as donné ${morceaux.length}.`,
    };
  const restantes = attendu.map(valeurDe);
  for (const m of morceaux) {
    let trouve = -1;
    for (let k = 0; k < restantes.length; k++) {
      const v = verifierUneValeur(m, restantes[k], tol);
      if (v.statut === 'invalide') return v;
      if (v.statut === 'correct') {
        trouve = k;
        break;
      }
    }
    if (trouve < 0) return { statut: 'incorrect' };
    restantes.splice(trouve, 1);
  }
  return { statut: 'correct' };
}

export interface OptionsExpression {
  variables?: readonly string[];
  domaine?: readonly [number, number];
  /** Accepter une différence constante (primitives). */
  aConstantePres?: boolean;
  tolerance?: number;
  /** Graine des points d'échantillonnage (tests). */
  graine?: number;
}

/**
 * Vérifie qu'une expression saisie est équivalente à l'expression attendue,
 * par évaluation en des points aléatoires du domaine.
 */
export function verifierExpression(saisie: string, attendu: string, opts: OptionsExpression = {}): Verdict {
  const variables = opts.variables ?? ['x'];
  const [min, max] = opts.domaine ?? [-3, 3];
  const tol = opts.tolerance ?? 1e-7;
  // Les constantes d'intégration éventuellement écrites par l'élève valent 0.
  const extra = opts.aConstantePres ? ['C', 'K'] : [];

  const user = analyser(saisie, [...variables, ...extra]);
  if (!user.ok) return { statut: 'invalide', message: user.message };
  const ref = analyser(attendu, variables);
  if (!ref.ok) throw new Error(`Expression attendue invalide « ${attendu} » : ${ref.message}`);

  const rng = createRng(opts.graine ?? 12345);
  let valides = 0;
  let decalage: C | null = null;
  for (let essai = 0; essai < 80 && valides < 12; essai++) {
    const scope: Record<string, number> = { C: 0, K: 0 };
    for (const v of variables) scope[v] = min + (max - min) * rng();
    const e = evaluer(ref.code, scope);
    if (!fini(e)) continue; // point hors du domaine de définition : on en tire un autre
    const u = evaluer(user.code, scope);
    if (!fini(u)) return { statut: 'incorrect' };
    valides++;
    if (opts.aConstantePres) {
      const d = moins(u, e);
      decalage ??= d;
      if (!proches(d, decalage, tol) && !proches(u, { re: e.re + decalage.re, im: e.im + decalage.im }, tol))
        return { statut: 'incorrect' };
    } else if (!proches(u, e, tol)) {
      return { statut: 'incorrect' };
    }
  }
  if (valides < 3) throw new Error(`Impossible d'évaluer « ${attendu} » sur le domaine donné.`);
  return { statut: 'correct' };
}

/** Aperçu LaTeX de la saisie (affiché en direct sous le champ). */
export function apercuLatex(saisie: string, variables: readonly string[] = ['x']): string | null {
  const a = analyser(saisie, [...variables, 'C', 'K']);
  if (!a.ok) return null;
  try {
    return a.node.toTex({ parenthesis: 'keep', implicit: 'hide' });
  } catch {
    return null;
  }
}
