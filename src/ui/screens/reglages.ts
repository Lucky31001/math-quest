/** Réglages : sons, animations, export / import / réinitialisation de la progression. */
import { h } from '../dom';
import { etat } from '../etat';
import { exporter, importer, progressionVide } from '../../storage/progression';
import { toast, jouerSon } from '../effets';

export function ecranReglages(main: HTMLElement): void {
  const p = etat.p;
  const interrupteur = (libelle: string, valeur: boolean, f: (v: boolean) => void) =>
    h(
      'label',
      { class: 'interrupteur' },
      h('input', { type: 'checkbox', checked: valeur, onchange: (e: Event) => f((e.target as HTMLInputElement).checked) }),
      h('span', { class: 'glissiere' }),
      libelle,
    );

  const fichier = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fichier.addEventListener('change', async () => {
    const f = fichier.files?.[0];
    if (!f) return;
    const res = importer(await f.text());
    if (!res.ok) return toast(`❌ ${res.message}`, 'erreur');
    if (!confirm('Remplacer ta progression actuelle par celle du fichier ?')) return;
    etat.remplacer(res.progression);
    toast('✅ Progression importée.');
    location.hash = '#/';
  });

  main.append(
    h('h1', null, '⚙️ Réglages'),
    h(
      'section',
      { class: 'carte-info' },
      h('h2', null, 'Effets'),
      interrupteur('Sons', p.reglages.sons, (v) => {
        etat.modifier((q) => (q.reglages.sons = v));
        if (v) jouerSon('juste');
      }),
      interrupteur('Animations (confettis, XP flottants)', p.reglages.animations, (v) => etat.modifier((q) => (q.reglages.animations = v))),
    ),
    h(
      'section',
      { class: 'carte-info' },
      h('h2', null, 'Sauvegarde'),
      h('p', null, 'Ta progression est enregistrée dans ce navigateur (localStorage). Exporte-la pour la transférer sur un autre appareil (ex. du PC au téléphone).'),
      h(
        'div',
        { class: 'actions' },
        h(
          'button',
          {
            class: 'btn btn-primaire',
            type: 'button',
            onclick: () => {
              const blob = new Blob([exporter(etat.p)], { type: 'application/json' });
              const a = h('a', { href: URL.createObjectURL(blob), download: `math-quest-${etat.aujourdhui()}.json` });
              document.body.append(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            },
          },
          '⬇️ Exporter (JSON)',
        ),
        h('button', { class: 'btn', type: 'button', onclick: () => fichier.click() }, '⬆️ Importer'),
        fichier,
      ),
    ),
    h(
      'section',
      { class: 'carte-info zone-danger' },
      h('h2', null, 'Zone de danger'),
      h(
        'button',
        {
          class: 'btn btn-danger',
          type: 'button',
          onclick: () => {
            if (!confirm('Effacer TOUTE ta progression (XP, badges, statistiques) ? Pense à exporter avant.')) return;
            const vide = progressionVide();
            vide.reglages = { ...etat.p.reglages };
            etat.remplacer(vide);
            toast('Progression réinitialisée.');
            location.hash = '#/';
          },
        },
        '🗑️ Réinitialiser la progression',
      ),
    ),
  );
}
