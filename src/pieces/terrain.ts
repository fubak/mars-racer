import * as THREE from 'three'
import { fbm, valueNoise } from '../noise.ts'
import { FOG_DENSITY, HORIZON } from '../palette.ts'
import { ellipsePoint, trackDistance } from '../track.ts'

export const WORLD = 1400
export const FIELD = 321

const CRATERS = [
  { x: 210, z: -40, r: 78, d: 9 },
  { x: -250, z: 120, r: 120, d: 14 },
  { x: 30, z: 300, r: 52, d: 6 },
  { x: -80, z: -280, r: 90, d: 11 },
  { x: 420, z: 180, r: 60, d: 7 },
  { x: -480, z: -160, r: 70, d: 8 },
  { x: 140, z: 80, r: 28, d: 3.2 },
  { x: -30, z: -90, r: 22, d: 2.4 },
]

const SHOULDER_IN = 10
const SHOULDER_OUT = 28

let field: Float32Array | null = null

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function mix(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t
}

function craterHeight(x: number, z: number): number {
  let h = 0
  for (const c of CRATERS) {
    const meters = Math.hypot(x - c.x, z - c.z)
    if (meters > c.r * 1.4) continue
    const dist = meters / c.r
    const bowl = dist < 1 ? Math.cos(dist * Math.PI) * 0.5 + 0.5 : 0
    const rim = Math.exp(-(((meters - c.r * 0.9) / 8) ** 2))
    h += -bowl * c.d + rim * c.d * 0.26
  }
  return h
}

function craterBowl(x: number, z: number): number {
  let bowl = 0
  for (const c of CRATERS) {
    const meters = Math.hypot(x - c.x, z - c.z)
    if (meters > c.r) continue
    const dist = meters / c.r
    bowl = Math.max(bowl, Math.cos(dist * Math.PI) * 0.5 + 0.5)
  }
  return bowl
}

function warped(x: number, z: number): { x: number; z: number } {
  return {
    x: x + (valueNoise(x * 0.0034 + 1.7, z * 0.0034) - 0.5) * 20,
    z: z + (valueNoise(x * 0.0034, z * 0.0034 + 4.1) - 0.5) * 20,
  }
}

/**
 * Long roll everywhere, plus 50–85m dunes a few meters tall.
 * Inside 10m of the racing line the dune weight stays tiny so the
 * driving line does not turn into a shoulder or a cliff.
 */
function duneField(x: number, z: number): number {
  const w = warped(x, z)
  const broad = valueNoise(w.x * 0.013, w.z * 0.0116)
  const mid = valueNoise(w.x * 0.0188 + 23, w.z * 0.0164 + 8)
  const mound = (u: number) => {
    const t = clamp01((u - 0.2) / 0.8)
    return t * t * (3 - 2 * t)
  }
  const roll = (broad - 0.5) * 2.2 + (mid - 0.5) * 1.15
  return mound(broad) * 4.8 + mound(mid) * 2.5 + roll
}

function terrainHeight(x: number, z: number): number {
  const dist = trackDistance(x, z)
  const shoulder = smoothstep(SHOULDER_IN, SHOULDER_OUT, dist)
  const ribbon = (fbm(x * 0.0024, z * 0.0021, 2) - 0.5) * 4.2
  const duneKeep = 0.07 + 0.93 * shoulder
  const craters = craterHeight(x, z) * smoothstep(24, 56, dist)
  return ribbon + duneField(x, z) * duneKeep + craters
}

export function ensureField(): Float32Array {
  if (field) return field
  const data = new Float32Array(FIELD * FIELD)
  for (let iz = 0; iz < FIELD; iz++) {
    const z = (iz / (FIELD - 1) - 0.5) * WORLD
    for (let ix = 0; ix < FIELD; ix++) {
      const x = (ix / (FIELD - 1) - 0.5) * WORLD
      data[iz * FIELD + ix] = terrainHeight(x, z)
    }
  }
  field = data
  return data
}

export function heightAt(x: number, z: number): number {
  const data = ensureField()
  const u = (x / WORLD + 0.5) * (FIELD - 1)
  const v = (z / WORLD + 0.5) * (FIELD - 1)
  const x0 = Math.max(0, Math.min(FIELD - 2, Math.floor(u)))
  const z0 = Math.max(0, Math.min(FIELD - 2, Math.floor(v)))
  const fx = Math.max(0, Math.min(1, u - x0))
  const fz = Math.max(0, Math.min(1, v - z0))
  const i = z0 * FIELD + x0
  const h00 = data[i] ?? 0
  const h10 = data[i + 1] ?? 0
  const h01 = data[i + FIELD] ?? 0
  const h11 = data[i + FIELD + 1] ?? 0
  const a = h00 * (1 - fx) + h10 * fx
  const b = h01 * (1 - fx) + h11 * fx
  return a * (1 - fz) + b * fz
}

