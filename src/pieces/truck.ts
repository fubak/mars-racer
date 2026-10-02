import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { WHEEL_RADIUS, type VehicleState } from '../vehicle.ts'

export type Truck = {
  group: THREE.Group
  apply: (state: VehicleState) => void
  update: (dt: number) => void
  dispose: () => void
}

// "Tesla Cybertruck" by hashikemu, CC BY 4.0.
// https://skfb.ly/6QSBr
const MODEL_URL = '/models/cybertruck.gltf'

export function createTruck(scene: THREE.Scene): Truck {
  const group = new THREE.Group()
  const body = new THREE.Group()
  const model = new THREE.Group()
  // The mesh sits on y=0. bodyY rests at the wheel radius, so drop the mesh by that much.
  model.position.y = -WHEEL_RADIUS
  body.add(model)
  group.add(body)
  scene.add(group)

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
