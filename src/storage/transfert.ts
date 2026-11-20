/**
 * Transfert de la progression d'un appareil à l'autre, SANS serveur : la
 * progression (même format que l'export JSON) est compressée puis encodée
 * dans un lien `…#/transfert/<code>`.
 *
 * Le code est dans le fragment (#) de l'URL : il n'est jamais envoyé au
 * serveur. Il passe par le partage natif, le presse-papiers, ou un QR code
 * quand il est assez court pour être scanné.
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { exporter, importer, type Progression } from './progression';

/** Préfixe d'un code de transfert (version du format). */
export const PREFIXE_CODE = 'MQ1-';
/** Chemin de l'écran de réception. */
export const ROUTE_TRANSFERT = '#/transfert/';
/** Au-delà, le QR code devient trop dense pour être scanné sur un écran. */
export const QR_MAX = 1200;

function versBase64Url(octets: Uint8Array): string {
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64Url(texte: string): Uint8Array {
  const b64 = texte.replace(/-/g, '+').replace(/_/g, '/');
  const binaire = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
}

/** Code de transfert d'une progression. */
export function encoderTransfert(p: Progression): string {
  return PREFIXE_CODE + versBase64Url(deflateSync(strToU8(exporter(p)), { level: 9 }));
}

/** Lien complet à ouvrir sur l'autre appareil. */
export function lienTransfert(code: string, adresse: Pick<Location, 'origin' | 'pathname'> = location): string {
  return `${adresse.origin}${adresse.pathname}${ROUTE_TRANSFERT}${code}`;
}

/**
 * Lit un code ou un lien de transfert collé par l'élève (espaces et retours à la
 * ligne tolérés) ; la progression est validée comme un import de fichier.
 */
export function decoderTransfert(saisie: string): { ok: true; progression: Progression } | { ok: false; message: string } {
  const texte = saisie.replace(/\s+/g, '');
  const i = texte.indexOf(PREFIXE_CODE);
  if (i < 0) return { ok: false, message: 'Ce n’est pas un lien ou un code de transfert Math Quest.' };
  let json: string;
  try {
    json = strFromU8(inflateSync(depuisBase64Url(texte.slice(i + PREFIXE_CODE.length))));
  } catch {
    return { ok: false, message: 'Code de transfert incomplet ou abîmé : recopie-le en entier.' };
  }
  return importer(json);
}
