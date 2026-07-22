"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { updateGoalSettingsV2Action } from "@/app/actions/goal-actions"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export function AutoLockSettings() {
  const supabase = createClient()
  const { activeCompany } = useCompany()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoLockEnabled, setAutoLockEnabled] = useState(false)
  const [dayOffset, setDayOffset] = useState(5)

  const loadSettings = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data } = await supabase
      .from("goal_settings_v2")
      .select("auto_lock_enabled, auto_lock_day_offset")
      .eq("company_id", activeCompany.id)
      .maybeSingle()

    if (data) {
      setAutoLockEnabled(data.auto_lock_enabled ?? false)
      setDayOffset(data.auto_lock_day_offset ?? 5)
    }
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => { loadSettings() }, [loadSettings])

  const handleSave = async () => {
    if (!activeCompany?.id) return
    setSaving(true)
    const result = await updateGoalSettingsV2Action(activeCompany.id, {
      auto_lock_enabled: autoLockEnabled,
      auto_lock_day_offset: dayOffset,
    })
    setSaving(false)
    if (result.success) {
      toast.success("Auto-lock settings saved")
    } else {
      toast.error(result.error ?? "Failed to save auto-lock settings")
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
        <CardTitle>Auto-Lock Settings</CardTitle>
        <CardDescription>
          Automatically close goal periods after a specified number of days past the period end date
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-3">
          <Switch checked={autoLockEnabled} onCheckedChange={setAutoLockEnabled} />
          <div>
            <Label>Enable Auto-Lock</Label>
            <p className="text-xs text-muted-foreground">
              Periods will be automatically closed after the configured day offset
            </p>
          </div>
        </div>

        {autoLockEnabled && (
          <div className="space-y-2">
            <Label>Days After Period End</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={dayOffset}
              onChange={(e) => setDayOffset(Math.min(30, Math.max(1, Number(e.target.value))))}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              Periods will auto-close {dayOffset} day{dayOffset !== 1 ? "s" : ""} after their end date
            </p>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Auto-Lock Settings
        </Button>
      </CardContent>
    </Card>
  )
}
