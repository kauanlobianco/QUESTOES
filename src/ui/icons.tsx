import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

export function CrownIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden {...props}>
      <path d="M3 8.5l4.2 3.4L12 5l4.8 6.9L21 8.5l-1.8 9.2H4.8L3 8.5z" />
      <rect x="4.8" y="18.8" width="14.4" height="2.2" rx="1.1" />
    </svg>
  )
}

export function SparkleIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden {...props}>
      <path d="M12 2l2.4 7.1L22 12l-7.6 2.9L12 22l-2.4-7.1L2 12l7.6-2.9z" />
    </svg>
  )
}

export function SwordsIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <path d="M13 19l6-6M16 16l4 4M19 21l2-2" />
      <path d="M9.5 6.5L13 3h3v3l-3.5 3.5" />
      <path d="M5 14l4 4M7 17l-3 3M3 19l2 2" />
    </svg>
  )
}

export function CloseIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function FlagIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  )
}
