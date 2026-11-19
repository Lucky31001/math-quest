/**
 * Répétition espacée — système de Leitner à 5 boîtes.
 *
 *  boîte : 1    2    3    4    5
 *  revue : 1 j  2 j  4 j  8 j  16 j   (après une bonne réponse)
 *
 * Bonne réponse → boîte suivante. Mauvaise réponse → retour en boîte 1,
 * à revoir le jour même : les questions ratées reviennent donc beaucoup plus souvent.
 */
import { ajouterJours } from './dates';

export const NB_BOITES = 5;
/** Intervalle (jours) avant la prochaine revue, indexé par boîte. */
export const INTERVALLES: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

export interface EntreeLeitner {
  boite: number;
  /** Date (AAAA-MM-JJ) à partir de laquelle l'élément est à revoir. */
  prochaine: string;
  vues: number;
  reussites: number;
  derniere: string;
}

export function apresReponse(e: EntreeLeitner | undefined, correct: boolean, aujourdhui: string): EntreeLeitner {
  const vues = (e?.vues ?? 0) + 1;
  const reussites = (e?.reussites ?? 0) + (correct ? 1 : 0);
  if (!correct) return { boite: 1, prochaine: aujourdhui, vues, reussites, derniere: aujourdhui };
  // Une première réponse juste fait entrer en boîte 2 ; sinon on monte d'une boîte.
  const boite = Math.min(NB_BOITES, (e?.boite ?? 1) + 1);
  return { boite, prochaine: ajouterJours(aujourdhui, INTERVALLES[boite]), vues, reussites, derniere: aujourdhui };
}

export const estDue = (e: EntreeLeitner, aujourdhui: string): boolean => e.prochaine <= aujourdhui;

/** Un élément est « maîtrisé » à partir de la boîte 4. */
export const estMaitrise = (e: EntreeLeitner | undefined): boolean => !!e && e.boite >= 4;
