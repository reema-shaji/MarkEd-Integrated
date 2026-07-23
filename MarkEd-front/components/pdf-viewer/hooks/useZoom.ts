import { useState, useEffect } from 'react'

export function useZoom(initialScale = 1) {
  const [scale, setScale] = useState(initialScale)

  const zoomIn = () => setScale(scale + 0.2)
  const zoomOut = () => setScale(Math.max(0.2, scale - 0.2))

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY
      if (delta < 0) {
        setScale((prev) => Math.min(3, prev + 0.002))
      } else {
        setScale((prev) => Math.max(0.1, prev - 0.002))
      }
    }
  }

  useEffect(() => {
    document.addEventListener('wheel', handleWheel, { passive: false })
    return () => document.removeEventListener('wheel', handleWheel)
  }, [])

  return { scale, zoomIn, zoomOut, handleWheel }
}
