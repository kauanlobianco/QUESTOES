import { defineConfig, devices } from '@playwright/test'

// Partida completa pela interface, com dois navegadores. Precisa do Supabase
// rodando (npx supabase start); o servidor de dev sobe sozinho se não estiver no ar.
const PORT = 5175
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: 'e2e',
  timeout: 8 * 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: { ...devices['Pixel 7'], baseURL, trace: 'retain-on-failure' },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npm run dev -- --port ${PORT} --strictPort`, url: baseURL, reuseExistingServer: true, timeout: 60_000 },
})
