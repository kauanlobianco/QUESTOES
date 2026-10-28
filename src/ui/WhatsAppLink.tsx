import { whatsappUrl } from '../game/share'

/** Abre o WhatsApp (app ou web) com a mensagem pronta; a pessoa escolhe o contato. */
export function WhatsAppLink({ text, children, className = '' }: { text: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={whatsappUrl(text)}
      target="_blank"
      rel="noreferrer"
      className={`font-display inline-flex items-center justify-center rounded-2xl bg-[#25d366] px-6 py-3 text-lg font-semibold text-[#063d1f] shadow-[0_5px_0_#128c4b] transition active:translate-y-[3px] active:shadow-[0_2px_0_#128c4b] ${className}`}
    >
      {children}
    </a>
  )
}
