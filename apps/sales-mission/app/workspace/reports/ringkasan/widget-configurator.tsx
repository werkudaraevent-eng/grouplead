"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Save } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChoiceChip, ChipRow } from "@/components/ui/choice-chip"
import { FacetSelect } from "@/components/facet-select"
import {
  CHART_LABELS,
  DIMENSION_LABELS,
  MEASURES,
  MEASURE_HINTS,
  MEASURE_LABELS,
  PROSPECT_MEASURES,
  SIZE_LABELS,
  WIDGET_SIZES,
  chartsFor,
  defaultTitle,
  groupsFor,
  listDrill,
  seriesFor,
  validateWidget,
  type ChartKind,
  type CubeWidget,
  type Dimension,
  type Measure,
  type WidgetSize,
} from "@/lib/reporting/cube"
import { newCustomId } from "@/lib/reporting/dashboard-layout"

/**
 * Compose a card: what to count, what to compare it with, how to group
 * and split it, which shape, which size, and whose. Every list is
 * derived from the previous answers, so the form never offers a
 * combination the cube cannot answer; a choice that stops being valid is
 * cleared, not left to fail on save.
 */

const NONE = "__none__"

interface Draft {
  title: string
  measure: Measure
  compare: Measure | ""
  group: Dimension
  series: Dimension | ""
  chart: ChartKind
  size: WidgetSize
  sales: string[]
}

function toDraft(widget: CubeWidget | null): Draft {
  if (!widget) return { title: "", measure: "visits", compare: "", group: "day", series: "", chart: "bars", size: "wide", sales: [] }
  return {
    title: widget.title,
    measure: widget.measures[0],
    compare: widget.measures[1] ?? "",
    group: widget.group,
    series: widget.series && widget.series !== "none" ? widget.series : "",
    chart: widget.chart,
    size: widget.size,
    sales: widget.filters?.sales ?? [],
  }
}

function toWidget(draft: Draft, id: string): CubeWidget {
  const measures: CubeWidget["measures"] = draft.compare ? [draft.measure, draft.compare] : [draft.measure]
  return {
    id,
    kind: "custom",
    source: "cube",
    title: draft.title.trim() || defaultTitle({ measures, group: draft.group, series: draft.series || undefined }),
    measures,
    group: draft.group,
    series: draft.series || undefined,
    chart: draft.chart,
    size: draft.size,
    filters: draft.sales.length ? { sales: draft.sales } : undefined,
  }
}

