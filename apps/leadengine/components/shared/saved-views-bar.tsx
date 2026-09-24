"use client"

/**
 * A person's saved views of a list, in two shapes.
 *
 * On a desk, `ViewsMenu`: one outlined button at the trailing edge of the
 * toolbar's first line, before the columns button, named after the view
 * the screen shows exactly (else "Views"), opening an M3 menu with
 * "Default view" and each view (a check on the one shown, a star on the
 * default), then the actions (Linear's and Notion's view switcher). A row
 * of chips above the toolbar was the earlier way and was dropped: it cost
 * a whole row for one or two chips and moved the table down the moment the
 * first view was saved.
 *
 * On a phone, `SavedViewsBar`: the chips above the search, with ⋮ for the
 * view last chosen, as before (saving a first view is desk work there).
 *
 * Stateless — the page owns the views through `useListViews`, which calls
 * the server actions.
 */

import * as React from "react"
import { Check, ChevronDown, MoreHorizontal, Save, Pencil, Trash2, Star, StarOff } from "@/components/icons"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
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
import type { ListViewsApi } from "@/hooks/use-list-views"
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

/**
 * The phone's saved views: chips above the search, drawn by the page below
 * `md` only. The chip of the view last chosen stays marked while it is
 * changed, with "Save changes" beside it; deleting asks first, and the
 * snackbar then offers Undo as it does on a desk (`useListViews`).
 */
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
    // footprint for most people. Views are saved on a desk (the Views
    // menu); the bar appears once there is something to switch between.
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

type NameDialog = { kind: "save" | "copy" | "rename"; id: string | null }

const DIALOG_TEXT: Record<NameDialog["kind"], { title: string; description: string; action: string }> = {
    save: { title: "Save view", description: "Give this view a name. You'll be able to switch to it later.", action: "Save" },
    copy: { title: "Save view", description: "Give this view a name. You'll be able to switch to it later.", action: "Save" },
    rename: { title: "Rename view", description: "Choose a new name for this view.", action: "Rename" },
}

/**
 * The desk's one "Views" button and its menu (M3 menu; Linear's and
 * Notion's view switcher), at the trailing edge of the toolbar's first
 * line. The button is outlined with 8dp corners at the filter chips'
 * height and names the view the screen shows exactly, else "Views".
 *
 * The menu lists "Default view" (the list as it first opens: no search,
 * filters or sort, 25 rows, the default columns) and each saved view, a
 * check on the one shown and a star on the default; then what can be done
 * now: "Save view" once the list differs from how it first opens and no
 * view is chosen, "Save changes" once the view last chosen has been
 * changed, and for the view in hand (the one shown, else the one last
 * chosen) save as new, rename, set or remove the default, and delete,
 * which asks nothing and whose snackbar undoes it. Drawn only where the
 * views can be read.
 */
export function ViewsMenu({
    views,
    customised,
    onChooseDefault,
}: {
    views: ListViewsApi
    /** The screen differs from how the list first opens (query, size or columns): worth saving. */
    customised: boolean
    /** "Default view": the page resets the list (URL and columns) and forgets the view last chosen. */
    onChooseDefault: () => void
}) {
    // The dialog's content outlives its opening, so its title does not change while it closes.
    const [dialog, setDialog] = React.useState<NameDialog>({ kind: "save", id: null })
    const [dialogOpen, setDialogOpen] = React.useState(false)
    const [name, setName] = React.useState("")

    if (!views.available) return null

    const { marked, target, dirty } = views
    const plainShown = !marked && !customised
    const openDialog = (kind: NameDialog["kind"], initialName: string, id: string | null = null) => {
        setDialog({ kind, id })
        setName(initialName)
        setDialogOpen(true)
    }
    const submit = async () => {
        const trimmed = name.trim()
        if (!trimmed) return
        if (dialog.kind === "rename") {
            if (!dialog.id) return
            await views.renameView(dialog.id, trimmed)
        } else {
            await views.saveAs(trimmed)
        }
        setDialogOpen(false)
    }
    const text = DIALOG_TEXT[dialog.kind]
    const canSave = customised && !target

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-9 gap-1.5 border-border bg-card px-3 shadow-none hover:bg-muted data-[state=open]:bg-muted"
                    >
                        {marked && <span className="sr-only">Saved view: </span>}
                        <span className="max-w-48 truncate">{marked?.name ?? "Views"}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                {/* M3 menu: never past the window (16px clear of it) and at most 32rem
                    tall; the whole menu scrolls when the views outgrow it. */}
                <DropdownMenuContent
                    align="end"
                    collisionPadding={16}
                    className="w-64 max-h-[min(var(--radix-dropdown-menu-content-available-height),32rem)]"
                >
                    <DropdownMenuGroup aria-label="Views">
                        <ViewItem label="Default view" checked={plainShown} onSelect={onChooseDefault} />
                        {views.views.map((v) => (
                            <ViewItem
                                key={v.id}
                                label={v.name}
                                checked={marked?.id === v.id}
                                isDefault={v.is_default}
                                onSelect={() => views.selectView(v.id)}
                            />
                        ))}
                    </DropdownMenuGroup>

                    {(canSave || target) && <DropdownMenuSeparator />}
                    {canSave && (
                        <DropdownMenuItem onSelect={() => openDialog("save", "")}>
                            <Save /> Save view
                        </DropdownMenuItem>
                    )}
                    {target && (
                        <>
                            {/* The view in hand is not the one shown: say which view these act on. */}
                            {!marked && (
                                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                                    Changed from “{target.name}”
                                </DropdownMenuLabel>
                            )}
                            {dirty && (
                                <DropdownMenuItem onSelect={() => void views.saveCurrent()}>
                                    <Save /> Save changes
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => openDialog("copy", `${target.name} (copy)`)}>
                                <Save /> Save as new view
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openDialog("rename", target.name, target.id)}>
                                <Pencil /> Rename
                            </DropdownMenuItem>
                            {target.is_default ? (
                                <DropdownMenuItem onSelect={() => void views.unsetDefault(target.id)}>
                                    <StarOff /> Remove default
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onSelect={() => void views.makeDefault(target.id)}>
                                    <Star /> Set as default
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem variant="destructive" onSelect={() => void views.deleteView(target.id)}>
                                <Trash2 /> Delete
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <SaveAsDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                value={name}
                onChange={setName}
                onSubmit={submit}
                title={text.title}
                description={text.description}
                action={text.action}
            />
        </>
    )
}

/** One choosable view: a leading check when it is the one shown, a star when it is the default. */
function ViewItem({
    label,
    checked,
    isDefault = false,
    onSelect,
}: {
    label: string
    checked: boolean
    isDefault?: boolean
    onSelect: () => void
}) {
    return (
        <DropdownMenuItem role="menuitemradio" aria-checked={checked} onSelect={onSelect} className="pl-8">
            <span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center">
                {checked && <Check className="size-4 text-primary" aria-hidden="true" />}
            </span>
            <span className={cn("min-w-0 flex-1 truncate", checked && "font-medium")}>{label}</span>
            {isDefault && (
                <>
                    <Star className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span className="sr-only"> (default)</span>
                </>
            )}
        </DropdownMenuItem>
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
