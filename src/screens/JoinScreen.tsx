import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AREAS } from '../engine'
import { AREA_INFO } from '../content/areas'
import { ClientError } from '../game/client'
import { useClients } from '../game/GameClientContext'
import { MAX_NAME_LENGTH, type InvitePeek } from '../game/protocol'
import { loadNickname, saveNickname } from '../game/nickname'
import { Button } from '../ui/Button'

/** /p/:code — quem recebe o link aceita o desafio aqui. */
export function JoinScreen() {
  const { code = '' } = useParams()
  const { remote, remoteError } = useClients()
  const navigate = useNavigate()
  const [peek, setPeek] = useState<InvitePeek | null>(null)
  const [error, setError] = useState<string | null>(remote ? null : (remoteError ?? 'Modo online indisponível.'))
  const [name, setName] = useState(loadNickname)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!remote?.peekInvite) return
    remote.peekInvite(code).then(
      (p) => (p.isPlayer ? navigate(`/m/${p.matchId}`, { replace: true }) : setPeek(p)),
      (e) => setError(e instanceof ClientError ? e.message : 'Convite inválido.'),
    )
  }, [remote, code, navigate])

  async function join(e: FormEvent) {
    e.preventDefault()
    const nick = name.trim()
    if (!remote?.joinMatch || !nick) return
    setBusy(true)
    saveNickname(nick)
    try {
      const view = await remote.joinMatch(code, nick)
      navigate(`/m/${view.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof ClientError ? err.message : 'Não foi possível entrar.')
      setBusy(false)
    }
  }

  const closed = peek && (peek.full || peek.status === 'ENDED')

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 py-8 text-center">
      <div className="flex -space-x-4">
        {AREAS.map((a) => (
          <img key={a} src={AREA_INFO[a].hero} alt="" className="h-16 object-contain drop-shadow-lg" />
        ))}
      </div>

      {error ? (
        <Message title={error} />
      ) : !peek ? (
        <p className="font-display animate-pulse text-xl">Abrindo convite…</p>
      ) : closed ? (
        <Message title={peek.status === 'ENDED' ? 'Essa partida já terminou.' : 'Essa partida já tem dois jogadores.'} />
      ) : (
        <form onSubmit={join} className="flex w-full flex-col gap-4">
          <div>
            <p className="text-white/70">Mestre dos Negócios</p>
            <h1 className="font-display text-3xl font-bold">
              <span className="text-coringa-gold">{peek.hostName}</span> te desafiou!
            </h1>
          </div>
          <input
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            autoFocus
            className="w-full rounded-xl bg-white px-4 py-3 text-center text-lg font-semibold text-ink outline-none ring-coringa-gold placeholder:text-ink/40 focus:ring-4"
          />
          <Button type="submit" disabled={!name.trim() || busy}>
            Aceitar desafio
          </Button>
        </form>
      )}
    </main>
  )
}

function Message({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-display text-xl">{title}</p>
      <Link to="/" className="underline">
        Criar minha partida
      </Link>
    </div>
  )
}
