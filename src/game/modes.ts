/**
 * Construction des séries de questions pour chaque mode de jeu.
 * Pur (pas de DOM) : prend le contenu, la progression et un générateur aléatoire.
 */
import type { Chapitre, ChapitreResume, Difficulte, Question } from '../core/schema';
import { cle } from '../core/loader';
import { shuffle, pick, type Rng } from '../core/random';
import { generateursDu, generer, GENERATEURS } from '../generators';
import type { Progression } from '../storage/progression';
import { estDue, estMaitrise } from './leitner';

export type Mode = 'entrainement' | 'infini' | 'boss' | 'survie' | 'eclair' | 'revision' | 'examen';

export interface ItemSession {
  question: Question;
  chapitre: Chapitre;
  /** Clé Leitner (questions fixes) ou null (questions générées). */
  cle: string | null;
}

const fixe = (chapitre: Chapitre, question: Question): ItemSession => ({ question, chapitre, cle: cle(chapitre.id, question.id) });

/** Une question générée pour ce chapitre (null si le chapitre n'a pas de générateur). */
export function itemGenere(chapitre: Chapitre, difficulte: Difficulte, rng: Rng, forme?: 'qcm' | 'libre'): ItemSession | null {
  let gens = generateursDu(chapitre.id);
  if (forme) gens = gens.filter((g) => g.formes.includes(forme));
  if (!gens.length) return null;
  const g = pick(rng, gens);
  return { question: generer(g, difficulte, forme, Math.floor(rng() * 2 ** 31)), chapitre, cle: null };
}

/**
 * Entraînement sur un chapitre : jusqu'à 10 questions, en priorité les questions
 * fixes pas encore maîtrisées, complétées par des questions générées.
 */
export function serieEntrainement(chapitre: Chapitre, p: Progression, difficulte: Difficulte | null, rng: Rng, n = 10): ItemSession[] {
  const fixes = chapitre.exercices.filter((q) => difficulte === null || q.difficulte === difficulte);
  const [aTravailler, maitrisees] = [
    fixes.filter((q) => !estMaitrise(p.questions[cle(chapitre.id, q.id)])),
    fixes.filter((q) => estMaitrise(p.questions[cle(chapitre.id, q.id)])),
  ];
  const nbGen = generateursDu(chapitre.id).length ? Math.max(3, n - aTravailler.length) : 0;
  const choisies = [...shuffle(aTravailler, rng), ...shuffle(maitrisees, rng)].slice(0, n - Math.min(nbGen, 3));
  const items = choisies.map((q) => fixe(chapitre, q));
  while (items.length < n) {
    const g = itemGenere(chapitre, difficulte ?? pick(rng, [1, 2, 3] as const), rng);
    if (!g) break;
    items.push(g);
  }
  return shuffle(items, rng);
}

/** Boss de fin de chapitre : 10 questions dont 6 QCM, plutôt difficiles. */
export function serieBoss(chapitre: Chapitre, rng: Rng): ItemSession[] {
  const diff = (): Difficulte => pick(rng, [2, 2, 3] as const);
  const qcmFixes = shuffle(chapitre.exercices.filter((q) => q.type === 'qcm'), rng);
  // Pas d'exercice « programme » sous le chronomètre du boss.
  const autresFixes = shuffle(chapitre.exercices.filter((q) => q.type !== 'qcm' && q.type !== 'programme'), rng);
  const items: ItemSession[] = [];
  // 6 QCM : moitié fixes, moitié générés (si possible)
  for (let i = 0; i < 6; i++) {
    const gen = i % 2 === 1 ? itemGenere(chapitre, diff(), rng, 'qcm') : null;
    const q = gen ?? (qcmFixes.length ? fixe(chapitre, qcmFixes.pop()!) : itemGenere(chapitre, diff(), rng, 'qcm'));
    if (q) items.push(q);
  }
  // 4 autres questions
  for (let i = 0; i < 4; i++) {
    const gen = i % 2 === 1 ? itemGenere(chapitre, diff(), rng, 'libre') : null;
    const q = gen ?? (autresFixes.length ? fixe(chapitre, autresFixes.pop()!) : itemGenere(chapitre, diff(), rng, 'libre'));
    if (q) items.push(q);
  }
  // Compléter avec ce qu'il reste si le chapitre est petit.
  const reste = shuffle([...qcmFixes, ...autresFixes], rng);
  while (items.length < 10 && reste.length) items.push(fixe(chapitre, reste.pop()!));
  return shuffle(items, rng);
}

