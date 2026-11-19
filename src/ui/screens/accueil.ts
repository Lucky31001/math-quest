/** Accueil : carte des deux mondes (Algèbre, Analyse), révision du jour et modes de jeu. */
import { CONTENU } from '../../core/loader';
import type { Chapitre, Monde } from '../../core/schema';
import { h } from '../dom';
import { etat } from '../etat';
import { maitriseChapitre, questionsDues, flashcardsDues } from '../../game/modes';

const MONDES: Record<Monde, { nom: string; sousTitre: string; embleme: string }> = {
  algebre: { nom: 'Monde Algèbre', sousTitre: 'Structures, calculs et raisonnements', embleme: '🏰' },
  analyse: { nom: 'Monde Analyse', sousTitre: 'Limites, fonctions et infini', embleme: '🌋' },
};

export function ecranAccueil(main: HTMLElement): void {
  const p = etat.p;
  const auj = etat.aujourdhui();
  const nbQ = questionsDues(CONTENU.chapitres, p, auj, 999).length;
  const nbF = flashcardsDues(CONTENU.chapitres, p, auj).length;

  if (CONTENU.erreurs.length)
    main.append(
      h(
        'div',
        { class: 'alerte', role: 'alert' },
        h('strong', null, `⚠️ ${CONTENU.erreurs.length} fichier(s) de contenu invalide(s) ont été ignorés :`),
        h('ul', null, CONTENU.erreurs.map((e) => h('li', null, h('code', null, e.fichier), h('ul', null, e.messages.slice(0, 5).map((m) => h('li', null, m)))))),
      ),
    );

  main.append(
    h(
      'section',
      { class: 'tableau-accueil' },
      h(
        'a',
        { class: `carte-action revision ${nbQ + nbF ? 'a-faire' : ''}`, href: '#/revision' },
        h('span', { class: 'carte-icone' }, '📅'),
        h('strong', null, 'Révision du jour'),
        h('span', null, nbQ + nbF ? `${nbQ} question(s) et ${nbF} flashcard(s) à revoir` : 'Tout est à jour ✨'),
      ),
      h(
        'a',
        { class: 'carte-action survie', href: '#/jouer/survie' },
        h('span', { class: 'carte-icone' }, '🛡️'),
        h('strong', null, 'Survie'),
        h('span', null, `Tous chapitres, jusqu'à la 1re erreur · record ${p.records.survie}`),
      ),
      h(
        'a',
        { class: 'carte-action eclair', href: '#/jouer/eclair' },
        h('span', { class: 'carte-icone' }, '⚡'),
        h('strong', null, 'QCM éclair'),
        h('span', null, `20 QCM en 3 min, combos · record ${p.records.eclair} pts`),
      ),
    ),
  );

  const carte = h('section', { class: 'carte-mondes', 'aria-label': 'Carte de progression' });
  for (const monde of ['algebre', 'analyse'] as const) {
    const chapitres = CONTENU.chapitres.filter((c) => c.monde === monde);
    const recommande = chapitres.find((c) => maitriseChapitre(p, c) < 0.5);
    const vaincus = chapitres.filter((c) => p.records.boss[c.id]?.vaincu).length;
    carte.append(
      h(
        'div',
        { class: `monde monde-${monde}` },
        h(
          'header',
          { class: 'monde-entete' },
          h('span', { class: 'monde-embleme' }, MONDES[monde].embleme),
          h('div', null, h('h2', null, MONDES[monde].nom), h('p', null, MONDES[monde].sousTitre)),
          h('span', { class: 'monde-boss', title: 'Boss vaincus' }, `👑 ${vaincus}/${chapitres.length}`),
        ),
        h('ol', { class: 'chemin' }, chapitres.map((c, i) => zone(c, i, c === recommande))),
      ),
    );
  }
  main.append(carte);
}

function zone(c: Chapitre, i: number, recommande: boolean): HTMLElement {
  const p = etat.p;
  const m = Math.round(maitriseChapitre(p, c) * 100);
  const boss = p.records.boss[c.id];
  return h(
    'li',
    { class: `zone ${i % 2 ? 'droite' : 'gauche'} ${recommande ? 'recommandee' : ''} ${boss?.vaincu ? 'conquise' : ''}` },
    h(
      'a',
      { href: `#/chapitre/${c.id}`, class: 'zone-lien', 'aria-label': `${c.titre}, maîtrise ${m} %` },
      h('span', { class: 'zone-noeud', style: `--maitrise:${m}` }, h('span', { class: 'zone-icone' }, c.icone), boss?.vaincu ? h('span', { class: 'couronne', title: 'Boss vaincu' }, '👑') : null),
      h('span', { class: 'zone-texte' }, h('strong', null, `${c.ordre}. ${c.titre}`), h('span', null, recommande ? `${m} % · ▶ recommandé` : `${m} % maîtrisé`)),
    ),
  );
}
