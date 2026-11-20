/** Accueil d'un défi reçu (#/defi/<code>) : sujet, note à battre, puis « Commencer ». */
import { h } from '../dom';
import { decoderDefi } from '../../game/defi';
import { EXAMEN } from '../../game/modes';
import { matiereParId, styleMatiere } from '../../core/loader';

export function ecranDefi(main: HTMLElement, params: string[]): void {
  const code = params.join('/');
  const defi = decoderDefi(code);
  const matiere = defi ? matiereParId(defi.matiere) : undefined;
  if (!defi || !matiere) {
    main.append(h('h1', null, '🤝 Défi'), h('div', { class: 'carte-vide', role: 'alert' }, h('p', null, '❌ Ce lien de défi est invalide ou incomplet.'), h('a', { class: 'btn', href: '#/' }, 'Accueil')));
    return;
  }
  const fr = (n: number) => `${String(n).replace('.', ',')}/20`;
  main.append(
    h(
      'section',
      { class: 'carte-info defi', style: styleMatiere(matiere) },
      h('h1', null, `🤝 Défi : examen blanc de ${matiere.nom}`),
      h('p', null, `Un camarade te propose exactement le même sujet que lui : ${defi.questions.length} questions, ${EXAMEN.duree / 60} minutes, sans correction avant la fin.`),
      defi.note !== undefined ? h('p', { class: 'defi-note' }, `Note à battre : `, h('strong', null, fr(defi.note))) : null,
      h('div', { class: 'actions' }, h('a', { class: 'btn btn-primaire', href: `#/jouer/examen/${matiere.id}/${code}` }, '▶ Commencer'), h('a', { class: 'btn', href: '#/' }, 'Plus tard')),
    ),
  );
}
