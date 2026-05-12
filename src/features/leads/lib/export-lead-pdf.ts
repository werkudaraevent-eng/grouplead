import jsPDF from "jspdf"
import type { Lead } from "@/types"

// ─── Types ────────────────────────────────────────────────────
interface LeadNote {
    id: string
    content: string
    author_name: string | null
    created_at: string
}

interface LeadActivity {
    id: string
    action_type: string
    description: string | null
    field_name: string | null
    old_value: string | null
    new_value: string | null
    created_at: string
    user_name?: string | null
}

export interface ExportLeadPDFOptions {
    lead: Lead & { pipeline?: { name: string } | null }
    notes?: LeadNote[]
    activities?: LeadActivity[]
    currencyFormat?: (value: number) => string
    companyLabel?: string
}

// ─── Theme (matches app brand; pure RGB tuples) ───────────────
const RGB = {
    brand: [2, 55, 141] as const,       // #02378D
    brandSoft: [238, 243, 253] as const,
    ink: [26, 29, 31] as const,         // primary text
    text: [51, 65, 85] as const,        // slate-700
    muted: [100, 116, 139] as const,    // slate-500
    light: [148, 163, 184] as const,    // slate-400
    line: [226, 232, 240] as const,     // slate-200
    lineSoft: [241, 245, 249] as const, // slate-100
    fill: [248, 250, 252] as const,     // slate-50
    success: [16, 185, 129] as const,
    danger: [239, 68, 68] as const,
    warn: [245, 158, 11] as const,
    white: [255, 255, 255] as const,
}

const FS = {
    docTitle: 9,
    hero: 18,
    sectionTitle: 10,
    fieldLabel: 7.5,
    fieldValue: 9.5,
    body: 9.5,
    meta: 7.5,
    footer: 7,
}

const PAGE = {
    mx: 14,
    mBottom: 16,
    cellH: 11,
    lineH: 4.3,
    sectionGap: 5,
}

