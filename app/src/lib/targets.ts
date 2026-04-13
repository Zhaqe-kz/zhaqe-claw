import type { TrailPoint } from './gesture'

export type Target = {
  id: number
  x: number
  y: number
  radius: number
  hit: boolean
  hitAt?: number
  pulseOffset: number
}

function randomPosition(width: number, height: number) {
  return {
    x: Math.max(width, 320) * (0.18 + Math.random() * 0.64),
    y: Math.max(height, 480) * (0.22 + Math.random() * 0.46),
  }
}

function createTarget(width: number, height: number, idSeed: number, radius: number): Target {
  const pos = randomPosition(width, height)
  return {
    id: idSeed,
    x: pos.x,
    y: pos.y,
    radius,
    hit: false,
    pulseOffset: Math.random() * Math.PI * 2,
  }
}

export function createTargets(width: number, height: number, count = 3, radius = 44): Target[] {
  return Array.from({ length: count }, (_, index) =>
    createTarget(width, height, Date.now() + index, radius),
  )
}

export function respawnTarget(prev: Target, width: number, height: number, radius = prev.radius): Target {
  let next = randomPosition(width, height)
  let tries = 0

  while (Math.hypot(next.x - prev.x, next.y - prev.y) < 140 && tries < 12) {
    next = randomPosition(width, height)
    tries += 1
  }

  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    x: next.x,
    y: next.y,
    radius,
    hit: false,
    pulseOffset: Math.random() * Math.PI * 2,
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
