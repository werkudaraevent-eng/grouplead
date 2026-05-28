"use client"

import { useEffect, useState } from "react"
import type { Lead } from "@/types"
import { Printer, Download, ArrowLeft } from "lucide-react"
import { formatPhoneDisplay } from "@/lib/phone-normalize"

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

interface CurrencySettings {
    currency_format: string
    currency_prefix: string
}

interface Props {
    lead: Lead & { pipeline?: { name: string } | null }
    notes: LeadNote[]
    activities: LeadActivity[]
    currencySettings: CurrencySettings
}

// ─── Helpers ──────────────────────────────────────────────────
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

function formatCurrency(value: number | null | undefined, prefix = "IDR"): string {
    if (value == null) return "—"
    return `${prefix} ${value.toLocaleString("id-ID")}`
}

function stageAccent(name: string | null | undefined): string {
    const n = (name || "").toLowerCase()
    if (n.includes("won")) return "stamp--success"
    if (["lost", "cancel", "postpone", "turndown"].some(k => n.includes(k))) return "stamp--danger"
    if (["proposal", "negot"].some(k => n.includes(k))) return "stamp--warn"
    return "stamp--brand"
}

// ─── Component ────────────────────────────────────────────────
export function LeadPrintView({ lead, notes, activities, currencySettings }: Props) {
    const [isPrinting, setIsPrinting] = useState(false)

    // Auto-trigger print dialog after layout settles
    useEffect(() => {
        // Delay lets fonts + images finish rendering
        const timer = setTimeout(() => {
            window.print()
        }, 500)

        // Update page title so browser's "Save as PDF" default filename is nice
        const safeName = (lead.project_name || "Lead").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 50)
        const dateStamp = new Date().toISOString().slice(0, 10)
        document.title = `LEAD-SUMMARY_${safeName}_${lead.id}_${dateStamp}`

        return () => clearTimeout(timer)
    }, [lead.id, lead.project_name])

    const handlePrint = () => {
        setIsPrinting(true)
        window.print()
        setTimeout(() => setIsPrinting(false), 800)
    }

    const prefix = currencySettings.currency_prefix || "IDR"

    const hasEvent =
        lead.event_date_start ||
        lead.event_date_end ||
        (lead.event_dates && lead.event_dates.length) ||
        lead.pax_count != null ||
        (lead.destinations && lead.destinations.length) ||
        lead.virtual_platform

    const hasOutcome = lead.closed_won_date || lead.closed_lost_date || lead.lost_reason

    return (
        <>
            {/* Print-specific CSS */}
            <style>{`
                :root {
                    --brand: #02378D;
                    --brand-soft: #eef3fd;
                    --ink: #1a1d1f;
                    --text: #334155;
                    --muted: #64748b;
                    --light: #94a3b8;
                    --line: #e2e8f0;
                    --line-soft: #f1f5f9;
                    --fill: #f8fafc;
                    --success: #10b981;
                    --danger: #ef4444;
                    --warn: #f59e0b;
                }

                /* Hide app shell when rendered inside authenticated layout */
                html, body {
                    margin: 0;
                    padding: 0;
                    background: #f1f5f9;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
                    color: var(--ink);
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .print-toolbar {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    background: white;
                    border-bottom: 1px solid var(--line);
                    padding: 12px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }

                .print-toolbar__actions {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }

                .btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 14px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                    border: 1px solid transparent;
                    font-family: inherit;
                }

                .btn--primary {
                    background: var(--brand);
                    color: white;
                }
                .btn--primary:hover { opacity: 0.9; }

                .btn--ghost {
                    background: transparent;
                    color: var(--muted);
                    border-color: var(--line);
                }
                .btn--ghost:hover {
                    background: var(--fill);
                    color: var(--ink);
                }

                .print-page {
                    max-width: 210mm;
                    margin: 24px auto;
                    background: white;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .print-header {
                    background: var(--brand);
                    color: white;
                    padding: 12px 32px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 11px;
                }

                .print-header__title {
                    font-weight: 700;
                    letter-spacing: 0.1em;
                }

                .print-body {
                    padding: 32px;
                }

                /* Hero */
                .hero__title {
                    margin: 0 0 12px 0;
                    font-size: 24px;
                    font-weight: 700;
                    color: var(--ink);
                    line-height: 1.25;
                    letter-spacing: -0.01em;
                }

                .hero__stamps {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-bottom: 10px;
                }

                .stamp {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 10.5px;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    color: white;
                }
                .stamp--brand { background: var(--brand); }
                .stamp--success { background: var(--success); }
                .stamp--danger { background: var(--danger); }
                .stamp--warn { background: var(--warn); }
                .stamp--neutral { background: var(--muted); }

                .hero__subtitle {
                    font-size: 12px;
                    color: var(--muted);
                    margin-bottom: 16px;
                }

                .divider {
                    height: 1px;
                    background: var(--line);
                    margin: 20px 0;
                }

                /* Section title */
                .section {
                    margin-top: 28px;
                }
                .section:first-child { margin-top: 0; }

                .section__title {
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--brand);
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    padding-bottom: 6px;
                    border-bottom: 2px solid var(--brand);
                    display: inline-block;
                    margin-bottom: 0;
                    position: relative;
                    z-index: 1;
                }

                .section__rule {
                    height: 1px;
                    background: var(--line-soft);
                    margin-top: -1px;
                    margin-bottom: 14px;
                }

                /* Field grid */
                .fields {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                }

                .field {
                    padding: 10px 14px;
                    border: 1px solid var(--line);
                    border-radius: 4px;
                    background: var(--fill);
                    min-height: 48px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .field--highlight { background: var(--brand-soft); border-color: #c7d7f3; }

                .field__label {
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--muted);
                    margin-bottom: 4px;
                    line-height: 1;
                }

                .field__value {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--ink);
                    line-height: 1.35;
                    word-break: break-word;
                }

                .field__value--empty {
                    font-weight: 400;
                    color: var(--light);
                    font-style: italic;
                }

                /* Destination table */
                .dest-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 8px;
                    border: 1px solid var(--line);
                    border-radius: 4px;
                    overflow: hidden;
                    font-size: 12px;
                }
                .dest-table th {
                    background: var(--brand-soft);
                    color: var(--brand);
                    text-align: left;
                    padding: 7px 12px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    border-bottom: 1px solid var(--line);
                }
                .dest-table td {
                    padding: 7px 12px;
                    border-bottom: 1px solid var(--line-soft);
                    color: var(--ink);
                }
                .dest-table tr:last-child td { border-bottom: none; }
                .dest-table tr:nth-child(even) td { background: var(--fill); }

                /* Panel (brief/sow/remarks) */
                .panel {
                    border-left: 3px solid var(--brand);
                    background: var(--fill);
                    border-top: 1px solid var(--line);
                    border-right: 1px solid var(--line);
                    border-bottom: 1px solid var(--line);
                    border-radius: 0 4px 4px 0;
                    padding: 14px 18px;
                    font-size: 12.5px;
                    color: var(--text);
                    line-height: 1.65;
                }

                .panel--empty { color: var(--light); font-style: italic; }

                .panel :first-child { margin-top: 0; }
                .panel :last-child { margin-bottom: 0; }

                .panel p { margin: 0.4em 0; }
                .panel ul, .panel ol { margin: 0.4em 0; padding-left: 1.4em; }
                .panel li { margin: 0.2em 0; }
                .panel h1, .panel h2, .panel h3 { font-size: 13.5px; margin: 0.8em 0 0.3em; font-weight: 700; color: var(--ink); }
                .panel a { color: var(--brand); text-decoration: underline; }
                .panel strong { font-weight: 700; color: var(--ink); }

                /* Notes */
                .note-card {
                    border: 1px solid var(--line);
                    border-radius: 4px;
                    padding: 10px 14px;
                    margin-bottom: 6px;
                    font-size: 12px;
                    page-break-inside: avoid;
                }
                .note-card:nth-child(even) { background: var(--fill); }

                .note-card__head {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    padding-bottom: 6px;
                    border-bottom: 1px solid var(--line-soft);
                    margin-bottom: 6px;
                }
                .note-card__author { font-weight: 700; color: var(--ink); font-size: 11.5px; }
                .note-card__time { font-size: 10px; color: var(--light); }
                .note-card__body { color: var(--text); line-height: 1.55; white-space: pre-wrap; }
                .note-card__body--empty { color: var(--light); font-style: italic; }

                /* Timeline */
                .timeline-item {
                    display: grid;
                    grid-template-columns: 10px 1fr;
                    gap: 10px;
                    padding: 8px 0;
                    border-bottom: 1px dashed var(--line-soft);
                    font-size: 12px;
                    page-break-inside: avoid;
                }
                .timeline-item:last-child { border-bottom: none; }
                .timeline-item__dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--brand);
                    margin-top: 6px;
                }
                .timeline-item__body { color: var(--ink); line-height: 1.45; }
                .timeline-item__user { font-weight: 600; }
                .timeline-item__time { display: block; font-size: 10px; color: var(--light); margin-top: 2px; }

                /* Metadata footer */
                .meta-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1px solid var(--line);
                }
                .meta-grid__item__label { font-size: 9px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
                .meta-grid__item__value { font-size: 11px; color: var(--ink); }

                .print-footer {
                    padding: 10px 32px;
                    border-top: 1px solid var(--line);
                    display: flex;
                    justify-content: space-between;
                    font-size: 10px;
                    color: var(--light);
                    background: var(--fill);
                }

                /* ═══ PRINT STYLES ═══ */
                @media print {
                    html, body {
                        background: white;
                    }
                    .print-toolbar { display: none !important; }
                    .print-page {
                        max-width: none;
                        margin: 0;
                        box-shadow: none;
                        border-radius: 0;
                    }
                    /* Force page size */
                    @page {
                        size: A4;
                        margin: 12mm 12mm 14mm 12mm;
                    }
                    /* Avoid awkward splits */
                    .section, .note-card, .timeline-item {
                        page-break-inside: avoid;
                    }
                    .hero__title {
                        page-break-after: avoid;
                    }
                    /* Hide any app chrome that could leak in */
                    body > *:not(.print-root) {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="print-root">
                {/* Toolbar — hidden on print */}
                <div className="print-toolbar">
                    <button
                        className="btn btn--ghost"
                        onClick={() => window.close()}
                        title="Close this tab and return"
                    >
                        <ArrowLeft size={14} /> Close
                    </button>
                    <div className="print-toolbar__actions">
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            Tip: Choose <strong>Save as PDF</strong> in the print dialog
                        </span>
                        <button
                            className="btn btn--primary"
                            onClick={handlePrint}
                            disabled={isPrinting}
                        >
                            <Printer size={14} /> {isPrinting ? "Preparing..." : "Print / Save as PDF"}
                        </button>
                    </div>
                </div>

                <article className="print-page">
                    <header className="print-header">
                        <span className="print-header__title">LEAD SUMMARY</span>
                        <span>{lead.company?.name ?? "Werkudara Group"}</span>
                    </header>

                    <div className="print-body">
                        {/* Hero */}
                        <h1 className="hero__title">{lead.project_name || "Untitled Lead"}</h1>

                        <div className="hero__stamps">
                            {lead.pipeline_stage?.name && (
                                <span className={`stamp ${stageAccent(lead.pipeline_stage.name)}`}>
                                    {lead.pipeline_stage.name}
                                </span>
                            )}
                            {lead.grade_lead && (
                                <span className="stamp stamp--brand">GRADE {lead.grade_lead}</span>
                            )}
                            {lead.category && (
                                <span className="stamp stamp--neutral">{lead.category.toUpperCase()}</span>
                            )}
                        </div>

                        {lead.pipeline?.name && (
                            <div className="hero__subtitle">Pipeline: {lead.pipeline.name}</div>
                        )}

                        <div className="divider" />

                        {/* Deal Information */}
                        <section className="section">
                            <div className="section__title">Deal Information</div>
                            <div className="section__rule" />
                            <div className="fields">
                                <FieldCell label="Subsidiary" value={lead.company?.name} />
                                <FieldCell label="Amount" value={lead.estimated_value != null ? formatCurrency(lead.estimated_value, prefix) : null} highlight />
                                <FieldCell label="Close Date" value={formatDate(lead.target_close_date)} />
                                <FieldCell label="PIC Sales" value={lead.pic_sales_profile?.full_name} />
                                <FieldCell label="Account Manager" value={lead.account_manager_profile?.full_name} />
                                <FieldCell label="Lead Source" value={lead.lead_source} />
                                <FieldCell label="Main Stream" value={lead.main_stream} />
                                <FieldCell label="Stream Type" value={lead.stream_type} />
                                <FieldCell label="Business Purpose" value={lead.business_purpose} />
                                <FieldCell label="Event Format" value={lead.event_format} />
                            </div>
                        </section>

                        {/* Client & Contact */}
                        <section className="section">
                            <div className="section__title">Client & Contact</div>
                            <div className="section__rule" />
                            <div className="fields">
                                <FieldCell label="Client Company" value={lead.client_company?.name} />
                                <FieldCell label="Contact Person" value={lead.contact?.full_name} />
                                <FieldCell label="Email" value={lead.contact?.email} />
                                <FieldCell label="Phone" value={lead.contact?.phone ? formatPhoneDisplay(lead.contact.phone) : null} />
                            </div>
                        </section>

                        {/* Event Details */}
                        {hasEvent && (
                            <section className="section">
                                <div className="section__title">Event Details</div>
                                <div className="section__rule" />
                                <div className="fields">
                                    {(lead.event_date_start || lead.event_date_end) && (
                                        <>
                                            <FieldCell label="Event Start" value={formatDate(lead.event_date_start)} />
                                            <FieldCell label="Event End" value={formatDate(lead.event_date_end)} />
                                        </>
                                    )}
                                    {lead.event_dates && lead.event_dates.length > 0 && (
                                        <FieldCell
                                            label="Event Dates"
                                            value={lead.event_dates.map(d => formatDate(d)).join(", ")}
                                        />
                                    )}
                                    {lead.pax_count != null && <FieldCell label="Pax Count" value={String(lead.pax_count)} />}
                                    {lead.virtual_platform && <FieldCell label="Virtual Platform" value={lead.virtual_platform} />}
                                </div>

                                {lead.destinations && lead.destinations.length > 0 && (
                                    <table className="dest-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: "30%" }}>City</th>
                                                <th>Venue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lead.destinations.map((d, i) => (
                                                <tr key={i}>
                                                    <td>{d.city || "—"}</td>
                                                    <td>{d.venue || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </section>
                        )}

                        {/* Outcome */}
                        {hasOutcome && (
                            <section className="section">
                                <div className="section__title">Outcome</div>
                                <div className="section__rule" />
                                <div className="fields">
                                    {lead.closed_won_date && <FieldCell label="Closed Won" value={formatDate(lead.closed_won_date)} />}
                                    {lead.closed_lost_date && <FieldCell label="Closed Lost" value={formatDate(lead.closed_lost_date)} />}
                                    {lead.lost_reason && <FieldCell label="Lost Reason" value={lead.lost_reason} />}
                                </div>
                                {lead.lost_reason_details && (
                                    <div style={{ marginTop: 10 }}>
                                        <div className="field__label" style={{ marginBottom: 6 }}>Lost Reason Details</div>
                                        <div className="panel" dangerouslySetInnerHTML={{ __html: lead.lost_reason_details }} />
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Rich-text sections */}
                        <section className="section">
                            <div className="section__title">General Brief &amp; Inquiry</div>
                            <div className="section__rule" />
                            <RichPanel html={lead.general_brief} />
                        </section>

                        <section className="section">
                            <div className="section__title">Production SOW &amp; Equipment</div>
                            <div className="section__rule" />
                            <RichPanel html={lead.production_sow} />
                        </section>

                        <section className="section">
                            <div className="section__title">Special Remarks</div>
                            <div className="section__rule" />
                            <RichPanel html={lead.special_remarks} />
                        </section>

                        {/* Notes */}
                        {notes.length > 0 && (
                            <section className="section">
                                <div className="section__title">
                                    Notes ({notes.length > 10 ? `latest 10 of ${notes.length}` : notes.length})
                                </div>
                                <div className="section__rule" />
                                {notes.slice(0, 10).map(n => (
                                    <div key={n.id} className="note-card">
                                        <div className="note-card__head">
                                            <span className="note-card__author">{n.author_name || "Unknown"}</span>
                                            <span className="note-card__time">{formatDateTime(n.created_at)}</span>
                                        </div>
                                        <div className={`note-card__body ${!n.content ? "note-card__body--empty" : ""}`}
                                             dangerouslySetInnerHTML={{ __html: n.content || "(empty)" }} />
                                    </div>
                                ))}
                            </section>
                        )}

                        {/* Timeline */}
                        {activities.length > 0 && (
                            <section className="section">
                                <div className="section__title">
                                    Activity Timeline ({activities.length > 10 ? `latest 10 of ${activities.length}` : activities.length})
                                </div>
                                <div className="section__rule" />
                                {activities.slice(0, 10).map(a => (
                                    <div key={a.id} className="timeline-item">
                                        <div className="timeline-item__dot" />
                                        <div className="timeline-item__body">
                                            <span className="timeline-item__user">{a.user_name || "System"}</span>
                                            {" — "}
                                            {a.description || a.action_type}
                                            <span className="timeline-item__time">{formatDateTime(a.created_at)}</span>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}

                        {/* Metadata */}
                        <div className="meta-grid">
                            <div>
                                <div className="meta-grid__item__label">Lead ID</div>
                                <div className="meta-grid__item__value">#{lead.id}</div>
                            </div>
                            <div>
                                <div className="meta-grid__item__label">Created</div>
                                <div className="meta-grid__item__value">{lead.created_at ? formatDateTime(lead.created_at) : "—"}</div>
                            </div>
                            <div>
                                <div className="meta-grid__item__label">Last Updated</div>
                                <div className="meta-grid__item__value">{lead.updated_at ? formatDateTime(lead.updated_at) : "—"}</div>
                            </div>
                        </div>
                    </div>

                    <footer className="print-footer">
                        <span>Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · LeadEngine</span>
                        <span>Lead #{lead.id}</span>
                    </footer>
                </article>

                <div style={{ height: 24 }} />
            </div>
        </>
    )
}

// ─── Sub components ───────────────────────────────────────────

function FieldCell({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
    const isEmpty = !value
    return (
        <div className={`field ${highlight ? "field--highlight" : ""}`}>
            <div className="field__label">{label}</div>
            <div className={`field__value ${isEmpty ? "field__value--empty" : ""}`}>
                {isEmpty ? "—" : value}
            </div>
        </div>
    )
}

function RichPanel({ html }: { html: string | null | undefined }) {
    const trimmed = (html || "").replace(/<[^>]+>/g, "").trim()
    const isEmpty = !trimmed
    if (isEmpty) {
        return <div className="panel panel--empty">(empty)</div>
    }
    return (
        <div
            className="panel"
            dangerouslySetInnerHTML={{ __html: html as string }}
        />
    )
}
