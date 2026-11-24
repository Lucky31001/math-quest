/** Vérifications indépendantes — Physique. Clé : « chapitre/question ». */
import { expect } from 'vitest';
import {
  attendu,
  fonction,
  imageParRayons,
  instant,
  minimum,
  proche,
  question,
  racine,
  resoudre,
  rk4,
  simpson,
} from '../outils/verification';

export const verifications: Record<string, () => void> = {
  /* =============================== PHYSIQUE =============================== */
  /* ---------------- Grandeurs et unités ---------------- */
  'grandeurs-unites/masse-volumique': () => expect(proche(attendu(question('grandeurs-unites', 'masse-volumique')), 1e-3 / 1e-6)).toBe(true),
  'grandeurs-unites/exposant-onde': () => {
    // Recherche exhaustive des exposants demi-entiers rendant λ^α g^β homogène à une vitesse.
    const sols: number[] = [];
    for (let a = -3; a <= 3; a += 0.5) for (let b = -3; b <= 3; b += 0.5) if (a + b === 1 && -2 * b === -1) sols.push(a);
    expect(sols).toEqual([attendu(question('grandeurs-unites', 'exposant-onde')).re]);
  },
  'grandeurs-unites/incertitude-surface': () => {
    const S = (a: number, b: number) => a * b;
    const dSa = (S(20 + 1e-6, 15) - S(20 - 1e-6, 15)) / 2e-6;
    const dSb = (S(20, 15 + 1e-6) - S(20, 15 - 1e-6)) / 2e-6;
    const relatif = (100 * Math.hypot(dSa * 0.2, dSb * 0.3)) / S(20, 15);
    expect(attendu(question('grandeurs-unites', 'incertitude-surface')).re).toBeCloseTo(relatif, 5);
  },
  /* ---------------- Cinématique ---------------- */
  'cinematique/distance-freinage': () => {
    const { y } = instant((_t, [, v]) => [v, -5], [0, 20], ([, v]) => v <= 0);
    expect(attendu(question('cinematique', 'distance-freinage')).re).toBeCloseTo(y[0], 2);
  },
  'cinematique/temps-chute': () => {
    const { t } = instant((_t, [, v]) => [v, 9.81], [0, 0], ([z]) => z >= 20, 1e-5);
    expect(Math.abs(attendu(question('cinematique', 'temps-chute')).re - t)).toBeLessThan(1e-4);
  },
  'cinematique/vitesse-position': () => {
    const v = fonction(question('cinematique', 'vitesse-position'));
    for (const t of [0.5, 1, 2.5]) {
      const [x, vx] = rk4((_t, [, w]) => [w, 2], [0, 3], 0, t);
      expect(v(x)).toBeCloseTo(vx, 6);
    }
  },
  'cinematique/rattrapage': () => {
    const { t } = instant((_t, [, , vb]) => [10, vb, 2], [0, 0, 0], ([xa, xb]) => xb >= xa, 1e-4, 50);
    expect(Math.abs(attendu(question('cinematique', 'rattrapage')).re - t)).toBeLessThan(1e-3);
  },
  'cinematique/vitesse-moyenne': () => {
    const d = 120; // km, valeur arbitraire
    expect(attendu(question('cinematique', 'vitesse-moyenne')).re).toBeCloseTo((2 * d) / (d / 60 + d / 40), 10);
  },
  /* ---------------- Dynamique ---------------- */
  'dynamique/pfd-simple': () => {
    // Position après 2 s sous la force constante, comparée à ½·a·t².
    const [x] = rk4((_t, [, v]) => [v, 12 / 4], [0, 0], 0, 2);
    expect((attendu(question('dynamique', 'pfd-simple')).re * 4) / 2).toBeCloseTo(x, 6);
  },
  'dynamique/plan-incline': () => {
    // Somme vectorielle poids + réaction normale (m = 1), dans le repère (horizontal, vertical).
    const al = Math.PI / 6;
    const g = 9.81;
    const N = g * Math.cos(al);
    const a = [N * Math.sin(al), -g + N * Math.cos(al)];
    expect(attendu(question('dynamique', 'plan-incline')).re).toBeCloseTo(Math.hypot(a[0], a[1]), 10);
  },
  'dynamique/vitesse-limite': () => {
    const [v] = rk4((_t, [w]) => [9.81 - (0.25 / 0.5) * w], [0], 0, 60);
    expect(attendu(question('dynamique', 'vitesse-limite')).re).toBeCloseTo(v, 6);
  },
  'dynamique/vitesse-frottement': () => {
    const v = fonction(question('dynamique', 'vitesse-frottement'));
    for (const t of [0.5, 2, 7]) {
      const [w] = rk4((_t, [u]) => [10 - (0.05 / 0.2) * u], [0], 0, t);
      expect(v(t)).toBeCloseTo(w, 6);
    }
  },
  'dynamique/deux-blocs': () => {
    // Inconnues (a, N) : m1·a + N = F et m2·a − N = 0.
    const [, N] = resoudre([[2, 1], [3, -1]], [10, 0]);
    expect(attendu(question('dynamique', 'deux-blocs')).re).toBeCloseTo(N, 10);
  },
  /* ---------------- Énergie ---------------- */
  'energie-mecanique/travail-poids': () => {
    // Intégrale curviligne de P·dl le long d'un chemin courbe de z = 5 à z = 0.
    const m = 3;
    const g = 9.81;
    const chemin = (s: number) => ({ x: Math.sin(3 * s), z: 5 * (1 - s) ** 2 });
    const W = simpson((s) => {
      const h = 1e-6;
      const dz = (chemin(s + h).z - chemin(s - h).z) / (2 * h);
      return -m * g * dz;
    }, 0, 1);
    expect(attendu(question('energie-mecanique', 'travail-poids')).re).toBeCloseTo(W, 4);
  },
  'energie-mecanique/vitesse-chute': () => {
    const { y } = instant((_t, [, v]) => [v, 10], [0, 0], ([z]) => z >= 45, 1e-5);
    expect(Math.abs(attendu(question('energie-mecanique', 'vitesse-chute')).re - y[1])).toBeLessThan(1e-3);
  },
  'energie-mecanique/vitesse-altitude': () => {
    // Glissade sur une rampe à 30° partant de z = 10 : abscisse curviligne s, ṡ' = g·sin α.
    const v = fonction(question('energie-mecanique', 'vitesse-altitude'));
    const al = Math.PI / 6;
    for (const t of [0.4, 1, 1.6]) {
      const [s, vs] = rk4((_t, [, w]) => [w, 10 * Math.sin(al)], [0, 0], 0, t);
      expect(v(10 - s * Math.sin(al))).toBeCloseTo(vs, 6);
    }
  },
  'energie-mecanique/travail-frottements': () => {
    const Em = (v: number, z: number) => 0.5 * 2 * v * v + 2 * 10 * z;
    expect(attendu(question('energie-mecanique', 'travail-frottements')).re).toBeCloseTo(Em(8, 0) - Em(0, 5), 10);
  },
  /* ---------------- Oscillateurs ---------------- */
  'oscillateurs/periode-ressort': () => {
    // Départ au maximum : la vitesse redevient nulle après une demi-période.
    const { t } = instant((_t, [x, v]) => [v, -(20 / 0.2) * x], [1, 0], ([, v]) => v >= 0, 1e-5);
    expect(Math.abs(attendu(question('oscillateurs', 'periode-ressort')).re - 2 * t)).toBeLessThan(1e-3);
  },
  'oscillateurs/periode-pendule': () => {
    // Pendule NON linéarisé, petite amplitude.
    const { t } = instant((_t, [th, w]) => [w, -9.81 * Math.sin(th)], [1e-3, 0], ([, w]) => w >= 0, 1e-5);
    expect(Math.abs(attendu(question('oscillateurs', 'periode-pendule')).re - 2 * t)).toBeLessThan(1e-3);
  },
  'oscillateurs/solution-ci': () => {
    const x = fonction(question('oscillateurs', 'solution-ci'));
    for (const t of [0.3, 1.2, 2.5]) expect(x(t)).toBeCloseTo(rk4((_t, [u, v]) => [v, -4 * u], [0.1, 0.4], 0, t)[0], 8);
  },
  'oscillateurs/amplitude-cm': () => {
    let max = 0;
    let y = [0.1, 0.4];
    for (let k = 0; k < 4000; k++) {
      y = rk4((_t, [u, v]) => [v, -4 * u], y, 0, 1e-3, 1);
      max = Math.max(max, Math.abs(y[0]));
    }
    expect(Math.abs(attendu(question('oscillateurs', 'amplitude-cm')).re - 100 * max)).toBeLessThan(1e-3);
  },
  /* ---------------- Électrocinétique ---------------- */
  'electrocinetique/resistance-equivalente': () => {
    // Kirchhoff sous 1 V : I3 = I1 + I2 ; 6·I1 = 3·I2 ; 6·I1 + 4·I3 = 1.
    const [, , I3] = resoudre([[1, 1, -1], [6, -3, 0], [6, 0, 4]], [0, 0, 1]);
    expect(attendu(question('electrocinetique', 'resistance-equivalente')).re).toBeCloseTo(1 / I3, 10);
  },
  'electrocinetique/diviseur-tension': () => {
    // Potentiel du nœud intermédiaire V (R2 relié à la masse) : (12 − V)/R1 = V/R2.
    const [V] = resoudre([[1 / 1000 + 1 / 2000]], [12 / 1000]);
    expect(attendu(question('electrocinetique', 'diviseur-tension')).re).toBeCloseTo(V, 10);
  },
  'electrocinetique/charge-rc': () => {
    const [u] = rk4((_t, [w]) => [(10 - w) / (1e4 * 1e-4)], [0], 0, 1);
    expect(attendu(question('electrocinetique', 'charge-rc')).re).toBeCloseTo(u, 8);
  },
  'electrocinetique/rc-condition-initiale': () => {
    const u = fonction(question('electrocinetique', 'rc-condition-initiale'));
    for (const t of [0.1, 0.5, 2]) expect(u(t)).toBeCloseTo(rk4((_t, [w]) => [(6 - w) / 0.5], [2], 0, t)[0], 8);
  },

  /* ---------------- Pensée scientifique ---------------- */
  'pensee-scientifique/ordre-grandeur': () => {
    const annee = 365 * 24 * 3600;
    const n = attendu(question('pensee-scientifique', 'ordre-grandeur')).re;
    expect(annee / 10 ** n).toBeGreaterThan(2.5);
    expect(annee / 10 ** n).toBeLessThan(3.5);
  },
  /* ---------------- Optique géométrique ---------------- */
  'optique-geometrique/vergence': () => expect(attendu(question('optique-geometrique', 'vergence')).re).toBeCloseTo(1 / 0.2, 10),
  'optique-geometrique/refraction-eau': () => {
    // Principe de Fermat : A dans l'air, B dans l'eau sur le rayon réfracté annoncé ; le chemin optique
    // n1·AI + n2·IB doit être minimal au point d'incidence I prévu.
    const r = (attendu(question('optique-geometrique', 'refraction-eau')).re * Math.PI) / 180;
    const xI = Math.tan(Math.PI / 6); // A = (0, 1), incidence 30°
    const B = { x: xI + Math.tan(r), y: -1 };
    const chemin = (x: number) => Math.hypot(x, 1) + 1.33 * Math.hypot(B.x - x, B.y);
    expect(minimum(chemin, -2, 3)).toBeCloseTo(xI, 4);
  },
  'optique-geometrique/angle-limite': () => {
    // Plus grand angle d'incidence pour lequel un rayon réfracté existe encore (sin i2 ≤ 1).
    const il = racine((i) => 1.5 * Math.sin(i) - 1, 0, Math.PI / 2);
    expect(attendu(question('optique-geometrique', 'angle-limite')).re).toBeCloseTo((il * 180) / Math.PI, 6);
  },
  'optique-geometrique/conjugaison': () =>
    expect(attendu(question('optique-geometrique', 'conjugaison')).re).toBeCloseTo(imageParRayons(-30, 10).x, 8),
  'optique-geometrique/position-image': () => {
    const g = fonction(question('optique-geometrique', 'position-image'));
    for (const x of [-50, -30, -12.5]) expect(g(x)).toBeCloseTo(imageParRayons(x, 10).x, 8);
  },
  'optique-geometrique/grandissement': () => {
    const q = question('optique-geometrique', 'grandissement');
    if (q.type !== 'qcm') throw new Error('QCM attendu');
    expect(q.choix.find((c) => c.correct)!.texte).toContain('-0{,}5');
    expect(imageParRayons(-30, 10).y).toBeCloseTo(-0.5, 10);
  },
  /* ---------------- Thermodynamique ---------------- */
  'thermodynamique/pression-gp': () => {
    // P·V/(n·T) doit redonner R.
    expect((attendu(question('thermodynamique', 'pression-gp')).re * 1000 * 24.9e-3) / 300).toBeCloseTo(8.314, 6);
  },
  'thermodynamique/travail-isobare': () =>
    expect(attendu(question('thermodynamique', 'travail-isobare')).re).toBeCloseTo(simpson(() => -2e5, 1e-3, 3e-3), 6),
  'thermodynamique/travail-isotherme': () =>
    expect(attendu(question('thermodynamique', 'travail-isotherme')).re).toBeCloseTo(simpson((V) => (-8.314 * 300) / V, 1e-3, 2e-3), 4),
  'thermodynamique/chauffer-eau': () => {
    let Q = 0;
    for (let T = 20; T < 80; T += 0.5) Q += 2 * 4180 * 0.5;
    expect(attendu(question('thermodynamique', 'chauffer-eau')).re).toBeCloseTo(Q / 1000, 6);
  },
  'thermodynamique/temperature-melange': () => {
    const T = fonction(question('thermodynamique', 'temperature-melange'));
    for (const m of [0.25, 1, 3]) expect(T(m)).toBeCloseTo(racine((t) => 1 * (t - 20) + m * (t - 80), 20, 80), 8);
  },
  'thermodynamique/rendement-carnot': () => {
    // Cycle de Carnot d'un gaz parfait monoatomique (γ = 5/3), calculé étape par étape.
    const [n, R, Tc, Tf, g] = [1, 8.314, 600, 300, 5 / 3];
    const V1 = 1e-3;
    const V2 = 3e-3;
    const V3 = V2 * (Tc / Tf) ** (1 / (g - 1));
    const V4 = V1 * (Tc / Tf) ** (1 / (g - 1));
    const Qc = simpson((V) => (n * R * Tc) / V, V1, V2); // isotherme chaude : Q = −W
    const Qf = simpson((V) => (n * R * Tf) / V, V3, V4); // isotherme froide
    expect(attendu(question('thermodynamique', 'rendement-carnot')).re).toBeCloseTo((100 * (Qc + Qf)) / Qc, 4);
  },
  /* ---------------- Panorama sur la Physique (CY Tech) ---------------- */
  'pensee-scientifique/ordre-atome-noyau': () =>
    expect(attendu(question('pensee-scientifique', 'ordre-atome-noyau')).re).toBe(Math.round(Math.log10(1e-10 / 1e-15))),
  'pensee-scientifique/annee-lumiere': () => {
    // Distance parcourue jour après jour pendant 365,25 jours.
    let d = 0;
    for (let j = 0; j < 365; j++) d += 3e8 * 86400;
    d += 3e8 * 86400 * 0.25;
    expect(proche(attendu(question('pensee-scientifique', 'annee-lumiere')), d, 1e-9)).toBe(true);
  },
  'pensee-scientifique/gravitation-double-distance': () => {
    const F = (r: number) => (6.67e-11 * 5 * 7) / r ** 2;
    expect(attendu(question('pensee-scientifique', 'gravitation-double-distance')).re).toBeCloseTo(F(3) / F(6), 10);
  },
  'optique-geometrique/cauchy-indice': () =>
    expect(proche(attendu(question('optique-geometrique', 'cauchy-indice')), 1.5 + 4e3 / 500 ** 2)).toBe(true),
  'optique-geometrique/nombre-abbe': () =>
    expect(attendu(question('optique-geometrique', 'nombre-abbe')).re).toBeCloseTo((1.62 - 1) / (1.63 - 1.61), 8),
  'optique-geometrique/rotation-miroir': () => {
    // Réflexion d'un rayon fixe sur un miroir dont la normale tourne de 10°.
    const reflechi = (d: number[], a: number) => {
      const n = [Math.cos(a), Math.sin(a)];
      const p = d[0] * n[0] + d[1] * n[1];
      return [d[0] - 2 * p * n[0], d[1] - 2 * p * n[1]];
    };
    const d = [-Math.cos(0.3), -Math.sin(0.3)];
    const [r1, r2] = [reflechi(d, 0), reflechi(d, (10 * Math.PI) / 180)];
    const angle = (Math.acos(r1[0] * r2[0] + r1[1] * r2[1]) * 180) / Math.PI;
    expect(attendu(question('optique-geometrique', 'rotation-miroir')).re).toBeCloseTo(angle, 8);
  },
  'optique-geometrique/dioptre-plan-profondeur': () => {
    // Rayon quasi vertical issu du caillou (profondeur 2 m), réfracté eau → air, prolongé dans l'eau.
    const i1 = 1e-4;
    const x = 2 * Math.tan(i1);
    const i2 = Math.asin(1.33 * Math.sin(i1));
    expect(proche(attendu(question('optique-geometrique', 'dioptre-plan-profondeur')), x / Math.tan(i2), 1e-6)).toBe(true);
  },
  'optique-geometrique/relation-newton': () =>
    // F'A' = OA' − OF' : l'image de A (OA = OF + FA = −30 cm) est obtenue par tracé de rayons.
    expect(attendu(question('optique-geometrique', 'relation-newton')).re).toBeCloseTo(imageParRayons(-10 - 20, 10).x - 10, 8),
  'optique-geometrique/lentilles-accolees': () => {
    // Rayon parallèle à l'axe (hauteur h) : chaque lentille ajoute −h/f' à la pente.
    const h = 1;
    const pente = -h / 20 - h / 30;
    expect(attendu(question('optique-geometrique', 'lentilles-accolees')).re).toBeCloseTo(-h / pente, 8);
  },
  'cinematique/produit-scalaire': () => {
    const [u, v] = [[1, 2, 3], [4, -5, 6]];
    expect(attendu(question('cinematique', 'produit-scalaire')).re).toBe(u.reduce((s, x, i) => s + x * v[i], 0));
  },
  'cinematique/norme-produit-vectoriel': () => {
    const u = [3, 0, 0];
    const v = [4 * Math.cos(Math.PI / 6), 4 * Math.sin(Math.PI / 6), 0];
    const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    expect(attendu(question('cinematique', 'norme-produit-vectoriel')).re).toBeCloseTo(Math.hypot(...w), 10);
  },
  'cinematique/helice-vitesse': () => {
    const M = (t: number) => [2 * Math.cos(3 * t), 2 * Math.sin(3 * t), 8 * t];
    const h = 1e-6;
    const t = 0.37;
    const v = M(t + h).map((x, i) => (x - M(t - h)[i]) / (2 * h));
    expect(attendu(question('cinematique', 'helice-vitesse')).re).toBeCloseTo(Math.hypot(...v), 5);
  },
  'cinematique/virage-frenet': () => {
    // Abscisse curviligne s(t) = 20t − 1,5t² sur un cercle de rayon 50 m ; accélération par différences finies en t = 0.
    const M = (t: number) => {
      const s = 20 * t - 1.5 * t * t;
      return [50 * Math.cos(s / 50), 50 * Math.sin(s / 50)];
    };
    const h = 1e-4;
    const a = M(h).map((x, i) => (x - 2 * M(0)[i] + M(-h)[i]) / (h * h));
    expect(proche(attendu(question('cinematique', 'virage-frenet')), Math.hypot(...a), 1e-5)).toBe(true);
  },
  'dynamique/g-gravitation': () =>
    expect(proche(attendu(question('dynamique', 'g-gravitation')), (6.67e-11 * 5.97e24) / 6.37e6 ** 2, 1e-9)).toBe(true),
  'dynamique/g-altitude': () => {
    const g = (h: number) => (6.67e-11 * 5.97e24) / (6.37e6 + h) ** 2;
    expect(attendu(question('dynamique', 'g-altitude')).re).toBeCloseTo(g(0) / g(6.37e6), 10);
  },
  'dynamique/patineurs': () => {
    const F = 150; // même norme pour les deux (3e loi)
    expect(proche(attendu(question('dynamique', 'patineurs')), F / 72 / (F / 95))).toBe(true);
  },
  'dynamique/periode-ressort': () => {
    // Masse lâchée en x = 0,1 sans vitesse : sa vitesse redevient positive au bout d'une demi-période.
    const F = (_t: number, [x, v]: number[]) => [v, (-50 / 0.5) * x];
    const demi = instant(F, [0.1, 0], ([, v]) => v > 0, 1e-5);
    expect(Math.abs(attendu(question('dynamique', 'periode-ressort')).re - 2 * demi.t)).toBeLessThan(1e-3);
  },
  'dynamique/equilibre-ressort-vertical': () => {
    // Équilibre : la force du ressort compense le poids (en m, converti en cm).
    const dl = racine((x) => 40 * x - 0.2 * 9.81, 0, 1);
    expect(proche(attendu(question('dynamique', 'equilibre-ressort-vertical')), dl * 100, 1e-9)).toBe(true);
  },
  'dynamique/solution-ressort': () => {
    const x = fonction(question('dynamique', 'solution-ressort'));
    for (const t of [0.2, 0.75, 1.3]) {
      const [xt] = rk4((_t, [p, v]) => [v, -100 * p], [0.1, 0], 0, t);
      expect(x(t)).toBeCloseTo(xt, 6);
    }
  },
};