// ─── Helpers ──────────────────────────────────────────────────
function stripHtml(html: string | null | undefined): string {
    if (!html) return ""
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<\/h[1-6]>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

function formatDate(v: string | null | undefined): string {
    if (!v) return "—"
    try {
        return new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    } catch {
        return v
    }
}

function formatDateTime(v: string | null | undefined): string {
    if (!v) return "—"
    try {
        const d = new Date(v)
        return (
            d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
            " · " +
            d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        )
    } catch {
        return v
    }
}

function stageAccent(name: string | null | undefined): readonly [number, number, number] {
    const n = (name || "").toLowerCase()
    if (n.includes("won")) return RGB.success
    if (["lost", "cancel", "postpone", "turndown"].some(k => n.includes(k))) return RGB.danger
    if (["proposal", "negot"].some(k => n.includes(k))) return RGB.warn
    return RGB.brand
}

// Typed alias so conditional spreads into setTextColor/setFillColor keep tuple shape
type RGB3 = readonly [number, number, number]

// ─── Main exporter ────────────────────────────────────────────
export function exportLeadPdf(opts: ExportLeadPDFOptions): void {
    const { lead, notes = [], activities = [], currencyFormat, companyLabel = "Werkudara Group" } = opts
    const fmt = currencyFormat ?? ((v: number) => `IDR ${v.toLocaleString("id-ID")}`)

    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const contentW = pageW - PAGE.mx * 2

    let y = 0
    let pageNum = 1

    // ─── Page chrome helpers ─────────────────────────────────
    const drawHeader = () => {
        doc.setFillColor(...RGB.brand)
        doc.rect(0, 0, pageW, 10, "F")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(FS.docTitle)
        doc.setTextColor(...RGB.white)
        doc.text("LEAD SUMMARY", PAGE.mx, 6.5)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(FS.meta)
        doc.text(companyLabel, pageW - PAGE.mx, 6.5, { align: "right" })
    }

    const drawFooter = () => {
        doc.setDrawColor(...RGB.line)
        doc.setLineWidth(0.2)
        doc.line(PAGE.mx, pageH - 12, pageW - PAGE.mx, pageH - 12)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(FS.footer)
        doc.setTextColor(...RGB.light)
        const generated = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        doc.text(`Generated ${generated} · LeadEngine · Lead #${lead.id}`, PAGE.mx, pageH - 7)
        doc.text(`Page ${pageNum}`, pageW - PAGE.mx, pageH - 7, { align: "right" })
    }

    const ensure = (needed: number) => {
        if (y + needed > pageH - PAGE.mBottom - 8) {
            drawFooter()
            doc.addPage()
            pageNum++
            drawHeader()
            y = 14
        }
    }

    // ─── Page 1 header ───────────────────────────────────────
    drawHeader()
    y = 14

    // Hero project name
    const projectName = lead.project_name || "Untitled Lead"
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FS.hero)
    doc.setTextColor(...RGB.ink)
    const projectLines = doc.splitTextToSize(projectName, contentW - 40)
    projectLines.forEach((line: string) => {
        doc.text(line, PAGE.mx, y + 6)
        y += 6.5
    })
    y += 2

    // Stamp row (stage + grade + category)
    const stampY = y
    let stampX = PAGE.mx

    const drawStamp = (label: string, rgb: readonly [number, number, number]) => {
        const padX = 3
        doc.setFont("helvetica", "bold")
        doc.setFontSize(FS.meta)
        const w = doc.getTextWidth(label) + padX * 2
        doc.setFillColor(rgb[0], rgb[1], rgb[2])
        doc.setDrawColor(rgb[0], rgb[1], rgb[2])
        doc.roundedRect(stampX, stampY - 3.8, w, 5.6, 1, 1, "F")
        doc.setTextColor(...RGB.white)
        doc.text(label, stampX + padX, stampY)
        stampX += w + 3
    }

    if (lead.pipeline_stage?.name) drawStamp(lead.pipeline_stage.name.toUpperCase(), stageAccent(lead.pipeline_stage.name))
    if (lead.grade_lead) drawStamp(`GRADE ${lead.grade_lead}`, RGB.brand)
    if (lead.category) drawStamp(lead.category.toUpperCase(), RGB.muted)
    y += 5

    if (lead.pipeline?.name) {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(FS.meta)
        doc.setTextColor(...RGB.muted)
        doc.text(`Pipeline: ${lead.pipeline.name}`, PAGE.mx, y)
        y += 5
    }

    // Divider
    doc.setDrawColor(...RGB.line)
    doc.setLineWidth(0.3)
    doc.line(PAGE.mx, y, pageW - PAGE.mx, y)
    y += 5

    // ─── Section header (underlined title + accent line) ─────
    const section = (title: string) => {
        ensure(10)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(FS.sectionTitle)
        doc.setTextColor(...RGB.brand)
        const titleText = title.toUpperCase()
        doc.text(titleText, PAGE.mx, y)
        const titleW = doc.getTextWidth(titleText)
        doc.setDrawColor(...RGB.brand)
        doc.setLineWidth(0.6)
        doc.line(PAGE.mx, y + 1.5, PAGE.mx + titleW, y + 1.5)
        doc.setDrawColor(...RGB.lineSoft)
        doc.setLineWidth(0.3)
        doc.line(PAGE.mx + titleW + 2, y + 1.5, pageW - PAGE.mx, y + 1.5)
        y += PAGE.sectionGap + 2
    }

    // ─── Form-filled field cell ──────────────────────────────
    const drawFieldCell = (x: number, cellY: number, w: number, label: string, value: string, rowIdx: number) => {
        const fill = rowIdx % 2 === 0 ? RGB.fill : RGB.white
        doc.setFillColor(fill[0], fill[1], fill[2])
        doc.setDrawColor(...RGB.line)
        doc.setLineWidth(0.15)
        doc.roundedRect(x, cellY, w, PAGE.cellH, 0.8, 0.8, "FD")

        doc.setFont("helvetica", "bold")
        doc.setFontSize(FS.fieldLabel)
        doc.setTextColor(...RGB.muted)
        doc.text(label.toUpperCase(), x + 2.5, cellY + 3.3)

        const displayVal = value || "—"
        const isEmpty = !value || value === "—"
        doc.setFont("helvetica", isEmpty ? "normal" : "bold")
        doc.setFontSize(FS.fieldValue)
        const valueColor: RGB3 = isEmpty ? RGB.light : RGB.ink
        doc.setTextColor(...valueColor)
        const truncated = doc.splitTextToSize(displayVal, w - 5)
        const line = Array.isArray(truncated) ? truncated[0] : truncated
        doc.text(line, x + 2.5, cellY + 8)
    }

    const grid = (pairs: Array<{ label: string; value: string }>, cols: 2 | 3 = 2) => {
        const gapX = 2
        const colW = (contentW - gapX * (cols - 1)) / cols
        for (let i = 0; i < pairs.length; i += cols) {
            ensure(PAGE.cellH + 1)
            for (let c = 0; c < cols; c++) {
                const p = pairs[i + c]
                if (!p) break
                const x = PAGE.mx + c * (colW + gapX)
                drawFieldCell(x, y, colW, p.label, p.value, Math.floor(i / cols))
            }
            y += PAGE.cellH + 1
        }
        y += 2
    }

    // ─── Long-text panel (brief/SOW/remarks) ────────────────
    const panel = (text: string) => {
        const content = text && text.trim() ? text : "(empty)"
        const isEmpty = !text || !text.trim()

        doc.setFont("helvetica", isEmpty ? "italic" : "normal")
        doc.setFontSize(FS.body)
        const panelColor: RGB3 = isEmpty ? RGB.light : RGB.text
        doc.setTextColor(...panelColor)
        const lines = doc.splitTextToSize(content, contentW - 6)
        const blockH = lines.length * PAGE.lineH + 5

        ensure(blockH)

        doc.setFillColor(...RGB.fill)
        doc.setDrawColor(...RGB.lineSoft)
        doc.setLineWidth(0.15)
        doc.roundedRect(PAGE.mx, y, contentW, blockH, 1, 1, "FD")
        doc.setFillColor(...RGB.brand)
        doc.rect(PAGE.mx, y, 1, blockH, "F")

        let textY = y + 4.2
        lines.forEach((line: string) => {
            doc.text(line, PAGE.mx + 4, textY)
            textY += PAGE.lineH
        })
        y += blockH + 3
    }

    // ═══════════════════════════════════════════════════════════
    //  SECTIONS
    // ═══════════════════════════════════════════════════════════

    section("Deal Information")
    grid([
        { label: "Subsidiary", value: lead.company?.name ?? "" },
        { label: "Amount", value: lead.estimated_value != null ? fmt(lead.estimated_value) : "" },
        { label: "Close Date", value: formatDate(lead.target_close_date) },
        { label: "PIC Sales", value: lead.pic_sales_profile?.full_name ?? "" },
        { label: "Account Manager", value: lead.account_manager_profile?.full_name ?? "" },
        { label: "Lead Source", value: lead.lead_source ?? "" },
        { label: "Main Stream", value: lead.main_stream ?? "" },
        { label: "Stream Type", value: lead.stream_type ?? "" },
        { label: "Business Purpose", value: lead.business_purpose ?? "" },
        { label: "Event Format", value: lead.event_format ?? "" },
    ], 2)

    section("Client & Contact")
    grid([
        { label: "Client Company", value: lead.client_company?.name ?? "" },
        { label: "Contact Person", value: lead.contact?.full_name ?? "" },
        { label: "Email", value: lead.contact?.email ?? "" },
        { label: "Phone", value: lead.contact?.phone ?? "" },
    ], 2)

    // Event Details
    const hasEvent =
        lead.event_date_start ||
        lead.event_date_end ||
        (lead.event_dates && lead.event_dates.length) ||
        lead.pax_count != null ||
        (lead.destinations && lead.destinations.length) ||
        lead.virtual_platform

    if (hasEvent) {
        section("Event Details")
        const eventPairs: Array<{ label: string; value: string }> = []
        if (lead.event_date_start || lead.event_date_end) {
            eventPairs.push({ label: "Event Start", value: formatDate(lead.event_date_start) })
            eventPairs.push({ label: "Event End", value: formatDate(lead.event_date_end) })
        }
        if (lead.event_dates && lead.event_dates.length) {
            eventPairs.push({
                label: "Event Dates",
                value: lead.event_dates.map(d => formatDate(d)).join(", "),
            })
        }
        if (lead.pax_count != null) eventPairs.push({ label: "Pax Count", value: String(lead.pax_count) })
        if (lead.virtual_platform) eventPairs.push({ label: "Virtual Platform", value: lead.virtual_platform })
        if (eventPairs.length) grid(eventPairs, 2)

        if (lead.destinations && lead.destinations.length) {
            ensure(8 + lead.destinations.length * 6)
            // Table header
            doc.setFillColor(...RGB.brandSoft)
            doc.setDrawColor(...RGB.line)
            doc.setLineWidth(0.15)
            doc.roundedRect(PAGE.mx, y, contentW, 6, 0.8, 0.8, "FD")
            doc.setFont("helvetica", "bold")
            doc.setFontSize(FS.fieldLabel)
            doc.setTextColor(...RGB.brand)
            doc.text("CITY", PAGE.mx + 2.5, y + 4)
            doc.text("VENUE", PAGE.mx + contentW / 2, y + 4)
            y += 6.5
            lead.destinations.forEach((d, idx) => {
                ensure(6)
                const fill = idx % 2 === 0 ? RGB.white : RGB.fill
                doc.setFillColor(fill[0], fill[1], fill[2])
                doc.rect(PAGE.mx, y, contentW, 5.5, "F")
                doc.setDrawColor(...RGB.lineSoft)
                doc.setLineWidth(0.1)
                doc.line(PAGE.mx, y + 5.5, PAGE.mx + contentW, y + 5.5)
                doc.setFont("helvetica", "normal")
                doc.setFontSize(FS.body)
                doc.setTextColor(...RGB.ink)
                doc.text(d.city || "—", PAGE.mx + 2.5, y + 3.8)
                doc.text(d.venue || "—", PAGE.mx + contentW / 2, y + 3.8)
                y += 5.5
            })
            y += 3
        }
    }

    // Outcome
    if (lead.closed_won_date || lead.closed_lost_date || lead.lost_reason) {
        section("Outcome")
        const outcomePairs: Array<{ label: string; value: string }> = []
        if (lead.closed_won_date) outcomePairs.push({ label: "Closed Won", value: formatDate(lead.closed_won_date) })
        if (lead.closed_lost_date) outcomePairs.push({ label: "Closed Lost", value: formatDate(lead.closed_lost_date) })
        if (lead.lost_reason) outcomePairs.push({ label: "Lost Reason", value: lead.lost_reason })
        if (outcomePairs.length) grid(outcomePairs, 2)
        if (lead.lost_reason_details) {
            ensure(6)
            doc.setFont("helvetica", "bold")
            doc.setFontSize(FS.fieldLabel)
            doc.setTextColor(...RGB.muted)
            doc.text("LOST REASON DETAILS", PAGE.mx, y)
            y += 4
            panel(lead.lost_reason_details)
        }
    }

    section("General Brief & Inquiry")
    panel(stripHtml(lead.general_brief))

    section("Production SOW & Equipment")
    panel(stripHtml(lead.production_sow))

    section("Special Remarks")
    panel(stripHtml(lead.special_remarks))

    // Notes
    if (notes.length > 0) {
        const count = notes.length
        const shown = Math.min(count, 10)
        section(`Notes (${shown === count ? count : `latest ${shown} of ${count}`})`)
        notes.slice(0, 10).forEach((n, idx) => {
            const content = stripHtml(n.content)
            const lines = doc.splitTextToSize(content || "(empty)", contentW - 6)
            const blockH = lines.length * PAGE.lineH + 10
            ensure(blockH)

            const fill = idx % 2 === 0 ? RGB.fill : RGB.white
            doc.setFillColor(fill[0], fill[1], fill[2])
            doc.setDrawColor(...RGB.line)
            doc.setLineWidth(0.15)
            doc.roundedRect(PAGE.mx, y, contentW, blockH, 1, 1, "FD")

            doc.setFont("helvetica", "bold")
            doc.setFontSize(FS.fieldLabel + 0.5)
            doc.setTextColor(...RGB.ink)
            doc.text(n.author_name || "Unknown", PAGE.mx + 3, y + 4)
            doc.setFont("helvetica", "normal")
            doc.setFontSize(FS.footer)
            doc.setTextColor(...RGB.light)
            doc.text(formatDateTime(n.created_at), pageW - PAGE.mx - 3, y + 4, { align: "right" })

            doc.setDrawColor(...RGB.lineSoft)
            doc.setLineWidth(0.1)
            doc.line(PAGE.mx + 2, y + 5.8, pageW - PAGE.mx - 2, y + 5.8)

            doc.setFont("helvetica", content ? "normal" : "italic")
            doc.setFontSize(FS.body)
            const noteColor: RGB3 = content ? RGB.text : RGB.light
            doc.setTextColor(...noteColor)
            let textY = y + 9.2
            lines.forEach((line: string) => {
                doc.text(line, PAGE.mx + 3, textY)
                textY += PAGE.lineH
            })
            y += blockH + 2
        })
    }

    // Activity Timeline
    if (activities.length > 0) {
        const count = activities.length
        const shown = Math.min(count, 10)
        section(`Activity Timeline (${shown === count ? count : `latest ${shown} of ${count}`})`)

        activities.slice(0, 10).forEach((a) => {
            const description = a.description || a.action_type
            const userName = a.user_name || "System"
            const lineText = `${userName} — ${description}`
            const lines = doc.splitTextToSize(lineText, contentW - 8)
            const blockH = lines.length * PAGE.lineH + 4.5

            ensure(blockH)

            doc.setFillColor(...RGB.brand)
            doc.circle(PAGE.mx + 1.5, y + 2, 0.9, "F")

            doc.setFont("helvetica", "normal")
            doc.setFontSize(FS.body)
            doc.setTextColor(...RGB.ink)
            lines.forEach((line: string, idx: number) => {
                doc.text(line, PAGE.mx + 5, y + 2.5 + idx * PAGE.lineH)
            })

            doc.setFontSize(FS.footer)
            doc.setTextColor(...RGB.light)
            doc.text(formatDateTime(a.created_at), PAGE.mx + 5, y + 2.5 + lines.length * PAGE.lineH)
            y += blockH + 1
        })
    }

    // Metadata footer block
    ensure(16)
    y += 2
    doc.setDrawColor(...RGB.line)
    doc.setLineWidth(0.3)
    doc.line(PAGE.mx, y, pageW - PAGE.mx, y)
    y += 4

    const metaColW = contentW / 3
    const metaItems = [
        { label: "LEAD ID", value: `#${lead.id}` },
        { label: "CREATED", value: lead.created_at ? formatDateTime(lead.created_at) : "—" },
        { label: "LAST UPDATED", value: lead.updated_at ? formatDateTime(lead.updated_at) : "—" },
    ]
    metaItems.forEach((m, i) => {
        const x = PAGE.mx + i * metaColW
        doc.setFont("helvetica", "bold")
        doc.setFontSize(FS.fieldLabel)
        doc.setTextColor(...RGB.muted)
        doc.text(m.label, x, y)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(FS.meta)
        doc.setTextColor(...RGB.ink)
        doc.text(m.value, x, y + 4)
    })
    y += 10

    drawFooter()

    const safeName = (lead.project_name || "lead")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 40)
    const dateStamp = new Date().toISOString().slice(0, 10)
    doc.save(`${safeName}_${lead.id}_${dateStamp}.pdf`)
}
