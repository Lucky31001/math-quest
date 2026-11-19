/**
 * État global de l'application : la progression (sauvegardée à chaque modification)
 * et les notifications de jeu (XP, niveau, badges).
 */
import { CONTENU, toutesLesMatieres } from '../core/loader';
import { charger, sauvegarder, type Progression } from '../storage/progression';
import { listeBadges, nouveauxBadges, type Badge } from '../game/badges';
import { niveauDepuisXp, titre } from '../game/xp';
import { jour } from '../game/dates';
import { toast, celebrer, jouerSon } from './effets';

export const BADGES: Badge[] = listeBadges(CONTENU.chapitres, toutesLesMatieres());

let progression: Progression = charger();
const abonnes = new Set<() => void>();

export const etat = {
  get p(): Progression {
    return progression;
  },
  aujourdhui: (): string => jour(),
  /** Remplace toute la progression (import / réinitialisation). */
  remplacer(p: Progression): void {
    progression = p;
    sauvegarder(progression);
    abonnes.forEach((f) => f());
  },
  /**
   * Applique une modification, sauvegarde, puis gère les conséquences :
   * passage de niveau, badges débloqués, rafraîchissement de l'en-tête.
   */
  modifier<T>(f: (p: Progression) => T): T {
    const niveauAvant = niveauDepuisXp(progression.xp).niveau;
    const r = f(progression);
    const niveauApres = niveauDepuisXp(progression.xp).niveau;
    const badges = nouveauxBadges(progression, BADGES, jour());
    sauvegarder(progression);
    if (niveauApres > niveauAvant) {
      toast(`⬆️ Niveau ${niveauApres} ! Titre : « ${titre(niveauApres)} »`, 'niveau');
      celebrer();
      jouerSon('niveau');
    }
    for (const b of badges) {
      toast(`${b.icone} Badge débloqué : ${b.nom}`, 'badge');
      jouerSon('badge');
    }
    abonnes.forEach((g) => g());
    return r;
  },
  /** S'abonner aux changements (pour l'en-tête). Renvoie la fonction de désabonnement. */
  surChangement(f: () => void): () => void {
    abonnes.add(f);
    return () => abonnes.delete(f);
  },
};
