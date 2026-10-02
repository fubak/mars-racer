import * as THREE from 'three'
import { GATE_COUNT, ellipsePoint } from '../track.ts'

export type Race = {
  lap: number
  gate: number
  lapTime: number
  best: number
  update: (dt: number, x: number, z: number) => void
  dispose: () => void
}

export function createRace(scene: THREE.Scene, heightAt: (x: number, z: number) => number): Race {
  const root = new THREE.Group()
  const pillarGeo = new THREE.CylinderGeometry(0.18, 0.22, 5.2, 8)
  const beamGeo = new THREE.BoxGeometry(13.2, 0.28, 0.35)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffb15a,
    emissive: 0xff7a2a,
    emissiveIntensity: 0.45,
    roughness: 0.4,
    metalness: 0.2,
    toneMapped: true,
  })
  for (let i = 0; i < GATE_COUNT; i++) {
    const t = (i / GATE_COUNT) * Math.PI * 2
    const p = ellipsePoint(t)
    const gate = new THREE.Group()
    gate.position.set(p.x, heightAt(p.x, p.z), p.z)
    gate.rotation.y = -Math.atan2(p.tz, p.tx)
    const left = new THREE.Mesh(pillarGeo, mat)
    left.position.set(0, 2.6, 6.2)
    const right = new THREE.Mesh(pillarGeo, mat)
    right.position.set(0, 2.6, -6.2)
    const beam = new THREE.Mesh(beamGeo, mat)
    beam.position.set(0, 5.15, 0)
    left.castShadow = true
    right.castShadow = true
    beam.castShadow = true
    gate.add(left, right, beam)
    const light = new THREE.PointLight(0xff8844, 2, 22, 2)
    light.position.set(0, 4.2, 0)
    gate.add(light)
    root.add(gate)
  }
  scene.add(root)

  let lap = 1
  let gate = 0
  let lapTime = 0
  let best = 0
  let prevIndex = 0

  return {
    get lap() {
      return lap
    },
    get gate() {
      return gate
    },
    get lapTime() {
      return lapTime
    },
    get best() {
      return best
    },
    update(dt: number, x: number, z: number) {
      lapTime += dt
      const ang = Math.atan2(z / 200, x / 320)
      const u = (ang + Math.PI) / (Math.PI * 2)
      const index = Math.floor(u * GATE_COUNT) % GATE_COUNT
      if (index !== prevIndex) {
        const forward = (index - prevIndex + GATE_COUNT) % GATE_COUNT
        if (forward === 1) {
          gate = index
          if (index === 0 && prevIndex === GATE_COUNT - 1) {
            if (best === 0 || lapTime < best) best = lapTime
            lap += 1
            lapTime = 0
          }
        }
        prevIndex = index
      }
    },
    dispose() {
      pillarGeo.dispose()
      beamGeo.dispose()
      mat.dispose()
    },
  }
}
