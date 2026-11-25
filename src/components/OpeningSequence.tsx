import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { CONFIG } from '../config'
import { OPENING_COPY, type Locale } from '../i18n'

const ASSETS_TO_PRELOAD = ['images/deep-space.png', 'images/galaxy-exploration.png']

type Props = {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  onComplete: () => void
  onEnableSound: () => void
}

function BrandMark({ progress }: { progress: number }) {
  return (
    <svg className="opening-mark" viewBox="0 0 120 120" role="img" aria-label="Portfolio mark">
      <path
        pathLength="100"
        d="M18 34 34 86 49 49 62 86 78 34M72 34h31M72 60h25M72 86h31M108 34v52"
        style={{ strokeDasharray: 100, strokeDashoffset: 100 - progress }}
      />
    </svg>
  )
}

export function OpeningSequence({ locale, onLocaleChange, onComplete, onEnableSound }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const reducedMotion = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [phase, setPhase] = useState<'flash' | 'loading'>(reducedMotion.current ? 'loading' : 'flash')
  const [progress, setProgress] = useState(0)
  const copy = OPENING_COPY[locale]

  useEffect(() => {
    document.body.classList.add('opening-active')
    if (reducedMotion.current) {
      onComplete()
      return () => document.body.classList.remove('opening-active')
    }

    const root = rootRef.current
    if (!root) return () => document.body.classList.remove('opening-active')
    const startedAt = performance.now()
    let loaded = 0
    let easedProgress = 0
    let frame = 0
    let active = true
    const images = ASSETS_TO_PRELOAD.map((path) => {
      const image = new Image()
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        loaded += 1
      }
      image.onload = settle
      image.onerror = settle
      image.src = `${import.meta.env.BASE_URL}${path}`
      if (image.complete) settle()
      return image
    })
    const flashTimer = window.setTimeout(() => setPhase('loading'), CONFIG.opening.whiteFlashMs)

    const tick = () => {
      if (!active) return
      const target = loaded / images.length * 100
      easedProgress += (target - easedProgress) * CONFIG.opening.progressEase
      if (loaded === images.length && easedProgress > 99.4) easedProgress = 100
      const nextProgress = Math.floor(easedProgress)
      setProgress((current) => current === nextProgress ? current : nextProgress)

      if (loaded === images.length && easedProgress === 100 && performance.now() - startedAt >= CONFIG.opening.minLoadingMs) {
        active = false
        timelineRef.current = gsap.timeline({ onComplete })
        timelineRef.current
          .to('.opening-loading-copy', { opacity: 0, y: -8, duration: CONFIG.opening.labelFadeSeconds })
          .to('.opening-mark-wrap', {
            scale: 1.04,
            rotateX: -7,
            rotateY: 9,
            filter: `drop-shadow(0 0 28px ${CONFIG.opening.markGlowColor})`,
            duration: CONFIG.opening.markGlowSeconds,
            ease: 'power2.out',
          }, '<')
          .to(root, { autoAlpha: 0, duration: CONFIG.opening.sceneRevealSeconds, ease: 'power2.out' }, `+=${CONFIG.opening.markHoldSeconds}`)
          .to('.hero-scene-backdrop', { filter: 'brightness(1)', duration: CONFIG.opening.sceneRevealSeconds, ease: 'power2.out' }, '<')
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      active = false
      clearTimeout(flashTimer)
      cancelAnimationFrame(frame)
      timelineRef.current?.kill()
      gsap.killTweensOf(root)
      gsap.killTweensOf('.opening-loading-copy, .opening-mark-wrap, .hero-scene-backdrop')
      images.forEach((image) => { image.onload = null; image.onerror = null })
      document.body.classList.remove('opening-active')
    }
  }, [onComplete])

  return (
    <div ref={rootRef} className={`opening-sequence${phase === 'flash' ? ' is-flash' : ' is-loading'}`} aria-live="polite">
      {phase === 'loading' && (
        <>
          <div className="opening-language" aria-label={copy.language}>
            <button type="button" aria-pressed={locale === 'en'} onClick={() => onLocaleChange('en')}>EN</button>
            <span>/</span>
            <button type="button" aria-pressed={locale === 'zh'} onClick={() => onLocaleChange('zh')}>中文</button>
          </div>
          <div className="opening-loading-copy">
            <span>{copy.loading}</span>
            <span className="opening-progress">{progress.toString().padStart(2, '0')}<i>%</i></span>
          </div>
          <div className="opening-mark-wrap"><BrandMark progress={progress} /></div>
          <button className="opening-sound-prompt" type="button" onClick={onEnableSound}>
            <span aria-hidden="true">•</span> {copy.clickSound}
          </button>
        </>
      )}
    </div>
  )
}
