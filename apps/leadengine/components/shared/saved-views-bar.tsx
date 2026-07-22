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
import { MoreHorizontal, Plus, Save, Pencil, Trash2, Star } from "lucide-react"
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

    return (
        <div className={cn("flex items-center justify-between gap-3 border-b border-border", className)}>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {views.map((v) => {
                    const isActive = v.id === activeViewId
                    return (
                        <button
                            key={v.id}
                            type="button"
                            onClick={() => onSelectView(v.id)}
                            className={cn(
                                "relative inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap",
                                isActive
                                    ? "text-foreground border-b-2 border-primary -mb-px"
                                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent",
                            )}
                        >
                            {v.is_default && <Star className="h-3 w-3 fill-current text-amber-500" />}
                            <span>{v.name}</span>
                        </button>
                    )
                })}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSaveAsName(""); setSaveAsOpen(true) }}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    aria-label="Create view"
                >
                    <Plus className="h-3.5 w-3.5" />
                </Button>
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
