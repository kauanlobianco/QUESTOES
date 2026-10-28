import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Em desenvolvimento, serve /api/game com o mesmo handler da Vercel Function,
 * carregado via SSR do Vite (recarrega ao editar server/).
 */
function devApi(): Plugin {
  return {
    name: 'mdn-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/game', async (req, res) => {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          const request = new Request(`http://localhost${req.originalUrl ?? '/api/game'}`, {
            method: req.method,
            headers,
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          })
          const { handleGameRequest } = await server.ssrLoadModule('/server/http.ts')
          const { supabaseDeps } = await server.ssrLoadModule('/server/supabase.ts')
          const response: Response = await handleGameRequest(request, supabaseDeps())
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await response.text())
        } catch (e) {
          console.error('[dev-api]', e)
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: { code: 'INTERNAL', message: String((e as Error).message) } }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Variáveis sem prefixo VITE_ (service role) ficam só no processo do servidor.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), tailwindcss(), devApi()],
  }
})
