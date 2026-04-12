"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Loader2, Shield, Pencil } from "lucide-react"
import type { Role } from "@/types/company"

const schema = z.object({
    name: z.string().min(1, "Role name is required").max(50, "Max 50 characters"),
    description: z.string().max(200).optional().or(z.literal("")),
    parent_id: z.string().nullable().optional(),
    peer_data_visibility: z.boolean().default(false),
})
type FormValues = z.infer<typeof schema>

interface RoleModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    existingRoles: Role[]
    /** If set, the modal opens in Edit mode for this role. If null, opens in Create mode. */
    editingRole: Role | null
    onSaved?: () => void
}

export function RoleModal({ open, onOpenChange, existingRoles, editingRole, onSaved }: RoleModalProps) {
    const [saving, setSaving] = useState(false)
    const isEditing = !!editingRole

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: { name: "", description: "", parent_id: null, peer_data_visibility: false },
    })

    // Populate form when editing, clear when creating
    useEffect(() => {
        if (!open) return
        if (editingRole) {
            form.reset({
                name: editingRole.name,
                description: editingRole.description ?? "",
                parent_id: editingRole.parent_id ?? null,
                peer_data_visibility: (editingRole as Role & { peer_data_visibility?: boolean }).peer_data_visibility ?? false,
            })
        } else {
            form.reset({ name: "", description: "", parent_id: null, peer_data_visibility: false })
        }
    }, [open, editingRole, form])

    const onSubmit = async (values: FormValues) => {
        setSaving(true)
        const supabase = createClient()

        if (isEditing) {
            /* ─── UPDATE ──────────────────────────────────────────── */
            const { error } = await supabase
                .from("roles")
                .update({
                    name: values.name.trim(),
                    description: values.description?.trim() || null,
                    parent_id: values.parent_id || null,
                    peer_data_visibility: values.peer_data_visibility,
                })
                .eq("id", editingRole.id)

            if (error) {
                if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
                    toast.error("A role with this name already exists")
                } else {
                    toast.error(`Failed: ${error.message}`)
                }
            } else {
                toast.success(`Role "${values.name}" updated`)
                onOpenChange(false)
                onSaved?.()
            }
        } else {
            /* ─── INSERT ──────────────────────────────────────────── */
            const maxSort = existingRoles.reduce((max, r) => Math.max(max, r.sort_order), 0)

            const { error } = await supabase.from("roles").insert({
                name: values.name.trim(),
                description: values.description?.trim() || null,
                parent_id: values.parent_id || null,
                peer_data_visibility: values.peer_data_visibility,
                sort_order: maxSort + 1,
                is_system: false,
            })

            if (error) {
                if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
                    toast.error("A role with this name already exists")
                } else {
                    toast.error(`Failed: ${error.message}`)
                }
            } else {
                toast.success(`Role "${values.name}" created`)
                form.reset()
                onOpenChange(false)
                onSaved?.()
            }
        }
        setSaving(false)
    }

    // When editing, exclude the current role from the parent options to prevent circular references
    const parentOptions = isEditing
        ? existingRoles.filter((r) => r.id !== editingRole.id)
        : existingRoles

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {isEditing
                            ? <><Pencil className="h-5 w-5 text-primary" /> Edit Role</>
                            : <><Shield className="h-5 w-5 text-primary" /> Create New Role</>
                        }
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Update this role's name, description, or hierarchy position."
                            : "Define a new role in your organization hierarchy. Permissions can be configured after creation."
                        }
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Role Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Regional Manager" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                    <Input placeholder="Brief description of this role's responsibilities" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="parent_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reports To (Role Hierarchy)</FormLabel>
                                <Select
                                    key={editingRole?.id ?? "create"}
                                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                                    defaultValue={field.value || "none"}
                                >
                                    <FormControl>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Select parent role..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">— None (Top Level) —</SelectItem>
                                        {parentOptions.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    Users in this role will only see data up to their hierarchy level.
                                </p>
                            </FormItem>
                        )} />
                        {/* Peer Data Visibility Toggle */}
                        <FormField control={form.control} name="peer_data_visibility" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-4 bg-white shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-sm font-medium">Peer Data Visibility</FormLabel>
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Let users in this role see each other&apos;s data laterally.
                                    </p>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving}>
                                {saving
                                    ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                    : isEditing
                                        ? <Pencil className="h-4 w-4 mr-1.5" />
                                        : <Shield className="h-4 w-4 mr-1.5" />
                                }
                                {isEditing ? "Save Changes" : "Create Role"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
