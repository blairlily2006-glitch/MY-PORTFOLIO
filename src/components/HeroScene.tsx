import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'

const COUNT = 800
const pointerState = { x: 0, y: 0, active: false }

function ParticleField() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const velocities = new Float32Array(COUNT * 3)
    const homes = new Float32Array(COUNT * 3)
    const seeds = new Float32Array(COUNT)
    const colors = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i += 1) {
      const i3 = i * 3
      const x = (Math.random() - 0.5) * 15
      const y = (Math.random() - 0.5) * 9
      const z = (Math.random() - 0.5) * 5
      positions.set([x, y, z], i3)
      homes.set([x, y, z], i3)
      seeds[i] = Math.random()
      const color = new THREE.Color('#ffffff')
      colors.set([color.r, color.g, color.b], i3)
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
    result.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3).setUsage(THREE.DynamicDrawUsage))
    result.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    result.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    result.userData.homes = homes
    return result
  }, [])
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(devicePixelRatio || 1, 1.5) } },
    vertexShader: `
      attribute vec3 aVelocity; attribute float aSeed; attribute vec3 aColor;
      uniform float uTime; uniform float uPixelRatio;
      varying float vSeed; varying vec3 vColor; varying vec2 vVelocity;
      void main(){
        vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=(0.8+aSeed*1.4)*uPixelRatio*(36.0/-mv.z);
        vSeed=aSeed; vColor=aColor; vVelocity=aVelocity.xy;
      }`,
    fragmentShader: `
      uniform float uTime; varying float vSeed; varying vec3 vColor; varying vec2 vVelocity;
      void main(){
        vec2 p=gl_PointCoord-0.5;
        float speed=length(vVelocity);
        float angle=atan(vVelocity.y,vVelocity.x);
        mat2 rot=mat2(cos(angle),-sin(angle),sin(angle),cos(angle)); p=rot*p;
        float stretch=1.0+min(speed*2.8,2.8);
        p.x/=stretch;
        float d=length(p);
        float glow=1.0-smoothstep(0.08,0.5,d);
        float twinkle=0.68+0.32*sin(uTime*1.1+vSeed*60.0);
        float alpha=glow*twinkle*(0.28+vSeed*0.58);
        if(alpha<0.015) discard;
        gl_FragColor=vec4(vColor,alpha);
      }`,
  }), [])
  const pointer = useRef(new THREE.Vector3(0, 0, 0))
  const pointerActive = useRef(false)
  const { camera } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])

  useFrame(({ clock }, delta) => {
    material.uniforms.uTime.value = clock.elapsedTime
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced) {
      raycaster.setFromCamera(new THREE.Vector2(pointerState.x, pointerState.y), camera)
      raycaster.ray.intersectPlane(plane, pointer.current)
      pointerActive.current = pointerState.active
    }
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    const velocity = geometry.getAttribute('aVelocity') as THREE.BufferAttribute
    const homes = geometry.userData.homes as Float32Array
    const step = Math.min(delta, 0.033)
    for (let i = 0; i < COUNT; i += 1) {
      const i3 = i * 3
      let x = pos.array[i3] as number
      let y = pos.array[i3 + 1] as number
      let z = pos.array[i3 + 2] as number
      let vx = velocity.array[i3] as number
      let vy = velocity.array[i3 + 1] as number
      let vz = velocity.array[i3 + 2] as number
      const homeX = homes[i3] as number
      const homeY = homes[i3 + 1] as number
      const homeZ = homes[i3 + 2] as number
      const dx = pointer.current.x - x
      const dy = pointer.current.y - y
      const distance = Math.hypot(dx, dy)
      const influence = pointerActive.current && distance < 4.2 ? (1 - distance / 4.2) ** 2 : 0
      const phase = clock.elapsedTime * 0.32 + i * 0.37
      vx += (homeX - x) * 0.045 * step + Math.sin(phase) * 0.018 * step + dx * influence * 0.82 * step
      vy += (homeY - y) * 0.045 * step + Math.cos(phase * 0.83) * 0.018 * step + dy * influence * 0.82 * step
      vz += (homeZ - z) * 0.045 * step - z * 0.008 * step
      const damping = Math.pow(0.91, step * 60)
      vx *= damping; vy *= damping; vz *= damping
      x += vx; y += vy; z += vz
      pos.array[i3] = x; pos.array[i3 + 1] = y; pos.array[i3 + 2] = z
      velocity.array[i3] = vx; velocity.array[i3 + 1] = vy; velocity.array[i3 + 2] = vz
    }
    pos.needsUpdate = true
    velocity.needsUpdate = true
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

function Emblem() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, delta) => {
    if (!ref.current) return
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.25) * 0.035
    ref.current.rotation.y += delta * 0.08
  })
  const shape = useMemo(() => {
    const outer = new THREE.Shape()
    const r = 0.82
    outer.moveTo(-r + 0.22, -r); outer.lineTo(r - 0.22, -r); outer.quadraticCurveTo(r, -r, r, -r + 0.22)
    outer.lineTo(r, r - 0.22); outer.quadraticCurveTo(r, r, r - 0.22, r); outer.lineTo(-r + 0.22, r)
    outer.quadraticCurveTo(-r, r, -r, r - 0.22); outer.lineTo(-r, -r + 0.22); outer.quadraticCurveTo(-r, -r, -r + 0.22, -r)
    const hole = new THREE.Path()
    const h = 0.43
    hole.moveTo(-h, -h); hole.lineTo(-h, h); hole.lineTo(h, h); hole.lineTo(h, -h); hole.closePath()
    outer.holes.push(hole)
    return new THREE.ExtrudeGeometry(outer, { depth: 0.12, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.045, bevelThickness: 0.045, curveSegments: 8 })
  }, [])
  return <mesh ref={ref} geometry={shape}>
    <meshStandardMaterial color="#eee8de" emissive="#d8c8b3" emissiveIntensity={0.7} metalness={0.35} roughness={0.24} />
  </mesh>
}

