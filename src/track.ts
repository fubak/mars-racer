export const ELLIPSE_A = 320
export const ELLIPSE_B = 200
export const TRACK_HALF_WIDTH = 15
export const GATE_COUNT = 8

export function ellipsePoint(t: number): { x: number; z: number; tx: number; tz: number } {
  const x = ELLIPSE_A * Math.cos(t)
  const z = ELLIPSE_B * Math.sin(t)
  const dx = -ELLIPSE_A * Math.sin(t)
  const dz = ELLIPSE_B * Math.cos(t)
  const len = Math.hypot(dx, dz) || 1
  return { x, z, tx: dx / len, tz: dz / len }
}

/** Approximate meters from the racing line. */
export function trackDistance(x: number, z: number): number {
  const radial = Math.hypot(x / ELLIPSE_A, z / ELLIPSE_B)
  const scale = (ELLIPSE_A + ELLIPSE_B) * 0.5
  return Math.abs(radial - 1) * scale
}

export function ellipseT(x: number, z: number): number {
  return Math.atan2(z / ELLIPSE_B, x / ELLIPSE_A)
}

export function wrapAngle(a: number): number {
  let v = a
  while (v > Math.PI) v -= Math.PI * 2
  while (v < -Math.PI) v += Math.PI * 2
  return v
}
