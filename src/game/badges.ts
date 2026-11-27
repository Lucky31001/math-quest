/**
 * Badges : chacun est une condition sur l'état de la progression.
 * `nouveauxBadges` est appelé après chaque événement et renvoie ceux qui viennent d'être débloqués.
 */
import type { ChapitreResume, Matiere } from '../core/schema';
import type { Progression } from '../storage/progression';
import { cle } from '../core/loader';
import { niveauDepuisXp } from './xp';

/** Familles de badges, dans l'ordre d'affichage. */
export const CATEGORIES_BADGES = ['Réponses', 'Régularité', 'Défis', 'Niveaux', 'Matières', 'Chapitres à 100 %'] as const;
export type CategorieBadge = (typeof CATEGORIES_BADGES)[number];

export interface Badge {
  id: string;
  nom: string;
  description: string;
  icone: string;
  categorie: CategorieBadge;
  test: (p: Progression) => boolean;
  /** Avancement vers le badge : [actuel, cible] (absent si ce n'est pas un compte). */
  progres?: (p: Progression) => [number, number];
}

/** Badge « atteindre `cible` » sur un compteur : le test et la progression viennent de la même valeur. */
const seuil = (valeur: (p: Progression) => number, cible: number) => ({
  test: (p: Progression) => valeur(p) >= cible,
  progres: (p: Progression): [number, number] => [Math.min(valeur(p), cible), cible],
});

const bossVaincus = (p: Progression, chapitres: readonly ChapitreResume[]) =>
  chapitres.filter((c) => p.records.boss[c.id]?.vaincu).length;

/** Nom court d'un chapitre pour le badge « 100 % sur … ». */
const surLe = (c: ChapitreResume) => c.titre.charAt(0).toLowerCase() + c.titre.slice(1);

