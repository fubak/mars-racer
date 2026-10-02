import * as THREE from 'three'
import type { Terrain } from './terrain.ts'
import type { Truck } from './truck.ts'
import {
  autoInput,
  createVehicleState,
  stepVehicle,
  wheelWorld,
  WHEEL_OFFSETS,
  type VehicleInput,
  type VehicleState,
} from '../vehicle.ts'

export type Drive = {
  state: VehicleState
  auto: boolean
  update: (dt: number) => void
  dispose: () => void
}

const look = new THREE.Vector3()
const desired = new THREE.Vector3()
const camPos = new THREE.Vector3()

export function createDrive(
  truck: Truck,
  terrain: Terrain,
  camera: THREE.PerspectiveCamera,
  keys: Set<string>,
  shot: string | null,
): Drive {
  const state = createVehicleState()
  let auto = shot !== null && shot !== 'truck'
  let seeded = false
  let anchorX = state.x
  let anchorZ = state.z
  camPos.set(state.x - 5.4, state.bodyY + 1.9, state.z)

  const readInput = (): VehicleInput => {
    if (auto) return autoInput(state)
    const throttle = keys.has('w') || keys.has('arrowup') ? 1 : 0
    const down = keys.has('s') || keys.has('arrowdown')
    let brake = down && state.speed > 1 ? 1 : 0
    let signedThrottle = throttle
    if (down && state.speed <= 1) signedThrottle = -0.45
    if (keys.has(' ') || keys.has('space')) brake = Math.max(brake, 1)
    const steer =
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0) -
      (keys.has('d') || keys.has('arrowright') ? 1 : 0)
    const handbrake = keys.has(' ') ? 1 : 0
    return { throttle: signedThrottle, brake, steer, handbrake }
  }

  const ground = (): [number, number, number, number] => {
    const samples: number[] = []
    for (const spec of WHEEL_OFFSETS) {
      const p = wheelWorld(state.x, state.z, state.heading, spec.x, spec.z)
      samples.push(terrain.heightAt(p.x, p.z))
    }
    return [samples[0] ?? 0, samples[1] ?? 0, samples[2] ?? 0, samples[3] ?? 0]
  }

  return {
    state,
    get auto() {
      return auto
    },
    set auto(value: boolean) {
      auto = value
    },
    update(dt: number) {
      if (shot === 'truck' && !seeded) {
        state.speed = 0
        seeded = true
      }
      const step = Math.min(dt, 0.05)
      stepVehicle(state, readInput(), step, ground())
      truck.apply(state)

      if (shot === 'sky') {
        camera.position.set(state.x - 12, terrain.heightAt(state.x, state.z) + 3.2, state.z + 6)
        look.set(state.x + 40, terrain.heightAt(state.x, state.z) + 18, state.z - 30)
        camera.lookAt(look)
        camera.fov = 58
        camera.updateProjectionMatrix()
        return
      }
      if (shot === 'terrain') {
        camera.position.set(40, 150, 220)
        camera.lookAt(0, 0, 0)
        camera.fov = 48
        camera.updateProjectionMatrix()
        return
      }
      if (shot === 'truck') {
        const y = terrain.heightAt(state.x, state.z)
        camera.up.set(0, 1, 0)
        camera.position.set(state.x - 8.6, y + 2.35, state.z - 7.4)
        camera.lookAt(state.x + 0.4, y + 1.05, state.z)
        camera.fov = 38
        camera.updateProjectionMatrix()
        return
      }

      const speed = Math.abs(state.speed)
      const back = (shot === 'dust' ? 5.2 : 5.4) + Math.min(speed, 32) * 0.016
      const up = shot === 'dust' ? 1.78 : 1.95
      const c = Math.cos(state.heading)
      const s = Math.sin(state.heading)
      const side = 1.45
      desired.set(
        state.x - c * back + s * side,
        0,
        state.z - s * back - c * side,
      )
      const gy = terrain.heightAt(desired.x, desired.z)
      desired.y = gy + up
      if (seeded) {
        camPos.x += state.x - anchorX
        camPos.z += state.z - anchorZ
      }
      anchorX = state.x
      anchorZ = state.z
      const lerp = 1 - Math.exp(-dt * (shot === 'dust' ? 9 : 7))
      if (!seeded) {
        camPos.copy(desired)
        seeded = true
      }
      camPos.lerp(desired, lerp)
      const minY = terrain.heightAt(camPos.x, camPos.z) + 1.15
      if (camPos.y < minY) camPos.y = minY
      camera.position.copy(camPos)
      look.set(
        state.x + c * 2.15,
        state.bodyY + 0.95,
        state.z + s * 2.15,
      )
      camera.up.set(state.roll * 0.35, 1, 0).normalize()
      camera.lookAt(look)
      const fov = (shot === 'dust' ? 51 : 50) + Math.min(speed, 32) * 0.03
      if (Math.abs(camera.fov - fov) > 0.05) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
    },
    dispose() {},
  }
}
