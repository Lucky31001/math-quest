/**
 * Tests de bout en bout : le VRAI build (service worker, découpage en fichiers,
 * worker du compilateur C) servi par `vite preview`, dans Chromium.
 *
 *   npm run e2e        (construit puis lance les tests)
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;
const ORIGINE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `${ORIGINE}/math-quest/`,
    trace: 'retain-on-failure',
    // Avertissement de première visite déjà vu (sa fenêtre modale bloquerait les clics) ;
    // e2e/avertissement.spec.ts repart d'un stockage vide pour le tester.
    storageState: { cookies: [], origins: [{ origin: ORIGINE, localStorage: [{ name: 'math-quest:avertissement-evolution:1', value: 'vu' }] }] },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'bureau', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `${ORIGINE}/math-quest/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
