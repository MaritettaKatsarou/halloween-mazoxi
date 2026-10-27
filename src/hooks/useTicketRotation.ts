import { useRef } from 'react'
import type { PointerEvent } from 'react'
import { useAnimationFrame, useMotionValue, useReducedMotion } from 'motion/react'

export function useTicketRotation(stable: boolean, paused: boolean, initiallyStable = false) {
  const reduced = useReducedMotion()
  const rotateX = useMotionValue(initiallyStable ? 0 : -9)
  const rotateY = useMotionValue(initiallyStable ? 0 : -12)
  const rotateZ = useMotionValue(initiallyStable ? 0 : 40)
  const gesture = useRef({ active: false, x: 0, y: 0, vx: 0, vy: 0, time: 0 })
  useAnimationFrame((_, delta) => {
    const dt = Math.min(delta, 32) / 1000
    const g = gesture.current
    if (stable || reduced) {
      const blend = reduced ? 1 : 1 - Math.exp(-7 * dt)
      const nearestFront = Math.round(rotateY.get() / 360) * 360
      rotateY.set(rotateY.get() + (nearestFront - rotateY.get()) * blend)
      rotateX.set(rotateX.get() * (1 - blend))
      rotateZ.set(rotateZ.get() * (1 - blend))
      g.vx = g.vy = 0
    } else if (!g.active && !paused) {
      g.vx *= Math.exp(-4 * dt)
      g.vy *= Math.exp(-5 * dt)
      rotateY.set(rotateY.get() + (8 + g.vx) * dt)
      rotateX.set(rotateX.get() + g.vy * dt + (-9 - rotateX.get()) * dt * 1.2)
      rotateZ.set(rotateZ.get() + (40 - rotateZ.get()) * dt * 2)
    }
  })
  const end = (e: PointerEvent<HTMLDivElement>) => {
    gesture.current.active = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  return { rotateX, rotateY, rotateZ, handlers: {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (stable || reduced || !e.isPrimary || e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      gesture.current = { active: true, x: e.clientX, y: e.clientY, vx: 0, vy: 0, time: e.timeStamp }
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const g = gesture.current
      if (stable || reduced) { g.active = false; return }
      if (!g.active) return
      const dx = e.clientX - g.x, dy = e.clientY - g.y
      const elapsed = Math.max(8, e.timeStamp - g.time) / 1000
      rotateY.set(rotateY.get() + dx * .55)
      rotateX.set(Math.max(-38, Math.min(38, rotateX.get() - dy * .35)))
      g.vx = Math.max(-160, Math.min(160, dx * .55 / elapsed))
      g.vy = Math.max(-70, Math.min(70, -dy * .35 / elapsed))
      g.x = e.clientX; g.y = e.clientY; g.time = e.timeStamp
    },
    onPointerUp: end, onPointerCancel: end,
    onLostPointerCapture: () => { gesture.current.active = false },
  } }
}
