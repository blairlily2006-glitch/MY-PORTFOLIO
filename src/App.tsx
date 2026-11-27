import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CustomCursor, FixedInterface, SmoothScroll } from './components/GlobalSystems'
import { HeroScene } from './components/HeroScene'
import { OpeningSequence } from './components/OpeningSequence'
import type { Locale } from './i18n'
import { useMotionStore } from './store/motion'

gsap.registerPlugin(ScrollTrigger)

const CONFIG = {
  stars: {
    count: 210,
    attractRadius: 260,
    stiffness: 0.012,
    damping: 0.94,
    maxSpeed: 6,
    minGap: 24,
    fadeInSpread: 5000,
    fadeDuration: 2000,
    driftSpeed: 8,
    releaseDelay: 1500,
    releaseDuration: 3000,
    mainStarRatio: 0.15,
  },
  cave: {
    radius: 180,
    decayMs: 2200,
    maxBrightness: 0.5,
    followMs: 95,
    radiusFollow: 0.16,
    warmGlow: 0.075,
    trailOpacity: 0.1,
    trailRadius: 0.7,
    fireflyCount: 36,
    introMs: 1000,
    maskScale: 0.5,
  },
}

type Star = {
  x: number; y: number; vx: number; vy: number; homeX: number; homeY: number
  size: number; alpha: number; delay: number; phase: number; main: boolean
  offsetX: number; offsetY: number; noise: number
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = matchMedia('(pointer: fine)').matches
    const points: Star[] = []
    let width = 0
    let height = 0
    let pointerX = -10000
    let pointerY = -10000
    let targetX = pointerX
    let targetY = pointerY
    let pointerMovedAt = performance.now()
    let lastFrame = 0
    let frame = 0
    const startedAt = performance.now()
    const { stars } = CONFIG

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const dpr = Math.min(devicePixelRatio || 1, 1.5)
      width = bounds.width
      height = bounds.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      points.length = 0
      const count = Math.max(180, Math.min(240, stars.count))
      for (let i = 0; i < count; i += 1) {
        points.push({
          x: Math.random() * width, y: Math.random() * height, vx: 0, vy: 0,
          homeX: Math.random() * width, homeY: Math.random() * height,
          size: 0.5 + Math.random() * 0.9,
          alpha: 0.3 + Math.random() * 0.45,
          delay: Math.random() * stars.fadeInSpread,
          phase: Math.random() * Math.PI * 2,
          main: Math.random() < stars.mainStarRatio,
          offsetX: (Math.random() * 2 - 1) * 320,
          offsetY: (Math.random() * 2 - 1) * 200,
          noise: Math.random() * 1000,
        })
      }
    }

    const onPointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      targetX = event.clientX - bounds.left
      targetY = event.clientY - bounds.top
      pointerMovedAt = performance.now()
    }
    const clearPointer = () => { targetX = -10000; targetY = -10000 }

    const draw = (now: number) => {
      const dtMs = Math.min(now - (lastFrame || now), 32)
      const dt = dtMs / 16.667
      lastFrame = now
      if (Number.isFinite(targetX) && targetX > -9000) {
        if (pointerX < -9000) {
          pointerX = targetX
          pointerY = targetY
        } else {
          pointerX += (targetX - pointerX) * 0.14
          pointerY += (targetY - pointerY) * 0.14
        }
      }
      ctx.clearRect(0, 0, width, height)

      points.forEach((p, index) => {
        const age = now - startedAt - p.delay
        const fade = reduced ? 1 : Math.max(0, Math.min(1, age / stars.fadeDuration))
        const dx = pointerX - p.x
        const dy = pointerY - p.y
        const distance = Math.hypot(dx, dy)
        const nearby = !reduced && finePointer && distance < stars.attractRadius
        const idleMs = now - pointerMovedAt
        const release = nearby && idleMs <= stars.releaseDelay
          ? 1
          : nearby && idleMs < stars.releaseDelay + stars.releaseDuration
            ? 1 - (idleMs - stars.releaseDelay) / stars.releaseDuration
            : 0
        const returnHome = !reduced && idleMs > stars.releaseDelay
          ? Math.min(1, (idleMs - stars.releaseDelay) / stars.releaseDuration)
          : 0

        const driftT = now * 0.00015 + p.noise
        const driftX = (Math.sin(driftT + index * 0.7) + Math.sin(driftT * 0.43 + index) * 0.5) * 0.003
        const driftY = (Math.cos(driftT * 0.8 + index * 0.37) + Math.sin(driftT * 0.51 + index * 1.3) * 0.5) * 0.003
        const maxDrift = stars.driftSpeed / 60
        const driftLength = Math.hypot(driftX, driftY)
        const driftScale = driftLength > maxDrift ? maxDrift / driftLength : 1
        p.vx += driftX * driftScale * dt
        p.vy += driftY * driftScale * dt

        if (release > 0) {
          p.vx += (pointerX + p.offsetX - p.x) * stars.stiffness * release * dt
          p.vy += (pointerY + p.offsetY - p.y) * stars.stiffness * release * dt
        }
        if (returnHome > 0) {
          p.vx += (p.homeX - p.x) * stars.stiffness * returnHome * dt
          p.vy += (p.homeY - p.y) * stars.stiffness * returnHome * dt
        }

        // A small local repulsion keeps nearby stars from collapsing into one point.
        if (!reduced) {
          for (let otherIndex = index + 1; otherIndex < points.length; otherIndex += 1) {
            const other = points[otherIndex]
            const gapX = p.x - other.x
            const gapY = p.y - other.y
            const gap = Math.hypot(gapX, gapY)
            if (gap > 0 && gap < stars.minGap) {
              const push = (stars.minGap - gap) * 0.0013 * dt
              p.vx += (gapX / gap) * push
              p.vy += (gapY / gap) * push
              other.vx -= (gapX / gap) * push
              other.vy -= (gapY / gap) * push
            }
          }
        }

        p.vx *= Math.pow(stars.damping, dt)
        p.vy *= Math.pow(stars.damping, dt)
        const speed = Math.hypot(p.vx, p.vy)
        const maxStep = stars.maxSpeed * dt
        if (speed > maxStep) {
          p.vx *= maxStep / speed
          p.vy *= maxStep / speed
        }
        p.x += p.vx
        p.y += p.vy
        if (p.x < -5) p.x = width + 5
        if (p.x > width + 5) p.x = -5
        if (p.y < -5) p.y = height + 5
        if (p.y > height + 5) p.y = -5

        const twinkle = p.main && !reduced ? 0.78 + Math.sin(now / (480 + p.phase * 35) + p.phase) * 0.22 : 1
        const alpha = p.alpha * fade * twinkle
        if (alpha <= 0) return
        ctx.beginPath()
        ctx.fillStyle = `rgba(255,244,225,${alpha})`
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        if (p.main && alpha > 0.12) {
          ctx.beginPath()
          ctx.fillStyle = `rgba(255,231,193,${alpha * 0.12})`
          ctx.arc(p.x, p.y, p.size * 4.2, 0, Math.PI * 2)
          ctx.fill()
        }
      })
      frame = requestAnimationFrame(draw)
    }

    resize()
    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('blur', clearPointer)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('blur', clearPointer)
    }
  }, [])

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />
}

