import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-coringa-gold text-coringa-deep shadow-[0_5px_0_#b45309] active:translate-y-[3px] active:shadow-[0_2px_0_#b45309]',
  secondary: 'bg-white text-ink shadow-[0_5px_0_#cbd5e1] active:translate-y-[3px] active:shadow-[0_2px_0_#cbd5e1]',
  ghost: 'bg-white/10 text-paper hover:bg-white/15',
  danger: 'bg-rose-500 text-white shadow-[0_5px_0_#9f1239] active:translate-y-[3px] active:shadow-[0_2px_0_#9f1239]',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`font-display rounded-2xl px-6 py-3 text-lg font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
