"use client"

import { useCallback, useState } from "react"

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

      const cloned = element.cloneNode(true) as HTMLElement
      cloned.querySelectorAll("[data-no-export]").forEach(node => node.remove())
      cloned.removeAttribute("id")

      const styleMarkup = Array.from(document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]'))
        .map(node => node.outerHTML)
        .join("\n")

      const reportDate = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
      // Do not use `noopener` here. Some browsers return `null` for the
      // WindowProxy when noopener is set, while still opening a blank tab;
      // then we cannot write the print HTML and the user sees a blank popup.
      const printWindow = window.open("about:blank", "_blank", "width=1440,height=1000")
      if (!printWindow) {
        throw new Error("Print window was blocked")
      }
      printWindow.opener = null

      printWindow.document.open()
      printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${filename}-${new Date().toISOString().slice(0, 10)}</title>
  ${styleMarkup}
  <style>
    html, body { margin: 0; min-height: 100%; background: #eaeff5; }
    body { font-family: Arial, sans-serif; color: #111827; }
    .print-shell { padding: 24px; }
    .print-header { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 18px; }
    .print-title { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
    .print-meta { font-size: 12px; color: #64748b; }
    #print-dashboard { width: 1280px; max-width: 100%; margin: 0 auto; background: #eaeff5; }
    #print-dashboard, #print-dashboard * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #print-dashboard [style*="overflow"] { overflow: visible !important; }
    /* Defeat react-grid-layout absolute positioning so widgets stack
       vertically and the browser can paginate naturally. */
    .react-grid-layout {
      position: static !important;
      height: auto !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 16px !important;
    }
    .react-grid-item {
      position: static !important;
      transform: none !important;
      width: 100% !important;
      max-width: 100% !important;
      left: auto !important;
      top: auto !important;
      height: auto !important;
      min-height: 220px !important;
      break-inside: avoid;
      page-break-inside: avoid;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    .react-resizable-handle,
    .dashboard-drag-handle { display: none !important; }
    @page { size: A4 landscape; margin: 10mm; }
    @media print {
      html, body { background: #fff; }
      .print-shell { padding: 0; }
      .print-header { margin-bottom: 10px; }
      #print-dashboard { width: 100%; }
      button, [role="button"] { box-shadow: none !important; }
      .react-grid-item { box-shadow: none !important; }
    }
  </style>
</head>
<body>
  <main class="print-shell">
    <header class="print-header">
      <div class="print-title">LeadEngine Dashboard Report</div>
      <div class="print-meta">${reportDate} · Use browser Save as PDF</div>
    </header>
    <section id="print-dashboard">${cloned.outerHTML}</section>
  </main>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 500)
    })
  </script>
</body>
</html>`)
      printWindow.document.close()
    } catch (err) {
      console.error("Print export failed:", err)
      throw err
    } finally {
      setExporting(false)
    }
  }, [])

  return { exportToPDF, exporting }
}
