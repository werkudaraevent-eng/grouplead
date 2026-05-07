"use client"

import { useCallback, useState } from "react"
import html2canvas from "html2canvas-pro"
import { jsPDF } from "jspdf"

interface ExportPDFOptions {
  /** Element selector or ID to capture */
  targetId?: string
  /** Filename without extension */
  filename?: string
}

export function useDashboardExportPDF() {
  const [exporting, setExporting] = useState(false)

  const exportToPDF = useCallback(async (options?: ExportPDFOptions) => {
    const { targetId = "dashboard-content", filename = "dashboard-report" } = options || {}

    setExporting(true)
    try {
      const element = document.getElementById(targetId)
      if (!element) {
        throw new Error("Dashboard content element not found")
      }

      // Read the true grid height from react-grid-layout container
      // RGL sets explicit height via inline style on the grid container
      const rglElement = (
        element.querySelector(".dashboard-grid-layout") ||
        element.querySelector("[class*='react-grid-layout']") ||
        element.querySelector("[style*='height']")
      ) as HTMLElement | null
      
      let rglHeight = 0
      if (rglElement) {
        // RGL always sets height as inline style
        rglHeight = parseInt(rglElement.style.height || "0", 10)
        if (!rglHeight) rglHeight = rglElement.offsetHeight
      }
      
      // Fallback: compute from scroll area's scrollHeight
      if (!rglHeight) {
        const scrollArea = document.getElementById("dashboard-scroll-area")
        rglHeight = scrollArea ? scrollArea.scrollHeight : element.scrollHeight
      }
      
      // Total capture height = grid height + padding (20 top + 24 bottom + buffer)
      const captureHeight = Math.max(rglHeight + 80, element.scrollHeight, 800)
      
      // Expand the LIVE DOM before capture
      const savedStyles: { el: HTMLElement; cssText: string }[] = []
      
      // Save and expand the target element
      savedStyles.push({ el: element, cssText: element.style.cssText })
      element.style.height = `${captureHeight}px`
      element.style.minHeight = `${captureHeight}px`
      element.style.overflow = "visible"
      element.style.maxHeight = "none"
      
      // Expand all ancestors and reset their scroll
      let anc: HTMLElement | null = element.parentElement
      while (anc && anc !== document.body) {
        savedStyles.push({ el: anc, cssText: anc.style.cssText })
        anc.style.overflow = "visible"
        anc.style.height = `${captureHeight + 100}px`
        anc.style.maxHeight = "none"
        anc.style.flex = "none"
        anc.scrollTop = 0
        anc = anc.parentElement
      }
      
      // Reset scroll position
      const scrollArea = document.getElementById("dashboard-scroll-area")
      const savedScrollTop = scrollArea?.scrollTop || 0
      if (scrollArea) scrollArea.scrollTop = 0
      
      // Wait for reflow
      await new Promise(r => setTimeout(r, 400))

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#eaeff5",
        height: captureHeight,
        width: element.offsetWidth,
        windowWidth: element.offsetWidth,
        windowHeight: captureHeight,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        ignoreElements: (el) => el.hasAttribute("data-no-export"),
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById(targetId)
          if (!clonedEl) return
          clonedEl.style.height = `${captureHeight}px`
          clonedEl.style.minHeight = `${captureHeight}px`
          clonedEl.style.overflow = "visible"

          // Expand ancestors but DON'T change position (preserve grid absolute positioning)
          let p: HTMLElement | null = clonedEl.parentElement
          while (p && p !== clonedDoc.body) {
            p.style.overflow = "visible"
            p.style.height = `${captureHeight + 100}px`
            p.style.maxHeight = "none"
            p.style.flex = "none"
            p = p.parentElement
          }

          // Make sure body/html are tall enough
          clonedDoc.documentElement.style.height = `${captureHeight + 200}px`
          clonedDoc.body.style.height = `${captureHeight + 200}px`
          clonedDoc.body.style.overflow = "visible"

          clonedDoc.querySelectorAll("svg").forEach(svg => {
            svg.style.overflow = "visible"
          })
        },
      })
      
      // Restore all saved styles
      savedStyles.forEach(({ el, cssText }) => {
        el.style.cssText = cssText
      })
      // Restore scroll position
      if (scrollArea) scrollArea.scrollTop = savedScrollTop

      const imgData = canvas.toDataURL("image/png")
      const imgWidth = canvas.width
      const imgHeight = canvas.height

      // A4 landscape for dashboard
      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      // Header
      pdf.setFontSize(8)
      pdf.setTextColor(148, 163, 184)
      pdf.text(`LeadEngine Dashboard Report — ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, 10, 8)

      const contentTop = 12
      const availableHeight = pdfHeight - contentTop - 5

      // Scale image to fit page width
      const ratio = Math.min(pdfWidth / imgWidth, availableHeight / imgHeight)
      const scaledWidth = imgWidth * ratio
      const scaledHeight = imgHeight * ratio

      // If content fits in one page
      if (scaledHeight <= availableHeight) {
        pdf.addImage(imgData, "PNG", (pdfWidth - scaledWidth) / 2, contentTop, scaledWidth, scaledHeight)
      } else {
        // Multi-page: slice the canvas
        const pageCanvasHeight = Math.floor((availableHeight / ratio))
        let yOffset = 0
        let pageNum = 0

        while (yOffset < imgHeight) {
          if (pageNum > 0) pdf.addPage()

          const sliceHeight = Math.min(pageCanvasHeight, imgHeight - yOffset)
          const sliceCanvas = document.createElement("canvas")
          sliceCanvas.width = imgWidth
          sliceCanvas.height = sliceHeight
          const ctx = sliceCanvas.getContext("2d")!
          ctx.drawImage(canvas, 0, yOffset, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight)

          const sliceData = sliceCanvas.toDataURL("image/png")
          const sliceScaledH = sliceHeight * ratio
          pdf.addImage(sliceData, "PNG", (pdfWidth - scaledWidth) / 2, contentTop, scaledWidth, sliceScaledH)

          yOffset += sliceHeight
          pageNum++
        }
      }

      pdf.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error("PDF export failed:", err)
      throw err
    } finally {
      setExporting(false)
    }
  }, [])

  return { exportToPDF, exporting }
}
