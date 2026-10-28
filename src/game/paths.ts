import type { ClientKind } from './GameClientContext'

export const matchPath = (kind: ClientKind, id: string) => (kind === 'local' ? `/local/${id}` : `/m/${id}`)