/** Durée (s) accordée pour une question en mode Boss. */
export const dureeBoss = (q: Question): number => (q.type === 'qcm' ? 45 : q.type === 'vrai-faux' || q.type === 'trouve-erreur' ? 60 : 90) + (q.difficulte === 3 ? 30 : 0);

/** Survie : une question au hasard parmi tous les chapitres, de plus en plus difficile. */
export function itemSurvie(chapitres: readonly Chapitre[], rang: number, rng: Rng): ItemSession {
  const difficulte: Difficulte = rang < 5 ? 1 : rang < 15 ? 2 : 3;
  const chapitre = pick(rng, chapitres);
  // Survie : questions rapides, sans exercice « programme ».
  const rapides = chapitre.exercices.filter((q) => q.type !== 'programme');
  const fixes = rapides.filter((q) => q.difficulte <= difficulte);
  if (rng() < 0.5 || !fixes.length) {
    const g = itemGenere(chapitre, difficulte, rng);
    if (g) return g;
  }
  return fixe(chapitre, pick(rng, fixes.length ? fixes : rapides));
}

/** QCM éclair : 20 QCM de tous les chapitres (fixes et générés). */
export function serieEclair(chapitres: readonly Chapitre[], rng: Rng, n = 20): ItemSession[] {
  const fixes = shuffle(
    chapitres.flatMap((c) => c.exercices.filter((q) => q.type === 'qcm').map((q) => fixe(c, q))),
    rng,
  );
  const items: ItemSession[] = [];
  // Seulement les générateurs dont le chapitre est chargé.
  const gens = GENERATEURS.filter((g) => g.formes.includes('qcm') && chapitres.some((c) => c.id === g.chapitre));
  while (items.length < n) {
    if ((items.length % 3 === 2 || !fixes.length) && gens.length) {
      const g = pick(rng, gens);
      const chapitre = chapitres.find((c) => c.id === g.chapitre)!;
      items.push({ question: generer(g, pick(rng, [1, 2] as const), 'qcm', Math.floor(rng() * 2 ** 31)), chapitre, cle: null });
      continue;
    }
    if (!fixes.length) break;
    items.push(fixes.pop()!);
  }
  return items;
}

/** Nombre de questions et durée (s) d'un examen blanc. */
export const EXAMEN = { questions: 20, duree: 30 * 60 } as const;

/**
 * Examen blanc d'une matière : questions fixes de tous ses chapitres, réparties
 * équitablement (tour à tour), sans exercice « programme » ; complété par des
 * questions générées si la matière en a trop peu.
 */
export function serieExamen(chapitres: readonly Chapitre[], rng: Rng, n: number = EXAMEN.questions): ItemSession[] {
  const piles = shuffle(chapitres, rng).map((c) => ({ c, qs: shuffle(c.exercices.filter((q) => q.type !== 'programme'), rng) }));
  const items: ItemSession[] = [];
  while (items.length < n && piles.some((p) => p.qs.length))
    for (const p of piles) {
      const q = p.qs.pop();
      if (q && items.length < n) items.push(fixe(p.c, q));
    }
  for (let essais = 0; items.length < n && essais < 10 * n; essais++) {
    const g = itemGenere(pick(rng, chapitres), pick(rng, [1, 2, 3] as const), rng);
    if (g) items.push(g);
  }
  return shuffle(items, rng);
}

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

/**
 * Révision du jour : questions dues ; s'il n'y en a pas assez, on complète avec
 * le chapitre le plus faible (taux de réussite le plus bas parmi ceux déjà travaillés).
 */
export function serieRevision(chapitres: readonly Chapitre[], p: Progression, aujourdhui: string, rng: Rng, n = 10): ItemSession[] {
  const items: ItemSession[] = questionsDues(chapitres, p, aujourdhui, n);
  if (items.length >= n) return items;
  const faible = pointsFaibles(chapitres, p)[0];
  if (faible) {
    const deja = new Set(items.map((i) => i.cle));
    const extra = serieEntrainement(faible.chapitre, p, null, rng, n - items.length).filter((i) => !i.cle || !deja.has(i.cle));
    items.push(...extra);
  }
  return items;
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
