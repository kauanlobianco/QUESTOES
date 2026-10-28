import { useRouteError } from 'react-router'
import { Button } from '../ui/Button'

/** Erro inesperado numa tela (ou versão nova publicada no meio do uso). */
export function CrashScreen() {
  const error = useRouteError()
  console.error(error)
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl font-bold text-coringa-gold">Ops, algo deu errado</h1>
      <p className="text-white/75">Recarregue a página. Sua partida está salva no servidor.</p>
      <Button onClick={() => location.reload()}>Recarregar</Button>
      <a href="/" className="text-sm underline text-white/70">
        Voltar ao início
      </a>
    </main>
  )
}