export function WidgetConfigurator({
  open,
  widget,
  people,
  canSeeProspects,
  saving,
  onOpenChange,
  onSave,
}: {
  open: boolean
  /** The card being edited, or null for a new one. */
  widget: CubeWidget | null
  people: Array<{ id: string; name: string; avatarUrl: string | null }>
  canSeeProspects: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (widget: CubeWidget) => void
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(widget))
  useEffect(() => {
    if (open) setDraft(toDraft(widget))
  }, [open, widget])

  const measures = useMemo<CubeWidget["measures"]>(() => (draft.compare ? [draft.measure, draft.compare] : [draft.measure]), [draft.measure, draft.compare])
  const measureOptions = MEASURES.filter((measure) => canSeeProspects || !PROSPECT_MEASURES.includes(measure))
  const groups = groupsFor(measures)
  const seriesOptions = seriesFor(measures, draft.group)
  const charts = chartsFor(draft.group, draft.series || undefined, measures.length as 1 | 2)
  // Two measures sit side by side in any grouping; only a split rules it out.
  const canCompare = !draft.series

  // Derived options changed under a choice: clear what no longer fits.
  useEffect(() => {
    setDraft((current) => {
      let next = current
      if (!groups.includes(next.group)) next = { ...next, group: groups.includes("day") ? "day" : (groups[0] ?? "none") }
      const series = seriesFor(measures, next.group)
      if (next.series && !series.includes(next.series)) next = { ...next, series: "" }
      const allowed = chartsFor(next.group, next.series || undefined, measures.length as 1 | 2)
      if (!allowed.includes(next.chart)) next = { ...next, chart: allowed[0] }
      return next === current ? current : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.measure, draft.compare, draft.group, draft.series])

  const candidate = toWidget(draft, widget?.id ?? "c_preview000")
  const problem = validateWidget(candidate)
  // A single-measure bar list is drawn as rows; a row opens the list that can answer it.
  const drill = draft.chart === "hbars" && measures.length === 1 && !draft.series ? listDrill(draft.measure, draft.group) : null
  const placeholder = defaultTitle({ measures, group: draft.group, series: draft.series || undefined })

  const fieldClass = "space-y-1.5"
  const labelClass = "text-sm font-medium text-foreground"

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{widget ? "Ubah widget" : "Widget baru"}</DialogTitle>
          <DialogDescription>Satu kartu menjawab satu pertanyaan: apa yang dihitung, dikelompokkan per apa, dalam bentuk apa.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className={fieldClass}>
            <Label htmlFor="widget-title" className={labelClass}>Judul</Label>
            <Input id="widget-title" value={draft.title} maxLength={60} placeholder={placeholder} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="h-11 md:h-10" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={fieldClass}>
              <Label className={labelClass}>Ukuran</Label>
              <Select value={draft.measure} onValueChange={(value) => setDraft({ ...draft, measure: value as Measure, compare: draft.compare === value ? "" : draft.compare })}>
                <SelectTrigger className="h-11 w-full md:h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {measureOptions.map((measure) => (
                    <SelectItem key={measure} value={measure}>{MEASURE_LABELS[measure]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{MEASURE_HINTS[draft.measure]}</p>
            </div>
            <div className={fieldClass}>
              <Label className={labelClass}>Bandingkan dengan</Label>
              <Select value={draft.compare || NONE} onValueChange={(value) => setDraft({ ...draft, compare: value === NONE ? "" : (value as Measure), series: value === NONE ? draft.series : "" })} disabled={!canCompare}>
                <SelectTrigger className="h-11 w-full md:h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Tidak dibandingkan</SelectItem>
                  {measureOptions.filter((measure) => measure !== draft.measure).map((measure) => (
                    <SelectItem key={measure} value={measure}>{MEASURE_LABELS[measure]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Dua ukuran berdampingan, misalnya kunjungan vs appointment.</p>
            </div>
            <div className={fieldClass}>
              <Label className={labelClass}>Dikelompokkan per</Label>
              <Select value={draft.group} onValueChange={(value) => setDraft({ ...draft, group: value as Dimension })}>
                <SelectTrigger className="h-11 w-full md:h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {groups.map((dimension) => (
                    <SelectItem key={dimension} value={dimension}>{DIMENSION_LABELS[dimension]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              <Label className={labelClass}>Dipecah per</Label>
              <Select value={draft.series || NONE} onValueChange={(value) => setDraft({ ...draft, series: value === NONE ? "" : (value as Dimension) })} disabled={seriesOptions.length === 0}>
                <SelectTrigger className="h-11 w-full md:h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Tidak dipecah</SelectItem>
                  {seriesOptions.map((dimension) => (
                    <SelectItem key={dimension} value={dimension}>{DIMENSION_LABELS[dimension]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {seriesOptions.length === 0 && <p className="text-xs text-muted-foreground">{draft.compare ? "Dua ukuran tidak bisa dipecah lagi." : "Pilih pengelompokan dulu."}</p>}
            </div>
          </div>

          <div className={fieldClass}>
            <Label className={labelClass}>Bentuk</Label>
            <ChipRow>
              {charts.map((chart) => (
                <ChoiceChip key={chart} selected={draft.chart === chart} onClick={() => setDraft({ ...draft, chart })}>
                  {CHART_LABELS[chart]}
                </ChoiceChip>
              ))}
            </ChipRow>
            {drill && (
              <p className="text-xs text-muted-foreground">
                Tiap baris kartu bisa diketuk: membuka {drill.list === "reports" ? "Laporan" : "Aktivitas"} yang sudah tersaring {DIMENSION_LABELS[draft.group].toLowerCase()} itu dan periode Ringkasan.
              </p>
            )}
          </div>

          <div className={fieldClass}>
            <Label className={labelClass}>Ukuran kartu</Label>
            <ChipRow>
              {WIDGET_SIZES.map((size) => (
                <ChoiceChip key={size} selected={draft.size === size} onClick={() => setDraft({ ...draft, size })}>
                  {SIZE_LABELS[size]}
                </ChoiceChip>
              ))}
            </ChipRow>
          </div>

          <div className={fieldClass}>
            <Label className={labelClass}>Hanya sales tertentu</Label>
            <div>
              <FacetSelect label="Sales" options={people.map((person) => ({ value: person.id, label: person.name }))} value={draft.sales} onChange={(sales) => setDraft({ ...draft, sales })} />
            </div>
            <p className="text-xs text-muted-foreground">Kosong berarti mengikuti saringan Sales di atas halaman.</p>
          </div>

          {problem && <p className="text-sm text-[var(--danger-foreground)]">{problem}</p>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button type="button" onClick={() => onSave(toWidget(draft, widget?.id ?? newCustomId()))} disabled={saving || Boolean(problem)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {widget ? "Simpan" : "Tambahkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
