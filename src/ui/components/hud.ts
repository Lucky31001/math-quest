/** En-tête permanent : niveau, titre, barre d'XP, streak 🔥, XP ⚡, navigation (onglets en bas sur téléphone). */
import { h, vider } from '../dom';
import { etat } from '../etat';
import { niveauDepuisXp, titre } from '../../game/xp';
import { streakActuel } from '../../game/progres';

const ONGLETS: [string, string, string][] = [
  ['#/', '🏠', 'Accueil'],
  ['#/revision', '📅', 'Révision'],
  ['#/stats', '📊', 'Stats'],
  ['#/badges', '🏅', 'Badges'],
  ['#/reglages', '⚙️', 'Réglages'],
];

export function creerHud(): HTMLElement {
  const el = h('header', { class: 'hud' });
  const nav = h('nav', { class: 'hud-nav', 'aria-label': 'Navigation principale' });
  const majNav = () => {
    const actuel = location.hash || '#/';
    nav.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href')!;
      const actif = href === '#/' ? actuel === '#/' || actuel === '#' : actuel.startsWith(href);
      a.classList.toggle('actif', actif);
      if (actif) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  };
  const rendre = () => {
    const p = etat.p;
    const n = niveauDepuisXp(p.xp);
    const streak = streakActuel(p, etat.aujourdhui());
    const aJoueAujourdhui = p.streak.dernierJour === etat.aujourdhui();
    vider(el);
    vider(nav);
    nav.append(...ONGLETS.map(([href, icone, label]) => h('a', { href, title: label }, h('span', { class: 'nav-icone' }, icone), h('span', { class: 'nav-label' }, label))));
    majNav();
    el.append(
      h('a', { href: '#/', class: 'logo', 'aria-label': 'Accueil' }, h('span', { class: 'logo-sigma' }, 'Σ'), h('span', { class: 'logo-texte' }, 'mathquest')),
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
        ),
      ),
      h(
        'div',
        { class: 'hud-stats' },
        h(
          'span',
          {
            class: `streak${streak ? '' : ' eteint'}${aJoueAujourdhui ? ' allume' : ''}`,
            title: streak ? `${streak} jour(s) d'affilée${aJoueAujourdhui ? '' : " — révise aujourd'hui pour ne pas perdre ta série !"}` : 'Aucune série en cours',
          },
          h('span', { class: 'flamme' }, '🔥'),
          String(streak),
        ),
        h('span', { class: 'xp-total', title: 'XP total' }, '⚡', String(p.xp)),
      ),
      nav,
    );
  };
  rendre();
  etat.surChangement(rendre);
  addEventListener('hashchange', majNav);
  return el;
}
