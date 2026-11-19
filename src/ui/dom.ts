/**
 * Mini-utilitaires DOM (pas de framework) :
 *   h('button', { class: 'btn', onclick: f }, 'Texte', autreNoeud)
 */
type Enfant = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown> & { class?: string; style?: string; dataset?: Record<string, string> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...enfants: (Enfant | Enfant[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs)
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k in el && k !== 'style' && k !== 'class' && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k === 'class' ? 'class' : k, v === true ? '' : String(v));
    }
  ajouter(el, enfants);
  return el;
}

export function ajouter(parent: Node, enfants: (Enfant | Enfant[])[]): void {
  for (const e of enfants.flat()) {
    if (e === null || e === undefined || e === false) continue;
    parent.appendChild(typeof e === 'string' || typeof e === 'number' ? document.createTextNode(String(e)) : e);
  }
}

export function vider(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Échappe le HTML. */
export const echapper = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
