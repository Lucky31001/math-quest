/** Robustesse de la sauvegarde : migrations, récupération partielle, copies de sécurité, non-régression. */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chargerAvecRapport, importer, exporter, listerCopies, supprimerCopie, PREFIXE_COPIE } from '../src/storage/progression';
import { migrer, VERSION_PROGRESSION, type Migration } from '../src/storage/migrations';
import { avertissementChargement } from '../src/ui/etat';

const CLE = 'math-quest:progression:v1';

/** localStorage minimal en mémoire. */
function stockage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    m,
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
const copiesDe = (s: ReturnType<typeof stockage>) => [...s.m.keys()].filter((k) => k.startsWith(PREFIXE_COPIE));

describe('migrations', () => {
  it('applique les migrations successives jusqu’à la cible', () => {
    const migrations: Record<number, Migration> = { 1: (d) => ({ ...d, a: 1 }), 2: (d) => ({ ...d, b: 2 }) };
    const r = migrer({ version: 1 }, migrations, 3);
    expect(r).toEqual({ ok: true, donnees: { version: 3, a: 1, b: 2 }, appliquees: [1, 2] });
  });
  it('refuse une version future ou une migration manquante', () => {
    expect(migrer({ version: 9 }).ok).toBe(false);
    expect(migrer({ version: 1 }, {}, 2)).toMatchObject({ ok: false, raison: 'migration-manquante', version: 1 });
  });
});

describe('chargement', () => {
  it('sans sauvegarde : progression neuve, pas de copie', () => {
    const s = stockage();
    const { progression, rapport } = chargerAvecRapport(s);
    expect(progression.xp).toBe(0);
    expect(rapport.statut).toBe('nouvelle');
    expect(copiesDe(s)).toEqual([]);
  });

  it('ne réinitialise que les éléments invalides et garde une copie de l’original', () => {
    const brut = JSON.stringify({
      version: 1,
      xp: 500,
      questions: {
        'c/bonne': { boite: 2, prochaine: '2026-03-12', vues: 1, reussites: 1, derniere: '2026-03-10' },
        'c/cassee': { boite: 42, prochaine: '2026-03-12', vues: 1, reussites: 1, derniere: '2026-03-10' },
      },
      streak: { courant: 'beaucoup', record: 7 },
      records: { survie: 12, boss: { c: { meilleur: 3 } } },
      journal: { '2026-03-10': 5 },
    });
    const s = stockage({ [CLE]: brut });
    const { progression: p, rapport } = chargerAvecRapport(s);
    expect(rapport.statut).toBe('reparee');
    expect(rapport.perdus.sort()).toEqual(['questions.c/cassee', 'records.boss.c', 'streak.courant']);
    expect(p.xp).toBe(500);
    expect(Object.keys(p.questions)).toEqual(['c/bonne']);
    expect(p.streak).toEqual({ courant: 0, record: 7, dernierJour: null });
    expect(p.records.survie).toBe(12);
    expect(p.records.boss).toEqual({});
    expect(p.journal).toEqual({ '2026-03-10': 5 });
    expect(rapport.copie).not.toBeNull();
    expect(s.m.get(rapport.copie!)).toBe(brut);
    expect(avertissementChargement(rapport)).toContain('3 élément(s)');
  });

  it('JSON cassé : repart de zéro mais garde une copie', () => {
    const s = stockage({ [CLE]: '{oups' });
    const { progression, rapport } = chargerAvecRapport(s);
    expect(progression.xp).toBe(0);
    expect(rapport.statut).toBe('reinitialisee');
    expect(copiesDe(s).map((k) => s.m.get(k))).toEqual(['{oups']);
  });

  it('version future : ne tente pas de réparer, garde une copie', () => {
    const brut = JSON.stringify({ version: VERSION_PROGRESSION + 1, xp: 999 });
    const s = stockage({ [CLE]: brut });
    const { progression, rapport } = chargerAvecRapport(s);
    expect(rapport.statut).toBe('version-future');
    expect(progression.xp).toBe(0);
    expect(s.m.get(rapport.copie!)).toBe(brut);
  });

  it('sauvegarde valide : aucune copie', () => {
    const s = stockage({ [CLE]: JSON.stringify({ version: 1, xp: 10 }) });
    expect(chargerAvecRapport(s).rapport).toMatchObject({ statut: 'ok', perdus: [], copie: null });
    expect(copiesDe(s)).toEqual([]);
  });
});

describe('copies de sécurité', () => {
  it('se listent de la plus récente à la plus ancienne et se suppriment', () => {
    const s = stockage({
      [`${PREFIXE_COPIE}2026-01-01T00:00:00.000Z`]: 'a',
      [`${PREFIXE_COPIE}2026-02-01T00:00:00.000Z`]: 'b',
      [CLE]: '{}',
    });
    expect(listerCopies(s).map((c) => c.contenu)).toEqual(['b', 'a']);
    supprimerCopie(`${PREFIXE_COPIE}2026-02-01T00:00:00.000Z`, s);
    supprimerCopie(CLE, s); // refusé : ce n'est pas une copie
    expect(listerCopies(s).map((c) => c.contenu)).toEqual(['a']);
    expect(s.m.has(CLE)).toBe(true);
  });
});

describe('import', () => {
  it('refuse proprement une sauvegarde d’une version future', () => {
    const r = importer(JSON.stringify({ progression: { version: VERSION_PROGRESSION + 1 } }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain('plus récente');
  });
});

/**
 * Non-régression : chaque ancienne version du format a une sauvegarde d'exemple
 * dans tests/fixtures/sauvegardes/vN.json, qui doit toujours se charger sans perte.
 */
describe('sauvegardes des versions précédentes', () => {
  const dossier = join(__dirname, 'fixtures', 'sauvegardes');
  const fichiers = readdirSync(dossier).filter((f) => /^v\d+\.json$/.test(f));

  it('il existe une sauvegarde d’exemple pour chaque version du format', () => {
    const versions = fichiers.map((f) => Number(f.slice(1, -5))).sort((a, b) => a - b);
    expect(versions).toEqual(Array.from({ length: VERSION_PROGRESSION }, (_, i) => i + 1));
  });

  for (const f of fichiers) {
    it(`${f} se charge sans perte et se réimporte`, () => {
      const brut = readFileSync(join(dossier, f), 'utf8');
      const v = Number(f.slice(1, -5));
      const s = stockage({ [CLE]: brut });
      const { progression, rapport } = chargerAvecRapport(s);
      expect(rapport).toMatchObject({ statut: 'ok', perdus: [], copie: null });
      expect(rapport.migrations).toEqual(Array.from({ length: VERSION_PROGRESSION - v }, (_, i) => v + i));
      expect(progression.version).toBe(VERSION_PROGRESSION);
      expect(progression.compteurs.reponses).toBeGreaterThan(0);
      const r = importer(brut);
      expect(r.ok && r.progression).toEqual(progression);
      const aller = importer(exporter(progression));
      expect(aller.ok && aller.progression).toEqual(progression);
    });
  }
});
