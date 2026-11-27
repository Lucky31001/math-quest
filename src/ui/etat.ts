/**
 * État global de l'application : la progression (sauvegardée à chaque modification)
 * et les notifications de jeu (XP, niveau, badges).
 */
import { INDEX, toutesLesMatieres } from '../core/loader';
import { chargerAvecRapport, sauvegarder, type Progression, type RapportChargement } from '../storage/progression';
import { listeBadges, nouveauxBadges, type Badge } from '../game/badges';
import { niveauDepuisXp, titre } from '../game/xp';
import { jour } from '../game/dates';
import { toast, celebrer, jouerSon } from './effets';
import { nombre } from '../core/francais';

export const BADGES: Badge[] = listeBadges(INDEX.chapitres, toutesLesMatieres());

const chargement = chargerAvecRapport();
let progression: Progression = chargement.progression;
/** Ce qui s'est passé au chargement de la sauvegarde (affiché dans les Réglages). */
export const rapportChargement: RapportChargement = chargement.rapport;
/**
 * Sauvegarde créée par une version PLUS RÉCENTE : on ne l'écrase pas (un simple
 * rechargement de la page suffit à récupérer la bonne version). Un import ou une
 * réinitialisation explicite lève ce verrou.
 */
let ecritureBloquee = rapportChargement.statut === 'version-future';
const enregistrer = (): void => {
  if (!ecritureBloquee) sauvegarder(progression);
};
const abonnes = new Set<() => void>();

export const etat = {
  get p(): Progression {
    return progression;
  },
  aujourdhui: (): string => jour(),
  /** Remplace toute la progression (import / réinitialisation). */
  remplacer(p: Progression): void {
    progression = p;
    ecritureBloquee = false;
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
    enregistrer();
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

/** Message d'avertissement à afficher si la sauvegarde n'a pas pu être lue telle quelle. */
export function avertissementChargement(r: RapportChargement = rapportChargement): string | null {
  switch (r.statut) {
    case 'reparee':
      return `⚠️ Une partie de ta sauvegarde était illisible : ${nombre(r.perdus.length, 'élément réinitialisé', 'éléments réinitialisés')}, le reste est conservé.`;
    case 'reinitialisee':
      return '⚠️ Ta sauvegarde était illisible : la progression repart de zéro.';
    case 'version-future':
      return '⚠️ Ta sauvegarde vient d’une version plus récente de Math Quest : recharge la page. Rien ne sera enregistré d’ici là.';
    default:
      return null;
  }
}
