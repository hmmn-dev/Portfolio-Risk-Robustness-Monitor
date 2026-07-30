import { useCallback, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export type PdfOrientation = 'portrait' | 'landscape'

const waitForFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })

export const sanitizePdfName = (name: string) => {
  const trimmed = name.trim()
  return trimmed ? trimmed.replace(/[\\/:*?"<>|]+/g, '-') : 'Portfolio report'
}

export const usePdfExport = (enabled: boolean) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('Portfolio Monitoring Report')
  const [orientation, setOrientation] = useState<PdfOrientation>('landscape')
  const [obfuscate, setObfuscate] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const openDialog = useCallback(() => setDialogOpen(true), [])
  const closeDialog = useCallback(() => setDialogOpen(false), [])

  const generate = useCallback(async () => {
    if (!enabled) return
    setDialogOpen(false)
    setIsGenerating(true)
    setShouldRender(true)
    try {
      await waitForFrame()
      await waitForFrame()
      const container = containerRef.current
      if (!container) return
      const pages = Array.from(container.querySelectorAll<HTMLElement>('[data-pdf-page]'))
      const document = new jsPDF({ orientation, unit: 'pt', format: 'a4' })

      for (let index = 0; index < pages.length; index += 1) {
        await waitForFrame()
        const canvas = await html2canvas(pages[index], {
          backgroundColor: '#ffffff',
          scale: 2.2,
          useCORS: true,
        })
        const imageData = canvas.toDataURL('image/jpeg', 0.92)
        const pageWidth = document.internal.pageSize.getWidth()
        const pageHeight = document.internal.pageSize.getHeight()
        const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
        const imageWidth = canvas.width * ratio
        const imageHeight = canvas.height * ratio
        if (index > 0) document.addPage()
        document.addImage(
          imageData,
          'JPEG',
          (pageWidth - imageWidth) / 2,
          (pageHeight - imageHeight) / 2,
          imageWidth,
          imageHeight,
          undefined,
          'FAST',
        )
        await waitForFrame()
      }

      document.save(`${sanitizePdfName(name)}.pdf`)
    } finally {
      setIsGenerating(false)
      setShouldRender(false)
    }
  }, [enabled, name, orientation])

  return {
    dialogOpen,
    name,
    orientation,
    obfuscate,
    isGenerating,
    shouldRender,
    containerRef,
    openDialog,
    closeDialog,
    setName,
    setOrientation,
    setObfuscate,
    generate,
  }
}
