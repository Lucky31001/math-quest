/**
 * Générateur pseudo-aléatoire à graine (mulberry32).
 * Utilisé partout où l'on a besoin de hasard : mélange des choix de QCM,
 * générateurs d'exercices… La graine rend les tests reproductibles.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Graine aléatoire « vraie » pour l'application. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** Entier uniforme dans [min, max] (bornes incluses). */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Entier non nul dans [min, max]. */
export function randNonZero(rng: Rng, min: number, max: number): number {
  let n = 0;
  while (n === 0) n = randInt(rng, min, max);
  return n;
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Mélange de Fisher–Yates (renvoie une copie). */
export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Tire `n` éléments distincts. */
export function sample<T>(arr: readonly T[], n: number, rng: Rng = Math.random): T[] {
  return shuffle(arr, rng).slice(0, n);
}