type Collider = { x: number; z: number; r: number }
const colliders: Collider[] = []

export function pushOut(
  x: number,
  z: number,
  radius: number,
  rocks: readonly Collider[],
): { x: number; z: number; hit: boolean } {
  let hit = false
  for (let pass = 0; pass < 2; pass++) {
    for (const rock of rocks) {
      const dx = x - rock.x
      const dz = z - rock.z
      const min = radius + rock.r
      const distSq = dx * dx + dz * dz
      if (distSq >= min * min) continue
      const dist = Math.sqrt(distSq) || 0.0001
      const push = (min - dist) / dist
      x += dx * push
      z += dz * push
      hit = true
    }
  }
  return { x, z, hit }
}

export function resolveRocks(x: number, z: number, radius: number): { x: number; z: number; hit: boolean } {
  return pushOut(x, z, radius, colliders)
}

function nearTruckColor(x: number, z: number): [number, number, number] | null {
  const p = ellipsePoint(0.35)
  const dx = x - p.x
  const dz = z - p.z
  const along = dx * p.tx + dz * p.tz
  const cross = dx * -p.tz + dz * p.tx
  if (Math.hypot(along, cross) > 22) return null
  if (Math.abs(cross) < 1.7 && Math.abs(along) < 4) {
    return [0.32, 0.14, 0.07]
  }
  return [1, 1, 1]
}

function groundColor(x: number, z: number): [number, number, number] {
  const near = nearTruckColor(x, z)
  if (near) return near
  const dist = trackDistance(x, z)
  const patch = valueNoise(x * 0.105, z * 0.097)
  const fleck = valueNoise(x * 0.26 + 2.4, z * 0.23 + 8.1)
  let r: number
  let g: number
  let b: number
  if (patch > 0.62) {
    r = 1
    g = 0.86
    b = 0.62
  } else if (patch > 0.45) {
    r = 0.78
    g = 0.4
    b = 0.18
  } else if (patch > 0.28) {
    r = 0.55
    g = 0.5
    b = 0.44
  } else {
    r = 0.2
    g = 0.07
    b = 0.03
  }
  if (fleck > 0.84) {
    r = 1
    g = 0.92
    b = 0.78
  } else if (fleck < 0.12) {
    r = 0.1
    g = 0.04
    b = 0.02
  }
  const bowl = craterBowl(x, z) * smoothstep(16, 42, dist)
  r = mix(r, 0.1, bowl)
  g = mix(g, 0.04, bowl)
  b = mix(b, 0.03, bowl)
  const packed = 1 - smoothstep(11, 16, dist)
  r = mix(r, 0.045 + fleck * 0.03, packed)
  g = mix(g, 0.018, packed)
  b = mix(b, 0.012, packed)
  return [r, g, b]
}

