/** Réglages : sons, animations, export / import / réinitialisation, copies de sécurité. */
import { h, ajouter } from '../dom';
import { etat, avertissementChargement, rapportChargement } from '../etat';
import { exporter, importer, progressionVide, listerCopies, supprimerCopie } from '../../storage/progression';
import { toast, jouerSon } from '../effets';
import { statutStockage, demanderProtection, estIosNavigateur, noterExport, dernierExport, type StatutStockage } from '../../storage/persistance';

/** Propose un fichier texte au téléchargement. */
function telecharger(nom: string, contenu: string): void {
  const blob = new Blob([contenu], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: nom });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Copies brutes d'une sauvegarde illisible, à télécharger avant de les supprimer. */
function sectionCopies(): HTMLElement | null {
  const avertissement = avertissementChargement();
  const copies = listerCopies();
  if (!avertissement && !copies.length) return null;
  const section = h('section', { class: 'carte-info zone-alerte' }, h('h2', null, '🛟 Copies de sécurité'));
  const rendre = (): void => {
    section.replaceChildren(section.firstChild!);
    const restantes = listerCopies();
    ajouter(section, [
      avertissement ? h('p', null, avertissement) : null,
      rapportChargement.perdus.length
        ? h('details', null, h('summary', null, 'Éléments réinitialisés'), h('ul', { class: 'liste-perdus' }, rapportChargement.perdus.map((c) => h('li', null, h('code', null, c)))))
        : null,
      restantes.length
        ? h('p', null, 'Ces copies brutes de ta sauvegarde d’origine ont été conservées. Télécharge-les : une prochaine version pourra peut-être les réimporter.')
        : null,
      h(
        'ul',
        { class: 'liste-copies' },
        restantes.map((c) =>
          h(
            'li',
            null,
            h('span', null, `${new Date(c.date).toLocaleString('fr-FR')} · ${Math.ceil(c.contenu.length / 1024)} Ko`),
            h(
              'span',
              { class: 'actions' },
              h('button', { class: 'btn', type: 'button', onclick: () => telecharger(`math-quest-copie-${c.date.replace(/[:.]/g, '-')}.json`, c.contenu) }, '⬇️ Télécharger'),
              h(
                'button',
                {
                  class: 'btn btn-danger',
                  type: 'button',
                  onclick: () => {
                    if (!confirm('Supprimer définitivement cette copie de sécurité ? Pense à la télécharger avant.')) return;
                    supprimerCopie(c.cle);
                    rendre();
                  },
                },
                '🗑️ Supprimer',
              ),
            ),
          ),
        ),
      ),
    ]);
  };
  rendre();
  return section;
}

/** Libellé du dernier export (« jamais », « aujourd'hui », « le 12/10/2026 »). */
function libelleExport(): string {
  const d = dernierExport();
  if (!d) return 'jamais';
  return d === etat.aujourdhui() ? 'aujourd’hui' : `le ${new Date(d).toLocaleDateString('fr-FR')}`;
}

/** La sauvegarde est-elle à l'abri d'un effacement automatique du navigateur ? */
function etatProtection(): HTMLElement {
  const bloc = h('div', { class: 'protection', role: 'status' }, h('p', null, 'Vérification de la protection…'));
  const rendre = (statut: StatutStockage): void => {
    const conseilIos = estIosNavigateur()
      ? h(
          'p',
          null,
          'Sur iPhone / iPad, Safari efface les données d’un site après 7 jours sans visite. Ajoute Math Quest à l’écran d’accueil (Partager → « Sur l’écran d’accueil ») : l’app installée a son propre stockage, qui n’est pas effacé. Exporte ici puis importe dans l’app installée.',
        )
      : null;
    const pied = h('p', { class: 'discret' }, `Dernier export : ${libelleExport()}.`);
    if (statut === 'protege') {
      bloc.replaceChildren(h('p', null, '🔒 Sauvegarde protégée : le navigateur ne l’effacera pas pour faire de la place.'), pied);
      return;
    }
    const demander =
      statut === 'non-protege'
        ? h(
            'button',
            {
              class: 'btn',
              type: 'button',
              onclick: async () => {
                const s = await demanderProtection();
                rendre(s);
                if (s !== 'protege') toast('Le navigateur a refusé : pense à exporter régulièrement.', 'info');
              },
            },
            '🔒 Protéger la sauvegarde',
          )
        : null;
    bloc.replaceChildren();
    ajouter(bloc, [
      h('p', null, '⚠️ Sauvegarde non protégée : le navigateur peut l’effacer (manque de place, longue absence). Exporte-la régulièrement.'),
      conseilIos,
      demander ? h('div', { class: 'actions' }, demander) : null,
      pied,
    ]);
  };
  void statutStockage().then(rendre);
  return bloc;
}

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

  ajouter(main, [
    h('h1', null, '⚙️ Réglages'),
    sectionCopies(),
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
      etatProtection(),
      h(
        'div',
        { class: 'actions' },
        h(
          'button',
          {
            class: 'btn btn-primaire',
            type: 'button',
            onclick: () => {
              telecharger(`math-quest-${etat.aujourdhui()}.json`, exporter(etat.p));
              noterExport(etat.aujourdhui());
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
  ]);
}
