"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { updateGoalSettingsV2Action } from "@/app/actions/goal-actions"
import { toast } from "sonner"
import { Loader2, X, Lock, Plus } from "lucide-react"

const MINIMUM_FIELDS = new Set([
  "actual_value",
  "event_date_start",
  "event_date_end",
  "project_name",
  "company_id",
  "pic_sales_id",
])

export function CriticalFieldsSettings() {
  const supabase = createClient()
  const { activeCompany } = useCompany()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState<string[]>([])
  const [newField, setNewField] = useState("")

  const loadSettings = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data } = await supabase
      .from("goal_settings_v2")
      .select("reporting_critical_fields")
      .eq("company_id", activeCompany.id)
      .maybeSingle()

    if (data?.reporting_critical_fields) {
      setFields(data.reporting_critical_fields)
    } else {
      setFields(Array.from(MINIMUM_FIELDS))
    }
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => { loadSettings() }, [loadSettings])

  const addField = () => {
    const trimmed = newField.trim().toLowerCase()
    if (!trimmed || fields.includes(trimmed)) return
    setFields((prev) => [...prev, trimmed])
    setNewField("")
  }

  const removeField = (field: string) => {
    if (MINIMUM_FIELDS.has(field)) return
    setFields((prev) => prev.filter((f) => f !== field))
  }

  const handleSave = async () => {
    if (!activeCompany?.id) return
    setSaving(true)
    const result = await updateGoalSettingsV2Action(activeCompany.id, {
      reporting_critical_fields: fields,
    })
    setSaving(false)
    if (result.success) {
      toast.success("Critical fields saved")
    } else {
      toast.error(result.error ?? "Failed to save critical fields")
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reporting-Critical Fields</CardTitle>
        <CardDescription>
          Changes to these fields on Closed Won leads will be tracked as post-win adjustments.
          The minimum set cannot be removed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {fields.map((field) => {
            const isProtected = MINIMUM_FIELDS.has(field)
            return (
              <span
                key={field}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  isProtected
                    ? "bg-slate-100 text-slate-500"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {isProtected && <Lock className="h-3 w-3" />}
                {field}
                {!isProtected && (
                  <button onClick={() => removeField(field)} className="hover:text-red-600 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Add field name (e.g. lead_source)"
            value={newField}
            onChange={(e) => setNewField(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField() } }}
            className="max-w-xs"
          />
          <Button variant="outline" size="sm" onClick={addField} disabled={!newField.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Critical Fields
        </Button>
      </CardContent>
    </Card>
  )
}
