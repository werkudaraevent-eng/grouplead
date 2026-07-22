"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Bookmark, Save, Trash2 } from "lucide-react"
import type { SavedView } from "@/types/goals"

interface SavedViewSelectorProps {
  views: SavedView[]
  loading: boolean
  onLoad: (viewId: string) => void
  onSave: (name: string, isShared: boolean) => void
  onDelete: (viewId: string) => void
}

export function SavedViewSelector({ views, loading, onLoad, onSave, onDelete }: SavedViewSelectorProps) {
  const [saveOpen, setSaveOpen] = useState(false)
  const [viewName, setViewName] = useState("")
  const [isShared, setIsShared] = useState(false)
  const [selectedViewId, setSelectedViewId] = useState<string>("")

  const handleSave = () => {
    if (!viewName.trim()) return
    onSave(viewName.trim(), isShared)
    setViewName("")
    setIsShared(false)
    setSaveOpen(false)
  }

  return (
    <div className="flex items-center gap-1.5">
      {views.length > 0 && (
        <Select
          value={selectedViewId}
          onValueChange={(id) => {
            setSelectedViewId(id)
            onLoad(id)
          }}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <Bookmark className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Saved views" />
          </SelectTrigger>
          <SelectContent>
            {views.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name} {v.is_shared ? "(shared)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selectedViewId && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            onDelete(selectedViewId)
            setSelectedViewId("")
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      )}

      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSaveOpen(true)}>
        <Save className="h-3 w-3 mr-1" />
        Save View
      </Button>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g. Q1 BFSI Focus"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="shared-toggle">Share with team</Label>
              <Switch id="shared-toggle" checked={isShared} onCheckedChange={setIsShared} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!viewName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
