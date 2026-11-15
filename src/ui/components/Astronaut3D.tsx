// Part 3 · 3D astronaut (the body map on the Astronaut View). Drawn with three.js; loaded as a separate chunk when the page
// opens (React.lazy), so the app's first load is not slowed down. The model and the Draco decoder are inside the project
// (the Draco decoder comes from the three package): works without internet.
//
// Regions are split along the model's height (in the shader, per pixel):
//   head (above the neck, helmet) · chest (between neck and waist, including arms and backpack) · lower body (below the waist: hips and legs)
//   · environment (the ground ring under the feet)
// Each region is painted in the color of its Layer 1 level; a WARNING region pulses. When the cursor hovers over a region
// it is highlighted and its screen coordinates are reported with onHover (the parent draws the risk box); clicking calls onSelect.
// The camera rotates slowly and continuously around the model (slows down while hovered); it can be dragged with the mouse.
// It rotates even with Windows "Animation effects" turned off; with that setting on, only the WARNING pulsing is turned off.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Level } from '../../types';
import modelUrl from '../assets/astronaut.glb?url';
import type { RegionId } from '../bodyRegions';
import { COLORS, LEVEL_COLOR } from '../theme';

const ORDER: RegionId[] = ['head', 'chest', 'lower', 'env'];

// Region boundaries, after the model is scaled to a height of 2 units (feet y = −1, top y = +1).
// Values tuned to this model's proportions (helmet, torso, waist).
const BOUNDS = {
  neckY: 0.52, // above this is the head (helmet)
  headR: 0.22, // the helmet is close to the torso axis; the shoulders and backpack above the neck count as chest
  waistY: -0.06, // chest between neck and waist (the arms in the T pose are in this range too); below the waist is lower body
};

export interface HoverInfo {
  region: RegionId;
  x: number; // pixels relative to the container
  y: number;
  w: number; // container width (so the risk box does not overflow)
  h: number;
}

interface Props {
  levels: Record<RegionId, Level | undefined>;
  selected: RegionId | null;
  onHover: (h: HoverInfo | null) => void;
  onSelect: (r: RegionId) => void;
  onError: () => void;
}

const levelColor = (l: Level | undefined) => new THREE.Color(l ? LEVEL_COLOR[l] : COLORS.offline);
const levelStrength = (l: Level | undefined) => (l === 'critical' ? 0.55 : l === 'caution' ? 0.42 : 0.16);

