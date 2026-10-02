import * as THREE from 'three'
import { createAudio } from './pieces/audio.ts'
import { createDrive } from './pieces/drive.ts'
import { createHud } from './pieces/hud.ts'
import { createParticles } from './pieces/particles.ts'
import { createPost } from './pieces/post.ts'
import { createRace } from './pieces/race.ts'
import { createSky } from './pieces/sky.ts'
import { createTerrain } from './pieces/terrain.ts'
import { createTruck } from './pieces/truck.ts'
import { createVehicleState } from './vehicle.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#view')
const hudRoot = document.querySelector<HTMLElement>('#hud')
const boot = document.querySelector<HTMLElement>('#boot')
if (!canvas || !hudRoot || !boot) throw new Error('missing root elements')

const params = new URLSearchParams(location.search)
const shot = params.get('shot')
const seek = Number(params.get('t') ?? (shot ? '8' : '0'))

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
  alpha: false,
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.18, 9000)

const sky = createSky(scene, renderer)
const terrain = createTerrain(scene)
const truck = createTruck(scene)
const keys = new Set<string>()
const drive = createDrive(truck, terrain, camera, keys, shot)
const particles = createParticles(scene, terrain)
const race = createRace(scene, terrain.heightAt)
const hud = createHud(hudRoot, race, shot)
const audio = createAudio()
const post = createPost(renderer, scene, camera)

const onKey = (event: KeyboardEvent, down: boolean) => {
  const key = event.key.toLowerCase()
  if (down) {
    keys.add(key)
    audio.unlock()
    if (key === 'r') {
      const fresh = createVehicleState()
      Object.assign(drive.state, fresh)
      drive.state.wheelY = [...fresh.wheelY]
    }
  } else {
    keys.delete(key)
  }
}
window.addEventListener('keydown', (event) => onKey(event, true))
window.addEventListener('keyup', (event) => onKey(event, false))
canvas.addEventListener('pointerdown', () => audio.unlock())

const resize = () => {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / Math.max(1, h)
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  post.setSize(w, h)
}
window.addEventListener('resize', resize)

if (seek > 0) {
  const step = 1 / 60
  let t = 0
  while (t < seek) {
    drive.update(step)
    particles.update(step, drive.state)
    race.update(step, drive.state.x, drive.state.z)
    sky.follow(drive.state.x, 0, drive.state.z)
    t += step
  }
}

let clock = performance.now()
let fps = 60
let ready = false

const frame = (now: number) => {
  const dt = Math.min(0.05, (now - clock) / 1000)
  clock = now
  fps = fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1
  drive.update(dt)
  const state = drive.state
  sky.follow(state.x, terrain.heightAt(state.x, state.z), state.z)
  sky.update(dt)
  particles.update(dt, state)
  race.update(dt, state.x, state.z)
  hud.update(dt, state)
  audio.update(dt, state)
  post.update(dt, state)
  post.render()
  const probe = window as unknown as { __MARS_FRAME?: Record<string, number | boolean | string | null> }
  probe.__MARS_FRAME = {
    ready: true,
    shot,
    speed: state.speed,
    x: state.x,
    z: state.z,
    slip: state.slip,
    fps,
    heading: state.heading,
  }
  if (!ready) {
    ready = true
    boot.remove()
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
