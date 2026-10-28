import { setMuted, useMuted } from './feedback'
import { SoundIcon } from './icons'

export function SoundToggle({ className = '' }: { className?: string }) {
  const muted = useMuted()
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      className={`rounded-full p-2 hover:bg-white/10 ${className}`}
      aria-label={muted ? 'Ligar som e vibração' : 'Desligar som e vibração'}
      aria-pressed={!muted}
    >
      <SoundIcon size={20} muted={muted} />
    </button>
  )
}
