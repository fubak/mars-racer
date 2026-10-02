import { describe, expect, it } from 'vitest'
import { heightAt } from './pieces/terrain.ts'
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
    stepVehicle(state, { throttle: 1, brake: 0, steer: 0, handbrake: 0 }, 0.5, [0, 0, 0, 0])
    expect(state.speed).toBeGreaterThan(1)
  })

  it('slides more when the handbrake is in', () => {
    const loose = createVehicleState()
    loose.speed = 24
    const planted = createVehicleState()
    planted.speed = 24
    stepVehicle(loose, { throttle: 0.2, brake: 0, steer: 1, handbrake: 1 }, 0.2, [0, 0, 0, 0])
    stepVehicle(planted, { throttle: 0.2, brake: 0, steer: 1, handbrake: 0 }, 0.2, [0, 0, 0, 0])
    expect(loose.speed).toBeLessThan(planted.speed)
  })
})
