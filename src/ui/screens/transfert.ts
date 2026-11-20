/**
 * Réception d'une progression transférée (lien `#/transfert/<code>`) : résumé
 * de ce qui va être importé, comparé à la progression actuelle, puis confirmation.
 * Le lien est retiré de l'historique dès qu'on quitte l'écran par ses boutons.
 */
import { h } from '../dom';
import { etat } from '../etat';
import { toast } from '../effets';
import { ecranApresChargement } from '../chargement';
import { niveauDepuisXp, titre } from '../../game/xp';
import type { Progression } from '../../storage/progression';

function resume(p: Progression): [string, string][] {
  const n = niveauDepuisXp(p.xp).niveau;
  const jours = Object.keys(p.journal).sort();
  const derniere = p.streak.dernierJour ?? jours[jours.length - 1] ?? null;
  return [
    ['Niveau', `${n} · ${titre(n)} (${p.xp} XP)`],
    ['Questions suivies', String(Object.keys(p.questions).length)],
    ['Flashcards suivies', String(Object.keys(p.flashcards).length)],
    ['Badges', String(Object.keys(p.badges).length)],
    ['Dernière activité', derniere ? new Date(derniere).toLocaleDateString('fr-FR') : '—'],
  ];
}

export function ecranTransfert(main: HTMLElement, params: string[]): () => void {
  const quitter = () => location.replace('#/'); // remplace l'entrée : le code ne reste pas dans l'historique
  return ecranApresChargement(main, () => import('../../storage/transfert'), ({ decoderTransfert }) => {
    const res = decoderTransfert(params.join('/'));
    if (!res.ok) {
      main.append(
        h('h1', null, '📲 Transfert'),
        h('div', { class: 'carte-vide', role: 'alert' }, h('p', null, `❌ ${res.message}`), h('a', { class: 'btn', href: '#/reglages' }, 'Réglages')),
      );
      return;
    }
    const recue = resume(res.progression);
    const actuelle = resume(etat.p);
    main.append(
      h('h1', null, '📲 Progression reçue'),
      h('p', { class: 'intro' }, 'Elle vient d’un autre appareil. Vérifie que c’est bien la tienne avant de l’importer.'),
      h(
        'table',
        { class: 'table-transfert' },
        h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Reçue'), h('th', null, 'Sur cet appareil'))),
        h(
          'tbody',
          null,
          recue.map(([libelle, valeur], i) => h('tr', null, h('th', null, libelle), h('td', null, valeur), h('td', null, actuelle[i][1]))),
        ),
      ),
      h('p', { class: 'note' }, '⚠️ Importer remplace la progression de cet appareil (pense à l’exporter avant si tu veux la garder).'),
      h(
        'div',
        { class: 'actions' },
        h(
          'button',
          {
            class: 'btn btn-primaire',
            type: 'button',
            onclick: () => {
              if (!confirm('Remplacer la progression de cet appareil par celle reçue ?')) return;
              const reglages = { ...etat.p.reglages };
              etat.remplacer({ ...res.progression, reglages });
              toast('✅ Progression importée.');
              quitter();
            },
          },
          '⬇️ Importer cette progression',
        ),
        h('button', { class: 'btn', type: 'button', onclick: quitter }, 'Annuler'),
      ),
    );
  });
}
