function hash(ix: number, iz: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

function fade(t: number): number {
  return t * t * (3 - 2 * t)
}

export function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const fx = fade(x - x0)
  const fz = fade(z - z0)
  const v00 = hash(x0, z0)
  const v10 = hash(x0 + 1, z0)
  const v01 = hash(x0, z0 + 1)
  const v11 = hash(x0 + 1, z0 + 1)
  const a = v00 * (1 - fx) + v10 * fx
  const b = v01 * (1 - fx) + v11 * fx
  return a * (1 - fz) + b * fz
}

export function fbm(x: number, z: number, octaves = 5): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq) * amp
    norm += amp
    amp *= 0.5
    freq *= 2.07
  }
  return sum / norm
}
