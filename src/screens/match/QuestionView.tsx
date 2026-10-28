import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { serverNow } from '../../game/clock'
import type { AnswerReveal, PublicQuestion } from '../../engine'
import { AREA_INFO } from '../../content/areas'
import { Button } from '../../ui/Button'
import { play, vibrate } from '../../ui/feedback'
import { Mascot, type MascotHandle, type MascotState } from '../../ui/Mascot'
import { CrownIcon, SwordsIcon } from '../../ui/icons'

const LETTERS = ['A', 'B', 'C', 'D']

interface QuestionViewProps {
  question: PublicQuestion
  playerName: string
  chosen: number | null
  reveal: AnswerReveal | null
  /** Resposta enviada, aguardando o servidor. */
  waiting: boolean
  duelProgress?: { index: number; total: number }
  continueLabel: string
  onAnswer: (option: number | null) => void
  onContinue: () => void
}

export function QuestionView(props: QuestionViewProps) {
  const { question, playerName, chosen, reveal, waiting, duelProgress, continueLabel, onAnswer, onContinue } = props
  const area = AREA_INFO[question.area]
  const answered = chosen !== null || waiting || reveal !== null
  const mascot = useRef<MascotHandle>(null)
  const [urgent, setUrgent] = useState(false)
  // O personagem da área acompanha a pergunta: pensa no aperto do tempo e reage à resposta.
  const mood: MascotState = reveal ? (reveal.correct ? 'happy' : 'sad') : urgent && !answered ? 'think' : 'idle'

  return (
    <motion.div
      key={question.id}
      className="flex min-h-dvh flex-col"
      style={{ background: `linear-gradient(180deg, ${area.color} 0%, var(--color-${question.area}-deep) 100%)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-3">
          <Mascot ref={mascot} area={question.area} size={64} label={area.name} mood={mood} className="-my-2" />
          <div className="min-w-0">
            <p className="font-display text-xl font-bold leading-tight">{area.name}</p>
            <p className="text-sm font-semibold text-white/80">
              {question.kind === 'CROWN' && (
                <span className="inline-flex items-center gap-1 text-coringa-gold">
                  <CrownIcon size={14} /> Pergunta de coroa ·{' '}
                </span>
              )}
              {question.kind === 'DUEL' && duelProgress && (
                <span className="inline-flex items-center gap-1">
                  <SwordsIcon size={14} /> Duelo {duelProgress.index}/{duelProgress.total} ·{' '}
                </span>
              )}
              Vez de {playerName}
            </p>
          </div>
          <Countdown question={question} stopped={answered} onTimeout={() => onAnswer(null)} onUrgentChange={setUrgent} />
        </header>

        <motion.div
          className="rounded-3xl bg-white p-5 text-ink shadow-xl"
          initial={{ y: 20, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        >
          <QuestionTags question={question} />
          {question.scenario && (
            <div className="mb-3 border-b border-ink/10 pb-3">
              {question.scenario.title && (
                <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: `var(--color-${question.area}-deep)` }}>
                  {question.scenario.title}
                </p>
              )}
              <p className="mt-1 leading-snug text-ink-soft">{question.scenario.text}</p>
            </div>
          )}
          <p className="text-lg font-bold leading-snug" data-testid="question-text">
            {question.text}
          </p>
        </motion.div>

        <ol className="flex flex-col gap-2.5">
          {question.options.map((text, i) => (
            <Option
              key={i}
              index={i}
              text={text}
              state={optionState(i, chosen, reveal)}
              disabled={answered}
              onClick={() => onAnswer(i)}
              onLook={(el) => mascot.current?.lookAt(answered ? null : el)}
            />
          ))}
        </ol>

        {reveal && <Feedback reveal={reveal} continueLabel={continueLabel} onContinue={onContinue} />}
      </div>
    </motion.div>
  )
}

const DIFFICULTY = [
  { max: 2, label: 'Fácil', dots: 1 },
  { max: 3, label: 'Média', dots: 2 },
  { max: Infinity, label: 'Difícil', dots: 3 },
]

/** Dificuldade e, nas interdisciplinares, as outras áreas que a questão cobra. */
function QuestionTags({ question }: { question: PublicQuestion }) {
  const level = DIFFICULTY.find((d) => question.difficulty <= d.max)!
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-bold">
      <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-1 text-ink-soft" aria-label={`Dificuldade: ${level.label}`}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`size-1.5 rounded-full ${i <= level.dots ? 'bg-ink-soft' : 'bg-ink/15'}`} />
        ))}
        {level.label}
      </span>
      {question.secondaryAreas.map((a) => (
        <span key={a} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-white" style={{ background: AREA_INFO[a].color }}>
          + {AREA_INFO[a].name}
        </span>
      ))}
    </div>
  )
}

type OptionState = 'idle' | 'chosen' | 'correct' | 'wrong' | 'faded'

function optionState(i: number, chosen: number | null, reveal: AnswerReveal | null): OptionState {
  if (!reveal) return chosen === i ? 'chosen' : 'idle'
  if (i === reveal.correctIndex) return 'correct'
  if (i === chosen) return 'wrong'
  return 'faded'
}

const OPTION_STYLE: Record<OptionState, string> = {
  idle: 'bg-white text-ink shadow-[0_4px_0_rgba(0,0,0,0.18)] active:translate-y-[2px]',
  chosen: 'bg-white text-ink ring-4 ring-coringa-gold animate-pulse',
  correct: 'bg-emerald-500 text-white ring-4 ring-white',
  wrong: 'bg-rose-500 text-white',
  faded: 'bg-white/60 text-ink/60',
}

function Option(props: {
  index: number
  text: string
  state: OptionState
  disabled: boolean
  onClick: () => void
  /** Mascote olha para a alternativa sob o dedo/mouse ou com foco. */
  onLook: (el: Element | null) => void
}) {
  const { index, text, state, disabled, onClick, onLook } = props
  return (
    <motion.li
      initial={{ x: -16, opacity: 0 }}
      animate={
        state === 'wrong'
          ? { x: [0, -8, 8, -6, 6, 0], opacity: 1 }
          : state === 'correct'
            ? { scale: [1, 1.04, 1], x: 0, opacity: 1 }
            : { x: 0, opacity: 1 }
      }
      transition={{ delay: state === 'idle' ? 0.08 * index : 0, duration: 0.35 }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        onPointerEnter={(e) => onLook(e.currentTarget)}
        onPointerLeave={() => onLook(null)}
        onFocus={(e) => onLook(e.currentTarget)}
        onBlur={() => onLook(null)}
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold transition ${OPTION_STYLE[state]}`}
      >
        <span className="font-display grid size-8 shrink-0 place-items-center rounded-xl bg-black/10 text-base font-bold">
          {LETTERS[index]}
        </span>
        <span className="leading-snug">{text}</span>
      </button>
    </motion.li>
  )
}

function Feedback({ reveal, continueLabel, onContinue }: { reveal: AnswerReveal; continueLabel: string; onContinue: () => void }) {
  useEffect(() => {
    play(reveal.correct ? 'correct' : 'wrong')
    vibrate(reveal.correct ? 40 : [70, 50, 70])
  }, [reveal.correct])

  const title = reveal.correct ? 'Acertou!' : reveal.timeout ? 'Tempo esgotado!' : 'Errou!'
  return (
    <motion.div
      className="mt-auto flex flex-col gap-3"
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
    >
      <div className="flex flex-col gap-2 rounded-2xl bg-black/25 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className={`font-display text-2xl font-bold ${reveal.correct ? 'text-emerald-300' : 'text-rose-200'}`}>{title}</p>
          {reveal.xp > 0 && (
            <motion.span
              className="font-display rounded-full bg-coringa-gold px-3 py-1 text-base font-bold text-coringa-deep"
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 14, delay: 0.15 }}
            >
              +{reveal.xp} XP
            </motion.span>
          )}
        </div>
        {reveal.optionFeedback && <p className="text-sm leading-relaxed text-rose-100">{reveal.optionFeedback}</p>}
        <p className="font-semibold leading-snug">{reveal.feedback}</p>
        {reveal.explanation && (
          <details className="text-sm text-white/80">
            <summary className="cursor-pointer font-bold text-white/90">Saiba mais</summary>
            <p className="mt-1 leading-relaxed">{reveal.explanation}</p>
          </details>
        )}
      </div>
      <Button onClick={onContinue} autoFocus>
        {continueLabel}
      </Button>
    </motion.div>
  )
}

