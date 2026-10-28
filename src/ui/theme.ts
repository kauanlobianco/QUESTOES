import type { Area, PlayerNo, Slice } from '../engine'
import { AREA_INFO, CORINGA_INFO } from '../content/areas'

/** Cor de destaque de cada jogador (independente das áreas). */
export const PLAYER_ACCENT: Record<PlayerNo, string> = {
  1: '#fbbf24',
  2: '#22d3ee',
}

export function sliceInfo(slice: Slice) {
  return slice === 'coringa' ? { name: CORINGA_INFO.name, color: CORINGA_INFO.color } : AREA_INFO[slice]
}

export function areaName(area: Area) {
  return AREA_INFO[area].name
}
