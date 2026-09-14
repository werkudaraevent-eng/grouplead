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
import { Loader2, Shield, Pencil } from "@/components/icons"
import type { Role } from "@/types/company"

const schema = z.object({
    name: z.string().min(1, "Nama role wajib diisi").max(50, "Maksimal 50 karakter"),
    description: z.string().max(200).optional().or(z.literal("")),
    parent_id: z.string().nullable().optional(),
    peer_data_visibility: z.boolean().default(false),
    /** Which role to copy the permission matrix from, or "blank". */
    copy_from: z.string().default("blank"),
})
type FormValues = z.infer<typeof schema>

interface RoleModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    existingRoles: Role[]
    /** If set, the modal opens in Edit mode for this role. If null, opens in Create mode. */
    editingRole: Role | null
    /** Companies to seed the new role's permission rows into. */
    companyIds: string[]
    onSaved?: () => void
}

export function RoleModal({ open, onOpenChange, existingRoles, editingRole, companyIds, onSaved }: RoleModalProps) {
    const [saving, setSaving] = useState(false)
    const isEditing = !!editingRole

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: { name: "", description: "", parent_id: null, peer_data_visibility: false, copy_from: "blank" },
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
                copy_from: "blank",
            })
        } else {
            form.reset({ name: "", description: "", parent_id: null, peer_data_visibility: false, copy_from: "blank" })
        }
    }, [open, editingRole, form])

    /**
     * Write the new role's matrix rows.
     *
     * A role used to be created with no `role_permissions` rows at all, which
     * left the matrix looking empty while the person actually resolved through
     * their legacy user_type grants. Now every role owns an explicit row for
     * every module from the moment it exists, so the screen is the whole truth
     * about it.
     *
     * Copying is offered because a 15-module by 4-column matrix is 60 switches,
     * and most new roles are a variation on one that already exists. Salesforce
     * clones a profile, GitLab makes you pick a base role; neither starts you on
     * a blank grid unless you ask for one.
     */
    const seedPermissions = async (roleId: string, copyFromRoleId: string | null) => {
        const supabase = createClient()

        const { data: modules, error: moduleError } = await supabase
            .from("app_modules")
            .select("id")

        if (moduleError || !modules?.length) {
            toast.error("Role dibuat, tetapi daftar modul gagal dibaca. Atur izinnya secara manual.")
            return
        }

        let source: Record<string, Record<string, unknown>> = {}
        if (copyFromRoleId) {
            const { data: sourceRows, error: sourceError } = await supabase
                .from("role_permissions")
                .select("company_id, module_id, can_create, can_read, can_update, can_delete")
                .eq("role_id", copyFromRoleId)
                .in("company_id", companyIds)

            if (sourceError) {
                toast.error("Role dibuat, tetapi izin sumber gagal dibaca. Matriks dimulai kosong.")
            } else {
                source = Object.fromEntries(
                    (sourceRows ?? []).map((row) => [`${row.company_id}:${row.module_id}`, row])
                )
            }
        }

        const rows = companyIds.flatMap((companyId) =>
            modules.map((mod) => {
                const copied = source[`${companyId}:${mod.id}`]
                return {
                    company_id: companyId,
                    role_id: roleId,
                    user_type: null,
                    module_id: mod.id,
                    can_create: (copied?.can_create as boolean) ?? false,
                    can_read: (copied?.can_read as string) ?? "none",
                    can_update: (copied?.can_update as boolean) ?? false,
                    can_delete: (copied?.can_delete as boolean) ?? false,
                }
            })
        )

        const { error } = await supabase.from("role_permissions").insert(rows)
        if (error) {
            toast.error(`Role dibuat, tetapi izinnya gagal disiapkan: ${error.message}`)
        }
    }

    const onSubmit = async (values: FormValues) => {
        setSaving(true)
        const supabase = createClient()

        if (isEditing) {
            /* ─── UPDATE ──────────────────────────────────────────── */
            // Asking for the row back turns a policy-filtered write, which
            // PostgREST reports as success with zero rows, into a real failure.
            const { data, error } = await supabase
                .from("roles")
                .update({
                    name: values.name.trim(),
                    description: values.description?.trim() || null,
                    parent_id: values.parent_id || null,
                    peer_data_visibility: values.peer_data_visibility,
                })
                .eq("id", editingRole.id)
                .select("id")

            if (error) {
                if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
                    toast.error("Sudah ada role dengan nama itu")
                } else {
                    toast.error(`Gagal: ${error.message}`)
                }
            } else if (!data?.length) {
                toast.error("Hanya super admin yang bisa mengubah role. Tidak ada yang tersimpan.")
            } else {
                toast.success(`Role "${values.name}" diperbarui`)
                onOpenChange(false)
                onSaved?.()
            }
        } else {
            /* ─── INSERT ──────────────────────────────────────────── */
            const maxSort = existingRoles.reduce((max, r) => Math.max(max, r.sort_order), 0)

            const { data, error } = await supabase
                .from("roles")
                .insert({
                    name: values.name.trim(),
                    description: values.description?.trim() || null,
                    parent_id: values.parent_id || null,
                    peer_data_visibility: values.peer_data_visibility,
                    sort_order: maxSort + 1,
                    is_system: false,
                })
                .select("id")
                .single()

            if (error) {
                if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
                    toast.error("Sudah ada role dengan nama itu")
                } else {
                    toast.error(`Gagal: ${error.message}`)
                }
            } else if (!data) {
                toast.error("Hanya super admin yang bisa membuat role. Tidak ada yang tersimpan.")
            } else {
                await seedPermissions(data.id as string, values.copy_from === "blank" ? null : values.copy_from)
                const copiedFrom = existingRoles.find((r) => r.id === values.copy_from)
                toast.success(
                    copiedFrom
                        ? `Role "${values.name}" dibuat, izin disalin dari ${copiedFrom.name}`
                        : `Role "${values.name}" dibuat dengan matriks kosong`
                )
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
                            ? <><Pencil className="h-5 w-5 text-primary" /> Ubah role</>
                            : <><Shield className="h-5 w-5 text-primary" /> Role baru</>
                        }
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Perbarui nama, deskripsi, atau posisi role ini di hierarki."
                            : "Tentukan role baru dalam hierarki organisasi. Izinnya bisa diatur setelah dibuat."
                        }
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nama role</FormLabel>
                                <FormControl>
                                    <Input placeholder="Misalnya: Regional Manager" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Deskripsi</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ringkasan tanggung jawab role ini" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="parent_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Melapor ke (hierarki role)</FormLabel>
                                <Select
                                    key={editingRole?.id ?? "create"}
                                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                                    defaultValue={field.value || "none"}
                                >
                                    <FormControl>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Pilih role induk..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">— Tidak ada (level teratas) —</SelectItem>
                                        {parentOptions.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    Pengguna di role ini hanya melihat data sampai level hierarkinya.
                                </p>
                            </FormItem>
                        )} />
                        {/* Only on create: an existing role is the fastest honest starting point. */}
                        {!isEditing && (
                            <FormField control={form.control} name="copy_from" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mulai dari</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="blank">Matriks kosong (semua mati)</SelectItem>
                                            {existingRoles.map((r) => (
                                                <SelectItem key={r.id} value={r.id}>Salin izin dari {r.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Izin tetap bisa diubah satu per satu setelah role dibuat.
                                    </p>
                                </FormItem>
                            )} />
                        )}
                        {/* Peer Data Visibility Toggle */}
                        <FormField control={form.control} name="peer_data_visibility" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-4 bg-white shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-sm font-medium">Lihat data sesama level</FormLabel>
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Pengguna di role ini bisa melihat data satu sama lain.
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
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                            <Button type="submit" disabled={saving}>
                                {saving
                                    ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                    : isEditing
                                        ? <Pencil className="h-4 w-4 mr-1.5" />
                                        : <Shield className="h-4 w-4 mr-1.5" />
                                }
                                {isEditing ? "Simpan perubahan" : "Buat role"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