type Work = { title: string; type: 'image' | 'video'; src: string; href: string; caption: string }
const works: Work[] = [
  { title: '片刻 Reel Moment', type: 'image', src: '', href: '#', caption: 'UI/UX · 电影内容产品' },
  { title: '会呼吸的家居生命体', type: 'image', src: '', href: '#', caption: '产品设计 · 居家健康 · 团队项目' },
  { title: '茶马风云 · 茶马古道体验设计', type: 'image', src: '', href: '#', caption: '服务与体验设计 · 团队项目' },
]

function WorkPlane({ work, index }: { work: Work; index: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playingRef = useRef(true)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'low-power' })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))
    renderer.setClearColor(0x0c0c0e, 1)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.z = 4.1
    const uniforms = {
      uTime: { value: 0 },
      uVelocity: { value: 0 },
      uTexture: { value: null as THREE.Texture | null },
      uHasTexture: { value: 0 },
      uIndex: { value: index },
    }
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        uniform float uVelocity;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          float edge = sin(uv.x * 3.14159265);
          float lower = pow(1.0 - uv.y, 2.0);
          p.z += uVelocity * 0.42 * lower * edge;
          p.x += (uv.x - 0.5) * uVelocity * 0.09 * (1.0 - uv.y);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform float uHasTexture;
        uniform float uIndex;
        varying vec2 vUv;
        void main() {
          vec3 blank = vec3(0.047, 0.047, 0.055);
          vec3 color = mix(blank, texture2D(uTexture, vUv).rgb, uHasTexture);
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      wireframe: false,
    })
    const geometry = new THREE.PlaneGeometry(3.4, 1.95, 32, 32)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    let mediaObserver: IntersectionObserver | undefined
    let video: HTMLVideoElement | undefined
    let texture: THREE.Texture | undefined
    if (work.src) {
      if (work.type === 'video') {
        video = document.createElement('video')
        video.src = work.src
        video.muted = true
        video.loop = true
        video.playsInline = true
        video.preload = 'metadata'
        videoRef.current = video
        texture = new THREE.VideoTexture(video)
        mediaObserver = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting && playingRef.current) void video?.play().catch(() => undefined)
          else video?.pause()
        })
        mediaObserver.observe(canvas)
      } else {
        texture = new THREE.TextureLoader().load(work.src, () => renderer.render(scene, camera))
      }
      texture.colorSpace = THREE.SRGBColorSpace
      uniforms.uTexture.value = texture
      uniforms.uHasTexture.value = 1
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      renderer.setSize(rect.width, rect.height, false)
      camera.aspect = rect.width / rect.height
      camera.updateProjectionMatrix()
      const aspect = rect.width / rect.height
      mesh.scale.set(aspect > 1.4 ? 1 : aspect / 1.4, aspect > 1.4 ? 1.4 / aspect : 1, 1)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    let raf = 0
    let velocity = 0
    let visible = false
    const clock = new THREE.Clock()
    const render = () => {
      if (!visible) return
      const scrollVelocity = useMotionStore.getState().scrollVelocity
      const target = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.max(-1, Math.min(1, scrollVelocity / 90))
      velocity += (target - velocity) * 0.16
      uniforms.uVelocity.value = velocity
      uniforms.uTime.value = clock.getElapsedTime()
      if (texture instanceof THREE.VideoTexture && video?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) texture.needsUpdate = true
      renderer.render(scene, camera)
      raf = requestAnimationFrame(render)
    }
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) raf = requestAnimationFrame(render)
      else cancelAnimationFrame(raf)
    }, { rootMargin: '120px' })
    visibilityObserver.observe(canvas)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      visibilityObserver.disconnect()
      mediaObserver?.disconnect()
      video?.pause()
      texture?.dispose()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [work.src, work.type, index])

  return (
    <div className={`project-art${work.src ? ' has-work' : ' is-empty'}`}>
      <canvas ref={canvasRef} aria-label={work.src ? `${work.title} project preview` : 'Empty project display'} />
      {!work.src && <span className="empty-state">{navigator.language.toLowerCase().startsWith('en') ? 'Coming soon' : '作品整理中'}</span>}
      {work.src && <>
        <a className="case-link" href={work.href}>查看案例 <span>↗</span></a>
        <span className="art-index">0{index + 1}</span>
        <span className="work-caption">{work.caption} — {work.title}</span>
        {work.type === 'video' && <button className="video-toggle" type="button" aria-pressed={playing} aria-label={playing ? 'Pause preview' : 'Play preview'} onClick={() => {
          const next = !playingRef.current
          playingRef.current = next
          setPlaying(next)
          if (next) void videoRef.current?.play().catch(() => undefined)
          else videoRef.current?.pause()
        }}>{playing ? 'Ⅱ' : '▶'}</button>}
      </>}
    </div>
  )
}

