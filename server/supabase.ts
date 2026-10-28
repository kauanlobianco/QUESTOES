// Adaptadores de produção: repositório e verificação de sessão via Supabase.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { MatchState, MatchView } from '../src/engine'
import { createBankFromFile } from './bank'
import type { HttpDeps } from './http'
import type { MatchRepo, StoredMatch } from './repo'
import { createGameService } from './service'

export function supabaseRepo(db: SupabaseClient): MatchRepo {
  const columns = (state: MatchState, view: MatchView) => ({
    p_status: state.status,
    p_turn_of: state.turnOf,
    p_view: view,
    p_state: state,
    p_expires_at: new Date(state.expiresAt).toISOString(),
  })

  return {
    async create(state, view) {
      const { data, error } = await db.rpc('create_match', {
        p_id: state.id,
        p_code: state.code,
        p_p1: state.players[1].id,
        ...columns(state, view),
      })
      if (error) throw new Error(`create_match: ${error.message}`)
      return data === true
    },

    async load(key) {
      const args = 'id' in key ? { p_id: key.id } : { p_code: key.code }
      const { data, error } = await db.rpc('load_match', args)
      if (error) throw new Error(`load_match: ${error.message}`)
      const row = (data as StoredMatch[] | null)?.[0]
      return row ? { id: row.id, version: row.version, state: row.state } : null
    },

    async commit(id, version, state, view) {
      const { data, error } = await db.rpc('commit_match', {
        p_id: id,
        p_version: version,
        p_p2: state.players[2]?.id ?? null,
        ...columns(state, view),
      })
      if (error) throw new Error(`commit_match: ${error.message}`)
      return data === true
    },
  }
}

let cached: HttpDeps | null = null

/** Dependências do endpoint a partir das variáveis de ambiente (reaproveitadas entre chamadas). */
export function supabaseDeps(env: Record<string, string | undefined> = process.env): HttpDeps {
  if (cached) return cached
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY')

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  cached = {
    service: createGameService({ repo: supabaseRepo(db), bank: createBankFromFile() }),
    async verifyUser(token) {
      const { data, error } = await db.auth.getUser(token)
      return error ? null : (data.user?.id ?? null)
    },
  }
  return cached
}
