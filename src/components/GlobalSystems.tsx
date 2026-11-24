import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useMotionStore } from '../store/motion'

gsap.registerPlugin(ScrollTrigger)

export function SmoothScroll() {
  useEffect(() => {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const lenis = new Lenis({ lerp: reducedMotion ? 1 : 0.08, smoothWheel: !reducedMotion, syncTouch: false })
    const updateScroll = ({ scroll, limit, velocity }: { scroll: number; limit: number; velocity: number }) => {
      useMotionStore.getState().setScroll(scroll, limit > 0 ? scroll / limit : 0, velocity)
      ScrollTrigger.update()
    }
    lenis.on('scroll', updateScroll)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      lenis.off('scroll', updateScroll)
      lenis.destroy()
    }
  }, [])

  return null
}

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor || !matchMedia('(pointer: fine)').matches) return
    let x = innerWidth / 2
    let y = innerHeight / 2
    let targetX = x
    let targetY = y
    let angle = 0
    let stretch = 1
    let targetAngle = 0
    let targetStretch = 1
    let frame = 0
    const move = (event: PointerEvent) => {
      targetX = event.clientX
      targetY = event.clientY
      const dx = targetX - x
      const dy = targetY - y
      const speed = Math.hypot(dx, dy)
      targetAngle = Math.atan2(dy, dx)
      targetStretch = Math.min(1.6, 1 + speed / 90)
      const target = (event.target as HTMLElement).closest('a,button,[data-cursor]')
      const hovering = Boolean(target)
      cursor.classList.toggle('is-hovering', hovering)
      if (hovering) targetStretch = 1
    }
    const animate = () => {
      x += (targetX - x) * 0.2
      y += (targetY - y) * 0.2
      let angleDelta = targetAngle - angle
      angleDelta = Math.atan2(Math.sin(angleDelta), Math.cos(angleDelta))
      angle += angleDelta * 0.2
      stretch += (targetStretch - stretch) * 0.2
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${angle}rad) scaleX(${stretch})`
      frame = requestAnimationFrame(animate)
    }
    window.addEventListener('pointermove', move, { passive: true })
    frame = requestAnimationFrame(animate)
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <div className="custom-cursor" ref={cursorRef} aria-hidden="true" />
}

export function FixedInterface() {
  const progress = useMotionStore((state) => state.scrollProgress)
  const scroll = useMotionStore((state) => state.scroll)
  const [muted, setMuted] = useState(true)
  const scrolled = scroll > innerHeight * 0.15

  return (
    <>
      <header className={`fixed-header${scrolled ? ' is-scrolled' : ''}`}>
        <a className="wordmark" href="#top" aria-label="Back to top">
          <span className="wordmark-symbol" aria-hidden="true"><i /><i /></span>
          <span>PORTFOLIO</span>
        </a>
        <a className="credits" href="#works">WORKS <span aria-hidden="true">↗</span></a>
        <span className="availability"><i /> AVAILABLE FOR FREELANCE</span>
      </header>
      <button className={`sound-toggle${muted ? '' : ' is-playing'}`} aria-pressed={!muted} aria-label={muted ? 'Enable sound' : 'Mute sound'} onClick={() => setMuted((value) => !value)}>
        {muted ? <span className="sound-line" aria-hidden="true" /> : <span className="sound-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span>}
        {muted ? 'UNMUTE' : 'MUTE'}
      </button>
      <div className="scroll-track" aria-hidden="true"><span style={{ transform: `scaleY(${progress})` }} /></div>
    </>
  )
}

