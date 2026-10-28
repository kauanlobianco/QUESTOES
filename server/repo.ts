import type { MatchState, MatchView } from '../src/engine/index.js'

export interface StoredMatch {
  id: string
  version: number
  state: MatchState
}

/** Persistência da partida. Produção: Supabase. Testes: memória. */
export interface MatchRepo {
  /** false se o id ou o código de convite já existe. */
  create(state: MatchState, view: MatchView): Promise<boolean>
  load(key: { id: string } | { code: string }): Promise<StoredMatch | null>
  /** false se `version` não é mais a atual (outra escrita chegou antes). */
  commit(id: string, version: number, state: MatchState, view: MatchView): Promise<boolean>
}

export function memoryRepo(): MatchRepo & { rows: Map<string, StoredMatch & { view: MatchView }> } {
  const rows = new Map<string, StoredMatch & { view: MatchView }>()
  const clone = <T>(x: T): T => structuredClone(x)
  return {
    rows,
    async create(state, view) {
      if (rows.has(state.id) || [...rows.values()].some((r) => r.state.code === state.code)) return false
      rows.set(state.id, { id: state.id, version: 1, state: clone(state), view: clone(view) })
      return true
    },
    async load(key) {
      const row = 'id' in key ? rows.get(key.id) : [...rows.values()].find((r) => r.state.code === key.code.toUpperCase())
      return row ? { id: row.id, version: row.version, state: clone(row.state) } : null
    },
    async commit(id, version, state, view) {
      const row = rows.get(id)
      if (!row || row.version !== version) return false
      rows.set(id, { id, version: version + 1, state: clone(state), view: clone(view) })
      return true
    },
  }
}