function Scene() {
  const particleLayer = useRef<THREE.Group>(null)
  const emblemLayer = useRef<THREE.Group>(null)
  const { size } = useThree()
  useFrame((_, delta) => {
    const lerp = 1 - Math.pow(0.001, Math.min(delta, 0.033))
    if (particleLayer.current) {
      particleLayer.current.position.x += ((-pointerState.x * 0.13) - particleLayer.current.position.x) * lerp
      particleLayer.current.position.y += ((-pointerState.y * 0.08) - particleLayer.current.position.y) * lerp
    }
    if (emblemLayer.current) {
      emblemLayer.current.position.x += ((-pointerState.x * size.width / innerWidth * 0.09) - emblemLayer.current.position.x) * lerp
      emblemLayer.current.position.y += ((pointerState.y * size.height / innerHeight * 0.09) - emblemLayer.current.position.y) * lerp
    }
  })
  return <>
    <ambientLight intensity={0.45} />
    <pointLight position={[0, 0, 2]} intensity={3} color="#ffcf9a" distance={8} />
    <group ref={particleLayer}><ParticleField /></group>
    <group ref={emblemLayer}><Emblem /></group>
    <EffectComposer multisampling={0}><Bloom intensity={0.65} luminanceThreshold={0.72} luminanceSmoothing={0.3} mipmapBlur /></EffectComposer>
  </>
}

export function HeroScene() {
  const pointer = useRef({ x: 0, y: 0 })
  const backgroundRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const bounds = backgroundRef.current?.getBoundingClientRect()
      if (!bounds) return
      pointer.current.x = (event.clientX - bounds.left) / bounds.width * 2 - 1
      pointer.current.y = 1 - (event.clientY - bounds.top) / bounds.height * 2
      pointerState.x = pointer.current.x
      pointerState.y = pointer.current.y
      pointerState.active = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
    }
    const leave = () => { pointerState.active = false }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('blur', leave)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('blur', leave) }
  }, [])
  useFrameDomParallax(backgroundRef, pointer)
  const quality = matchMedia('(pointer: coarse)').matches ? 0.65 : 1
  return <div className="hero-scene">
    <div
      className="hero-scene-backdrop"
      ref={backgroundRef}
      style={{ backgroundImage: `linear-gradient(180deg,rgba(3,4,6,.08),rgba(3,4,6,.26) 55%,#08090a 100%),url("${import.meta.env.BASE_URL}images/deep-space.png")` }}
    />
    <div className="hero-scene-canvas">
      <Canvas dpr={quality} camera={{ position: [0, 0, 6.5], fov: 47 }} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}>
        <Scene />
      </Canvas>
    </div>
  </div>
}

function useFrameDomParallax(elementRef: React.RefObject<HTMLDivElement | null>, pointer: React.RefObject<{ x: number; y: number }>) {
  useEffect(() => {
    let frame = 0
    let x = 0
    let y = 0
    const tick = () => {
      x += (pointer.current.x * -8 - x) * 0.08
      y += (pointer.current.y * 8 - y) * 0.08
      if (elementRef.current) elementRef.current.style.transform = `translate3d(${x}px,${y}px,0) scale(1.025)`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [elementRef, pointer])
}
