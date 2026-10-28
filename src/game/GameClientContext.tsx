import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import type { GameClient } from './client'

export type ClientKind = 'local' | 'remote'

export interface Clients {
  /** Hot-seat no navegador; só existe em desenvolvimento (carrega o gabarito). */
  local: GameClient | null
  /** Online via Supabase; null se não configurado ou se a conexão falhou. */
  remote: GameClient | null
  remoteError: string | null
  /** Ainda conectando: as telas já aparecem, mas sem os clientes. */
  connecting: boolean
}

const Ctx = createContext<Clients | null>(null)

async function connectRemote(): Promise<Pick<Clients, 'remote' | 'remoteError'>> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !key) return { remote: null, remoteError: 'Modo online não configurado (.env.local).' }
  try {
    const { RemoteGameClient } = await import('./remote/RemoteGameClient')
    return { remote: await RemoteGameClient.connect(url, key), remoteError: null }
  } catch (e) {
    console.error(e)
    return { remote: null, remoteError: 'Não foi possível conectar ao servidor.' }
  }
}

async function createLocal(): Promise<GameClient | null> {
  if (!import.meta.env.DEV) return null
  const { LocalGameClient } = await import('./local/LocalGameClient')
  return new LocalGameClient()
}

const CONNECTING: Clients = { local: null, remote: null, remoteError: null, connecting: true }

/** Renderiza já: o cliente do Supabase (o maior pedaço do app) chega depois da primeira tela. */
export function GameClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Clients>(CONNECTING)

  useEffect(() => {
    Promise.all([createLocal(), connectRemote()]).then(([local, remote]) => setClients({ local, ...remote, connecting: false }))
  }, [])

  return <Ctx value={clients}>{children}</Ctx>
}

export function useClients(): Clients {
  const clients = use(Ctx)
  if (!clients) throw new Error('useClients fora do GameClientProvider')
  return clients
}
