import { useEffect, useRef, useState } from 'react'

// A lightweight animated ECG-style waveform rendered on canvas.
export function Waveform({ bpm }: { bpm: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [beats, setBeats] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let offset = 0
    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Repeating ECG pattern (P-QRS-T) sampled across one cycle.
    const pattern = (t: number): number => {
      const x = t % 1
      if (x < 0.1) return Math.sin(x * Math.PI * 10) * 0.12
      if (x < 0.2) return 0
      if (x < 0.24) return -(x - 0.2) * 6
      if (x < 0.28) return (x - 0.24) * 40 - 0.24
      if (x < 0.32) return 1.4 - (x - 0.28) * 46
      if (x < 0.36) return -0.44 + (x - 0.32) * 11
      if (x < 0.55) return 0
      if (x < 0.75) return Math.sin((x - 0.55) * Math.PI * 5) * 0.28
      return 0
    }

    let lastBeatCycle = -1

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      ctx.clearRect(0, 0, w, h)

      // grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'
      ctx.lineWidth = 1
      for (let gx = 0; gx < w; gx += 24) {
        ctx.beginPath()
        ctx.moveTo(gx, 0)
        ctx.lineTo(gx, h)
        ctx.stroke()
      }
      for (let gy = 0; gy < h; gy += 24) {
        ctx.beginPath()
        ctx.moveTo(0, gy)
        ctx.lineTo(w, gy)
        ctx.stroke()
      }

      const mid = h / 2
      const amp = h * 0.32
      const cyclesOnScreen = 4
      const speed = (bpm / 60) * 0.006

      ctx.beginPath()
      ctx.strokeStyle = '#22d3ee'
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(34, 211, 238, 0.6)'
      ctx.shadowBlur = 8

      for (let px = 0; px <= w; px++) {
        const t = (px / w) * cyclesOnScreen + offset
        const y = mid - pattern(t) * amp
        if (px === 0) ctx.moveTo(px, y)
        else ctx.lineTo(px, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      const currentCycle = Math.floor(offset + cyclesOnScreen)
      if (currentCycle !== lastBeatCycle) {
        lastBeatCycle = currentCycle
        setBeats((b) => b + 1)
      }

      offset += speed
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [bpm])

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-slate-950/60 px-2 py-1 text-[10px] font-medium text-cyan-300 tabular-nums">
        {beats % 1000} beats
      </div>
    </div>
  )
}
