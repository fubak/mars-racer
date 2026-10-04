import { describe, expect, it } from 'vitest'
import { heightAt, pushOut } from './pieces/terrain.ts'
import { ELLIPSE_A, trackDistance } from './track.ts'
import { createVehicleState, stepVehicle } from './vehicle.ts'

describe('mars field', () => {
  it('keeps the racing line near the macro dunes', () => {
    const on = heightAt(ELLIPSE_A, 0)
    const off = heightAt(ELLIPSE_A * 0.45, 40)
    expect(Number.isFinite(on)).toBe(true)
    expect(Number.isFinite(off)).toBe(true)
    expect(Math.abs(on)).toBeLessThan(40)
    expect(trackDistance(ELLIPSE_A, 0)).toBeLessThan(2)
  })
})

describe('vehicle', () => {
  it('gains speed under throttle on flat ground', () => {
    const state = createVehicleState()
    const dt = 1 / 60
    for (let t = 0; t < 2; t += dt) {
      stepVehicle(state, { throttle: 1, brake: 0, steer: 0, handbrake: 0 }, dt, [0, 0, 0, 0])
    }
    expect(state.speed).toBeGreaterThan(12)
    expect(state.pitch).toBeLessThan(0)
  })

  it('slides more when the handbrake is in', () => {
    const loose = createVehicleState()
    loose.speed = 22
    const planted = createVehicleState()
    planted.speed = 22
    const start = loose.heading
    const dt = 1 / 60
    for (let t = 0; t < 0.45; t += dt) {
      stepVehicle(loose, { throttle: 0.4, brake: 0, steer: 1, handbrake: 1 }, dt, [0, 0, 0, 0])
      stepVehicle(planted, { throttle: 0.4, brake: 0, steer: 1, handbrake: 0 }, dt, [0, 0, 0, 0])
    }
    expect(loose.speed).toBeLessThan(planted.speed)
    expect(Math.abs(loose.heading - start)).toBeGreaterThan(Math.abs(planted.heading - start))
  })

  it('steers left toward negative z when facing +x', () => {
    const state = createVehicleState()
    state.x = 0
    state.z = 0
    state.heading = 0
    state.speed = 14
    const dt = 1 / 60
    for (let t = 0; t < 0.8; t += dt) {
      stepVehicle(state, { throttle: 0.2, brake: 0, steer: -1, handbrake: 0 }, dt, [0, 0, 0, 0])
    }
    expect(state.z).toBeLessThan(-0.4)
    expect(state.heading).toBeLessThan(0)
  })
})

describe('rocks', () => {
  it('pushes a body out of a rock', () => {
    const free = pushOut(0, 0, 2, [{ x: 10, z: 0, r: 1 }])
    expect(free.hit).toBe(false)
    expect(free.x).toBe(0)
    const hit = pushOut(0.2, 0, 2, [{ x: 0, z: 0, r: 1.2 }])
    expect(hit.hit).toBe(true)
    expect(Math.hypot(hit.x, hit.z)).toBeGreaterThan(3.1)
  })
})