export function listeBadges(chapitres: readonly ChapitreResume[], matieres: readonly Matiere[] = []): Badge[] {
  const fixes: Badge[] = [
    { id: 'premiers-pas', nom: 'Premiers pas', description: 'Réussir sa première question.', icone: '👣', categorie: 'Réponses', ...seuil((p) => p.compteurs.bonnes, 1) },
    { id: 'centurion', nom: 'Centurion', description: 'Réussir 100 questions.', icone: '💯', categorie: 'Réponses', ...seuil((p) => p.compteurs.bonnes, 100) },
    { id: 'millenaire', nom: 'Millénaire', description: 'Réussir 1000 questions.', icone: '🏛️', categorie: 'Réponses', ...seuil((p) => p.compteurs.bonnes, 1000) },
    { id: 'qcm-50', nom: 'Cocheur fou', description: 'Réussir 50 QCM.', icone: '☑️', categorie: 'Réponses', ...seuil((p) => p.compteurs.qcmReussis, 50) },
    { id: 'flashcards-100', nom: "Mémoire d'éléphant", description: 'Réviser 100 flashcards.', icone: '🐘', categorie: 'Réponses', ...seuil((p) => p.compteurs.flashcards, 100) },
    { id: 'streak-3', nom: 'Ça chauffe', description: '3 jours de révision d\'affilée.', icone: '🔥', categorie: 'Régularité', ...seuil((p) => p.streak.record, 3) },
    { id: 'streak-7', nom: 'Semaine en feu', description: '7 jours d\'affilée.', icone: '🌋', categorie: 'Régularité', ...seuil((p) => p.streak.record, 7) },
    { id: 'streak-30', nom: 'Inarrêtable', description: '30 jours d\'affilée.', icone: '☄️', categorie: 'Régularité', ...seuil((p) => p.streak.record, 30) },
    { id: 'revision-1', nom: 'Élève assidu', description: 'Terminer une révision du jour.', icone: '📅', categorie: 'Régularité', ...seuil((p) => p.compteurs.revisions, 1) },
    { id: 'revision-10', nom: 'Métronome', description: 'Terminer 10 révisions du jour.', icone: '⏱️', categorie: 'Régularité', ...seuil((p) => p.compteurs.revisions, 10) },
    { id: 'boss-1', nom: 'Tueur de boss', description: 'Vaincre un boss de chapitre.', icone: '⚔️', categorie: 'Défis', test: (p) => bossVaincus(p, chapitres) >= 1 },
    { id: 'sans-indice', nom: 'Aucun indice utilisé', description: 'Vaincre un boss sans utiliser d\'indice.', icone: '🧠', categorie: 'Défis', test: (p) => Object.values(p.records.boss).some((b) => b.vaincu && b.sansIndice) },
    { id: 'survie-10', nom: 'Survivant', description: '10 bonnes réponses d\'affilée en mode Survie.', icone: '🛡️', categorie: 'Défis', ...seuil((p) => p.records.survie, 10) },
    { id: 'survie-25', nom: 'Immortel', description: '25 bonnes réponses d\'affilée en mode Survie.', icone: '🧬', categorie: 'Défis', ...seuil((p) => p.records.survie, 25) },
    { id: 'eclair-parfait', nom: 'Éclair parfait', description: '20/20 en QCM éclair.', icone: '⚡', categorie: 'Défis', test: (p) => p.records.eclairParfait },
    { id: 'combo-10', nom: 'Combo ×10', description: '10 bonnes réponses d\'affilée en QCM éclair.', icone: '🎯', categorie: 'Défis', ...seuil((p) => p.records.meilleurCombo, 10) },
    { id: 'examen-10', nom: 'Admis', description: 'Obtenir au moins 10/20 à un examen blanc.', icone: '📝', categorie: 'Défis', test: (p) => Object.values(p.records.examens).some((n) => n >= 10) },
    { id: 'examen-16', nom: 'Mention très bien', description: 'Obtenir au moins 16/20 à un examen blanc.', icone: '🎓', categorie: 'Défis', test: (p) => Object.values(p.records.examens).some((n) => n >= 16) },
    { id: 'niveau-5', nom: 'Niveau 5', description: 'Atteindre le niveau 5.', icone: '⭐', categorie: 'Niveaux', ...seuil((p) => niveauDepuisXp(p.xp).niveau, 5) },
    { id: 'niveau-10', nom: 'Niveau 10', description: 'Atteindre le niveau 10.', icone: '🌟', categorie: 'Niveaux', ...seuil((p) => niveauDepuisXp(p.xp).niveau, 10) },
  ];
  // « 100 % sur <chapitre> » : toutes les questions fixes du chapitre réussies au moins une fois.
  const parfaits: Badge[] = chapitres.map((c) => ({
    id: `parfait-${c.id}`,
    nom: `100 % sur ${surLe(c)}`,
    description: `Réussir au moins une fois chacune des ${c.exercices.length} questions du chapitre « ${c.titre} ».`,
    icone: c.icone,
    categorie: 'Chapitres à 100 %',
    test: (p: Progression) => c.exercices.length > 0 && c.exercices.every((q) => (p.questions[cle(c.id, q.id)]?.reussites ?? 0) > 0),
    progres: (p: Progression): [number, number] => [c.exercices.filter((q) => (p.questions[cle(c.id, q.id)]?.reussites ?? 0) > 0).length, c.exercices.length],
  }));
  // « Conquérant » : tous les boss d'une matière (un badge par matière du catalogue).
  const conquetes: Badge[] = matieres.map((m) => {
    const chs = chapitres.filter((c) => c.monde === m.id);
    return {
      id: `boss-${m.id}`,
      nom: `Conquérant : ${m.nom}`,
      description: `Vaincre tous les boss de la matière « ${m.nom} ».`,
      icone: m.embleme,
      categorie: 'Matières' as const,
      test: (p: Progression) => chs.length > 0 && bossVaincus(p, chs) === chs.length,
      progres: (p: Progression): [number, number] => [bossVaincus(p, chs), chs.length],
    };
  });
  return [...fixes, ...conquetes, ...parfaits];
}

/** Débloque et renvoie les badges nouvellement obtenus. */
export function nouveauxBadges(p: Progression, badges: readonly Badge[], aujourdhui: string): Badge[] {
  const nouveaux = badges.filter((b) => !p.badges[b.id] && b.test(p));
  for (const b of nouveaux) p.badges[b.id] = aujourdhui;
  return nouveaux;
}
