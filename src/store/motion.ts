import { create } from 'zustand'

type MotionState = {
  scroll: number
  scrollProgress: number
  scrollVelocity: number
  setScroll: (scroll: number, progress: number, velocity: number) => void
}

export const useMotionStore = create<MotionState>((set) => ({
  scroll: 0,
  scrollProgress: 0,
  scrollVelocity: 0,
  setScroll: (scroll, scrollProgress, scrollVelocity) =>
    set({ scroll, scrollProgress, scrollVelocity }),
}))
