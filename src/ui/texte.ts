/**
 * Rendu des textes du contenu : LaTeX ($…$ et $$…$$) via KaTeX, **gras**, *italique*,
 * retours à la ligne. Les morceaux non mathématiques sont échappés (pas d'injection HTML).
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { echapper, h } from './dom';

const cache = new Map<string, string>();

export function latex(tex: string, bloc = false): string {
  const k = `${bloc ? 'B' : 'I'}${tex}`;
  let html = cache.get(k);
  if (html === undefined) {
    html = katex.renderToString(tex, { displayMode: bloc, throwOnError: false, strict: 'ignore', output: 'html' });
    if (cache.size > 2000) cache.clear();
    cache.set(k, html);
  }
  return html;
}

function texteSimple(s: string): string {
  return echapper(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br>');
}

/** Convertit un texte du contenu en HTML sûr. */
export function rendreHtml(texte: string): string {
  const morceaux = texte.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
  return morceaux
    .map((m) => {
      if (m.startsWith('$$') && m.endsWith('$$') && m.length > 4) return latex(m.slice(2, -2), true);
      if (m.startsWith('$') && m.endsWith('$') && m.length > 2) return latex(m.slice(1, -1));
      return texteSimple(m);
    })
    .join('');
}

/** Élément contenant un texte rendu. */
export function riche<K extends keyof HTMLElementTagNameMap>(tag: K, texte: string, classe?: string): HTMLElementTagNameMap[K] {
  return h(tag, { class: classe, html: rendreHtml(texte) });
}