type Firefly = { x: number; y: number; vx: number; vy: number; phase: number; size: number }
const hiddenWords = [
  { text: 'INTERACTION', x: 22, y: 31 },
  { text: 'MOTION', x: 74, y: 25 },
  { text: 'PROTOTYPE', x: 66, y: 67 },
  { text: 'HANGZHOU', x: 27, y: 76 },
  { text: 'CURIOSITY', x: 48, y: 46 },
]

function CaveExplorer() {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([])

  useEffect(() => {
    const section = sectionRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!section || !canvas || !ctx) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = matchMedia('(pointer: fine)').matches
    const cave = new Image()
    cave.src = `${import.meta.env.BASE_URL}images/galaxy-exploration.png`
    const trailCanvas = document.createElement('canvas')
    const trail = trailCanvas.getContext('2d')
    const maskCanvas = document.createElement('canvas')
    const mask = maskCanvas.getContext('2d')
    const lightCanvas = document.createElement('canvas')
    const light = lightCanvas.getContext('2d')
    const compositeCanvas = document.createElement('canvas')
    const composite = compositeCanvas.getContext('2d')
    if (!trail || !mask || !light || !composite) return
    const fireflies: Firefly[] = Array.from({ length: CONFIG.cave.fireflyCount }, () => ({
      x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.00012,
      vy: (Math.random() - 0.5) * 0.0001, phase: Math.random() * Math.PI * 2,
      size: 0.8 + Math.random() * 1.5,
    }))
    const ripples: Array<{ x: number; y: number; start: number }> = []
    const dwell = hiddenWords.map(() => ({ since: 0, opacity: 0, lastSeen: 0 }))
    let active = false
    let frame = 0
    let last = 0
    let enteredAt = 0
    let targetX = 0.5
    let targetY = 0.5
    let lightX = 0.5
    let lightY = 0.5
    let hasPointer = reduced || !finePointer
    let lightRadius = 0
    let pointerSpeed = 0
    let previousPointerAt = 0
    let previousPointer = { x: 0, y: 0 }
    let autoClock = 0
    let cssWidth = 0
    let cssHeight = 0
    let dpr = 1
    const lastTouchAt = { value: 0 }

    const resize = () => {
      const bounds = section.getBoundingClientRect()
      cssWidth = bounds.width
      cssHeight = bounds.height
      dpr = Math.min(devicePixelRatio || 1, 1)
      canvas.width = Math.round(cssWidth * dpr)
      canvas.height = Math.round(cssHeight * dpr)
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
      compositeCanvas.width = canvas.width
      compositeCanvas.height = canvas.height
      maskCanvas.width = Math.max(1, Math.round(cssWidth * CONFIG.cave.maskScale))
      maskCanvas.height = Math.max(1, Math.round(cssHeight * CONFIG.cave.maskScale))
      trailCanvas.width = maskCanvas.width
      trailCanvas.height = maskCanvas.height
      lightCanvas.width = maskCanvas.width
      lightCanvas.height = maskCanvas.height
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const setPointer = (clientX: number, clientY: number) => {
      const bounds = section.getBoundingClientRect()
      const x = clientX - bounds.left
      const y = clientY - bounds.top
      hasPointer = true
      const now = performance.now()
      const elapsed = Math.max(16, now - previousPointerAt)
      const moveX = x - previousPointer.x
      const moveY = y - previousPointer.y
      const moveDistance = Math.hypot(moveX, moveY)
      pointerSpeed = moveDistance / elapsed
      if (previousPointerAt && moveDistance > 9) {
        const trailX = (previousPointer.x + x) * 0.5 * CONFIG.cave.maskScale
        const trailY = (previousPointer.y + y) * 0.5 * CONFIG.cave.maskScale
        const trailR = CONFIG.cave.radius * CONFIG.cave.trailRadius * CONFIG.cave.maskScale
        const trace = trail.createRadialGradient(trailX, trailY, 0, trailX, trailY, trailR)
        trace.addColorStop(0, `rgba(255,255,255,${CONFIG.cave.trailOpacity})`)
        trace.addColorStop(1, 'rgba(255,255,255,0)')
        trail.fillStyle = trace
        trail.fillRect(trailX - trailR, trailY - trailR, trailR * 2, trailR * 2)
      }
      previousPointer = { x, y }
      previousPointerAt = now
      targetX = Math.max(0, Math.min(1, x / bounds.width))
      targetY = Math.max(0, Math.min(1, y / bounds.height))
      if (targetY > 0.7 && !reduced && now - lastTouchAt.value > 220) {
        ripples.push({ x: targetX, y: targetY, start: now })
        lastTouchAt.value = now
      }
    }
    const onPointerMove = (event: PointerEvent) => setPointer(event.clientX, event.clientY)
    const onTouchStart = (event: PointerEvent) => { if (event.pointerType === 'touch') setPointer(event.clientX, event.clientY) }
    const onTouchEnd = (event: PointerEvent) => { if (event.pointerType === 'touch') lastTouchAt.value = performance.now() }
    const observer = new IntersectionObserver(([entry]) => {
      active = entry.isIntersecting
      if (active) {
        enteredAt = performance.now()
        frame = requestAnimationFrame(draw)
      } else {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }, { threshold: 0.01 })
    observer.observe(section)

    const draw = (now: number) => {
      if (!active) return
      const dt = Math.min(now - (last || now), 40)
      last = now
      const intro = reduced ? 1 : Math.min(1, (now - enteredAt) / CONFIG.cave.introMs)
      if (!finePointer && now - lastTouchAt.value > 1100 && !reduced) {
        autoClock += dt * 0.00018
        targetX = 0.5 + Math.sin(autoClock) * 0.3
        targetY = 0.5 + Math.sin(autoClock * 2 + 0.7) * 0.22
        hasPointer = true
      }
      const follow = reduced ? 1 : 1 - Math.exp(-dt / CONFIG.cave.followMs)
      lightX += (targetX - lightX) * follow
      lightY += (targetY - lightY) * follow
      const radius = CONFIG.cave.radius + (!reduced ? Math.min(45, pointerSpeed * 30) : 0)
      const radiusTarget = hasPointer ? radius * intro : 0
      lightRadius += (radiusTarget - lightRadius) * (reduced ? 1 : CONFIG.cave.radiusFollow)
      pointerSpeed *= 0.92

      const mw = maskCanvas.width
      const mh = maskCanvas.height
      trail.save()
      trail.globalCompositeOperation = 'destination-out'
      trail.fillStyle = reduced ? 'rgba(0,0,0,1)' : `rgba(0,0,0,${Math.min(0.08, dt / CONFIG.cave.decayMs)})`
      trail.fillRect(0, 0, mw, mh)
      trail.restore()
      const mx = lightX * mw
      const my = lightY * mh
      const mr = lightRadius * CONFIG.cave.maskScale
      light.clearRect(0, 0, mw, mh)
      const gradient = light.createRadialGradient(mx, my, 0, mx, my, Math.max(1, mr))
      gradient.addColorStop(0, `rgba(255,255,255,${CONFIG.cave.maxBrightness})`)
      gradient.addColorStop(0.38, `rgba(255,255,255,${CONFIG.cave.maxBrightness * 0.76})`)
      gradient.addColorStop(0.76, `rgba(255,255,255,${CONFIG.cave.maxBrightness * 0.2})`)
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      light.fillStyle = gradient
      light.fillRect(0, 0, mw, mh)

      mask.clearRect(0, 0, mw, mh)
      mask.drawImage(trailCanvas, 0, 0)
      mask.drawImage(lightCanvas, 0, 0)
      mask.save()

      ripples.forEach((ripple) => {
        const progress = Math.max(0, (now - ripple.start) / 1600)
        if (progress >= 1) return
        mask.beginPath()
        mask.strokeStyle = `rgba(255,255,255,${(1 - progress) * 0.2})`
        mask.lineWidth = 1
        for (let ring = 0; ring < 3; ring += 1) {
          const radiusPx = (progress * 70 + ring * 17) * CONFIG.cave.maskScale
          mask.arc(ripple.x * mw, ripple.y * mh, radiusPx, 0, Math.PI * 2)
        }
        mask.stroke()
      })
      mask.restore()
      for (let i = ripples.length - 1; i >= 0; i -= 1) if (now - ripples[i].start > 1600) ripples.splice(i, 1)

      composite.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height)
      if (cave.complete && cave.naturalWidth) {
        const scale = Math.max(cssWidth / cave.naturalWidth, cssHeight / cave.naturalHeight) * 1.08
        const drawW = cave.naturalWidth * scale
        const drawH = cave.naturalHeight * scale
        const offsetX = (cssWidth - drawW) / 2 + (0.5 - lightX) * 40
        const offsetY = (cssHeight - drawH) / 2 + (0.5 - lightY) * 40
        composite.save()
        composite.filter = 'brightness(1.22) contrast(1.12)'
        composite.drawImage(cave, offsetX * dpr, offsetY * dpr, drawW * dpr, drawH * dpr)
        composite.restore()
        composite.globalCompositeOperation = 'destination-in'
        composite.drawImage(maskCanvas, 0, 0, compositeCanvas.width, compositeCanvas.height)
        composite.globalCompositeOperation = 'source-over'
      }
      ctx.clearRect(0, 0, cssWidth, cssHeight)
      ctx.drawImage(compositeCanvas, 0, 0, cssWidth, cssHeight)
      if (!reduced && lightRadius > 1) {
        const glowRadius = lightRadius * 1.18
        const warm = ctx.createRadialGradient(lightX * cssWidth, lightY * cssHeight, 0, lightX * cssWidth, lightY * cssHeight, glowRadius)
        warm.addColorStop(0, `rgba(255,226,184,${CONFIG.cave.warmGlow})`)
        warm.addColorStop(0.5, `rgba(255,226,184,${CONFIG.cave.warmGlow * 0.32})`)
        warm.addColorStop(1, 'rgba(255,226,184,0)')
        ctx.globalCompositeOperation = 'screen'
        ctx.fillStyle = warm
        ctx.fillRect(0, 0, cssWidth, cssHeight)
        ctx.globalCompositeOperation = 'source-over'
      }
      fireflies.forEach((fly) => {
        if (!reduced) {
          fly.x += fly.vx * dt
          fly.y += fly.vy * dt
          fly.vx += (Math.random() - 0.5) * 0.000008 * dt
          fly.vy += (Math.random() - 0.5) * 0.000008 * dt
          if (fly.x < 0 || fly.x > 1) fly.vx *= -1
          if (fly.y < 0 || fly.y > 1) fly.vy *= -1
        }
        const distance = Math.hypot((fly.x - lightX) * cssWidth, (fly.y - lightY) * cssHeight)
        const visibility = reduced ? 0 : Math.max(0, 1 - distance / (lightRadius * 1.15))
        if (visibility <= 0.015) return
        const flicker = 0.45 + (Math.sin(now * 0.001 + fly.phase) + 1) * 0.22
        ctx.beginPath()
        ctx.fillStyle = `rgba(255,214,143,${visibility * flicker})`
        ctx.arc(fly.x * cssWidth, fly.y * cssHeight, fly.size, 0, Math.PI * 2)
        ctx.fill()
      })

      hiddenWords.forEach((word, index) => {
        const distance = Math.hypot((lightX - word.x / 100) * cssWidth, (lightY - word.y / 100) * cssHeight)
        const state = dwell[index]
        if (distance < 82) {
          if (!state.since) state.since = now
          if (now - state.since > 600) state.lastSeen = now
        } else state.since = 0
        const target = now - state.lastSeen < 2000 ? 1 : 0
        state.opacity += (target - state.opacity) * (reduced ? 1 : 0.06)
        if (wordRefs.current[index]) wordRefs.current[index]!.style.opacity = String(state.opacity)
      })
      frame = requestAnimationFrame(draw)
    }
    const sizeObserver = new ResizeObserver(resize)
    sizeObserver.observe(section)
    resize()
    section.addEventListener('pointermove', onPointerMove, { passive: true })
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') hasPointer = false
    }
    section.addEventListener('pointerleave', onPointerLeave, { passive: true })
    section.addEventListener('pointerdown', onTouchStart, { passive: true })
    section.addEventListener('pointerup', onTouchEnd, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      sizeObserver.disconnect()
      section.removeEventListener('pointermove', onPointerMove)
      section.removeEventListener('pointerleave', onPointerLeave)
      section.removeEventListener('pointerdown', onTouchStart)
      section.removeEventListener('pointerup', onTouchEnd)
    }
  }, [])

  return (
    <section ref={sectionRef} className="about-section cave-transition" id="about">
      <canvas className="cave-canvas" ref={canvasRef} aria-hidden="true" />
      <div className="cave-words" aria-hidden="true">
        {hiddenWords.map((word, index) => <span key={word.text} ref={(node) => { wordRefs.current[index] = node }} style={{ left: `${word.x}%`, top: `${word.y}%` }}>{word.text}</span>)}
      </div>
    </section>
  )
}

