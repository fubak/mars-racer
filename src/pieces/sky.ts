import * as THREE from 'three'
import { FOG_DENSITY, HORIZON, RIM_COLOR, SUN_COLOR, ZENITH } from '../palette.ts'

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  uniform vec3 sunDir;
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform float time;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    vec3 sun = normalize(sunDir);
    float above = max(dir.y, 0.0);

    vec3 flatDir = normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-4, 0.0, 0.0));
    vec3 flatSun = normalize(vec3(sun.x, 0.0, sun.z));
    float horizAng = acos(clamp(dot(flatDir, flatSun), -1.0, 1.0));
    float toward = exp(-pow(horizAng / 1.05, 2.0));

    float horizonMask = pow(1.0 - smoothstep(0.0, 0.26, above), 1.15);
    vec3 dustCol = mix(horizon * vec3(0.72, 0.64, 0.56), horizon, toward);
    vec3 col = mix(zenith, dustCol, horizonMask);
    col = mix(col, zenith * vec3(0.70, 0.58, 0.50), smoothstep(0.28, 0.75, above));

    float mu = clamp(dot(dir, sun), 0.0, 1.0);
    float ang = acos(mu);
    float sunLow = 1.0 - smoothstep(0.16, 0.50, sun.y);

    // Horizon dust band spans the truck frame; it thins out before the rust zenith.
    float aboveSun = max(dir.y - sun.y, 0.0);
    float bandElev = 1.0 - smoothstep(0.085, 0.165, above);
    float along = 1.0 - smoothstep(1.15, 2.05, horizAng);
    float band = bandElev * along;
    float connector = exp(-pow(horizAng / 0.40, 2.0)) * exp(-pow(aboveSun / 0.045, 2.0));
    float overhead = 1.0 - smoothstep(sun.y + 0.002, sun.y + 0.045, dir.y);
    float scatter = min(max(band, connector), 1.0) * overhead * sunLow;

    vec3 dustBlue = vec3(0.30, 0.52, 0.96);
    vec3 sunBlue = vec3(0.62, 0.78, 1.0);
    vec3 blue = mix(dustBlue, sunBlue, exp(-pow(ang / 0.12, 2.0)));
    col = mix(col, blue, scatter * 0.96);

    float limb = smoothstep(0.014, 0.005, ang);
    float core = smoothstep(0.0075, 0.0024, ang);
    col = mix(col, vec3(0.98, 0.90, 0.70), limb);
    col = mix(col, vec3(1.0, 0.97, 0.92) * 3.15, core);

    // Banks and cirrus sit in the scatter color. Warm shelves start only after
    // that blue has fallen off, so the dune line stays scatter on both sides.
    // Azimuth is taken from sin/cos so the noise does not jump on the atan cut.
    vec2 xz = vec2(dir.x, dir.z);
    xz /= max(length(xz), 1e-4);
    vec2 h2 = vec2(xz.x * xz.x - xz.y * xz.y, 2.0 * xz.x * xz.y);
    vec2 bankUv = vec2(h2.x * 1.25 + h2.y * 1.25 + time * 0.006, above * 11.0 + h2.x * 0.4);
    float bankN = noise(bankUv);
    bankN += noise(bankUv * 2.3 + vec2(4.0, 1.7)) * 0.5;
    bankN /= 1.5;
    float streakN = noise(vec2(h2.y * 0.85 + h2.x * 0.45 - time * 0.004, above * 42.0 + bankN * 1.8));
    float bank = smoothstep(0.34, 0.5, bankN);
    float streak = smoothstep(0.58, 0.8, streakN);
    float offDisc = smoothstep(0.02, 0.05, ang);
    float inBlue = smoothstep(0.22, 0.55, scatter);
    float gain = mix(1.0, mix(0.4, 1.08, streak), bank);
    col *= mix(1.0, gain, offDisc * inBlue);

    float clearOfBlue = smoothstep(0.12, 0.0, scatter);
    float aboveBand = smoothstep(0.155, 0.21, above) * (1.0 - smoothstep(0.42, 0.75, above));
    vec3 shelfCol = mix(vec3(0.18, 0.07, 0.05), vec3(0.70, 0.34, 0.18), streak);
    col = mix(col, shelfCol, bank * aboveBand * clearOfBlue * offDisc * 0.82);

    float dust = sin(dir.x * 8.0 + dir.z * 5.0 + time * 0.05);
    dust += sin(dir.z * 12.0 - dir.x * 2.5 - time * 0.035) * 0.4;
    col += (horizon - zenith) * (dust * 0.5 + 0.5) * horizonMask * (1.0 - scatter) * 0.07;

    float ground = smoothstep(0.0, -0.08, dir.y);
    col = mix(col, horizon * 0.75, ground);
    gl_FragColor = vec4(col, 1.0);
  }
`

export type Sky = {
  sun: THREE.DirectionalLight
  follow: (x: number, y: number, z: number) => void
  update: (dt: number) => void
  dispose: () => void
}

export function createSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Sky {
  const elevation = THREE.MathUtils.degToRad(10.5)
  const azimuth = 0.85
  const sunDir = new THREE.Vector3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
  ).normalize()

  const uniforms = {
    sunDir: { value: sunDir.clone() },
    zenith: { value: new THREE.Vector3(ZENITH.r, ZENITH.g, ZENITH.b) },
    horizon: { value: new THREE.Vector3(HORIZON.r, HORIZON.g, HORIZON.b) },
    time: { value: 0 },
  }

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 48, 24), mat)
  sky.frustumCulled = false
  sky.castShadow = false
  sky.receiveShadow = false
  sky.renderOrder = -1
  scene.add(sky)

  const sun = new THREE.DirectionalLight(SUN_COLOR, 3.1)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.18
  const shadow = sun.shadow.camera
  shadow.near = 8
  shadow.far = 220
  shadow.left = -48
  shadow.right = 48
  shadow.top = 48
  shadow.bottom = -48
  shadow.updateProjectionMatrix()
  scene.add(sun)
  scene.add(sun.target)

  const hemi = new THREE.HemisphereLight(0xf2b48a, 0x6a3828, 0.38)
  scene.add(hemi)

  const rim = new THREE.DirectionalLight(RIM_COLOR, 0.85)
  scene.add(rim)
  scene.add(rim.target)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), mat)
  envScene.add(envSky)
  scene.environment = pmrem.fromScene(envScene, 0.02).texture
  scene.environmentIntensity = 1.15
  pmrem.dispose()

  const follow = (x: number, y: number, z: number) => {
    sky.position.set(x, y, z)
    sun.position.set(x + sunDir.x * 140, y + sunDir.y * 140, z + sunDir.z * 140)
    sun.target.position.set(x, y, z)
    rim.position.set(x - sunDir.x * 40, y + 18, z - sunDir.z * 40)
    rim.target.position.set(x, y + 1.2, z)
  }

  follow(0, 0, 0)

  return {
    sun,
    follow,
    update(dt: number) {
      uniforms.time.value += dt
    },
    dispose() {
      sky.geometry.dispose()
      mat.dispose()
      scene.environment?.dispose()
    },
  }
}

export { FOG_DENSITY }
