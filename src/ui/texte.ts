/**
 * Rendu des textes du contenu : LaTeX ($…$ et $$…$$) via KaTeX, **gras**, *italique*,
 * retours à la ligne, code (`en ligne` et blocs ```…```). Les morceaux non
 * mathématiques sont échappés (pas d'injection HTML).
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

/** Segments de code : blocs ```…``` (langue facultative sur la 1re ligne) et `en ligne`. */
export const MOTIF_CODE = /(```[\s\S]+?```|`[^`\n]+`)/g;

/**
 * Convertit un texte du contenu en HTML sûr. Le code et les formules sont rendus
 * à part puis réinsérés, ce qui a deux effets :
 * - le contenu du code est seulement échappé (ni LaTeX, ni gras — `x**2` reste intact) ;
 * - le gras et l'italique peuvent les englober (`**continue en $a$**`).
 */
export function rendreHtml(texte: string): string {
  const morceaux: string[] = [];
  const reserver = (html: string) => `\u0000${morceaux.push(html) - 1}\u0000`;
  const sansCode = texte.replace(MOTIF_CODE, (m) => {
    if (m.startsWith('```')) {
      const langage = /^([a-z]*)\n/.exec(m.slice(3))?.[1] ?? '';
      const code = m.slice(3, -3).replace(/^[a-z]*\n/, '').replace(/\n$/, '');
      return reserver(`<pre class="code" data-langage="${langage}"><code>${echapper(code)}</code></pre>`);
    }
    return reserver(`<code>${echapper(m.slice(1, -1))}</code>`);
  });
  const sansFormules = sansCode.replace(/\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g, (_, bloc?: string, enLigne?: string) =>
    reserver(bloc !== undefined ? latex(bloc, true) : latex(enLigne!)),
  );
  return texteSimple(sansFormules).replace(/\u0000(\d+)\u0000/g, (_, i: string) => morceaux[Number(i)]!);
}

/** Élément contenant un texte rendu. */
export function riche<K extends keyof HTMLElementTagNameMap>(tag: K, texte: string, classe?: string): HTMLElementTagNameMap[K] {
  return h(tag, { class: classe, html: rendreHtml(texte) });
}
