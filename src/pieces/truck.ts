import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { VehicleState } from '../vehicle.ts'

export type Truck = {
  group: THREE.Group
  apply: (state: VehicleState) => void
  update: (dt: number) => void
  dispose: () => void
}

// "Tesla Cybertruck" by hashikemu, CC BY 4.0.
// https://skfb.ly/6QSBr
const MODEL_URL = `${import.meta.env.BASE_URL}models/cybertruck.gltf`

export function createTruck(scene: THREE.Scene): Truck {
  const group = new THREE.Group()
  const body = new THREE.Group()
  const model = new THREE.Group()
  // The mesh origin is the tire contact. bodyY rests one suspension lift above the sand.
  model.position.y = -0.08
  body.add(model)
  group.add(body)
  scene.add(group)

  const lamps = new THREE.Group()
  const leftTarget = new THREE.Object3D()
  const rightTarget = new THREE.Object3D()
  leftTarget.position.set(18, -1.1, -0.72)
  rightTarget.position.set(18, -1.1, 0.72)
  const leftBeam = new THREE.SpotLight(0xffe6c8, 95, 46, 0.52, 0.72, 1.35)
  const rightBeam = new THREE.SpotLight(0xffe6c8, 95, 46, 0.52, 0.72, 1.35)
  leftBeam.position.set(2.55, 0.72, -0.72)
  rightBeam.position.set(2.55, 0.72, 0.72)
  for (const beam of [leftBeam, rightBeam]) {
    beam.castShadow = true
    beam.shadow.mapSize.set(512, 512)
    beam.shadow.bias = -0.0008
    beam.shadow.camera.near = 0.4
    beam.shadow.camera.far = 40
  }
  leftBeam.target = leftTarget
  rightBeam.target = rightTarget
  const tail = new THREE.PointLight(0xff2414, 6, 11, 2)
  tail.position.set(-2.75, 0.95, 0)
  lamps.add(leftBeam, rightBeam, leftTarget, rightTarget, tail)
  group.add(lamps)

  const materials: THREE.Material[] = []
  const loader = new GLTFLoader()
  loader.load(MODEL_URL, (gltf) => {
    const root = gltf.scene
    // The light bar sits on source -Z. The sim faces +X.
    root.rotation.y = Math.PI / 2
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of list) {
        if (!mat || !('envMap' in mat)) continue
        const shaded = mat as THREE.MeshStandardMaterial
        shaded.envMap = scene.environment
        shaded.envMapIntensity = 1
        if (shaded.name === 'warninglights') {
          shaded.emissiveIntensity = 1.32
        }
        shaded.needsUpdate = true
        materials.push(shaded)
      }
    })
    model.add(root)
    const win = window as Window & { __MARS_TRUCK?: boolean }
    win.__MARS_TRUCK = true
  })

  return {
    group,
    apply(state: VehicleState) {
      group.position.set(state.x, 0, state.z)
      group.rotation.y = -state.heading
      body.position.y = state.bodyY
      body.rotation.x = state.pitch
      body.rotation.z = state.roll
      tail.intensity = 6 + state.slip * 34
    },
    update() {},
    dispose() {
      for (const mat of materials) mat.dispose()
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
      })
    },
  }
}