/** The same region rule on the JS side (for the mouse hit point). Exactly the same as regionOf in the shader. */
function regionOf(p: THREE.Vector3): RegionId {
  const r = Math.hypot(p.x, p.z);
  if (p.y > BOUNDS.neckY && r < BOUNDS.headR) return 'head';
  if (p.y > BOUNDS.waistY) return 'chest';
  return 'lower';
}

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vec4 mv = viewMatrix * w;
    vViewPos = mv.xyz;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uGlass;
  uniform vec3 uColor[3];
  uniform float uStrength[3];
  uniform float uPulse[3];
  uniform float uHover;
  uniform float uSelected;
  uniform float uTime;
  uniform float uNeckY;
  uniform float uHeadR;
  uniform float uWaistY;
  varying vec3 vWorld;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying vec2 vUv;

  float regionOf(vec3 p) {
    float r = length(p.xz);
    if (p.y > uNeckY && r < uHeadR) return 0.0;
    if (p.y > uWaistY) return 1.0;
    return 2.0;
  }

  void main() {
    float reg = uGlass > 0.5 ? 0.0 : regionOf(vWorld); // the helmet visor is always head
    vec3 rc = reg < 0.5 ? uColor[0] : (reg < 1.5 ? uColor[1] : uColor[2]);
    float st = reg < 0.5 ? uStrength[0] : (reg < 1.5 ? uStrength[1] : uStrength[2]);
    float pu = reg < 0.5 ? uPulse[0] : (reg < 1.5 ? uPulse[1] : uPulse[2]);

    vec3 base = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb : vec3(0.75);
    vec3 N = normalize(vNormalV);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(-vViewPos);
    vec3 L = normalize(vec3(-0.35, 0.55, 0.75));
    float diff = max(dot(N, L), 0.0);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.4);
    vec3 lit = base * (0.22 + 0.9 * diff);
    if (uGlass > 0.5) {
      // Helmet visor: dark, bright reflection at the edge
      lit = vec3(0.02, 0.03, 0.06) + vec3(0.5, 0.6, 0.75) * pow(max(dot(reflect(-L, N), V), 0.0), 24.0) + vec3(0.15, 0.2, 0.3) * fres;
    }

    float hov = abs(reg - uHover) < 0.5 ? 1.0 : 0.0;
    float sel = abs(reg - uSelected) < 0.5 ? 1.0 : 0.0;
    float pulse = pu * (0.5 + 0.5 * sin(uTime * 5.0));
    float tint = clamp(st + 0.1 * sel + 0.2 * hov + 0.15 * pulse, 0.0, 0.85);
    vec3 col = mix(lit, rc * (0.3 + 0.85 * diff), tint);
    col += rc * fres * (0.55 + 0.35 * sel + 0.9 * hov + 0.9 * pulse);

    // Scan line moving slowly from bottom to top (live monitoring feel)
    float scanY = mod(uTime * 0.32, 2.8) - 1.2;
    col += rc * 0.55 * (1.0 - smoothstep(0.0, 0.02, abs(vWorld.y - scanY)));
    // Thin line at region boundaries
    float edge = (1.0 - smoothstep(0.0, 0.006, abs(vWorld.y - uNeckY))) + (1.0 - smoothstep(0.0, 0.006, abs(vWorld.y - uWaistY)));
    col += vec3(0.6, 0.75, 0.9) * 0.25 * edge;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function Astronaut3D({ levels, selected, onHover, onSelect, onError }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ levels, selected, onHover, onSelect, onError });
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    propsRef.current = { levels, selected, onHover, onSelect, onError };
  });

  useEffect(() => {
    const wrap = wrapRef.current!;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      propsRef.current.onError(); // the parent switches to the 2D drawing
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    canvas.setAttribute('aria-hidden', 'true');
    wrap.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0.0, 0.2, 4.6);
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, -0.02, 0);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = Math.PI * 0.32;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6; // one turn every ~37 s
    controls.update();

    // --- Region uniforms (shared by all materials)
    const shared = {
      uColor: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] },
      uStrength: { value: [0.12, 0.12, 0.12] },
      uPulse: { value: [0, 0, 0] },
      uHover: { value: -1 },
      uSelected: { value: -1 },
      uTime: { value: 0 },
      uNeckY: { value: BOUNDS.neckY },
      uHeadR: { value: BOUNDS.headR },
      uWaistY: { value: BOUNDS.waistY },
    };

    // --- Environment: the ground ring under the feet (dashed, rotates slowly) and an invisible hit ring
    const envGroup = new THREE.Group();
    envGroup.position.y = -1.0;
    scene.add(envGroup);
    const envMat = new THREE.MeshBasicMaterial({ color: COLORS.offline, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const envSoft = new THREE.MeshBasicMaterial({ color: COLORS.offline, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
    const dashes = new THREE.Group();
    const DASH = 36;
    for (let i = 0; i < DASH; i++) {
      const g = new THREE.RingGeometry(0.86, 0.92, 6, 1, (i / DASH) * Math.PI * 2, (Math.PI * 2) / DASH / 1.8);
      const m = new THREE.Mesh(g, envMat);
      m.rotation.x = -Math.PI / 2;
      dashes.add(m);
    }
    envGroup.add(dashes);
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.84, 64), envSoft);
    disc.rotation.x = -Math.PI / 2;
    envGroup.add(disc);
    const envHit = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.02, 48), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    envHit.rotation.x = -Math.PI / 2;
    envGroup.add(envHit);

    // --- Model
    const meshes: THREE.Mesh[] = [];
    // three loads the Draco decoder from its own package (Vite adds it to the build): no internet needed
    const draco = new DRACOLoader();
    const loader = new GLTFLoader().setDRACOLoader(draco);
    let disposed = false;
    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const s = 2 / size.y;
        const pivot = new THREE.Group();
        model.position.set(-center.x, -box.min.y, -center.z);
        pivot.add(model);
        pivot.scale.setScalar(s);
        pivot.position.y = -1;
        scene.add(pivot);
        model.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const src = mesh.material as THREE.MeshStandardMaterial;
          const map = src.map ?? null;
          if (map) map.colorSpace = THREE.SRGBColorSpace;
          const glass = /2$/.test(src.name ?? '') ? 1 : 0; // the second material is the helmet visor
          mesh.material = new THREE.ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            uniforms: { ...shared, uMap: { value: map }, uHasMap: { value: map ? 1 : 0 }, uGlass: { value: glass } },
            side: THREE.DoubleSide,
          });
          src.dispose();
          meshes.push(mesh);
        });
        setState('ready');
      },
      undefined,
      () => {
        if (disposed) return;
        setState('error');
        propsRef.current.onError();
      },
    );

    // --- Size
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      camera.aspect = w / h;
      // Move the camera back so the model fits in a narrow container
      const fit = Math.max(1, 0.62 / camera.aspect);
      camera.position.setLength(4.6 * fit);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // --- Mouse: hover shows the region, click selects
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hovered: RegionId | null = null;
    let down: { x: number; y: number } | null = null;
    const pick = (e: PointerEvent): RegionId | null => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects([...meshes, envHit], false)[0];
      if (!hit) return null;
      if (hit.object === envHit) return 'env';
      const mat = (hit.object as THREE.Mesh).material as THREE.ShaderMaterial;
      return mat.uniforms?.uGlass?.value ? 'head' : regionOf(hit.point);
    };
    const onMove = (e: PointerEvent) => {
      const region = pick(e);
      const r = canvas.getBoundingClientRect();
      hovered = region;
      canvas.style.cursor = region ? 'pointer' : 'grab';
      propsRef.current.onHover(region ? { region, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height } : null);
    };
    const onLeave = () => {
      hovered = null;
      propsRef.current.onHover(null);
    };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
        const region = pick(e);
        if (region) propsRef.current.onSelect(region);
      }
      down = null;
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);

    // --- Render loop
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const { levels: lv, selected: sel } = propsRef.current;
      const t = (performance.now() - t0) / 1000;
      for (let i = 0; i < 3; i++) {
        const l = lv[ORDER[i]];
        shared.uColor.value[i].copy(levelColor(l));
        shared.uStrength.value[i] = levelStrength(l);
        shared.uPulse.value[i] = l === 'critical' && !still ? 1 : 0;
      }
      shared.uHover.value = hovered && hovered !== 'env' ? ORDER.indexOf(hovered) : -1;
      shared.uSelected.value = sel && sel !== 'env' ? ORDER.indexOf(sel) : -1;
      shared.uTime.value = t;
      // Environment ring
      const envLevel = lv.env;
      const envC = levelColor(envLevel);
      envMat.color.copy(envC);
      envSoft.color.copy(envC);
      const envOn = hovered === 'env' || sel === 'env';
      const pulse = envLevel === 'critical' && !still ? 0.5 + 0.5 * Math.sin(t * 5) : 0;
      envSoft.opacity = (envLevel && envLevel !== 'normal' ? 0.22 : 0.1) + (envOn ? 0.14 : 0) + pulse * 0.2;
      envMat.opacity = envOn ? 1 : 0.75;
      dashes.rotation.y = t * 0.15;
      // Continuous slow rotation; slows down while the cursor is over the model, so it is easy to read
      controls.autoRotate = true;
      controls.autoRotateSpeed = hovered ? 0.5 : 1.6;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const m = mesh.material as THREE.Material & { uniforms?: { uMap?: { value: THREE.Texture | null } } };
        m.uniforms?.uMap?.value?.dispose();
        m.dispose();
      });
      draco.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {state === 'loading' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400" role="status">
          Loading 3D model…
        </div>
      )}
    </div>
  );
}
