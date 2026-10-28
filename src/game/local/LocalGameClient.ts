// Cliente hot-seat: roda a engine no navegador e guarda as partidas no
// localStorage. Contém o gabarito, por isso só é carregado em desenvolvimento.
import questions from '../../../server/questions.json'
import {
  GameError,
  createBank,
  createMatch,
  reduce,
  settle,
  toPublicView,
  type Command,
  type Ctx,
  type MatchState,
  type MatchView,
  type Question,
} from '../../engine'
import { ClientError, type ClientCommand, type CommandResult, type GameClient } from '../client'
import { newInviteCode } from '../ids'

const STORAGE_KEY = 'mdn:local-matches'
const bank = createBank(questions as Question[])

export class LocalGameClient implements GameClient {
  readonly mode = 'local' as const
  readonly userId = null
  private matches = new Map<string, MatchState>()
  private listeners = new Map<string, Set<(v: MatchView) => void>>()

  constructor(private readonly latencyMs = 250) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      for (const m of raw ? (JSON.parse(raw) as MatchState[]) : []) {
        // Partidas salvas com um banco de questões antigo não abrem mais.
        if (m.usedQuestionIds.every((id) => bank.byId.has(id))) this.matches.set(m.id, m)
      }
    } catch {
      // Armazenamento indisponível: segue só em memória.
    }
  }

  async createMatch({ p1Name, p2Name }: { p1Name: string; p2Name?: string }) {
    await this.delay()
    const now = Date.now()
    let state = createMatch({ id: crypto.randomUUID(), code: newInviteCode(), creatorId: 'local-1', creatorName: p1Name, now })
    if (p2Name) state = reduce(state, { type: 'JOIN', by: 'local-2', name: p2Name }, this.ctx()).state
    this.save(state)
    return toPublicView(state, bank)
  }

  async listMatches() {
    await this.delay()
    return [...this.matches.values()]
      .map((m) => this.settled(m))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((m) => toPublicView(m, bank))
  }

  async getMatch(id: string) {
    await this.delay()
    return toPublicView(this.settled(this.load(id)), bank)
  }

  async send(id: string, cmd: ClientCommand): Promise<CommandResult> {
    await this.delay()
    const state = this.settled(this.load(id))
    // No hot-seat quem age é sempre o jogador da vez.
    const by = state.players[state.turnOf]?.id ?? state.players[1].id
    try {
      const r = reduce(state, { ...cmd, by } as Command, this.ctx())
      this.save(r.state)
      return { view: toPublicView(r.state, bank), events: r.events, reveal: r.reveal, spin: r.spin }
    } catch (e) {
      if (e instanceof GameError) throw new ClientError(e.code)
      throw e
    }
  }

  subscribe(id: string, onView: (view: MatchView) => void) {
    const set = this.listeners.get(id) ?? new Set()
    set.add(onView)
    this.listeners.set(id, set)
    return () => set.delete(onView)
  }

  private ctx(): Ctx {
    return { now: Date.now(), rng: Math.random, bank }
  }

  private load(id: string): MatchState {
    const m = this.matches.get(id)
    if (!m) throw new ClientError('NOT_FOUND')
    return m
  }

  private settled(m: MatchState): MatchState {
    const r = settle(m, this.ctx())
    if (r.events.length) this.save(r.state)
    return r.state
  }

  private save(state: MatchState) {
    this.matches.set(state.id, state)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.matches.values()]))
    } catch {
      // Ignora: cota cheia ou modo privado.
    }
    const view = toPublicView(state, bank)
    this.listeners.get(state.id)?.forEach((fn) => fn(view))
  }

  private delay() {
    return new Promise((r) => setTimeout(r, this.latencyMs))
  }
}
