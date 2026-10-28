import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { MatchView } from '../../engine'
import { ClientError, type GameClient } from '../client'
import { syncClock } from '../clock'
import type { ApiErrorBody, ApiRequest, ApiResult, ClientCommand, CommandResult, InvitePeek } from '../protocol'

const API_URL = '/api/game'

/** Fala com /api/game (jogadas) e lê/assina a tabela `matches` direto no Supabase (RLS). */
export class RemoteGameClient implements GameClient {
  readonly mode = 'remote' as const

  private constructor(
    private readonly sb: SupabaseClient,
    readonly userId: string,
  ) {}

  /** Garante uma sessão: reaproveita a salva no navegador ou cria uma anônima. */
  static async connect(url: string, anonKey: string): Promise<RemoteGameClient> {
    const sb = createClient(url, anonKey)
    const { data } = await sb.auth.getSession()
    let session = data.session
    if (!session) {
      const { data: signed, error } = await sb.auth.signInAnonymously()
      if (error || !signed.session) throw new Error(`Login anônimo falhou: ${error?.message ?? 'sem sessão'}`)
      session = signed.session
    }
    return new RemoteGameClient(sb, session.user.id)
  }

  async createMatch({ p1Name }: { p1Name: string }) {
    return (await this.api<ApiResult>({ op: 'create', name: p1Name })).view
  }

  async listMatches(): Promise<MatchView[]> {
    const { data, error } = await this.sb.from('matches').select('view').order('updated_at', { ascending: false }).limit(30)
    if (error) throw new ClientError('NETWORK')
    return (data as { view: MatchView }[]).map((r) => r.view)
  }

  async getMatch(id: string) {
    return (await this.api<ApiResult>({ op: 'get', matchId: id })).view
  }

  async send(id: string, command: ClientCommand): Promise<CommandResult> {
    const { view, events, reveal, spin } = await this.api<ApiResult>({ op: 'command', matchId: id, command })
    return { view, events, reveal, spin }
  }

  peekInvite(code: string) {
    return this.api<InvitePeek>({ op: 'peek', code })
  }

  async joinMatch(code: string, name: string) {
    return (await this.api<ApiResult>({ op: 'join', code, name })).view
  }

  async rematch(id: string) {
    return (await this.api<ApiResult>({ op: 'rematch', matchId: id })).view
  }

  watchMatches(onChange: () => void) {
    // Sem filtro: o RLS só entrega as partidas em que o usuário joga.
    const channel = this.sb
      .channel('my-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => onChange())
      .subscribe()
    return () => {
      void this.sb.removeChannel(channel)
    }
  }

  subscribe(id: string, onView: (view: MatchView) => void) {
    const channel = this.sb
      .channel(`match:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, (payload) => {
        const view = (payload.new as { view?: MatchView }).view
        if (view) onView(view)
      })
      .subscribe()
    return () => {
      void this.sb.removeChannel(channel)
    }
  }

  private async api<T>(body: ApiRequest): Promise<T> {
    const { data } = await this.sb.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new ClientError('UNAUTHORIZED')

    const sentAt = Date.now()
    let res: Response
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
    } catch {
      throw new ClientError('NETWORK')
    }
    const json = (await res.json().catch(() => null)) as (T & { now?: number }) | ApiErrorBody | null
    if (!res.ok || !json || 'error' in json) {
      throw new ClientError(json && 'error' in json ? json.error.code : 'INTERNAL')
    }
    if (typeof json.now === 'number') syncClock(json.now, sentAt, Date.now())
    return json
  }
}
