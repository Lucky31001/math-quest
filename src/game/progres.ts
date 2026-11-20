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

/**
 * Met à jour le streak quotidien. Renvoie true si le streak vient d'augmenter
 * (premier jour validé aujourd'hui).
 */
export function majStreak(p: Progression, aujourdhui: string): boolean {
  const s = p.streak;
  if (s.dernierJour === aujourdhui) return false;
  s.courant = s.dernierJour && ecartJours(s.dernierJour, aujourdhui) === 1 ? s.courant + 1 : 1;
  s.dernierJour = aujourdhui;
  s.record = Math.max(s.record, s.courant);
  return true;
}

/** Nombre de réponses qui forment une « série » en mode infini. */
export const TAILLE_SERIE_INFINIE = 10;

/**
 * Une série d'exercices vient d'être TERMINÉE (bilan atteint, ou 10 réponses en mode
 * infini) : c'est la seule chose qui fait avancer le streak quotidien.
 * Renvoie true si le streak a augmenté aujourd'hui.
 */
export function validerSerie(p: Progression, aujourdhui: string): boolean {
  p.compteurs.series++;
  return majStreak(p, aujourdhui);
}

/** Streak affiché : il retombe à 0 si l'on a sauté un jour (sans attendre la prochaine série). */
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
  /** Réponse en partie juste (QCM à réponses multiples) : part des points, entre 0 et 1. */
  credit?: number;
  /** Pièges dans lesquels l'élève vient de tomber (voir `piegesDe`). */
  pieges?: PiegeTombe[];
}

export interface PiegeTombe {
  cle: string;
  texte: string;
  explication: string;
}

/** Nombre maximal de pièges mémorisés (on oublie d'abord les plus rares et les plus anciens). */
export const MAX_PIEGES = 80;

/** Mémorise les pièges ; renvoie rien. */
export function noterPieges(p: Progression, chapitre: string, pieges: readonly PiegeTombe[], aujourdhui: string): void {
  for (const x of pieges) {
    const e = p.pieges[x.cle];
    p.pieges[x.cle] = { n: (e?.n ?? 0) + 1, chapitre, texte: x.texte, explication: x.explication, derniere: aujourdhui };
  }
  const cles = Object.keys(p.pieges);
  if (cles.length <= MAX_PIEGES) return;
  cles
    .sort((a, b) => p.pieges[a].n - p.pieges[b].n || p.pieges[a].derniere.localeCompare(p.pieges[b].derniere))
    .slice(0, cles.length - MAX_PIEGES)
    .forEach((k) => delete p.pieges[k]);
}

/** Pièges récurrents (au moins `min` fois), du plus fréquent au moins fréquent. */
export function piegesRecurrents(p: Progression, min = 2) {
  return Object.entries(p.pieges)
    .filter(([, e]) => e.n >= min)
    .sort(([, a], [, b]) => b.n - a.n || b.derniere.localeCompare(a.derniere))
    .map(([cle, e]) => ({ cle, ...e }));
}

/** Enregistre une réponse ; renvoie les XP gagnés. */
export function enregistrerReponse(p: Progression, r: InfoReponse, aujourdhui: string): number {
  // (Le streak n'avance plus à chaque réponse : voir validerSerie.)
  p.compteurs.reponses++;
  p.journal[aujourdhui] = (p.journal[aujourdhui] ?? 0) + 1;
  compterStat(p, r.chapitre, r.type, r.correct);
  if (r.pieges?.length) noterPieges(p, r.chapitre, r.pieges, aujourdhui);
  // Leitner : seule une réponse entièrement juste fait monter la question de boîte.
  if (r.cle) p.questions[r.cle] = apresReponse(p.questions[r.cle], r.correct, aujourdhui);
  if (!r.correct) {
    // En partie juste : une part des XP (sans multiplicateur ni combo).
    const partiel = Math.round(XP_PAR_DIFFICULTE[r.difficulte] * Math.min(1, Math.max(0, r.credit ?? 0)));
    p.xp += partiel;
    return partiel;
  }
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
  p.compteurs.flashcards++;
  p.journal[aujourdhui] = (p.journal[aujourdhui] ?? 0) + 1;
  p.flashcards[cle] = apresReponse(p.flashcards[cle], connue, aujourdhui);
  if (!connue) return 0;
  p.xp += XP_FLASHCARD;
  return XP_FLASHCARD;
}
