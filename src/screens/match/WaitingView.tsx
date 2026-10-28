import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { RULES, type MatchView, type PlayerNo, type Slice } from '../../engine'
import { AREA_INFO } from '../../content/areas'
import { serverNow } from '../../game/clock'
import { inviteLink } from '../../game/share'
import { Button } from '../../ui/Button'
import { WhatsAppLink } from '../../ui/WhatsAppLink'
import { SwordsIcon } from '../../ui/icons'
import { SpinView } from './SpinView'

/** Pausa com o nome da fatia na tela, igual à de quem gira. */
const LANDED_PAUSE_MS = 600

/** Online: tela enquanto o rival joga. Atualiza sozinha pelo Realtime. */
export function WaitingView({ view, turnName, me }: { view: MatchView; turnName: string; me: PlayerNo }) {
  // O giro do rival roda aqui também; a área só aparece quando a roleta para.
  const last = view.log.at(-1)
  const rivalSpin = last?.type === 'SPUN' && last.player !== me ? last : null
  const [watched, setWatched] = useState<number | null>(null)

  if (rivalSpin && rivalSpin.at !== watched) {
    return <RivalSpin key={rivalSpin.at} name={turnName} slice={rivalSpin.slice} at={rivalSpin.at} onDone={() => setWatched(rivalSpin.at)} />
  }

  let text = `Vez de ${turnName}.`
  if (!view.players[2]) text = 'Esperando seu amigo entrar pelo link.'
  else if (view.current && view.current.kind !== 'DUEL') text = `${turnName} está respondendo ${AREA_INFO[view.current.area].name}.`
  else if (view.phase === 'CROWN_CHOICE') text = `${turnName} está escolhendo um personagem.`
  else if (view.phase === 'DUEL' && view.duel) {
    text =
      view.duel.kind === 'FINAL'
        ? `${turnName} está no duelo final. Sua vez vem depois.`
        : view.duel.challenged === me
          ? `${turnName} te desafiou! Responda quando chegar sua vez.`
          : `${turnName} está respondendo o duelo.`
  }

  return (
    <motion.div className="flex flex-1 flex-col items-center justify-center gap-5 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {view.phase === 'DUEL' ? (
        <SwordsIcon size={48} className="text-coringa-gold" />
      ) : (
        <div className="flex gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-3 rounded-full bg-coringa-gold"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
            />
          ))}
        </div>
      )}
      <p className="font-display max-w-xs text-xl font-semibold">{text}</p>
      <p className="text-sm text-white/60">A tela atualiza sozinha quando for sua vez.</p>
      {view.players[2] && view.status === 'ACTIVE' && (
        <WhatsAppLink text={`Sua vez no Mestre dos Negócios, ${turnName}! ${inviteLink(view.code)}`} className="mt-2 px-5 py-2 text-base">
          Avisar {turnName} no WhatsApp
        </WhatsAppLink>
      )}
    </motion.div>
  )
}

/** Roleta do rival girando até a fatia que ele tirou. */
function RivalSpin({ name, slice, at, onDone }: { name: string; slice: Slice; at: number; onDone: () => void }) {
  // Atualização atrasada (aba voltou do segundo plano): pula a animação.
  const [late] = useState(() => serverNow() > at + RULES.spinRevealMs)
  const [landed, setLanded] = useState(false)
  const done = useRef(onDone)

  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!late && !landed) return
    const t = setTimeout(() => done.current(), late ? 0 : LANDED_PAUSE_MS)
    return () => clearTimeout(t)
  }, [late, landed])

  if (late) return null
  return <SpinView playerName={name} canSpin={false} spinning target={slice} landed={landed} onLanded={() => setLanded(true)} />
}

/** Código e link do convite enquanto o segundo jogador não entrou. */
export function InviteBanner({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const link = inviteLink(code)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Copie o link do convite:', link)
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'Mestre dos Negócios', text: 'Te desafio no Mestre dos Negócios!', url: link })
    } catch {
      // Compartilhamento cancelado.
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-coringa-gold/15 p-3 ring-1 ring-coringa-gold/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-coringa-gold">Convide um amigo</p>
          <p className="font-display text-2xl font-bold tracking-[0.2em]">{code}</p>
        </div>
        <div className="flex gap-2">
          {'share' in navigator && (
            <Button variant="secondary" className="px-4 py-2 text-base" onClick={share}>
              Enviar
            </Button>
          )}
          <Button className="px-4 py-2 text-base" onClick={copy}>
            {copied ? 'Copiado!' : 'Copiar link'}
          </Button>
        </div>
      </div>
      <WhatsAppLink text={`Te desafio no Mestre dos Negócios! Entra aqui: ${link}`} className="px-4 py-2 text-base">
        Desafiar pelo WhatsApp
      </WhatsAppLink>
    </section>
  )
}
