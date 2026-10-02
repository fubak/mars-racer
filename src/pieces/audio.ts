import type { VehicleState } from '../vehicle.ts'

export type AudioRig = {
  unlock: () => void
  update: (dt: number, state: VehicleState) => void
  dispose: () => void
}

export function createAudio(): AudioRig {
  let ctx: AudioContext | null = null
  let motor: OscillatorNode | null = null
  let whine: OscillatorNode | null = null
  let motorGain: GainNode | null = null
  let whineGain: GainNode | null = null
  let windGain: GainNode | null = null
  let filter: BiquadFilterNode | null = null

  const unlock = () => {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume()
      return
    }
    const AudioCtx = window.AudioContext
    ctx = new AudioCtx()
    const master = ctx.createGain()
    master.gain.value = 0.22
    master.connect(ctx.destination)

    motor = ctx.createOscillator()
    motor.type = 'sawtooth'
    filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 220
    motorGain = ctx.createGain()
    motorGain.gain.value = 0
    motor.connect(filter)
    filter.connect(motorGain)
    motorGain.connect(master)
    motor.start()

    whine = ctx.createOscillator()
    whine.type = 'sine'
    whineGain = ctx.createGain()
    whineGain.gain.value = 0
    whine.connect(whineGain)
    whineGain.connect(master)
    whine.start()

    const length = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 500
    windFilter.Q.value = 0.6
    windGain = ctx.createGain()
    windGain.gain.value = 0
    noise.connect(windFilter)
    windFilter.connect(windGain)
    windGain.connect(master)
    noise.start()
  }

  return {
    unlock,
    update(_dt: number, state: VehicleState) {
      if (!ctx || !motor || !filter || !motorGain || !whine || !whineGain || !windGain) return
      const now = ctx.currentTime
      const speed = Math.abs(state.speed)
      motor.frequency.setTargetAtTime(32 + speed * 2.4, now, 0.05)
      filter.frequency.setTargetAtTime(160 + speed * 22 + state.slip * 400, now, 0.08)
      motorGain.gain.setTargetAtTime(Math.min(0.12, 0.02 + speed * 0.0025), now, 0.08)
      whine.frequency.setTargetAtTime(90 + speed * 14, now, 0.05)
      whineGain.gain.setTargetAtTime(Math.min(0.05, speed * 0.0012), now, 0.08)
      windGain.gain.setTargetAtTime(Math.min(0.08, speed * 0.0018 + state.slip * 0.04), now, 0.1)
    },
    dispose() {
      void ctx?.close()
      ctx = null
    },
  }
}
