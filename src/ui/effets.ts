/**
 * Effets de jeu : sons (synthétisés en WebAudio, aucun fichier à charger),
 * confettis, toasts, « +XP » flottant. Désactivables dans les réglages.
 */
import { h } from './dom';

/** Réglages lus à la demande (évite une dépendance circulaire avec etat.ts). */
let lireReglages: () => { sons: boolean; animations: boolean } = () => ({ sons: true, animations: true });
export function brancherReglages(f: typeof lireReglages): void {
  lireReglages = f;
}

const animationsReduites = () =>
  !lireReglages().animations || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/* --------------------------- sons -------------------------------- */

let audio: AudioContext | null = null;
type Son = 'juste' | 'faux' | 'niveau' | 'badge' | 'clic' | 'boss';

const PARTITIONS: Record<Son, [number, number][]> = {
  // [fréquence Hz, durée s]
  juste: [
    [660, 0.08],
    [880, 0.12],
  ],
  faux: [
    [220, 0.12],
    [180, 0.16],
  ],
  niveau: [
    [523, 0.1],
    [659, 0.1],
    [784, 0.1],
    [1047, 0.22],
  ],
  badge: [
    [784, 0.08],
    [988, 0.08],
    [1319, 0.18],
  ],
  clic: [[500, 0.03]],
  boss: [
    [196, 0.15],
    [147, 0.15],
    [110, 0.3],
  ],
};

export function jouerSon(son: Son): void {
  if (!lireReglages().sons) return;
  try {
    audio ??= new AudioContext();
    let t = audio.currentTime;
    for (const [f, d] of PARTITIONS[son]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = son === 'faux' || son === 'boss' ? 'sawtooth' : 'triangle';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + d + 0.02);
      t += d * 0.9;
    }
  } catch {
    /* pas d'audio disponible */
  }
}

/* --------------------------- visuels ----------------------------- */

function couche(): HTMLElement {
  let c = document.getElementById('effets');
  if (!c) {
    c = h('div', { id: 'effets', 'aria-hidden': 'true' });
    document.body.appendChild(c);
  }
  return c;
}

export function celebrer(n = 40): void {
  if (animationsReduites()) return;
  const c = couche();
  const couleurs = ['#a78bfa', '#2dd4bf', '#fbbf24', '#f472b6', '#60a5fa'];
  for (let i = 0; i < n; i++) {
    const p = h('span', { class: 'confetti' });
    p.style.left = `${Math.random() * 100}vw`;
    p.style.background = couleurs[i % couleurs.length];
    p.style.animationDelay = `${Math.random() * 0.3}s`;
    p.style.setProperty('--derive', `${(Math.random() - 0.5) * 200}px`);
    c.appendChild(p);
    setTimeout(() => p.remove(), 2200);
  }
}

/** « +20 XP » qui s'envole depuis un élément. */
export function xpFlottant(depuis: Element, texte: string): void {
  if (animationsReduites()) return;
  const r = depuis.getBoundingClientRect();
  const e = h('span', { class: 'xp-flottant' }, texte);
  e.style.left = `${r.left + r.width / 2}px`;
  e.style.top = `${r.top}px`;
  couche().appendChild(e);
  setTimeout(() => e.remove(), 1300);
}

/** Petit secouement d'un élément (mauvaise réponse). */
export function secouer(el: Element): void {
  if (animationsReduites()) return;
  el.classList.remove('secoue');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('secoue');
}

let pile: HTMLElement | null = null;
export function toast(message: string, genre: 'info' | 'badge' | 'niveau' | 'erreur' = 'info', duree = 3200): void {
  if (!pile || !pile.isConnected) {
    pile = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(pile);
  }
  const t = h('div', { class: `toast toast-${genre}` }, message);
  pile.appendChild(t);
  setTimeout(() => t.classList.add('sortie'), duree);
  setTimeout(() => t.remove(), duree + 500);
}
