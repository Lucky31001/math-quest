/** Collection de badges. */
import { h } from '../dom';
import { etat, BADGES } from '../etat';
import { TITRES, niveauDepuisXp } from '../../game/xp';

export function ecranBadges(main: HTMLElement): void {
  const p = etat.p;
  const obtenus = BADGES.filter((b) => p.badges[b.id]).length;
  const niveau = niveauDepuisXp(p.xp).niveau;
  main.append(
    h('h1', null, `🏅 Badges (${obtenus}/${BADGES.length})`),
    h(
      'div',
      { class: 'grille-badges' },
      BADGES.map((b) => {
        const date = p.badges[b.id];
        return h(
          'div',
          { class: `badge ${date ? 'obtenu' : 'verrouille'}`, title: date ? `Obtenu le ${date}` : 'Pas encore obtenu' },
          h('span', { class: 'badge-icone' }, date ? b.icone : '🔒'),
          h('strong', null, b.nom),
          h('small', null, b.description),
        );
      }),
    ),
    h('h2', null, '🎖️ Titres'),
    h(
      'ol',
      { class: 'liste-titres' },
      TITRES.map((t) => h('li', { class: niveau >= t.niveau ? 'obtenu' : '' }, h('span', null, `Niv. ${t.niveau}`), ' ', t.titre)),
    ),
  );
}
