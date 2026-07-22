"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ExternalLink, LayoutDashboard, MapPinned } from "lucide-react"

const leadEngineUrl = process.env.NEXT_PUBLIC_LEADENGINE_URL ?? "http://localhost:3000"

export function AppSwitcher() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  return (
    <div className="app-switcher" ref={containerRef}>
      <button className="app-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" aria-label="Switch Werkudara app">
        <span className="launcher-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      </button>
      {open && (
        <div className="app-menu" role="menu">
          <p>Werkudara apps</p>
          <a href={leadEngineUrl} role="menuitem" className="app-row">
            <span className="app-icon app-icon-blue"><LayoutDashboard size={16} /></span>
            <span><strong>LeadEngine</strong><small>CRM and pipeline operations</small></span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
          <a href="/" role="menuitem" className="app-row app-row-active" onClick={() => setOpen(false)}>
            <span className="app-icon app-icon-amber"><MapPinned size={16} /></span>
            <span><strong>Sales Mission</strong><small>Plan visits and capture results</small></span>
            <Check size={16} aria-label="Current app" />
          </a>
        </div>
      )}
    </div>
  )
}
