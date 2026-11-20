/**
 * Vérifications PHYSIQUES des générateurs de physique : on relit les données
 * dans l'énoncé affiché (« $X = valeur\ unité$ »), on recalcule la réponse avec
 * des formules réécrites ici, et chaque distracteur de QCM doit être faux.
 */
import { describe, it, expect } from 'vitest';
import type { Question } from '../src/core/schema';
import { GENERATEURS_PHYSIQUE } from '../src/generators/physique';
import { toutVerifier } from './outils/tout-verifier';
import { graines, toutes, bonne, mauvais, proche } from './outils/generateurs';

const lireNombre = (t: string): number => Number(t.replace('{,}', '.'));
const echapper = (s: string) => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

/** Valeur de la donnée `symbole` dans l'énoncé : « $symbole = 12{,}5\ … $ ». */
function donnee(enonce: string, symbole: string): number {
  const m = enonce.match(new RegExp(`\\$${echapper(symbole)} = (-?[0-9]+(?:\\{,\\}[0-9]+)?)`));
  if (!m) throw new Error(`donnée ${symbole} absente : ${enonce}`);
  return lireNombre(m[1]);
}

/** Nombre affiché dans un choix de QCM : « $12{,}5\ \mathrm{m}$ ». */
const valeurChoix = (texte: string): number => lireNombre(texte.match(/^\$(-?[0-9]+(?:\{,\}[0-9]+)?)/)![1]);

const rad = (a: number) => (a * Math.PI) / 180;
type Lire = (s: string) => number;

/** Réponse attendue, par générateur et par difficulté, recalculée depuis les données affichées. */
const ATTENDU: Record<string, Record<1 | 2 | 3, (v: Lire) => number>> = {
  'phys-cinematique': {
    1: (v) => v('v_0') ** 2 / (2 * v('a')),
    2: (v) => Math.sqrt(2 * v('g') * v('h')),
    3: (v) => 100 * v('v_0') * Math.sqrt((2 * v('h')) / v('g')),
  },
  'phys-dynamique': {
    1: (v) => v('F') / v('m'),
    2: (v) => v('g') * Math.sin(rad(v('\\alpha'))),
    3: (v) => v('g') * (Math.sin(rad(v('\\alpha'))) - v('\\mu') * Math.cos(rad(v('\\alpha')))),
  },
  'phys-electrocinetique': {
    1: (v) => (v('U') / v('R')) * 1e3,
    2: (v) => 1 / (1 / v('R_1') + 1 / v('R_2')),
    // u_C = E(1 − e^{−t/RC}) = 0,95 E ; R en kΩ, C en µF → ms.
    3: (v) => -v('R') * v('C') * Math.log(1 - 0.95),
  },
  'phys-energie': {
    1: (v) => 0.5 * v('m') * v('v') ** 2,
    2: (v) => v('v_0') ** 2 / (2 * v('g')),
    3: (v) => v('m') * v('g') * v('h') - 0.5 * v('m') * v('v') ** 2,
  },
  'phys-optique': {
    1: (v) => 1 / (v("f'") / 100),
    2: (v) => (Math.asin(Math.sin(rad(v('i_1'))) / v('n_2')) * 180) / Math.PI,
    3: (v) => 1 / (1 / v("f'") + 1 / v('\\overline{OA}')),
  },
  'phys-oscillateurs': {
    1: (v) => Math.sqrt(v('k') / v('m')),
    2: (v) => 2 * Math.PI * Math.sqrt(v('m') / v('k')) * 1e3,
    3: (v) => 2 * Math.PI * Math.sqrt(v('L') / v('g')),
  },
  'phys-thermo': {
    1: (v) => (v('m') * v('c') * v('\\Delta T')) / 1e3,
    2: (v) => (v('n') * v('R') * v('T')) / (v('V') * 1e-3) / 1e3,
    3: (v) => (v('m_1') * v('T_1') + v('m_2') * v('T_2')) / (v('m_1') + v('m_2')),
  },
  'phys-unites': {
    1: (v) => (v('v') * 1000) / 3600,
    2: (v) => (v('v') * 3600) / 1000,
    3: (v) => (v('\\rho') * 1e-3) / 1e-6,
  },
};

const GRAINES = graines(300, 4513);

function verifier(id: string): void {
  const attendu = (q: Question) => ATTENDU[id][q.difficulte]((s) => donnee(q.enonce, s));
  for (const q of toutes(id, 'libre', GRAINES)) {
    if (q.type !== 'numerique') throw new Error(q.type);
    const a = attendu(q);
    expect(proche(Number(q.reponse), a, 1e-3), `${q.enonce} → ${q.reponse} ≠ ${a}`).toBe(true);
    expect(a, `réponse < 1 (tolérance absolue) : ${q.enonce}`).toBeGreaterThanOrEqual(1);
    expect(q.tolerance).toBe(0.01);
  }
  for (const q of toutes(id, 'qcm', GRAINES)) {
    if (q.type !== 'qcm') throw new Error(q.type);
    const a = attendu(q);
    expect(proche(valeurChoix(bonne(q).texte), a, 6e-3), `${q.enonce} → ${bonne(q).texte} ≠ ${a}`).toBe(true);
    for (const c of mauvais(q)) expect(proche(valeurChoix(c.texte), a, 0.015), `${q.enonce} : distracteur ${c.texte} ≈ ${a}`).toBe(false);
  }
}

describe('générateurs de physique', () => {
  it('un générateur par chapitre calculatoire, chacun vérifié', () => {
    const chapitres = GENERATEURS_PHYSIQUE.map((g) => g.chapitre);
    expect(new Set(chapitres).size).toBe(chapitres.length);
    expect(Object.keys(ATTENDU).sort()).toEqual(GENERATEURS_PHYSIQUE.map((g) => g.id).sort());
  });

  it('réponse recalculée depuis l’énoncé affiché, distracteurs faux', () =>
    toutVerifier(GENERATEURS_PHYSIQUE.map((g): [string, () => void] => [g.id, () => verifier(g.id)])));
});