function loadRepeat(url: string): THREE.Texture {
  const tex = new THREE.TextureLoader().load(url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

function detailTexture(): THREE.CanvasTexture {
  const size = 4
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context missing')
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      img.data[i] = 189
      img.data[i + 1] = 97
      img.data[i + 2] = 46
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 1
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.repeat.set(WORLD / 2, WORLD / 2)
  return tex
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeRock(seed: number, detail: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail)
  const pos = geo.attributes.position
  if (!pos) return geo
  const rand = mulberry32(seed)
  const ox = rand() * 90
  const oy = rand() * 90
  const oz = rand() * 90
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    n.copy(v).normalize()
    const warp =
      fbm(n.x * 1.35 + ox, n.y * 1.35 + oy, 3) * 0.68 +
      fbm(n.z * 2.05 + oz, n.x * 2.05 + ox, 2) * 0.32
    const lobe = Math.pow(clamp01(fbm(n.x * 0.85 + oy, n.z * 0.85 + oz, 2) - 0.38), 1.7)
    v.addScaledVector(n, (warp - 0.5) * 0.74 + lobe * 0.46)
    v.y *= 0.84
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

function scatter(
  mesh: THREE.InstancedMesh,
  rand: () => number,
  count: number,
  nearScale: number,
  farScale: number,
  solid: boolean,
): void {
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let placed = 0
  let guard = 0
  while (placed < count && guard < count * 40) {
    guard++
    let x: number
    let z: number
    if (rand() < 0.78) {
      const p = ellipsePoint(rand() * Math.PI * 2)
      const side = rand() < 0.5 ? -1 : 1
      const d = 24 + rand() * 70
      x = p.x - p.tz * d * side
      z = p.z + p.tx * d * side
    } else {
      x = (rand() - 0.5) * WORLD * 0.88
      z = (rand() - 0.5) * WORLD * 0.88
    }
    const dist = trackDistance(x, z)
    if (dist < 22) continue
    if (Math.abs(x) > WORLD * 0.46 || Math.abs(z) > WORLD * 0.46) continue
    const near = dist < 48
    const s = near ? nearScale * (0.55 + rand() * 0.9) : farScale * (0.35 + rand() * rand())
    const sy = s * (0.42 + rand() * 0.62)
    dummy.position.set(x, heightAt(x, z) - sy * 0.32, z)
    dummy.rotation.set(rand() * 0.6, rand() * Math.PI * 2, rand() * 0.6)
    dummy.scale.set(s * (0.72 + rand() * 0.55), sy, s * (0.7 + rand() * 0.6))
    dummy.updateMatrix()
    mesh.setMatrixAt(placed, dummy.matrix)
    if (solid) colliders.push({ x, z, r: Math.max(s, sy) * 0.5 })
    const dust = rand()
    color.setRGB(
      mix(0.82, 1.05, dust),
      mix(0.78, 1.0, dust),
      mix(0.72, 0.95, dust),
      THREE.SRGBColorSpace,
    )
    mesh.setColorAt(placed, color)
    placed++
  }
  mesh.count = placed
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
}

function placeViewRocks(mesh: THREE.InstancedMesh): void {
  const p = ellipsePoint(0.35)
  const spots = [
    { along: -5.5, cross: 2.3, scale: 1.1 },
    { along: -3.2, cross: -2.4, scale: 0.85 },
    { along: 4.8, cross: 2.3, scale: 1.25 },
    { along: 7.2, cross: -2.2, scale: 1.0 },
  ]
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  const rand = mulberry32(3)
  let placed = 0
  for (const spot of spots) {
    const x = p.x + p.tx * spot.along + -p.tz * spot.cross
    const z = p.z + p.tz * spot.along + p.tx * spot.cross
    if (Math.abs(spot.cross) < 5) continue
    const sy = spot.scale * (0.5 + rand() * 0.35)
    dummy.position.set(x, heightAt(x, z) - sy * 0.3, z)
    dummy.rotation.set(rand() * 0.45, rand() * Math.PI * 2, rand() * 0.45)
    dummy.scale.set(spot.scale * (0.8 + rand() * 0.4), sy, spot.scale * (0.75 + rand() * 0.45))
    dummy.updateMatrix()
    mesh.setMatrixAt(placed, dummy.matrix)
    color.setRGB(0.18 + rand() * 0.1, 0.11 + rand() * 0.05, 0.08 + rand() * 0.03, THREE.SRGBColorSpace)
    mesh.setColorAt(placed, color)
    placed++
  }
  mesh.count = placed
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
}

function butteGeometry(radius: number, height: number, seed: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius * 0.58, radius, height, 14, 5)
  const pos = geo.attributes.position
  if (!pos) return geo
  const rand = mulberry32(seed)
  const ox = rand() * 30
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const radial = Math.hypot(v.x, v.z) || 1
    const n = fbm(v.x * 0.07 + ox, v.z * 0.07, 2)
    const push = (n - 0.42) * radius * 0.16
    v.x += (v.x / radial) * push
    v.z += (v.z / radial) * push
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

export type Terrain = {
  heightAt: (x: number, z: number) => number
  update: (dt: number) => void
  dispose: () => void
}

export function createTerrain(scene: THREE.Scene): Terrain {
  ensureField()
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, FIELD - 1, FIELD - 1)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  if (!pos) throw new Error('terrain positions missing')
  const colorAttr = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3)
  geo.setAttribute('color', colorAttr)
  const tint = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, heightAt(x, z))
    const [r, g, b] = groundColor(x, z)
    tint.setRGB(r, g, b, THREE.SRGBColorSpace)
    colorAttr.setXYZ(i, tint.r, tint.g, tint.b)
  }
  pos.needsUpdate = true
  colorAttr.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingSphere()

  const detail = detailTexture()
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: detail,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
  })
  const sand = loadRepeat(`${import.meta.env.BASE_URL}textures/sand.jpg`)
  const rockTex = loadRepeat(`${import.meta.env.BASE_URL}textures/rock.jpg`)
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.sandMap = { value: sand }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vGritWorld;`,
      )
      .replace(
        '#include <project_vertex>',
        `vGritWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #include <project_vertex>`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vGritWorld;
        uniform sampler2D sandMap;
        float gritHash(vec2 p) {
          vec3 q = fract(vec3(p.xyx) * 0.1031);
          q += dot(q, q.yzx + 33.33);
          return fract((q.x + q.y) * q.z);
        }
        float gritNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = gritHash(i);
          float b = gritHash(i + vec2(1.0, 0.0));
          float c = gritHash(i + vec2(0.0, 1.0));
          float d = gritHash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float gritDist = length(vViewPosition);
        float gritFade = 1.0 - smoothstep(5.0, 11.0, gritDist);
        vec2 gritXZ = vGritWorld.xz;
        float gritN = gritNoise(gritXZ * 90.0) * 0.52
          + gritNoise(gritXZ * 38.0 + 19.2) * 0.30
          + gritNoise(gritXZ * 15.0 + 4.7) * 0.18;
        float gritSpeck = gritHash(floor(gritXZ * 140.0));
        gritN = mix(gritN, gritSpeck, 0.34);
        vec3 sandPhoto = texture2D(sandMap, gritXZ * 0.45).rgb;
        vec3 grit = sandPhoto * mix(0.78, 1.2, clamp(gritN, 0.0, 1.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, grit, gritFade);`,
      )
  }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  mesh.castShadow = false
  scene.add(mesh)

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0.02,
  })
  rockMat.onBeforeCompile = (shader) => {
    shader.uniforms.rockMap = { value: rockTex }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRockWorld;`,
      )
      .replace(
        '#include <project_vertex>',
        `vRockWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #include <project_vertex>`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRockWorld;
        uniform sampler2D rockMap;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 rockBlend = abs(normalize(vNormal));
        rockBlend /= rockBlend.x + rockBlend.y + rockBlend.z + 0.0001;
        vec3 rockPhoto = texture2D(rockMap, vRockWorld.yz * 0.7).rgb * rockBlend.x
          + texture2D(rockMap, vRockWorld.xz * 0.7).rgb * rockBlend.y
          + texture2D(rockMap, vRockWorld.xy * 0.7).rgb * rockBlend.z;
        diffuseColor.rgb *= rockPhoto;`,
      )
  }
  const rockGeos = [11, 29, 47].map((seed) => makeRock(seed, 2))
  const pebbleGeo = makeRock(71, 2)
  const viewGeo = rockGeos[0]
  if (!viewGeo) throw new Error('rock geometry missing')
  const viewRocks = new THREE.InstancedMesh(viewGeo, rockMat, 5)
  viewRocks.castShadow = false
  viewRocks.receiveShadow = true
  placeViewRocks(viewRocks)
  scene.add(viewRocks)
  rockGeos.forEach((rockGeo, index) => {
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 52)
    rocks.castShadow = false
    rocks.receiveShadow = true
    scatter(rocks, mulberry32(11 + index * 17), 52, 1.15, 4.2, true)
    scene.add(rocks)
  })
  const pebbles = new THREE.InstancedMesh(pebbleGeo, rockMat, 340)
  pebbles.castShadow = false
  pebbles.receiveShadow = true
  scatter(pebbles, mulberry32(19), 340, 0.42, 0.85, false)
  scene.add(pebbles)

  const mesaMat = new THREE.MeshStandardMaterial({
    color: 0x7a5340,
    roughness: 0.92,
    metalness: 0.03,
  })
  const mesaSpots = [
    [520, -80, 46, 34],
    [-560, 40, 60, 28],
    [80, 560, 38, 22],
    [-200, -540, 52, 30],
    [600, 420, 34, 18],
  ]
  const mesas: THREE.Mesh[] = []
  const mesaRand = mulberry32(5)
  mesaSpots.forEach(([x, z, radius, height], index) => {
    const g = butteGeometry(radius ?? 40, height ?? 20, 90 + index)
    const butteMat = mesaMat.clone()
    butteMat.color.multiplyScalar(0.92 + mesaRand() * 0.16)
    const m = new THREE.Mesh(g, butteMat)
    m.position.set(x ?? 0, heightAt(x ?? 0, z ?? 0) + (height ?? 20) * 0.42, z ?? 0)
    m.castShadow = true
    m.receiveShadow = true
    scene.add(m)
    mesas.push(m)
  })

  const fog = new THREE.Color(HORIZON.r, HORIZON.g, HORIZON.b)
  scene.background = fog
  scene.fog = new THREE.FogExp2(fog, FOG_DENSITY)

  return {
    heightAt,
    update() {},
    dispose() {
      geo.dispose()
      mat.map?.dispose()
      mat.dispose()
      rockMat.dispose()
      for (const g of rockGeos) g.dispose()
      pebbleGeo.dispose()
      for (const m of mesas) {
        m.geometry.dispose()
        const material = m.material
        if (Array.isArray(material)) {
          for (const entry of material) entry.dispose()
        } else {
          material.dispose()
        }
      }
      mesaMat.dispose()
    },
  }
}
