import * as THREE from 'three'
import {
  BloomEffect,
  Effect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing'
import type { VehicleState } from '../vehicle.ts'

// Stock brightness/contrast pivots the whole frame, so a shadow lift clips the sky
// or washes the sand gray. This gain applies only while luma is still in the toe.
class ShadowLiftEffect extends Effect {
  constructor() {
    super(
      'ShadowLiftEffect',
      `uniform float power;
uniform float cap;
uniform float toeStart;
uniform float toeEnd;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = max(inputColor.rgb, vec3(0.0));
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float gain = pow(max(luma, 0.04), power);
  float shadow = smoothstep(toeStart, toeEnd, luma);
  gain = mix(1.0, min(gain, cap), shadow);
  outputColor = vec4(min(color * gain, vec3(1.0)), inputColor.a);
}`,
      {
        uniforms: new Map<string, THREE.Uniform>([
          ['power', new THREE.Uniform(-0.5)],
          ['cap', new THREE.Uniform(3.8)],
          ['toeStart', new THREE.Uniform(0.32)],
          ['toeEnd', new THREE.Uniform(0.07)],
        ]),
      },
    )
    this.inputColorSpace = THREE.SRGBColorSpace
  }
}

export type Post = {
  update: (dt: number, state: VehicleState) => void
  render: () => void
  setSize: (w: number, h: number) => void
  dispose: () => void
}

export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): Post {
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: 0,
  })
  const bloom = new BloomEffect({
    intensity: 0.42,
    luminanceThreshold: 1.05,
    luminanceSmoothing: 0.2,
    mipmapBlur: true,
    radius: 0.55,
  })
  const tone = new ToneMappingEffect({
    mode: ToneMappingMode.AGX,
    whitePoint: 4.2,
  })
  const grade = new ShadowLiftEffect()
  const sat = new HueSaturationEffect({ saturation: 0.08, hue: 0.01 })
  const vignette = new VignetteEffect({ offset: 0.7, darkness: 0.18 })
  const smaa = new SMAAEffect({ preset: SMAAPreset.HIGH })

  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new EffectPass(camera, bloom, tone, grade, sat, vignette))
  composer.addPass(new EffectPass(camera, smaa))

  return {
    update() {},
    render() {
      composer.render()
    },
    setSize(w: number, h: number) {
      composer.setSize(w, h)
    },
    dispose() {
      composer.dispose()
    },
  }
}
