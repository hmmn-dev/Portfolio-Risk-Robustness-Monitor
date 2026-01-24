import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

const LazySection = ({
  children,
  placeholderHeight,
  disabled = false,
  rootMargin = '200px',
}: {
  children: ReactNode
  placeholderHeight: number
  disabled?: boolean
  rootMargin?: string
}) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(disabled)

  useEffect(() => {
    if (disabled || visible) return
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { root: null, rootMargin }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [disabled, visible, rootMargin])

  return <Box ref={ref}>{visible || disabled ? children : <Box sx={{ height: placeholderHeight }} />}</Box>
}

export default LazySection