/** Contagem regressiva a partir do relógio do servidor (servedAt + limite). */
function Countdown(props: { question: PublicQuestion; stopped: boolean; onTimeout: () => void; onUrgentChange: (urgent: boolean) => void }) {
  const { question, stopped, onTimeout, onUrgentChange } = props
  const deadline = question.servedAt + question.timeLimitMs
  const [now, setNow] = useState(serverNow)
  const fired = useRef(false)
  const timeout = useRef(onTimeout)

  useEffect(() => {
    timeout.current = onTimeout
  }, [onTimeout])

  useEffect(() => {
    if (stopped) return
    const id = setInterval(() => {
      const t = serverNow()
      setNow(t)
      if (t >= deadline && !fired.current) {
        fired.current = true
        timeout.current()
      }
    }, 100)
    return () => clearInterval(id)
  }, [deadline, stopped])

  const remaining = Math.max(0, Math.min(question.timeLimitMs, deadline - now))
  const fraction = remaining / question.timeLimitMs
  const urgent = remaining < 5000
  const seconds = Math.ceil(remaining / 1000)

  useEffect(() => {
    if (urgent && !stopped && seconds > 0) play('urgent')
  }, [urgent, stopped, seconds])

  useEffect(() => {
    onUrgentChange(urgent && !stopped)
  }, [urgent, stopped, onUrgentChange])

  return (
    <div className="relative ml-auto grid size-14 shrink-0 place-items-center" aria-label={`${seconds} segundos`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke={urgent ? '#fb7185' : '#fff'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${fraction * 97.4} 97.4`}
          style={{ transition: 'stroke-dasharray 100ms linear' }}
        />
      </svg>
      <span className={`font-display relative text-lg font-bold ${urgent && !stopped ? 'animate-pulse text-rose-200' : ''}`}>
        {seconds}
      </span>
    </div>
  )
}
