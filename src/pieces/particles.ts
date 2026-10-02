import * as THREE from 'three'
import { wheelWorld, WHEEL_OFFSETS, type VehicleState } from '../vehicle.ts'
import type { Terrain } from './terrain.ts'

const COUNT = 700
const TRACKS = 360
const STAMP_ALONG = 1.6
const STAMP_ACROSS = 0.5
const STAMP_GAP = 0.62
// Hotter than the sand so a grain still reads orange after the grade,
// including pixels SMAA feathers against the ground.
const GRAIN = 0xec5814

function dustTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context missing')
  ctx.clearRect(0, 0, 16, 16)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(8, 8, 7, 0, Math.PI * 2)
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  return tex
}

export type Particles = {
  update: (dt: number, state: VehicleState) => void
  dispose: () => void
}

export function createParticles(scene: THREE.Scene, terrain: Terrain): Particles {
  const positions = new Float32Array(COUNT * 3)
  const colors = new Float32Array(COUNT * 4)
  for (let i = 0; i < COUNT; i++) positions[i * 3 + 1] = -200
  const velocity = new Float32Array(COUNT * 3)
  const life = new Float32Array(COUNT)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4))
  const mat = new THREE.PointsMaterial({
    color: GRAIN,
    map: dustTexture(),
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    // Pixels, not world units. Attenuation turned 0.42 into wheel-sized
    // sprites wherever dust drifted toward the chase camera.
    size: 4,
    sizeAttenuation: false,
    opacity: 1,
    alphaTest: 0.5,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  scene.add(points)

  // Long axis is local X. After the ground rotation, yaw -heading lays that axis
  // along travel, so each stamp is a short strip of tread, not a lateral blob.
  const trackGeo = new THREE.PlaneGeometry(STAMP_ALONG, STAMP_ACROSS)
  trackGeo.rotateX(-Math.PI / 2)
  const trackMat = new THREE.MeshBasicMaterial({
    color: 0x140c08,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  })
  const tracks = new THREE.InstancedMesh(trackGeo, trackMat, TRACKS)
  tracks.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  // Instances sit on the racing line. The mesh itself stays at the origin,
  // so default bounds would cull the whole trail out of the chase view.
  tracks.frustumCulled = false
  tracks.renderOrder = 1
  scene.add(tracks)
  const dummy = new THREE.Object3D()
  dummy.scale.setScalar(0)
  dummy.updateMatrix()
  for (let i = 0; i < TRACKS; i++) tracks.setMatrixAt(i, dummy.matrix)
  tracks.instanceMatrix.needsUpdate = true
  const trail = [
    { x: 0, z: 0, carry: 0 },
    { x: 0, z: 0, carry: 0 },
  ]
  let trailReady = false
  let trackCursor = 0
  let cursor = 0
  let emit = 0

  const layTrack = (x: number, z: number, heading: number) => {
    const slot = trackCursor % TRACKS
    trackCursor++
    dummy.position.set(x, terrain.heightAt(x, z) + 0.04, z)
    dummy.rotation.set(0, -heading, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    tracks.setMatrixAt(slot, dummy.matrix)
  }

  const spawn = (
    x: number,
    y: number,
    z: number,
    hx: number,
    hz: number,
    side: number,
    travel: number,
  ) => {
    const i = cursor % COUNT
    cursor++
    const span = 0.18 + Math.random() * 0.2
    life[i] = span
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    // Most of the truck's speed, so the grain stays in the chase frame and
    // only slips backward into a short trail.
    const carry = travel * (0.74 + Math.random() * 0.12)
    const out = 0.5 + Math.random() * 1.3
    velocity[i * 3] = hx * carry - hz * side * out + (Math.random() - 0.5) * 0.7
    velocity[i * 3 + 1] = 0.25 + Math.random() * 0.9
    velocity[i * 3 + 2] = hz * carry + hx * side * out + (Math.random() - 0.5) * 0.7
    colors[i * 4] = 1
    colors[i * 4 + 1] = 1
    colors[i * 4 + 2] = 1
    colors[i * 4 + 3] = 1
  }

  return {
    update(dt: number, state: VehicleState) {
      const speed = Math.abs(state.speed)
      const hx = Math.cos(state.heading)
      const hz = Math.sin(state.heading)
      if (speed > 2.5) {
        emit += dt * (30 + speed * 14 + state.slip * 40)
        const n = Math.min(36, Math.floor(emit))
        emit -= n
        for (let k = 0; k < n; k++) {
          const roll = Math.random()
          const index = roll < 0.42 ? 3 : roll < 0.72 ? 2 : roll < 0.86 ? 1 : 0
          const spec = WHEEL_OFFSETS[index]
          if (!spec) continue
          const side = Math.sign(spec.z) || 1
          const back = 0.12 + Math.random() * 0.85
          const out = 0.1 + Math.random() * 0.38
          const p = wheelWorld(
            state.x,
            state.z,
            state.heading,
            spec.x - back,
            spec.z + side * out,
          )
          spawn(
            p.x,
            terrain.heightAt(p.x, p.z) + 0.03 + Math.random() * 0.14,
            p.z,
            hx,
            hz,
            side,
            state.speed,
          )
        }
      }

      const rear = [WHEEL_OFFSETS[2], WHEEL_OFFSETS[3]]
      if (!trailReady) {
        for (let w = 0; w < rear.length; w++) {
          const spec = rear[w]
          const mark = trail[w]
          if (!spec || !mark) continue
          const p = wheelWorld(state.x, state.z, state.heading, spec.x, spec.z)
          mark.x = p.x
          mark.z = p.z
          mark.carry = 0
        }
        trailReady = true
      } else if (speed > 4) {
        let laid = false
        for (let w = 0; w < rear.length; w++) {
          const spec = rear[w]
          const mark = trail[w]
          if (!spec || !mark) continue
          const p = wheelWorld(state.x, state.z, state.heading, spec.x, spec.z)
          const dx = p.x - mark.x
          const dz = p.z - mark.z
          const dist = Math.hypot(dx, dz)
          if (dist > 6) {
            mark.x = p.x
            mark.z = p.z
            mark.carry = 0
            continue
          }
          if (dist < 1e-4) continue
          const ux = dx / dist
          const uz = dz / dist
          const heading = Math.atan2(uz, ux)
          let at = STAMP_GAP - mark.carry
          let guard = 0
          while (at <= dist && guard < TRACKS) {
            layTrack(mark.x + ux * at, mark.z + uz * at, heading)
            at += STAMP_GAP
            guard++
            laid = true
          }
          const pending = mark.carry + dist
          mark.carry = pending - Math.floor(pending / STAMP_GAP) * STAMP_GAP
          mark.x = p.x
          mark.z = p.z
        }
        if (laid) tracks.instanceMatrix.needsUpdate = true
      }

      for (let i = 0; i < COUNT; i++) {
        if (life[i] <= 0) {
          positions[i * 3 + 1] = -100
          colors[i * 4 + 3] = 0
          continue
        }
        life[i] -= dt
        positions[i * 3] += velocity[i * 3] * dt
        positions[i * 3 + 1] += velocity[i * 3 + 1] * dt
        positions[i * 3 + 2] += velocity[i * 3 + 2] * dt
        velocity[i * 3 + 1] -= dt * 3.71
        velocity[i * 3] *= 1 - dt * 0.35
        velocity[i * 3 + 2] *= 1 - dt * 0.35
        const gx = positions[i * 3] ?? 0
        const gz = positions[i * 3 + 2] ?? 0
        const ground = terrain.heightAt(gx, gz) + 0.02
        const py = positions[i * 3 + 1] ?? ground
        const vy = velocity[i * 3 + 1] ?? 0
        if (py < ground) {
          positions[i * 3 + 1] = ground
          if (vy < 0) velocity[i * 3 + 1] = 0
        } else if (py > ground + 0.42) {
          positions[i * 3 + 1] = ground + 0.42
          velocity[i * 3 + 1] = Math.min(0, vy)
        }
        colors[i * 4] = 1
        colors[i * 4 + 1] = 1
        colors[i * 4 + 2] = 1
        colors[i * 4 + 3] = 1
        if (life[i] <= 0) {
          life[i] = 0
          colors[i * 4 + 3] = 0
          positions[i * 3 + 1] = -100
        }
      }
      const attr = geo.getAttribute('position')
      if (attr) attr.needsUpdate = true
      const colorAttr = geo.getAttribute('color')
      if (colorAttr) colorAttr.needsUpdate = true
    },
    dispose() {
      geo.dispose()
      mat.map?.dispose()
      mat.dispose()
      trackGeo.dispose()
      trackMat.dispose()
    },
  }
}
