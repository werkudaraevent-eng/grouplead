import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { CalendarPreview, WorkspacePage } from "@/app/workspace/workspace-page"

export default function CalendarPage() {
  return <WorkspacePage eyebrow="Sales Mission / Calendar" title="Calendar" description="See your team schedule and keep travel time visible before assigning work.">
    <section className="workspace-calendar-layout"><div className="workspace-panel workspace-calendar-panel"><div className="workspace-panel-header"><div><p className="workspace-section-kicker">Month view</p><h2>July 2026</h2></div><div className="workspace-calendar-arrows"><button type="button" aria-label="Previous month"><ChevronLeft size={15} /></button><button type="button" aria-label="Next month"><ChevronRight size={15} /></button></div></div><CalendarPreview /></div><aside className="workspace-panel workspace-day-panel"><div className="workspace-panel-header"><div><p className="workspace-section-kicker">Friday, July 24</p><h2>Today</h2></div></div><div className="workspace-day-list"><div><strong>09:30</strong><span><b>PT Arunika Kreasi</b><small>South Jakarta · Wg, Hanung</small></span></div><div><strong>13:00</strong><span><b>Bina Ruang Nusantara</b><small>Tangerang · Nadia Prameswari</small></span></div><div className="workspace-day-empty"><CalendarDays size={16} /><span>No more missions today</span></div></div></aside></section>
  </WorkspacePage>
}
