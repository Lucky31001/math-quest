/** XP, niveaux et titres. */
import type { Difficulte } from '../core/schema';

export const XP_PAR_DIFFICULTE: Record<Difficulte, number> = { 1: 10, 2: 20, 3: 30 };
/** Prix d'un indice. */
export const COUT_INDICE = 5;
/** XP pour une flashcard connue. */
export const XP_FLASHCARD = 3;

/** XP total nécessaire pour atteindre le niveau n (niveau 1 = 0 XP, 2 = 100, 3 = 300, 4 = 600…). */
export const seuilNiveau = (n: number): number => 50 * n * (n - 1);

export interface InfoNiveau {
  niveau: number;
  /** XP gagnés depuis le début du niveau. */
  xpDansNiveau: number;
  /** XP à gagner pour passer au niveau suivant (depuis le début du niveau). */
  xpPourSuivant: number;
  /** Progression dans le niveau, entre 0 et 1. */
  progression: number;
}

export function niveauDepuisXp(xp: number): InfoNiveau {
  let n = 1;
  while (seuilNiveau(n + 1) <= xp) n++;
  const debut = seuilNiveau(n);
  const total = seuilNiveau(n + 1) - debut;
  return { niveau: n, xpDansNiveau: xp - debut, xpPourSuivant: total, progression: (xp - debut) / total };
}

/** Titres débloqués selon le niveau (du plus bas au plus haut). */
export const TITRES: readonly { niveau: number; titre: string }[] = [
  { niveau: 1, titre: 'Bachelier perdu' },
  { niveau: 3, titre: 'Apprenti calculateur' },
  { niveau: 5, titre: 'Chasseur de racines' },
  { niveau: 7, titre: "Dompteur d'epsilons" },
  { niveau: 10, titre: 'Jongleur de matrices' },
  { niveau: 13, titre: 'Intégrateur fou' },
  { niveau: 16, titre: 'Maître des DL' },
  { niveau: 20, titre: 'Légende du pivot de Gauss' },
  { niveau: 25, titre: 'Grand Ordonnateur de CY' },
];

export function titre(niveau: number): string {
  let t = TITRES[0].titre;
  for (const x of TITRES) if (niveau >= x.niveau) t = x.titre;
  return t;
}

/** Points du mode QCM éclair : 100 par bonne réponse, +25 par réponse d'affilée (plafond 200). */
export const pointsEclair = (combo: number): number => Math.min(200, 100 + 25 * (combo - 1));
