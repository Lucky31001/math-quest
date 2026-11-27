/** Collection de badges, par famille, avec l'avancement vers ceux qui restent à obtenir. */
import { h } from '../dom';
import { etat, BADGES } from '../etat';
import { CATEGORIES_BADGES, type Badge } from '../../game/badges';
import { TITRES, niveauDepuisXp } from '../../game/xp';

function carteBadge(b: Badge): HTMLElement {
  const p = etat.p;
  const date = p.badges[b.id];
  const progres = date ? null : b.progres?.(p);
  return h(
    'div',
    { class: `badge ${date ? 'obtenu' : 'verrouille'}`, title: date ? `Obtenu le ${date}` : 'Pas encore obtenu' },
    h('span', { class: 'badge-icone', 'aria-hidden': 'true' }, b.icone),
    h('strong', null, b.nom),
    h('small', null, b.description),
    progres
      ? h(
          'span',
          { class: 'badge-progres', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(progres[1]), 'aria-valuenow': String(progres[0]), 'aria-label': `${progres[0]} sur ${progres[1]}` },
          h('span', { class: 'badge-jauge' }, h('span', { style: `width:${Math.round((progres[0] / progres[1]) * 100)}%` })),
          h('span', { class: 'badge-compte' }, `${progres[0]}/${progres[1]}`),
        )
      : null,
  );
}

export function ecranBadges(main: HTMLElement): void {
  const p = etat.p;
  const obtenus = BADGES.filter((b) => p.badges[b.id]).length;
  const niveau = niveauDepuisXp(p.xp).niveau;
  main.append(
    h('h1', null, `🏅 Badges (${obtenus}/${BADGES.length})`),
    ...CATEGORIES_BADGES.map((categorie) => {
      // Obtenus d'abord, puis les plus avancés.
      const avancement = (b: Badge) => (p.badges[b.id] ? 2 : b.progres ? b.progres(p)[0] / b.progres(p)[1] : 0);
      const liste = BADGES.filter((b) => b.categorie === categorie).sort((a, b) => avancement(b) - avancement(a));
      if (!liste.length) return null;
      const n = liste.filter((b) => p.badges[b.id]).length;
      return h(
        'section',
        { class: 'famille-badges' },
        h('h2', null, categorie, h('small', null, ` ${n}/${liste.length}`)),
        h('div', { class: 'grille-badges' }, liste.map(carteBadge)),
      );
    }).filter((x): x is HTMLElement => x !== null),
    h('h2', null, '🎖️ Titres'),
    h(
      'ol',
      { class: 'liste-titres' },
      TITRES.map((t) => h('li', { class: niveau >= t.niveau ? 'obtenu' : '' }, h('span', null, `Niv. ${t.niveau}`), ' ', t.titre)),
    ),
  );
}
