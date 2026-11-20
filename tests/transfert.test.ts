/** Transfert de la progression entre appareils, par lien ou QR code (sans serveur). */
import { describe, it, expect } from 'vitest';
import { renderSVG } from 'uqr';
import { progressionVide } from '../src/storage/progression';
import { encoderTransfert, decoderTransfert, lienTransfert, PREFIXE_CODE, QR_MAX } from '../src/storage/transfert';

/** Progression réaliste (≈ 3 mois d'usage régulier). */
function progressionType(questions: number) {
  const p = progressionVide();
  p.xp = 4321;
  for (let i = 0; i < questions; i++)
    p.questions[`chapitre-${i % 30}/q-${i}`] = { boite: 1 + (i % 5), prochaine: '2026-12-01', vues: 3, reussites: 2, derniere: '2026-11-19' };
  p.badges['premiers-pas'] = '2026-09-01';
  p.journal['2026-11-19'] = 12;
  return p;
}

describe('transfert de progression', () => {
  it('aller-retour sans perte', () => {
    const p = progressionType(150);
    const r = decoderTransfert(encoderTransfert(p));
    expect(r.ok && r.progression).toEqual(p);
  });

  it('accepte le lien complet ou le code seul, même coupé par des retours à la ligne', () => {
    const p = progressionType(20);
    const code = encoderTransfert(p);
    const lien = lienTransfert(code, { origin: 'https://exemple.github.io', pathname: '/math-quest/' });
    expect(lien).toBe(`https://exemple.github.io/math-quest/#/transfert/${code}`);
    expect(decoderTransfert(lien).ok).toBe(true);
    expect(decoderTransfert(`  ${code.slice(0, 30)}\n${code.slice(30)} `).ok).toBe(true);
  });

  it('refuse un texte quelconque ou un code tronqué, avec un message', () => {
    expect(decoderTransfert('bonjour')).toMatchObject({ ok: false });
    const code = encoderTransfert(progressionType(50));
    const r = decoderTransfert(code.slice(0, code.length / 2));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/incomplet|invalide/);
  });

  it('refuse une progression invalide (validée comme un import)', async () => {
    const { deflateSync, strToU8 } = await import('fflate');
    const b64 = btoa(String.fromCharCode(...deflateSync(strToU8(JSON.stringify({ progression: { xp: -5 } }))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decoderTransfert(PREFIXE_CODE + b64).ok).toBe(false);
  });

  it('compression : une progression débutante tient dans un QR code', () => {
    const lien = lienTransfert(encoderTransfert(progressionType(60)), { origin: 'https://exemple.github.io', pathname: '/math-quest/' });
    expect(lien.length).toBeLessThanOrEqual(QR_MAX);
    expect(renderSVG(lien, { ecc: 'L' })).toMatch(/^<svg/);
  });
});
