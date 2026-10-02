import '../style.css'
import { GATE_COUNT } from '../track.ts'
import type { Race } from './race.ts'
import type { VehicleState } from '../vehicle.ts'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

export type Hud = {
  update: (dt: number, state: VehicleState) => void
  dispose: () => void
}

export function createHud(root: HTMLElement, race: Race, shot: string | null): Hud {
  const hidden = shot !== null && shot !== 'hud'
  root.innerHTML = `
    <div class="hud-speed"><span id="speed">0</span><small>KM/H</small></div>
    <div class="hud-place">JEZERO LOOP <em id="slip"></em></div>
    <div class="hud-lap"><span id="lap">LAP 1</span><strong id="time">0:00.0</strong><span id="best"></span></div>
    <div class="hud-help">W A S D drive · SPACE slide · R reset</div>
    <canvas id="map" width="168" height="168"></canvas>
    <a class="progress-link" href="/progress.html">progress</a>
    <div class="hud-credit">Truck model by hashikemu, CC BY 4.0</div>
  `
  root.style.display = hidden ? 'none' : 'block'
  const speedEl = root.querySelector<HTMLElement>('#speed')
  const slipEl = root.querySelector<HTMLElement>('#slip')
  const lapEl = root.querySelector<HTMLElement>('#lap')
  const timeEl = root.querySelector<HTMLElement>('#time')
  const bestEl = root.querySelector<HTMLElement>('#best')
  const map = root.querySelector<HTMLCanvasElement>('#map')
  const ctx = map?.getContext('2d') ?? null

  const drawMap = (state: VehicleState) => {
    if (!ctx || !map) return
    const w = map.width
    const h = map.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(28, 14, 10, 0.45)'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 12)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 176, 110, 0.85)'
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2
      const x = w * 0.5 + Math.cos(t) * w * 0.32
      const y = h * 0.5 + Math.sin(t) * h * 0.24
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
    const px = w * 0.5 + (state.x / 320) * w * 0.32
    const py = h * 0.5 + (state.z / 200) * h * 0.24
    ctx.fillStyle = '#f4efe6'
    ctx.beginPath()
    ctx.arc(px, py, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  return {
    update(_dt: number, state: VehicleState) {
      if (hidden) return
      const kmh = Math.abs(state.speed) * 3.6
      if (speedEl) speedEl.textContent = Math.round(kmh).toString()
      if (slipEl) slipEl.textContent = state.slip > 0.35 ? 'LOOSE REGOLITH' : ''
      if (lapEl) lapEl.textContent = `LAP ${race.lap} · GATE ${race.gate + 1}/${GATE_COUNT}`
      if (timeEl) timeEl.textContent = formatTime(race.lapTime)
      if (bestEl) bestEl.textContent = race.best > 0 ? `BEST ${formatTime(race.best)}` : ''
      drawMap(state)
    },
    dispose() {
      root.innerHTML = ''
    },
  }
}
