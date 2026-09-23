"use client"

/**
 * Saved-Views Bar — tab-like row above filters that lists the user's
 * saved list views for a given page. Click a tab to apply that view's
 * filters/sort/columns. Modify any of those and a "Save" affordance
 * appears so the user can persist the change.
 *
 *   Visual:
 *     [ All contacts ]  [ My active ]  [ + ]              ⋯  Save · Save as
 *
 * Stateless — parent owns the view list + active id. Parent calls a
 * server action to persist.
 */

import * as React from "react"
import { Check, MoreHorizontal, Save, Pencil, Trash2, Star } from "@/components/icons"
import { ToolbarIconButton } from "./list-toolbar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface SavedView {
    id: string
    name: string
    is_default: boolean
}

interface SavedViewsBarProps {
    views: SavedView[]
    activeViewId: string | null
    onSelectView: (id: string) => void
    /** Hidden when no views or no diff vs active. Caller decides. */
    isDirty: boolean
    onSaveCurrent: () => Promise<void> | void
    onSaveAs: (name: string) => Promise<void> | void
    onRename: (id: string, name: string) => Promise<void> | void
    onDelete: (id: string) => Promise<void> | void
    onMakeDefault: (id: string) => Promise<void> | void
    className?: string
}

export function SavedViewsBar({
    views,
    activeViewId,
    onSelectView,
    isDirty,
    onSaveCurrent,
    onSaveAs,
    onRename,
    onDelete,
    onMakeDefault,
    className,
}: SavedViewsBarProps) {
    const [saveAsOpen, setSaveAsOpen] = React.useState(false)
    const [saveAsName, setSaveAsName] = React.useState("")
    const [renameTarget, setRenameTarget] = React.useState<SavedView | null>(null)
    const [renameName, setRenameName] = React.useState("")

    const activeView = views.find(v => v.id === activeViewId) ?? null

    // No views, no bar: a lone "+" above a rule was the whole feature's
    // footprint for most people. Saving the first view lives on the
    // toolbar (SaveViewButton); the bar appears once there is something
    // to switch between.
    if (views.length === 0) return null

    return (
        <div className={cn("flex items-center justify-between gap-3", className)}>
            {/* M3 choice chips: one selected, all visible, scrolling sideways when long. */}
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto" role="group" aria-label="Saved views">
                {views.map((v) => {
                    const isActive = v.id === activeViewId
                    return (
                        <button
                            key={v.id}
                            type="button"
                            onClick={() => onSelectView(v.id)}
                            aria-pressed={isActive}
                            className={cn(
                                "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors",
                                isActive
                                    ? "border-transparent bg-primary/12 text-primary"
                                    : "border-border bg-card text-foreground hover:bg-muted",
                            )}
                        >
                            {isActive && <Check className="h-3.5 w-3.5" />}
                            {v.is_default && !isActive && <Star className="h-3 w-3 fill-current text-accent" />}
                            <span>{v.name}</span>
                        </button>
                    )
                })}
            </div>

            {activeView && (
                <div className="flex items-center gap-1.5 shrink-0 pr-1">
                    {isDirty && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSaveCurrent()}
                            className="h-7 px-2.5 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/5"
                        >
                            <Save className="h-3 w-3" />
                            Save changes
                        </Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => { setSaveAsName(activeView.name + " (copy)"); setSaveAsOpen(true) }}>
                                <Save className="mr-2 h-3.5 w-3.5" />
                                Save as new view
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setRenameTarget(activeView); setRenameName(activeView.name) }}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                Rename
                            </DropdownMenuItem>
                            {!activeView.is_default && (
                                <DropdownMenuItem onClick={() => onMakeDefault(activeView.id)}>
                                    <Star className="mr-2 h-3.5 w-3.5" />
                                    Set as default
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                    if (confirm(`Delete view "${activeView.name}"? This cannot be undone.`)) {
                                        onDelete(activeView.id)
                                    }
                                }}
                            >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Delete view
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            <SaveAsDialog
                open={saveAsOpen}
                onOpenChange={setSaveAsOpen}
                value={saveAsName}
                onChange={setSaveAsName}
                onSubmit={async () => {
                    const name = saveAsName.trim()
                    if (!name) return
                    await onSaveAs(name)
                    setSaveAsOpen(false)
                }}
                title="Save view"
                description="Give this view a name. You'll be able to switch to it later."
                action="Save"
            />

            <SaveAsDialog
                open={!!renameTarget}
                onOpenChange={(o) => { if (!o) setRenameTarget(null) }}
                value={renameName}
                onChange={setRenameName}
                onSubmit={async () => {
                    if (!renameTarget) return
                    const name = renameName.trim()
                    if (!name) return
                    await onRename(renameTarget.id, name)
                    setRenameTarget(null)
                }}
                title="Rename view"
                description="Choose a new name for this view."
                action="Rename"
            />
        </div>
    )
}

/**
 * "Save view" on the toolbar: names the current search, filters, sort and
 * columns as a view. This is where a person's first view is made.
 */
export function SaveViewButton({ onSaveAs }: { onSaveAs: (name: string) => Promise<void> | void }) {
    const [open, setOpen] = React.useState(false)
    const [name, setName] = React.useState("")
    return (
        <>
            <ToolbarIconButton label="Save this view" onClick={() => { setName(""); setOpen(true) }}>
                <Save className="h-5 w-5" />
            </ToolbarIconButton>
            <SaveAsDialog
                open={open}
                onOpenChange={setOpen}
                value={name}
                onChange={setName}
                onSubmit={async () => {
                    const trimmed = name.trim()
                    if (!trimmed) return
                    await onSaveAs(trimmed)
                    setOpen(false)
                }}
                title="Save view"
                description="Give this view a name. You'll be able to switch to it later."
                action="Save"
            />
        </>
    )
}

/* ─────────────────────────────────────────────────────────────────── */
/* Reusable name dialog — used for both Save-as and Rename             */
/* ─────────────────────────────────────────────────────────────────── */

function SaveAsDialog({
    open,
    onOpenChange,
    value,
    onChange,
    onSubmit,
    title,
    description,
    action,
}: {
    open: boolean
    onOpenChange: (o: boolean) => void
    value: string
    onChange: (v: string) => void
    onSubmit: () => void | Promise<void>
    title: string
    description: string
    action: string
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <Input
                    autoFocus
                    placeholder="View name"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") onSubmit() }}
                    maxLength={80}
                />
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => onSubmit()} disabled={!value.trim()}>{action}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
