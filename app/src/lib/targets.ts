import type { TrailPoint } from './gesture'

export type Target = {
  id: number
  x: number
  y: number
  radius: number
  hit: boolean
  hitAt?: number
}

export function createTargets(width: number, height: number, count = 3): Target[] {
  const safeWidth = Math.max(width, 320)
  const safeHeight = Math.max(height, 480)

  return Array.from({ length: count }, (_, index) => ({
    id: Date.now() + index,
    x: safeWidth * (0.18 + Math.random() * 0.64),
    y: safeHeight * (0.22 + Math.random() * 0.46),
    radius: 44,
    hit: false,
  }))
}

export function respawnTarget(width: number, height: number): Target {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    x: Math.max(width, 320) * (0.18 + Math.random() * 0.64),
    y: Math.max(height, 480) * (0.22 + Math.random() * 0.46),
    radius: 44,
    hit: false,
  }
}

export function detectHits(targets: Target[], trail: TrailPoint[], slashReady: boolean) {
  if (!slashReady || trail.length < 2) return targets

  return targets.map((target) => {
    if (target.hit) return target

    const touched = trail.some((point) => {
      const dx = point.x - target.x
      const dy = point.y - target.y
      return Math.hypot(dx, dy) <= target.radius * 1.3
    })

    return touched ? { ...target, hit: true, hitAt: Date.now() } : target
  })
}
