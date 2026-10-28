import type { Area } from '../engine'
import empreendedorismoFicha from '../assets/fichas/empreendedorismo.webp'
import marketingFicha from '../assets/fichas/marketing.webp'
import financasFicha from '../assets/fichas/financas.webp'
import operacoesFicha from '../assets/fichas/operacoes.webp'
import liderancaFicha from '../assets/fichas/lideranca.webp'
import estrategiaFicha from '../assets/fichas/estrategia.webp'
import coringaHero from '../assets/heroes/coringa.svg'

export interface AreaInfo {
  key: Area
  name: string
  tagline: string
  /** Classe/variável CSS: var(--color-<key>) */
  color: string
  /** Mesma cor em hex, para canvas/confete. */
  hex: string
  ficha: string
}

export const AREA_INFO: Record<Area, AreaInfo> = {
  empreendedorismo: {
    key: 'empreendedorismo',
    name: 'Empreendedorismo',
    tagline: 'Identificar oportunidades, criar valor e transformar ideias em negócios.',
    color: 'var(--color-empreendedorismo)',
    hex: '#8b5cf6',
    ficha: empreendedorismoFicha,
  },
  marketing: {
    key: 'marketing',
    name: 'Marketing',
    tagline: 'Conhecer o cliente, comunicar valor e conquistar mercado.',
    color: 'var(--color-marketing)',
    hex: '#ec4899',
    ficha: marketingFicha,
  },
  financas: {
    key: 'financas',
    name: 'Finanças',
    tagline: 'Capital, custos, investimento e retorno na palma da mão.',
    color: 'var(--color-financas)',
    hex: '#16a34a',
    ficha: financasFicha,
  },
  operacoes: {
    key: 'operacoes',
    name: 'Operações',
    tagline: 'Processos, projetos, qualidade e fluxo de entrega.',
    color: 'var(--color-operacoes)',
    hex: '#2563eb',
    ficha: operacoesFicha,
  },
  lideranca: {
    key: 'lideranca',
    name: 'Liderança',
    tagline: 'Pessoas, cultura, motivação e quem inspira o time.',
    color: 'var(--color-lideranca)',
    hex: '#f97316',
    ficha: liderancaFicha,
  },
  estrategia: {
    key: 'estrategia',
    name: 'Estratégia',
    tagline: 'Visão, posicionamento e onde a empresa quer chegar.',
    color: 'var(--color-estrategia)',
    hex: '#eab308',
    ficha: estrategiaFicha,
  },
}

export const CORINGA_INFO = {
  name: 'Coringa',
  tagline: 'Escolha um personagem para conquistar ou desafie seu rival.',
  color: 'var(--color-coringa)',
  hero: coringaHero,
}
