import { motion } from 'motion/react'
import { useState } from 'react'
import { crownChoices, duelChoices, other, type Area, type MatchView, type PlayerNo } from '../../engine'
import { AREA_INFO } from '../../content/areas'
import { Button } from '../../ui/Button'
import { Ficha } from '../../ui/Ficha'
import { CrownIcon, SparkleIcon, SwordsIcon } from '../../ui/icons'
import { Mascot } from '../../ui/Mascot'

interface CrownChoiceViewProps {
  view: MatchView
  me: PlayerNo
  busy: boolean
  onChooseCrown: (area: Area) => void
  onStartDuel: (requested: Area, offered: Area) => void
}

export function CrownChoiceView({ view, me, busy, onChooseCrown, onStartDuel }: CrownChoiceViewProps) {
  const [mode, setMode] = useState<'crown' | 'duel'>('crown')
  const choices = crownChoices(view, me)
  const duel = duelChoices(view, me)
  const canDuel = duel.requestable.length > 0 && duel.offerable.length > 0
  const opponent = view.players[other(me)]

  if (mode === 'duel' && opponent) {
    return <DuelSetup duel={duel} opponentName={opponent.name} busy={busy} onBack={() => setMode('crown')} onConfirm={onStartDuel} />
  }

  return (
    <motion.div className="flex flex-1 flex-col gap-5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <header className="text-center">
        <p className="inline-flex items-center gap-2 rounded-full bg-coringa-gold px-3 py-1 text-sm font-bold text-coringa-deep">
          {view.crownCause === 'CORINGA' ? <SparkleIcon size={16} /> : <CrownIcon size={16} />}
          {view.crownCause === 'CORINGA' ? 'Coringa!' : 'Medidor cheio!'}
        </p>
        <h2 className="font-display mt-3 text-2xl font-bold">Escolha um personagem</h2>
        <p className="text-sm text-white/70">Acerte a pergunta de coroa para conquistá-lo.</p>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {choices.map((area, i) => (
          <motion.li key={area} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.05 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onChooseCrown(area)}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-b-4 p-3 shadow-lg transition active:scale-95 disabled:opacity-60"
              style={{ background: `var(--color-${area}-soft)`, borderColor: AREA_INFO[area].color }}
            >
              <Mascot area={area} size={80} intro="enter" introDelay={i * 70} interactive={false} />
              <span className="font-display font-semibold" style={{ color: `var(--color-${area}-deep)` }}>
                {AREA_INFO[area].name}
              </span>
            </button>
          </motion.li>
        ))}
      </ul>

      {canDuel && opponent && (
        <Button variant="secondary" className="mt-auto flex items-center justify-center gap-2" disabled={busy} onClick={() => setMode('duel')}>
          <SwordsIcon size={20} /> Desafiar {opponent.name}
        </Button>
      )}
    </motion.div>
  )
}

function DuelSetup(props: {
  duel: { requestable: Area[]; offerable: Area[] }
  opponentName: string
  busy: boolean
  onBack: () => void
  onConfirm: (requested: Area, offered: Area) => void
}) {
  const { duel, opponentName, busy, onBack, onConfirm } = props
  const [requested, setRequested] = useState<Area | null>(duel.requestable.length === 1 ? duel.requestable[0]! : null)
  const [offered, setOffered] = useState<Area | null>(duel.offerable.length === 1 ? duel.offerable[0]! : null)

  return (
    <motion.div className="flex flex-1 flex-col gap-5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
      <header className="text-center">
        <SwordsIcon size={36} className="mx-auto text-coringa-gold" />
        <h2 className="font-display mt-2 text-2xl font-bold">Duelo contra {opponentName}</h2>
        <p className="text-sm text-white/70">6 perguntas, uma de cada área. Mais acertos vence; empate, quem foi mais rápido.</p>
      </header>

      <Picker label={`Personagem que você quer de ${opponentName}`} areas={duel.requestable} value={requested} onChange={setRequested} />
      <Picker label="Personagem seu que fica em jogo" areas={duel.offerable} value={offered} onChange={setOffered} />

      <div className="mt-auto flex gap-3">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Voltar
        </Button>
        <Button className="flex-1" disabled={!requested || !offered || busy} onClick={() => onConfirm(requested!, offered!)}>
          Começar duelo
        </Button>
      </div>
    </motion.div>
  )
}

function Picker({ label, areas, value, onChange }: { label: string; areas: Area[]; value: Area | null; onChange: (a: Area) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-white/80">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {areas.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onChange(a)}
            aria-pressed={value === a}
            className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 font-semibold transition ${value === a ? 'bg-white text-ink' : 'bg-white/10'}`}
          >
            <Ficha area={a} size={30} />
            {AREA_INFO[a].name}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
