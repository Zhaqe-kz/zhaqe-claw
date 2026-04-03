export type TrailPoint = {
  x: number
  y: number
  t: number
}

export function clampTrail(points: TrailPoint[], max = 12) {
  return points.slice(-max)
}

export function estimateSwipe(points: TrailPoint[]) {
  if (points.length < 3) {
    return { speed: 0, isSlash: false }
  }

  const first = points[0]
  const last = points[points.length - 1]
  const dt = Math.max((last.t - first.t) / 1000, 0.001)
  const dx = last.x - first.x
  const dy = last.y - first.y
  const distance = Math.hypot(dx, dy)
  const speed = distance / dt

  return {
    speed,
    isSlash: speed > 260,
  }
}
