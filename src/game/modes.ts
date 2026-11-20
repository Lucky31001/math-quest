/**
 * Modes de jeu : types communs, et ce que l'accueil, les statistiques et la
 * révision calculent sur l'INDEX (maîtrise, éléments dus, points faibles).
 *
 * Module LÉGER : sans les générateurs ni math.js (chargés seulement à l'ouverture
 * d'un chapitre ou d'une séance). Les séries de questions sont dans series.ts.
 */
import type { Chapitre, ChapitreResume, Question } from '../core/schema';
import { cle } from '../core/loader';
import type { Progression } from '../storage/progression';
import { estDue, estMaitrise } from './leitner';

export type Mode = 'entrainement' | 'infini' | 'boss' | 'survie' | 'eclair' | 'revision' | 'examen';

export interface ItemSession {
  question: Question;
  chapitre: Chapitre;
  /** Clé Leitner (questions fixes) ou null (questions générées). */
  cle: string | null;
}

/** Nombre de questions et durée (s) d'un examen blanc. */
export const EXAMEN = { questions: 20, duree: 30 * 60 } as const;

/** Note sur 20 d'un examen : 1 point par question juste, une part pour un QCM en partie juste. */
export const noteSur20 = (points: number, total: number): number => (total ? Math.round((200 * points) / total) / 10 : 0);

/**
 * Questions fixes à revoir aujourd'hui (Leitner), les plus « en retard » d'abord.
 * Sur des chapitres complets, chaque élément est un `ItemSession` ; sur des
 * résumés (index), il sert à compter ou à savoir quels chapitres charger.
 */
export function questionsDues<C extends ChapitreResume>(chapitres: readonly C[], p: Progression, aujourdhui: string, max = 20) {
  const dues = chapitres.flatMap((c) =>
    c.exercices
      .map((q) => ({ item: { question: q as C['exercices'][number], chapitre: c, cle: cle(c.id, q.id) }, e: p.questions[cle(c.id, q.id)] }))
      .filter((x) => x.e && estDue(x.e, aujourdhui)),
  );
  dues.sort((a, b) => a.e!.boite - b.e!.boite || a.e!.prochaine.localeCompare(b.e!.prochaine));
  return dues.slice(0, max).map((x) => x.item);
}

/** Flashcards à revoir aujourd'hui. */
export function flashcardsDues<C extends ChapitreResume>(chapitres: readonly C[], p: Progression, aujourdhui: string) {
  return chapitres.flatMap((c) =>
    c.flashcards.filter((f) => {
      const e = p.flashcards[cle(c.id, f.id)];
      return e && estDue(e, aujourdhui);
    }).map((f) => ({ chapitre: c, flashcard: f as C['flashcards'][number] })),
  );
}

/** Taux de réussite d'un chapitre (toutes questions confondues). */
export function tauxChapitre(p: Progression, chapitre: string): { tentatives: number; reussites: number; taux: number | null } {
  const s = Object.values(p.stats[chapitre] ?? {});
  const tentatives = s.reduce((a, x) => a + x.tentatives, 0);
  const reussites = s.reduce((a, x) => a + x.reussites, 0);
  return { tentatives, reussites, taux: tentatives ? reussites / tentatives : null };
}

/** Maîtrise d'un chapitre : part des questions fixes en boîte ≥ 4 (0..1). */
export function maitriseChapitre(p: Progression, chapitre: ChapitreResume): number {
  if (!chapitre.exercices.length) return 0;
  const m = chapitre.exercices.filter((q) => estMaitrise(p.questions[cle(chapitre.id, q.id)])).length;
  return m / chapitre.exercices.length;
}

/** Chapitres classés du plus faible au plus fort (parmi ceux ayant ≥ 3 tentatives). */
export function pointsFaibles<C extends Pick<ChapitreResume, 'id'>>(chapitres: readonly C[], p: Progression) {
  return chapitres
    .map((chapitre) => ({ chapitre, ...tauxChapitre(p, chapitre.id) }))
    .filter((x) => x.tentatives >= 3 && x.taux !== null)
    .sort((a, b) => a.taux! - b.taux!);
}

/**
 * Chapitres à charger pour la révision du jour : ceux qui ont des questions
 * dues, plus le point faible (complément quand il y a peu de questions dues).
 */
export function chapitresPourRevision(chapitres: readonly ChapitreResume[], p: Progression, aujourdhui: string, n = 10): string[] {
  const ids = new Set(questionsDues(chapitres, p, aujourdhui, n).map((x) => x.chapitre.id));
  const faible = pointsFaibles(chapitres, p)[0];
  if (faible) ids.add(faible.chapitre.id);
  return [...ids];
}
