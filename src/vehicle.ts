import { ellipsePoint, wrapAngle } from './track.ts'

export const WHEEL_RADIUS = 0.42
export const WHEELBASE = 3.7
export const WHEEL_OFFSETS = [
  { x: 1.82, z: 0.96, steer: true },
  { x: 1.82, z: -0.96, steer: true },
  { x: -1.88, z: 0.96, steer: false },
  { x: -1.88, z: -0.96, steer: false },
] as const

const MASS = 2990
const MARS_G = 3.71
const PEAK_FORCE = 26000
const TOP_SPEED = 46
const BRAKE_FORCE = 32000
const ENGINE_BRAKE = 3800
const DRAG = 0.45
const ROLL = 220
const GRIP = 1.35

export type VehicleInput = {
  throttle: number
  brake: number
  steer: number
  handbrake: number
}

export type VehicleState = {
  x: number
  z: number
  heading: number
  speed: number
  wheelSpin: number
  steerAngle: number
  yawRate: number
  slip: number
  bodyY: number
  pitch: number
  roll: number
  wheelY: [number, number, number, number]
}

export function createVehicleState(): VehicleState {
  const p = ellipsePoint(0.35)
  return {
    x: p.x,
    z: p.z,
    heading: Math.atan2(p.tz, p.tx),
    speed: 0,
    wheelSpin: 0,
    steerAngle: 0,
    yawRate: 0,
    slip: 0,
    bodyY: 0.08,
    pitch: 0,
    roll: 0,
    wheelY: [WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_RADIUS],
  }
}

export function wheelWorld(
  x: number,
  z: number,
  heading: number,
  lx: number,
  lz: number,
): { x: number; z: number } {
  const c = Math.cos(heading)
  const s = Math.sin(heading)
  return {
    x: x + c * lx - s * lz,
    z: z + s * lx + c * lz,
  }
}

export function autoInput(state: VehicleState): VehicleInput {
  const t = Math.atan2(state.z / 200, state.x / 320)
  const ahead = ellipsePoint(t + 0.22)
  const desired = Math.atan2(ahead.z - state.z, ahead.x - state.x)
  const err = wrapAngle(desired - state.heading)
  const steer = Math.max(-1, Math.min(1, err * 1.6))
  const align = 1 - Math.min(Math.abs(err) / 1.2, 1)
  return { throttle: 0.72 + align * 0.28, brake: 0, steer, handbrake: 0 }
}

export function stepVehicle(
  state: VehicleState,
  input: VehicleInput,
  dt: number,
  ground: [number, number, number, number],
): VehicleState {
  const speedSign = state.speed === 0 ? 1 : Math.sign(state.speed)
  const speedAbsIn = Math.abs(state.speed)
  const handbrake = input.handbrake > 0.5
  const taper = 1 - 0.78 * Math.min(Math.max(state.speed, 0) / TOP_SPEED, 1)
  const driveMul = (input.throttle >= 0 ? Math.max(taper, 0.22) : 0.4) * (handbrake ? 0.62 : 1)
  const drive = input.throttle * PEAK_FORCE * driveMul
  const braking = input.brake > 0.05
  const coast = !braking && input.throttle === 0 && speedAbsIn > 0.15 ? ENGINE_BRAKE * speedSign : 0
  const brake = input.brake * BRAKE_FORCE * speedSign
  const drag = DRAG * state.speed * Math.abs(state.speed)
  const roll = ROLL * (speedAbsIn > 0.2 ? speedSign : 0)
  const force = drive - brake - coast - drag - roll
  state.speed += (force / MASS) * dt
  if (braking && Math.abs(state.speed) < 0.35) state.speed = 0
  state.speed = Math.max(-12, Math.min(TOP_SPEED, state.speed))

  const speedAbs = Math.abs(state.speed)
  const steerScale = 0.045 + 0.5 * (1 - Math.min(speedAbs / 24, 1))
  const targetSteer = input.steer * steerScale
  const steerK = handbrake ? 12 : 8
  state.steerAngle += (targetSteer - state.steerAngle) * Math.min(1, dt * steerK)

  let yaw = 0
  if (speedAbs > 0.35) {
    yaw = (state.speed / WHEELBASE) * Math.tan(state.steerAngle)
  }
  const maxLat = GRIP * MARS_G
  const lat = Math.abs(yaw * state.speed)
  if (handbrake && speedAbs > 3 && Math.abs(input.steer) > 0.15) {
    const kick = Math.sign(input.steer) * Math.min(speedAbs, 26) * 0.085
    yaw = Math.sign(state.speed || 1) * kick
    state.speed *= Math.exp(-dt * 0.85)
    state.slip = Math.min(1, 0.72 + Math.abs(input.steer) * 0.28)
  } else if (lat > maxLat && speedAbs > 1.2) {
    yaw = Math.sign(yaw || state.steerAngle || 1) * (maxLat / Math.max(speedAbs, 0.5))
    state.speed *= Math.exp(-dt * 0.12)
    state.slip = Math.min(1, (lat / maxLat - 1) * 0.6)
  } else {
    state.slip = Math.max(0, state.slip - dt * 2.4)
  }
  state.yawRate = yaw
  state.heading = wrapAngle(state.heading + yaw * dt)
  state.x += Math.cos(state.heading) * state.speed * dt
  state.z += Math.sin(state.heading) * state.speed * dt
  state.wheelSpin += (state.speed / WHEEL_RADIUS) * dt

  const limit = 640
  state.x = Math.max(-limit, Math.min(limit, state.x))
  state.z = Math.max(-limit, Math.min(limit, state.z))

  let sum = 0
  for (let i = 0; i < 4; i++) {
    const target = ground[i] + WHEEL_RADIUS
    const y = state.wheelY[i] + (target - state.wheelY[i]) * Math.min(1, dt * 10)
    state.wheelY[i] = y
    sum += y
  }
  const front = (state.wheelY[0] + state.wheelY[1]) * 0.5
  const rear = (state.wheelY[2] + state.wheelY[3]) * 0.5
  const left = (state.wheelY[0] + state.wheelY[2]) * 0.5
  const right = (state.wheelY[1] + state.wheelY[3]) * 0.5
  const bodyTarget = sum / 4 - WHEEL_RADIUS + 0.08
  const longAcc = force / MASS
  const latAcc = state.yawRate * state.speed
  const pitchTarget = Math.max(-0.09, Math.min(0.09, (rear - front) * 0.18 - longAcc * 0.007))
  const rollTarget = Math.max(-0.14, Math.min(0.14, (left - right) * 0.22 - latAcc * 0.011))
  const k = Math.min(1, dt * 6)
  state.bodyY += (bodyTarget - state.bodyY) * k
  state.pitch += (pitchTarget - state.pitch) * k
  state.roll += (rollTarget - state.roll) * k
  return state
}
