/**
 * Effets d'une réponse sur la progression : XP, Leitner, statistiques, streak.
 * Fonctions « pures » sur l'objet Progression (mutation en place), testables sans DOM.
 */
import type { Difficulte, TypeQuestion } from '../core/schema';
import type { Progression } from '../storage/progression';
import { compterStat } from '../storage/progression';
import { apresReponse } from './leitner';
import { XP_PAR_DIFFICULTE, XP_FLASHCARD, COUT_INDICE } from './xp';
import { ecartJours } from './dates';

/** Met à jour le streak quotidien (appelé à chaque activité). */
export function majStreak(p: Progression, aujourdhui: string): void {
  const s = p.streak;
  if (s.dernierJour === aujourdhui) return;
  s.courant = s.dernierJour && ecartJours(s.dernierJour, aujourdhui) === 1 ? s.courant + 1 : 1;
  s.dernierJour = aujourdhui;
  s.record = Math.max(s.record, s.courant);
}

/** Streak affiché : il retombe à 0 si l'on a sauté un jour (sans attendre la prochaine activité). */
export function streakActuel(p: Progression, aujourdhui: string): number {
  const d = p.streak.dernierJour;
  if (!d) return 0;
  return ecartJours(d, aujourdhui) <= 1 ? p.streak.courant : 0;
}

export interface InfoReponse {
  chapitre: string;
  /** Clé Leitner « chapitre/id », ou null pour une question générée. */
  cle: string | null;
  type: TypeQuestion;
  difficulte: Difficulte;
  correct: boolean;
  /** Multiplicateur d'XP (combos, modes spéciaux). */
  multiplicateur?: number;
}

/** Enregistre une réponse ; renvoie les XP gagnés. */
export function enregistrerReponse(p: Progression, r: InfoReponse, aujourdhui: string): number {
  majStreak(p, aujourdhui);
  p.compteurs.reponses++;
  p.journal[aujourdhui] = (p.journal[aujourdhui] ?? 0) + 1;
  compterStat(p, r.chapitre, r.type, r.correct);
  if (r.cle) p.questions[r.cle] = apresReponse(p.questions[r.cle], r.correct, aujourdhui);
  if (!r.correct) return 0;
  p.compteurs.bonnes++;
  if (r.type === 'qcm') p.compteurs.qcmReussis++;
  const gain = Math.round(XP_PAR_DIFFICULTE[r.difficulte] * (r.multiplicateur ?? 1));
  p.xp += gain;
  return gain;
}

/** Payer un indice. Renvoie le coût réellement débité (on ne descend pas sous 0). */
export function payerIndice(p: Progression): number {
  const cout = Math.min(COUT_INDICE, p.xp);
  p.xp -= cout;
  p.compteurs.indices++;
  return cout;
}

/** Auto-évaluation d'une flashcard. */
export function enregistrerFlashcard(p: Progression, cle: string, connue: boolean, aujourdhui: string): number {
  majStreak(p, aujourdhui);
  p.compteurs.flashcards++;
  p.journal[aujourdhui] = (p.journal[aujourdhui] ?? 0) + 1;
  p.flashcards[cle] = apresReponse(p.flashcards[cle], connue, aujourdhui);
  if (!connue) return 0;
  p.xp += XP_FLASHCARD;
  return XP_FLASHCARD;
}
