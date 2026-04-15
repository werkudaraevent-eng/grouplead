"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { LEAD_FIELD_REGISTRY, type LeadFieldEntry } from "@/config/lead-field-registry"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Plus, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import type { LeadFieldSetting } from "@/types"

function sourceLabel(entry: LeadFieldEntry): string {
  const src = entry.valueSource
  switch (src.type) {
    case "master_options": return `master_options (${src.optionType})`
    case "leads_distinct": return `leads DISTINCT (${src.column})`
    case "profiles": return "profiles"
    case "client_companies": return "client_companies"
    case "client_company_field": return `client_companies.${src.column}`
    case "subsidiaries": return "companies (subsidiaries)"
    default: return "unknown"
  }
}

export function RegistrySettings() {
  const supabase = createClient()
  const { activeCompany } = useCompany()

  const [settings, setSettings] = useState<LeadFieldSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  // Dependency check state
  const [warnField, setWarnField] = useState<string | null>(null)
  const [warnDeps, setWarnDeps] = useState<string[]>([])
  const [pendingToggle, setPendingToggle] = useState<{ key: string; active: boolean } | null>(null)

  // Add custom field dialog
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newFieldKey, setNewFieldKey] = useState("")
  const [newFieldLabel, setNewFieldLabel] = useState("")
  const [newFieldSourceType, setNewFieldSourceType] = useState<string>("leads_distinct")
  const [newFieldSourceParam, setNewFieldSourceParam] = useState("")
  const [addSaving, setAddSaving] = useState(false)

  const loadSettings = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data } = await supabase
      .from("lead_field_settings")
      .select("*")
      .eq("company_id", activeCompany.id)
    setSettings((data as LeadFieldSetting[]) ?? [])
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => { loadSettings() }, [loadSettings])

  // Merge registry with settings
  const settingsMap = new Map(settings.map((s) => [s.field_key, s]))

  const allFields: (LeadFieldEntry & { isActive: boolean; settingId?: string })[] = [
    ...LEAD_FIELD_REGISTRY.map((f) => {
      const override = settingsMap.get(f.key)
      return { ...f, isActive: override ? override.is_active : true, settingId: override?.id }
    }),
    // Custom fields (in settings but not in registry)
    ...settings
      .filter((s) => !LEAD_FIELD_REGISTRY.find((f) => f.key === s.field_key))
      .map((s) => ({
        key: s.field_key,
        label: s.custom_label ?? s.field_key,
        valueSource: (s.custom_value_source as any) ?? { type: "leads_distinct" as const, column: s.field_key },
        isSystemDefault: false,
        supportsSegmentation: true,
        isActive: s.is_active,
        settingId: s.id,
      })),
  ]

  const checkDependencies = async (fieldKey: string): Promise<string[]> => {
    if (!activeCompany?.id) return []
    const deps: string[] = []

    // Check goal_segments using this source_field
    const { data: dims } = await supabase
      .from("goal_segments")
      .select("name")
      .eq("company_id", activeCompany.id)
      .eq("source_field", fieldKey)
    if (dims && dims.length > 0) {
      deps.push(...dims.map((d: { name: string }) => `Segment: ${d.name}`))
    }

    // Check goals_v2 breakdown_config
    const { data: goals } = await supabase
      .from("goals_v2")
      .select("name, breakdown_config")
      .eq("company_id", activeCompany.id)
      .eq("is_active", true)
    if (goals) {
      for (const g of goals as { name: string; breakdown_config: Array<{ field: string }> }[]) {
        if (g.breakdown_config?.some((l) => l.field === fieldKey)) {
          deps.push(`Goal breakdown: ${g.name}`)
        }
      }
    }

    return deps
  }

  const handleToggle = async (fieldKey: string, newActive: boolean) => {
    if (!activeCompany?.id) return

    // If deactivating, check dependencies first
    if (!newActive) {
      const deps = await checkDependencies(fieldKey)
      if (deps.length > 0) {
        setWarnField(fieldKey)
        setWarnDeps(deps)
        setPendingToggle({ key: fieldKey, active: newActive })
        return
      }
    }

    await doToggle(fieldKey, newActive)
  }

  const doToggle = async (fieldKey: string, newActive: boolean) => {
    if (!activeCompany?.id) return
    setToggling(fieldKey)

    const { error } = await supabase
      .from("lead_field_settings")
      .upsert(
        {
          company_id: activeCompany.id,
          field_key: fieldKey,
          is_active: newActive,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,field_key" }
      )

    setToggling(null)
    if (error) {
      toast.error("Failed to update field status")
    } else {
      toast.success(`${fieldKey} ${newActive ? "activated" : "deactivated"}`)
      loadSettings()
    }
  }

  const confirmDeactivation = () => {
    if (pendingToggle) {
      doToggle(pendingToggle.key, pendingToggle.active)
    }
    setWarnField(null)
    setWarnDeps([])
    setPendingToggle(null)
  }

  const handleAddCustomField = async () => {
    if (!activeCompany?.id || !newFieldKey.trim() || !newFieldLabel.trim()) return

    // Check uniqueness
    const exists = allFields.find((f) => f.key === newFieldKey.trim())
    if (exists) {
      toast.error("A field with this key already exists")
      return
    }

    setAddSaving(true)

    let valueSource: any
    if (newFieldSourceType === "master_options") {
      valueSource = { type: "master_options", optionType: newFieldSourceParam || newFieldKey.trim() }
    } else if (newFieldSourceType === "leads_distinct") {
      valueSource = { type: "leads_distinct", column: newFieldSourceParam || newFieldKey.trim() }
    } else if (newFieldSourceType === "profiles") {
      valueSource = { type: "profiles" }
    } else {
      valueSource = { type: "client_companies" }
    }

    const { error } = await supabase.from("lead_field_settings").insert({
      company_id: activeCompany.id,
      field_key: newFieldKey.trim(),
      is_active: true,
      custom_label: newFieldLabel.trim(),
      custom_value_source: valueSource,
    })

    setAddSaving(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Custom field added")
      setShowAddDialog(false)
      setNewFieldKey("")
      setNewFieldLabel("")
      setNewFieldSourceParam("")
      loadSettings()
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Toggle fields on/off to control which lead fields appear in goal breakdown, segment source, and dashboard widget selectors.
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Custom Field
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Label</TableHead>
              <TableHead className="text-xs">Key</TableHead>
              <TableHead className="text-xs">Value Source</TableHead>
              <TableHead className="text-xs text-center w-[80px]">Segmentable</TableHead>
              <TableHead className="text-xs text-center w-[80px]">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allFields.map((field) => (
              <TableRow key={field.key}>
                <TableCell className="text-sm font-medium">
                  {field.label}
                  {field.isSystemDefault && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">system</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{field.key}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{sourceLabel(field)}</TableCell>
                <TableCell className="text-center text-xs">
                  {field.supportsSegmentation ? "✓" : "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={field.isActive}
                    onCheckedChange={(checked) => handleToggle(field.key, checked)}
                    disabled={toggling === field.key}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Deactivation warning dialog */}
      <AlertDialog open={!!warnField} onOpenChange={(open) => { if (!open) { setWarnField(null); setPendingToggle(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Field is referenced
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deactivating &quot;{warnField}&quot; will hide it from selectors, but existing configurations will be preserved:
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {warnDeps.map((d) => (
                  <li key={d} className="text-sm">{d}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivation}>Deactivate Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Custom Field Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Field</DialogTitle>
            <DialogDescription>Register a new lead field for analysis across the system.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Field Key</Label>
              <Input placeholder="e.g. custom_region" value={newFieldKey} onChange={(e) => setNewFieldKey(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Display Label</Label>
              <Input placeholder="e.g. Custom Region" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Value Source Type</Label>
              <Select value={newFieldSourceType} onValueChange={setNewFieldSourceType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="master_options">Master Options</SelectItem>
                  <SelectItem value="leads_distinct">Leads Distinct</SelectItem>
                  <SelectItem value="profiles">Profiles</SelectItem>
                  <SelectItem value="client_companies">Client Companies</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(newFieldSourceType === "master_options" || newFieldSourceType === "leads_distinct") && (
              <div className="grid gap-2">
                <Label>{newFieldSourceType === "master_options" ? "Option Type" : "Column Name"}</Label>
                <Input
                  placeholder={newFieldSourceType === "master_options" ? "e.g. custom_region" : "e.g. custom_region"}
                  value={newFieldSourceParam}
                  onChange={(e) => setNewFieldSourceParam(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddCustomField} disabled={addSaving || !newFieldKey.trim() || !newFieldLabel.trim()}>
              {addSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Add Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
