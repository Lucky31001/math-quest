import { describe, it, expect } from 'vitest';
import { statutStockage, demanderProtection, rappelExportNecessaire, estIosNavigateur, XP_RAPPEL } from '../src/storage/persistance';

describe('protection de la sauvegarde', () => {
  it('statut : protégé, non protégé, ou inconnu sans API', async () => {
    expect(await statutStockage({ persisted: async () => true })).toBe('protege');
    expect(await statutStockage({ persisted: async () => false })).toBe('non-protege');
    expect(await statutStockage(undefined)).toBe('inconnu');
    expect(await statutStockage({ persisted: async () => Promise.reject(new Error('x')) })).toBe('inconnu');
  });

  it('demande la protection seulement si elle manque', async () => {
    let demandes = 0;
    const persist = async () => (demandes++, true);
    expect(await demanderProtection({ persisted: async () => true, persist })).toBe('protege');
    expect(demandes).toBe(0);
    expect(await demanderProtection({ persisted: async () => false, persist })).toBe('protege');
    expect(demandes).toBe(1);
    expect(await demanderProtection({ persisted: async () => false, persist: async () => false })).toBe('non-protege');
  });

  it('rappel d’export : progression non protégée, pas exportée ni rappelée depuis 14 jours', () => {
    const base = { statut: 'non-protege' as const, xp: XP_RAPPEL, aujourdhui: '2026-11-20', dernierExport: null, dernierRappel: null };
    expect(rappelExportNecessaire(base)).toBe(true);
    expect(rappelExportNecessaire({ ...base, statut: 'protege' })).toBe(false);
    expect(rappelExportNecessaire({ ...base, xp: XP_RAPPEL - 1 })).toBe(false);
    expect(rappelExportNecessaire({ ...base, dernierExport: '2026-11-10' })).toBe(false);
    expect(rappelExportNecessaire({ ...base, dernierExport: '2026-11-06' })).toBe(true);
    expect(rappelExportNecessaire({ ...base, dernierRappel: '2026-11-19' })).toBe(false);
    expect(rappelExportNecessaire({ ...base, statut: 'inconnu' })).toBe(true);
  });

  it('détecte Safari iOS hors app installée', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
    expect(estIosNavigateur({ userAgent: iphone })).toBe(true);
    expect(estIosNavigateur({ userAgent: iphone, standalone: true })).toBe(false);
    expect(estIosNavigateur({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 })).toBe(true);
    expect(estIosNavigateur({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 })).toBe(false);
    expect(estIosNavigateur({ userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140' })).toBe(false);
  });
});
