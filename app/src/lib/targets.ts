import type { TrailPoint } from './gesture'

export type Target = {
  id: number
  x: number
  y: number
  radius: number
  hit: boolean
}

export function createTargets(width: number, height: number): Target[] {
  const safeWidth = Math.max(width, 320)
  const safeHeight = Math.max(height, 480)

  return [0, 1, 2].map((index) => ({
    id: index + 1,
    x: safeWidth * (0.25 + index * 0.25),
    y: safeHeight * (0.32 + (index % 2) * 0.18),
    radius: 34,
    hit: false,
  }))
}

export function detectHits(targets: Target[], trail: TrailPoint[], slashReady: boolean) {
  if (!slashReady || trail.length < 2) return targets

  return targets.map((target) => {
    if (target.hit) return target

    const touched = trail.some((point) => {
      const dx = point.x - target.x
      const dy = point.y - target.y
      return Math.hypot(dx, dy) <= target.radius
    })

    return touched ? { ...target, hit: true } : target
  })
}

export function countHits(targets: Target[]) {
  return targets.filter((target) => target.hit).length
}
