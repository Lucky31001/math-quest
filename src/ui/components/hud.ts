/** En-tête permanent : niveau, titre, barre d'XP, streak 🔥, navigation. */
import { h, vider } from '../dom';
import { etat } from '../etat';
import { niveauDepuisXp, titre } from '../../game/xp';
import { streakActuel } from '../../game/progres';

export function creerHud(): HTMLElement {
  const el = h('header', { class: 'hud' });
  const rendre = () => {
    const p = etat.p;
    const n = niveauDepuisXp(p.xp);
    const streak = streakActuel(p, etat.aujourdhui());
    const aJoueAujourdhui = p.streak.dernierJour === etat.aujourdhui();
    vider(el);
    el.append(
      h('a', { href: '#/', class: 'logo', 'aria-label': 'Accueil' }, h('span', { class: 'logo-sigma' }, 'Σ'), h('span', { class: 'logo-texte' }, 'Math Quest')),
      h(
        'div',
        { class: 'hud-joueur' },
        h('span', { class: 'niveau', title: `${p.xp} XP au total` }, `Niv. ${n.niveau}`),
        h(
          'div',
          { class: 'hud-xp' },
          h('span', { class: 'titre-joueur' }, titre(n.niveau)),
          h(
            'div',
            { class: 'barre-xp', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(n.xpPourSuivant), 'aria-valuenow': String(n.xpDansNiveau), 'aria-label': 'XP du niveau' },
            h('div', { class: 'barre-xp-remplie', style: `width:${Math.round(n.progression * 100)}%` }),
          ),
          h('span', { class: 'xp-texte' }, `${n.xpDansNiveau} / ${n.xpPourSuivant} XP`),
        ),
      ),
      h(
        'div',
        {
          class: `streak${streak ? '' : ' eteint'}${aJoueAujourdhui ? ' allume' : ''}`,
          title: streak ? `${streak} jour(s) d'affilée${aJoueAujourdhui ? '' : ' — révise aujourd\'hui pour ne pas perdre ta série !'}` : 'Aucune série en cours',
        },
        h('span', { class: 'flamme' }, '🔥'),
        h('span', null, String(streak)),
      ),
      h(
        'nav',
        { class: 'hud-nav' },
        h('a', { href: '#/revision', title: 'Révision du jour' }, '📅', h('span', { class: 'nav-label' }, 'Révision')),
        h('a', { href: '#/stats', title: 'Tableau de bord' }, '📊', h('span', { class: 'nav-label' }, 'Stats')),
        h('a', { href: '#/badges', title: 'Badges' }, '🏅', h('span', { class: 'nav-label' }, 'Badges')),
        h('a', { href: '#/reglages', title: 'Réglages' }, '⚙️', h('span', { class: 'nav-label' }, 'Réglages')),
      ),
    );
  };
  rendre();
  etat.surChangement(rendre);
  return el;
}