export default function App() {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const [opening, setOpening] = useState(!reducedMotion)
  const [locale, setLocale] = useState<Locale>(() => navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en')
  const finishOpening = useCallback(() => setOpening(false), [])
  useEffect(() => {
    if (opening || reducedMotion) return
    const entrance = gsap.fromTo(
      ['.fixed-header', '.foundation-intro .eyebrow', '.foundation-intro h1', '.hero-subtitle', '.scroll-cue', '.sound-toggle'],
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, stagger: 0.08, ease: 'power2.out', clearProps: 'all' },
    )
    return () => { entrance.kill() }
  }, [opening, reducedMotion])

  useEffect(() => {
    const intro = document.querySelector<HTMLElement>('.foundation-intro')
    const heading = document.querySelector<HTMLElement>('.foundation-intro h1')
    const eyebrow = document.querySelector<HTMLElement>('.eyebrow')
    const subtitle = document.querySelector<HTMLElement>('.hero-subtitle')
    if (opening || reducedMotion || !intro || !heading || !eyebrow || !subtitle) return
    const cleanups: Array<() => void> = []
    const introMotion = gsap.timeline({ scrollTrigger: { trigger: intro, start: 'top top', end: 'bottom top', scrub: 0.8 } })
    introMotion.to(heading, { yPercent: -48, scale: 0.72, opacity: 0.12, ease: 'none' }, 0)
      .to(eyebrow, { y: -70, opacity: 0, ease: 'none' }, 0)
      .to(subtitle, { y: -24, opacity: 0, ease: 'none' }, 0)
      .to(intro, { backgroundPosition: 'center 55%', ease: 'none' }, 0)
    cleanups.push(() => { introMotion.scrollTrigger?.kill(); introMotion.kill() })

    gsap.utils.toArray<HTMLElement>('.project-row').forEach((row, index) => {
      const animation = gsap.fromTo(row,
        { clipPath: 'inset(0 0 32% 0)', y: 90, x: index === 1 ? 54 : -54, opacity: 0.18, scale: 0.96 },
        { clipPath: 'inset(0 0 0% 0)', y: 0, x: 0, opacity: 1, scale: 1, ease: 'none', scrollTrigger: { trigger: row, start: 'top 88%', end: 'top 38%', scrub: 0.8 } },
      )
      cleanups.push(() => { animation.scrollTrigger?.kill(); animation.kill() })
    })
    const about = gsap.fromTo('.about-copy > *', { y: 46, opacity: 0.15 }, {
      y: 0, opacity: 1, stagger: 0.12, ease: 'none',
      scrollTrigger: { trigger: '.about-section', start: 'top 78%', end: 'center 55%', scrub: 0.7 },
    })
    const wordReveal = gsap.fromTo('.about-copy .word', { opacity: 0.28 }, {
      opacity: 1, stagger: 0.2, ease: 'none',
      scrollTrigger: { trigger: '.about-section', start: 'top 72%', end: 'center 46%', scrub: 0.8 },
    })
    const footer = gsap.fromTo('.contact-section > *', { y: 34, opacity: 0.25 }, {
      y: 0, opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: '.contact-section', start: 'top 85%', end: 'center 60%', scrub: 0.6 },
    })
    cleanups.push(() => { about.scrollTrigger?.kill(); about.kill(); wordReveal.scrollTrigger?.kill(); wordReveal.kill(); footer.scrollTrigger?.kill(); footer.kill() })
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [opening, reducedMotion])

  return (
    <>
      <SmoothScroll />
      <div className={opening ? 'site-interface is-hidden' : 'site-interface'}>
        <FixedInterface />
      </div>
      <CustomCursor />
      <main id="top" className={`foundation-stage${opening ? ' is-opening' : ''}`}>
        <section className="foundation-intro" aria-label="Portfolio introduction">
          <HeroScene />
          <span className="eyebrow">INDEPENDENT DESIGN PRACTICE · 2026</span>
          <h1>PORTFOLIO</h1>
          <p className="hero-subtitle">UI/UX DESIGNER <span>·</span> INTERACTION DESIGNER</p>
          <a className="scroll-cue" href="#works">SCROLL TO EXPLORE <i /></a>
        </section>

        <CaveExplorer />

        <section id="works" className="works-section">
          <div className="section-heading"><span>SELECTED WORK</span><span>2023 — 2026</span></div>
          {works.map((work, index) => (
            <article className={`project-row project-row-${index + 1}${work.src ? '' : ' is-empty-work'}`} key={work.title}>
              <span className="project-number">0{index + 1} / 03</span>
              <WorkPlane work={work} index={index} />
              <div className="project-copy">
                <p>{work.caption}</p>
                <h2>{work.title}</h2>
                <span>{index === 0 ? '让选片回归轻松，把时间留给观影。' : index === 1 ? '家用无创呼吸机的居家体验概念。' : '以路线桌游与 VR 沉浸体验，让历史旅程变得可参与。'}</span>
              </div>
              <span className="project-mark" aria-hidden="true">↗</span>
            </article>
          ))}
        </section>

        <footer className="contact-section" id="contact">
          <span>HAVE A PROJECT IN MIND?</span>
          <a href="mailto:2257982465@qq.com">GET IN TOUCH ↗</a>
          <small>© 2026 · PORTFOLIO</small>
        </footer>
      </main>
      {opening && <OpeningSequence locale={locale} onLocaleChange={setLocale} onComplete={finishOpening} />}
    </>
  )
}
