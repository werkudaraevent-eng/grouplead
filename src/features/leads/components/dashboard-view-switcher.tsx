"use client"

import { useState } from "react"
import {
  Bookmark,
  ChevronDown,
  Star,
  StarOff,
  Plus,
  Pencil,
  Copy,
  Trash2,
  Check,
  CircleDot,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { DashboardView } from "@/types/dashboard-view"

type DialogMode =
  | { kind: "none" }
  | { kind: "save-as" }
  | { kind: "rename"; view: DashboardView }
  | { kind: "delete"; view: DashboardView }

interface DashboardViewSwitcherProps {
  views: DashboardView[]
  activeView: DashboardView | null
  loading: boolean
  hasUnsavedChanges: boolean
  isEditMode: boolean
  onSelectView: (id: string) => void
  onSaveCurrent: () => Promise<unknown> | void
  onSaveAsNew: (name: string) => Promise<unknown> | void
  onRename: (id: string, name: string) => Promise<unknown> | void
  onSetDefault: (id: string) => Promise<unknown> | void
  onDuplicate: (id: string) => Promise<unknown> | void
  onDelete: (id: string) => Promise<unknown> | void
}

/**
 * Dropdown switcher for saved dashboard views.
 * Mounts itself into the existing #dashboard-edit-controls portal slot so it
 * sits cleanly alongside the "Edit Dashboard" button in the sticky header.
 */
export function DashboardViewSwitcher({
  views,
  activeView,
  loading,
  hasUnsavedChanges,
  isEditMode,
  onSelectView,
  onSaveCurrent,
  onSaveAsNew,
  onRename,
  onSetDefault,
  onDuplicate,
  onDelete,
}: DashboardViewSwitcherProps) {
  const [dialog, setDialog] = useState<DialogMode>({ kind: "none" })
  const [dialogName, setDialogName] = useState("")
  const [dialogBusy, setDialogBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const openDialog = (mode: DialogMode) => {
    if (mode.kind === "rename") setDialogName(mode.view.name)
    else setDialogName("")
    setDialog(mode)
  }

  const closeDialog = () => {
    if (dialogBusy) return
    setDialog({ kind: "none" })
  }

  const handleDialogSubmit = async () => {
    if (dialogBusy) return
    const name = dialogName.trim()
    if (dialog.kind === "save-as") {
      if (!name) return
      setDialogBusy(true)
      await onSaveAsNew(name)
      setDialogBusy(false)
      setDialog({ kind: "none" })
    } else if (dialog.kind === "rename") {
      if (!name) return
      setDialogBusy(true)
      await onRename(dialog.view.id, name)
      setDialogBusy(false)
      setDialog({ kind: "none" })
    } else if (dialog.kind === "delete") {
      setDialogBusy(true)
      await onDelete(dialog.view.id)
      setDialogBusy(false)
      setDialog({ kind: "none" })
    }
  }

  const canDelete = views.length > 1
  const activeLabel = loading
    ? "Loading…"
    : activeView?.name ?? "Default view"

  const switcher = (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isEditMode}
            title={isEditMode ? "Finish editing before switching views" : "Switch view"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#fff",
              border: "1px solid #e5e8ed",
              borderRadius: 7,
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 600,
              color: isEditMode ? "#94a3b8" : "#02378D",
              cursor: isEditMode ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: "0 1px 2px rgba(0,0,0,.03)",
              maxWidth: 200,
              opacity: isEditMode ? 0.5 : 1,
              whiteSpace: "nowrap",
            }}
          >
            <Bookmark style={{ width: 12, height: 12, flexShrink: 0 }} />
            <span
              style={{
                maxWidth: 130,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {activeLabel}
            </span>
            {hasUnsavedChanges && (
              <span
                title="Unsaved changes"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CircleDot style={{ width: 10, height: 10, color: "#f59e0b" }} />
              </span>
            )}
            <ChevronDown style={{ width: 12, height: 12, flexShrink: 0 }} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[260px]">
          <DropdownMenuLabel className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
            <span>Your Views</span>
            <span className="font-normal normal-case text-[10px] text-slate-400">
              {views.length} saved
            </span>
          </DropdownMenuLabel>
          {views.length === 0 && !loading && (
            <div className="px-2 py-3 text-xs text-slate-500">No views yet.</div>
          )}
          {views.map(view => {
            const isActive = view.id === activeView?.id
            return (
              <DropdownMenuItem
                key={view.id}
                onSelect={(e) => {
                  e.preventDefault()
                  if (!isActive) onSelectView(view.id)
                  setMenuOpen(false)
                }}
                className="flex items-start gap-2 py-2"
              >
                <div className="flex items-center gap-1 pt-0.5">
                  {isActive ? (
                    <Check className="h-3.5 w-3.5 text-[#02378D]" />
                  ) : (
                    <span className="inline-block h-3.5 w-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium text-slate-900 truncate">
                      {view.name}
                    </span>
                    {view.is_default && (
                      <Star className="h-3 w-3 fill-amber-400 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setMenuOpen(false)
              openDialog({ kind: "save-as" })
            }}
            className="text-[12px]"
          >
            <Plus className="h-3.5 w-3.5 mr-2 text-slate-500" />
            Save current as new view…
          </DropdownMenuItem>
          {activeView && (
            <DropdownMenuItem
              onSelect={async (e) => {
                e.preventDefault()
                setMenuOpen(false)
                await onSaveCurrent()
              }}
              disabled={!hasUnsavedChanges}
              className="text-[12px]"
            >
              <Bookmark className="h-3.5 w-3.5 mr-2 text-slate-500" />
              Save changes to this view
            </DropdownMenuItem>
          )}
          {activeView && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  if (!activeView) return
                  setMenuOpen(false)
                  openDialog({ kind: "rename", view: activeView })
                }}
                className="text-[12px]"
              >
                <Pencil className="h-3.5 w-3.5 mr-2 text-slate-500" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async (e) => {
                  e.preventDefault()
                  if (!activeView) return
                  setMenuOpen(false)
                  await onDuplicate(activeView.id)
                }}
                className="text-[12px]"
              >
                <Copy className="h-3.5 w-3.5 mr-2 text-slate-500" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async (e) => {
                  e.preventDefault()
                  if (!activeView || activeView.is_default) return
                  setMenuOpen(false)
                  await onSetDefault(activeView.id)
                }}
                disabled={activeView.is_default}
                className="text-[12px]"
              >
                {activeView.is_default ? (
                  <StarOff className="h-3.5 w-3.5 mr-2 text-slate-400" />
                ) : (
                  <Star className="h-3.5 w-3.5 mr-2 text-slate-500" />
                )}
                {activeView.is_default ? "Current default" : "Set as default"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  if (!activeView || !canDelete) return
                  setMenuOpen(false)
                  openDialog({ kind: "delete", view: activeView })
                }}
                disabled={!canDelete}
                className="text-[12px] text-red-600 focus:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                {canDelete ? "Delete view" : "Delete (keep at least one)"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <>
      {switcher}

      <Dialog
        open={dialog.kind !== "none"}
        onOpenChange={(open) => { if (!open) closeDialog() }}
      >
        <DialogContent className="sm:max-w-[400px]">
          {dialog.kind === "save-as" && (
            <>
              <DialogHeader>
                <DialogTitle>Save as new view</DialogTitle>
                <DialogDescription>
                  Saves the current layout, hidden widgets, and filters as a new named view.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="view-name-input">View name</Label>
                <Input
                  id="view-name-input"
                  value={dialogName}
                  maxLength={60}
                  autoFocus
                  onChange={(e) => setDialogName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleDialogSubmit()
                  }}
                  placeholder="e.g. Q2 Sales Focus"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} disabled={dialogBusy}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDialogSubmit}
                  disabled={dialogBusy || !dialogName.trim()}
                >
                  {dialogBusy ? "Saving…" : "Save view"}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog.kind === "rename" && (
            <>
              <DialogHeader>
                <DialogTitle>Rename view</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="view-rename-input">View name</Label>
                <Input
                  id="view-rename-input"
                  value={dialogName}
                  maxLength={60}
                  autoFocus
                  onChange={(e) => setDialogName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleDialogSubmit()
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} disabled={dialogBusy}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDialogSubmit}
                  disabled={dialogBusy || !dialogName.trim()}
                >
                  {dialogBusy ? "Saving…" : "Rename"}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog.kind === "delete" && (
            <>
              <DialogHeader>
                <DialogTitle>Delete &quot;{dialog.view.name}&quot;?</DialogTitle>
                <DialogDescription>
                  This permanently removes the view. Widgets and data are not affected.
                  {dialog.view.is_default && " The next view will become your default."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} disabled={dialogBusy}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDialogSubmit}
                  disabled={dialogBusy}
                >
                  {dialogBusy ? "Deleting…" : "Delete view"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
