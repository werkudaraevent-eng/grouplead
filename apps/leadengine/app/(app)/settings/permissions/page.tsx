"use client"

import Link from "next/link"
import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { usePermissions } from "@/contexts/permissions-context"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { RoleModal } from "@/features/roles/components/create-role-modal"
import { Loader2, ShieldCheck, Shield, Lock, Crown, UserCog, User, Plus, ChevronRight, ChevronDown, Pencil, Trash2, Info, Check, MoreVertical } from "@/components/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip } from "@/components/ui/tooltip"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import type { RolePermission, AppModule, Role, RecordScope } from "@/types/company"

/* ─── Icon mapping for known system roles; custom roles get a generic Shield ──── */
const ROLE_ICON_MAP: Record<string, React.ElementType> = {
  "Super Admin": Crown,
  "Admin": ShieldCheck,
  "Executive": Shield,
  "Leader": UserCog,
  "Staff": User,
}

/**
 * Every group can be collapsed. It used to be only Settings, so the Sales
 * Mission group's four children were permanently expanded next to a Settings
 * group that folded away, and the chevron read as decoration on the two headers
 * that ignored it.
 *
 * `description` stays one sentence. The cascade rule that used to be spelled out
 * in three sentences here lives in the help panel above the table, where the
 * other rules of the matrix already are.
 */
const MODULE_GROUPS = [
  {
    title: "Core CRM",
    description: "Ruang kerja harian sales dan data pelanggan.",
    modules: ["dashboard", "leads", "companies", "contacts", "sales_mission"],
  },
  {
    title: "Sales Mission",
    description: "Kontrol rinci di dalam aplikasi Sales Mission.",
    modules: ["sales_mission_mission", "sales_mission_result", "sales_mission_contact", "sales_mission_settings", "sales_mission_prospect"],
  },
  {
    title: "Pengaturan",
    description: "Akses ke halaman Settings dan tiap bagiannya.",
    modules: ["settings", "master_options", "pipeline", "segment_settings", "goal_settings", "management_dashboard", "members", "permissions"],
  },
] as const

/**
 * `description` is the one supporting line under the module name, the way a
 * Material list item carries a headline and one line of supporting text.
 * `details` is the full rule, read on demand from the info icon: HubSpot and
 * Salesforce both keep the matrix scannable and put the explanation a hover
 * away, because a paragraph in a table cell is what breaks the table.
 */
const MODULE_DISPLAY: Record<string, { name: string; description: string; details?: string; level?: number }> = {
  dashboard: {
    name: "Dashboard",
    description: "Dashboard performa eksekutif dan sales.",
    level: 0,
  },
  sales_mission: {
    name: "Sales Mission",
    description: "Pintu masuk aplikasi. Baris ini disalin ke lima modul di bawahnya.",
    details: "Tanpa Lihat di sini, tidak ada yang bisa dijangkau di dalam Sales Mission. Tiap sakelar dan Cakupan di baris ini disalin ke lima modul di bawah; setelah itu tiap modul bisa diatur sendiri-sendiri.",
    level: 0,
  },
  sales_mission_mission: {
    name: "Mission",
    description: "Menjadwalkan dan mengubah kunjungan. Pemilik: sales utama dan yang menjadwalkan.",
    details: "Lihat: semua mission unit bisnis (jadwal bersama). Buat: menjadwalkan mission baru dan mengimpor. Ubah: detail, jadwal, tim, dan pembatalan mission di dalam Cakupan. Hapus: memindahkan mission di dalam Cakupan ke sampah.",
    level: 1,
  },
  sales_mission_result: {
    name: "Laporan kunjungan",
    description: "Mengisi dan mengubah laporan, mengirim lead. Pemilik: sales utama.",
    details: "Lihat: membaca laporan dan halaman Laporan. Buat: mengisi laporan dan mengirim lead untuk mission di dalam Cakupan. Ubah: mengubah laporan terkirim milik orang di dalam Cakupan kapan saja dan meminta klarifikasi; penulisnya sendiri selalu boleh mengubah dalam jendela hari yang diatur di Pengaturan mission.",
    level: 1,
  },
  sales_mission_contact: {
    name: "Kontak mission",
    description: "Membaca kontak klien pada mission dan laporan.",
    details: "Tanpa Cakupan: kontak ditulis lewat laporan, jadi mengikuti izin Laporan kunjungan.",
    level: 1,
  },
  sales_mission_settings: {
    name: "Pengaturan mission",
    description: "Ubah di sini berarti admin Sales Mission.",
    details: "Pengaturan mission, form, pilihan laporan, status prospek, papan, dan sampah. Tanpa Cakupan: ini bukan record milik seseorang.",
    level: 1,
  },
  sales_mission_prospect: {
    name: "Prospek",
    description: "Daftar calon klien sebelum jadi mission. Pemilik: pemegangnya.",
    details: "Lihat: seluruh daftar prospek. Buat: menambah dan mengimpor. Ubah dan Hapus: prospek di dalam Cakupan; prospek tanpa pemegang boleh diambil siapa pun yang punya Ubah. Cakupan Tim atau Semua juga mengizinkan menugaskan prospek ke orang lain.",
    level: 1,
  },
  settings: {
    name: "Halaman Settings",
    description: "Menentukan apakah pengguna bisa membuka halaman /settings.",
    level: 0,
  },
  master_options: {
    name: "Master Options",
    description: "Field lead, opsi dropdown, tata letak form, dan konfigurasi tahap pipeline.",
    level: 1,
  },
  pipeline: {
    name: "Tahap Pipeline",
    description: "Membuat, mengganti nama, mewarnai, mengurutkan, dan menghapus tahap pipeline di kanban maupun Settings.",
    level: 1,
  },
  segment_settings: {
    name: "Segmen",
    description: "Definisi dan pemetaan segmen di dalam Settings.",
    level: 1,
  },
  goal_settings: {
    name: "Pengaturan Goal",
    description: "Periode goal, aturan atribusi, dan konfigurasi pelaporan di dalam Settings.",
    level: 1,
  },
  management_dashboard: {
    name: "Dashboard Manajemen Goal",
    description: "Dashboard pencapaian goal dan forecast di dalam Pengaturan Goal, bukan dashboard utama.",
    level: 1,
  },
  members: {
    name: "Pengguna",
    description: "Manajemen pengguna dan penambahan anggota di dalam Settings.",
    level: 1,
  },
  permissions: {
    name: "Role & Izin",
    description: "Pengelolaan matriks kontrol akses di dalam Settings.",
    level: 1,
  },
}

const GROUPED_MODULE_IDS: Set<string> = new Set(MODULE_GROUPS.flatMap((group) => [...group.modules]))

/**
 * Rows in `app_modules` that gate nothing.
 *
 * `users` duplicated the label of `members`, which is the module that actually
 * governs Settings > Users, so the matrix showed two rows called Pengguna.
 * `forecast_settings` had no reader anywhere in either app.
 *
 * The companion migration deletes both. This list keeps the screen correct in
 * the window before it runs, and on any environment where it has not.
 */
const RETIRED_MODULE_IDS: Set<string> = new Set(["users", "forecast_settings"])

/**
 * Sub-modules that follow the `sales_mission` switch.
 *
 * Sales Mission treats a module with no row as *unrestricted*, so an admin
 * looking at four switches rendered off was reading "denied" where the app read
 * "allowed". Writing explicit rows alongside the parent removes that gap: once
 * a role has been configured, off genuinely means off, and the admin tightens
 * individual sub-modules from a known state.
 */
const SALES_MISSION_PARENT = "sales_mission"
const SALES_MISSION_SUBMODULES = [
  "sales_mission_mission",
  "sales_mission_result",
  "sales_mission_contact",
  "sales_mission_settings",
  "sales_mission_prospect",
] as const

/**
 * Cakupan: whose records Ubah, Hapus, and the record-bound actions reach.
 *
 * Drawn only where Sales Mission reads it. Kontak and Pengaturan have no
 * records with an owner, and LeadEngine enforces no ownership at all; a
 * control that changes nothing is the mistake the old four-value Lihat made.
 * The parent row carries the control as a cascade, like its switches.
 */
const SCOPED_MODULE_IDS: Set<string> = new Set(["sales_mission_mission", "sales_mission_result", "sales_mission_prospect"])
const SCOPE_OPTIONS: ReadonlyArray<{ value: RecordScope; label: string; hint: string }> = [
  { value: "own", label: "Sendiri", hint: "Hanya record miliknya: mission yang ia sales utama atau ia jadwalkan, laporan mission-nya sendiri, prospek yang ia pegang." },
  { value: "team", label: "Tim", hint: "Miliknya, ditambah milik orang yang Atasan-nya adalah dia, berantai ke bawah. Atasan diatur di Settings → Users." },
  { value: "all", label: "Semua", hint: "Semua record di unit bisnis." },
]

/**
 * Material segmented button: one connected group, the selected segment
 * filled and marked with a check, every segment labelled. Mixed (the parent
 * row while its children disagree) selects nothing.
 */
function ScopeSegments({
  value,
  disabled,
  label,
  onChange,
}: {
  value: RecordScope | null
  disabled: boolean
  label: string
  onChange: (next: RecordScope) => void
}) {
  return (
    <div role="group" aria-label={`Cakupan ${label}`} className="inline-flex overflow-hidden rounded-full border border-border">
      {SCOPE_OPTIONS.map((option, index) => {
        const selected = option.value === value
        return (
          <Tooltip key={option.value} content={option.hint}>
            <button
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => { if (!selected) onChange(option.value) }}
              className={cn(
                "inline-flex h-8 items-center gap-1 px-2.5 text-[12px] font-medium transition-colors disabled:cursor-default disabled:opacity-60",
                index > 0 && "border-l border-border",
                selected ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {option.label}
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

export default function GlobalPermissionsPage() {
  const { activeCompany, isHoldingView, companies } = useCompany()
  const { can } = usePermissions()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)

  /* ─── Dynamic roles state ──────────────────────────────────────────────── */
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)
  /** null while counting; the dialog must not guess a number it does not have. */
  const [roleUserCount, setRoleUserCount] = useState<number | null>(null)

  const [modules, setModules] = useState<AppModule[]>([])
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [rolesLoading, setRolesLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  /** The reading guide folds away: the matrix is the page, the guide is there when asked. */
  const [helpOpen, setHelpOpen] = useState(false)

  const supabase = createClient()
  const companyId = selectedCompanyId ?? activeCompany?.id ?? null
  const isSuperAdmin = selectedRole?.name === "Super Admin"
  const canManagePermissions = can("permissions", "update")

  /* ─── Fetch roles from DB ──────────────────────────────────────────────── */
  const fetchRoles = useCallback(async () => {
    setRolesLoading(true)
    const { data, error: err } = await supabase
      .from("roles")
      .select("*")
      .order("sort_order", { ascending: true })

    if (err) { setError(err.message); setRolesLoading(false); return }

    const fetched = (data as Role[]) ?? []
    setRoles(fetched)

    // Keep the selection, but on the refreshed object. Returning `prev` meant a
    // rename saved fine and the panel beside the sidebar kept showing the old
    // name and description until the next full reload.
    setSelectedRole((prev) => {
      const match = prev ? fetched.find((r) => r.id === prev.id) : undefined
      return match ?? fetched[0] ?? null
    })
    setRolesLoading(false)
  }, [])

  /**
   * Fetch modules and permissions for the selected role.
   *
   * `showLoading` exists because the Sales Mission cascade ends by re-reading,
   * and the full loader swaps the entire table for a centred spinner. Flipping
   * one switch made every other row vanish and come back, resetting the scroll
   * position, while the toast beside it said the change had succeeded. A
   * background reconcile refreshes the values in place instead.
   */
  const fetchPermissions = useCallback(async (showLoading = true) => {
    if (!companyId || !selectedRole) return
    if (showLoading) setLoading(true)
    setError(null)

    const { data: mods, error: modErr } = await supabase
      .from("app_modules")
      .select("*")
      .order("sort_order", { ascending: true })

    if (modErr) { setError(modErr.message); setLoading(false); return }
    setModules((mods as AppModule[]) ?? [])

    const { data: perms, error: permErr } = await supabase
      .from("role_permissions")
      .select("*")
      .eq("company_id", companyId)
      .eq("role_id", selectedRole.id)

    if (permErr) { setError(permErr.message); setLoading(false); return }
    setPermissions((perms as RolePermission[]) ?? [])
    setLoading(false)
  }, [companyId, selectedRole?.id])

  useEffect(() => { fetchRoles() }, [fetchRoles])
  useEffect(() => { fetchPermissions() }, [fetchPermissions])

  // How many people are standing on the role about to be deleted. Nothing in the
  // schema blocks the delete, so this number is the only warning there is.
  useEffect(() => {
    if (!roleToDelete) { setRoleUserCount(null); return }
    let cancelled = false
    setRoleUserCount(null)
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role_id", roleToDelete.id)
      .then(({ count }) => { if (!cancelled) setRoleUserCount(count ?? 0) })
    return () => { cancelled = true }
  }, [roleToDelete?.id])

  /* ─── Permission helpers ───────────────────────────────────────────────── */
  const findPerm = (moduleId: string) =>
    permissions.find((p) => p.module_id === moduleId)

  /**
   * Every group folds. Settings still starts closed when the hub itself is off,
   * because its eight children cannot be reached until it is on; the others
   * start open.
   */
  const isGroupExpanded = (groupTitle: string) => {
    if (expandedGroups[groupTitle] !== undefined) return expandedGroups[groupTitle]
    if (groupTitle !== "Pengaturan") return true
    const settingsPerm = findPerm("settings")
    return (settingsPerm?.can_read ?? "none") !== "none"
  }

  const toggleGroup = (groupTitle: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupTitle]: !isGroupExpanded(groupTitle),
    }))
  }

  /**
   * Write permissions depend on read, so granting one grants the other.
   *
   * The matrix used to enforce that dependency by disabling Buat / Ubah / Hapus
   * until Lihat was on. On a role that has never been configured there are no
   * `role_permissions` rows at all, so `can_read` read as "none" and all three
   * switches came up dead — a brand-new role was a screen of controls that
   * refused every click, with nothing anywhere saying to turn Lihat on first.
   *
   * The dependency was right; expressing it as a locked control was not. Now the
   * switches are live and the prerequisite follows the grant, which is what
   * Salesforce, Strapi and Directus all do with the same matrix: enabling Edit
   * implies Read, and revoking Read still takes the writes with it
   * (see handleChangeRead). The combination the admin cannot reach is the only
   * one that was ever nonsense — write access to something you cannot see.
   */
  const grantsImpliedRead = (perm: RolePermission | undefined, turningOn: boolean) =>
    turningOn && (perm?.can_read ?? "none") === "none"

  const handleToggleBool = async (
    moduleId: string,
    field: "can_create" | "can_update" | "can_delete"
  ) => {
    if (!companyId || !selectedRole || isSuperAdmin || !canManagePermissions) return
    const key = `${moduleId}:${selectedRole.id}:${field}`
    setToggling(key)

    const perm = findPerm(moduleId)
    if (perm) {
      const newVal = !perm[field]
      const payload: Partial<RolePermission> = { [field]: newVal }
      if (grantsImpliedRead(perm, newVal)) payload.can_read = "company"

      // Move the switch on the click, then reconcile. Waiting for the round trip
      // meant that on a field connection the control sat still for a second and
      // read as one that had ignored the tap, which invites a second click.
      const previous = permissions
      setPermissions((prev) =>
        prev.map((p) => (p.id === perm.id ? { ...p, ...payload } : p))
      )

      const { error } = await supabase
        .from("role_permissions")
        .update(payload)
        .eq("id", perm.id)
      if (error) {
        setPermissions(previous)
        setError(error.message)
        toast.error("Gagal memperbarui izin")
      }
      else {
        // Propagate to subsidiaries when editing from Holding View
        const propagated = isHoldingView && companies.length > 1
          ? await propagateToSubsidiaries(moduleId, payload as Record<string, unknown>)
          : true
        if (moduleId === SALES_MISSION_PARENT) {
          // The implied read travels down with the column it came in on, or the
          // sub-modules would land in exactly the state this change removed.
          await cascadeSalesMissionSubmodules(payload)
        }
        // Silent when propagation already reported its own failure: two toasts
        // saying opposite things is worse than the one that is true.
        if (propagated) {
          toast.success(payload.can_read ? "Izin diperbarui, Lihat ikut dinyalakan" : "Izin diperbarui")
        }
      }
    } else {
      // No row yet, and the only way to get here is by switching something on,
      // so the read this write depends on is granted in the same insert.
      const insertPayload = {
        company_id: companyId,
        role_id: selectedRole.id,
        module_id: moduleId,
        can_create: field === "can_create",
        can_read: "company" as const,
        can_update: field === "can_update",
        can_delete: field === "can_delete",
        record_scope: "own" as const,
      }
      const { data, error } = await supabase
        .from("role_permissions")
        .insert(insertPayload)
        .select("*")
        .single()
      if (error) { setError(error.message); toast.error("Gagal memperbarui izin") }
      else if (data) {
        setPermissions((prev) => [...prev, data as RolePermission])
        // Propagate to subsidiaries when editing from Holding View
        const propagated = isHoldingView && companies.length > 1
          ? await propagateToSubsidiaries(moduleId, {
              can_create: insertPayload.can_create,
              can_read: insertPayload.can_read,
              can_update: insertPayload.can_update,
              can_delete: insertPayload.can_delete,
            })
          : true
        if (moduleId === SALES_MISSION_PARENT) {
          await cascadeSalesMissionSubmodules({
            [field]: true,
            can_read: "company",
          } as Partial<RolePermission>)
        }
        if (propagated) toast.success("Izin diperbarui, Lihat ikut dinyalakan")
      }
    }
    setToggling(null)
  }

  const handleChangeRead = async (moduleId: string, value: string) => {
    if (!companyId || !selectedRole || isSuperAdmin || !canManagePermissions) return
    const key = `${moduleId}:${selectedRole.id}:can_read`
    setToggling(key)

    const perm = findPerm(moduleId)
    if (perm) {
      // Cascade: if setting to 'none', force CUD off in the same update
      const cascadePayload: Record<string, unknown> = { can_read: value }
      if (value === 'none') {
        cascadePayload.can_create = false
        cascadePayload.can_update = false
        cascadePayload.can_delete = false
      }
      const { error } = await supabase
        .from("role_permissions")
        .update(cascadePayload)
        .eq("id", perm.id)
      // Returning here, not just toasting, because the cascade below writes to
      // four more modules. Without the return a failed parent write was followed
      // by a successful child write: the admin saw "Gagal", believed nothing had
      // been saved, and the sub-modules had already changed underneath them.
      if (error) {
        setError(error.message)
        toast.error("Gagal memperbarui akses lihat")
        setToggling(null)
        return
      }

      setPermissions((prev) =>
        prev.map((p) => (p.id === perm.id ? { ...p, ...cascadePayload as Partial<RolePermission> } : p))
      )
      // Propagate to subsidiaries when editing from Holding View
      const propagated = isHoldingView && companies.length > 1
        ? await propagateToSubsidiaries(moduleId, cascadePayload)
        : true
      if (propagated) toast.success("Akses lihat diperbarui")
    } else {
      const insertPayload = {
        company_id: companyId,
        role_id: selectedRole.id,
        module_id: moduleId,
        can_create: false,
        can_read: value as RolePermission["can_read"],
        can_update: false,
        can_delete: false,
        record_scope: "own" as const,
      }
      const { data, error } = await supabase
        .from("role_permissions")
        .insert(insertPayload)
        .select("*")
        .single()
      if (error || !data) {
        setError(error?.message ?? "Baris izin gagal dibuat")
        toast.error("Gagal memperbarui akses lihat")
        setToggling(null)
        return
      }

      setPermissions((prev) => [...prev, data as RolePermission])
      // Propagate to subsidiaries when editing from Holding View
      const propagated = isHoldingView && companies.length > 1
        ? await propagateToSubsidiaries(moduleId, {
            can_create: false,
            can_read: value,
            can_update: false,
            can_delete: false,
          })
        : true
      if (propagated) toast.success("Akses lihat diperbarui")
    }

    // Lihat on the parent opens Lihat below it, and only that column. Reached
    // only after the parent write succeeded — both branches above return early.
    if (moduleId === SALES_MISSION_PARENT) {
      await cascadeSalesMissionSubmodules({ can_read: value as RolePermission["can_read"] })
    }

    setToggling(null)
  }

  /**
   * Cakupan is one write, like a switch. A row that does not exist yet is
   * created all-off with the scope set, which is legal under the
   * write-requires-read rule because nothing is granted. On the parent row
   * the value is stored and copied down, the way its switches are.
   */
  const handleChangeScope = async (moduleId: string, value: RecordScope) => {
    if (!companyId || !selectedRole || isSuperAdmin || !canManagePermissions) return
    const key = `${moduleId}:${selectedRole.id}:record_scope`
    setToggling(key)

    const perm = findPerm(moduleId)
    const previous = permissions
    if (perm) {
      setPermissions((prev) => prev.map((p) => (p.id === perm.id ? { ...p, record_scope: value } : p)))
      const { error } = await supabase.from("role_permissions").update({ record_scope: value }).eq("id", perm.id)
      if (error) {
        setPermissions(previous)
        setError(error.message)
        toast.error("Gagal memperbarui cakupan")
        setToggling(null)
        return
      }
    } else {
      const insertPayload = {
        company_id: companyId,
        role_id: selectedRole.id,
        module_id: moduleId,
        can_create: false,
        can_read: "none" as const,
        can_update: false,
        can_delete: false,
        record_scope: value,
      }
      const { data, error } = await supabase.from("role_permissions").insert(insertPayload).select("*").single()
      if (error || !data) {
        setError(error?.message ?? "Baris izin gagal dibuat")
        toast.error("Gagal memperbarui cakupan")
        setToggling(null)
        return
      }
      setPermissions((prev) => [...prev, data as RolePermission])
    }

    const propagated = isHoldingView && companies.length > 1
      ? await propagateToSubsidiaries(moduleId, { record_scope: value })
      : true
    if (moduleId === SALES_MISSION_PARENT) {
      await cascadeSalesMissionSubmodules({ record_scope: value })
    }
    if (propagated) toast.success(`Cakupan diperbarui: ${SCOPE_OPTIONS.find((o) => o.value === value)?.label ?? value}`)
    setToggling(null)
  }

  /**
   * The Sales Mission row drives the same column on its four sub-modules.
   *
   * Column for column: turning on Lihat opens Lihat below it, and nothing else.
   * The first version granted create, update and delete as well, which handed a
   * role permissions the admin never asked for by moving one switch.
   *
   * Rows are written on the way down too, never deleted, because Sales Mission
   * reads a missing row as unrestricted. Deleting on "off" would hand back the
   * access just revoked.
   *
   * Two queries regardless of how many subsidiaries are in scope. The earlier
   * version looped module by module and then company by company, which on a
   * holding view meant sixty-odd sequential round trips: the admin watched the
   * rows light up one at a time, and a failure halfway left the rest untouched.
   */
  const cascadeSalesMissionSubmodules = async (patch: Partial<RolePermission>) => {
    if (!companyId || !selectedRole) return

    // In holding view the change belongs to every subsidiary as well, matching
    // how single-module edits already propagate.
    const targetCompanyIds =
      isHoldingView && companies.length > 1
        ? [companyId, ...companies.filter((c) => c.id !== companyId && !c.isHolding).map((c) => c.id)]
        : [companyId]

    const modules = [...SALES_MISSION_SUBMODULES]

    // Read off means everything off, the same rule a single module already
    // follows. Without this a child could keep create with no read, which the
    // matrix would then draw as a disabled switch sitting in the on position.
    const effective: Partial<RolePermission> =
      patch.can_read === "none"
        ? { ...patch, can_create: false, can_update: false, can_delete: false }
        : patch

    const { data: existing, error: lookupError } = await supabase
      .from("role_permissions")
      .select("id, company_id, module_id")
      .eq("role_id", selectedRole.id)
      .in("company_id", targetCompanyIds)
      .in("module_id", modules)

    if (lookupError) {
      toast.error("Gagal membaca modul Sales Mission")
      return
    }

    const seen = new Set((existing ?? []).map((row) => `${row.company_id}:${row.module_id}`))
    const existingIds = (existing ?? []).map((row) => row.id as string)

    const missing = targetCompanyIds.flatMap((cid) =>
      modules
        .filter((moduleId) => !seen.has(`${cid}:${moduleId}`))
        .map((moduleId) => ({
          company_id: cid,
          role_id: selectedRole.id,
          module_id: moduleId,
          can_create: false,
          can_read: "none" as const,
          can_update: false,
          can_delete: false,
          record_scope: "own" as const,
          ...effective,
        }))
    )

    const [updateResult, insertResult] = await Promise.all([
      existingIds.length > 0
        ? supabase.from("role_permissions").update(effective).in("id", existingIds)
        : Promise.resolve({ error: null }),
      missing.length > 0
        ? supabase.from("role_permissions").insert(missing)
        : Promise.resolve({ error: null }),
    ])

    if (updateResult.error || insertResult.error) {
      toast.error("Sebagian modul Sales Mission gagal diperbarui")
      await fetchPermissions(false)
      return
    }

    // Re-read rather than patch local state by hand: the insert covers rows this
    // component never held, and a stale row here would render a switch that
    // disagrees with the database. Silent, so the table stays on screen instead
    // of collapsing into a spinner every time one switch moves.
    await fetchPermissions(false)
  }

  /**
   * Propagate a permission change from Holding to every subsidiary.
   *
   * Two round trips instead of two per company, matching the shape
   * cascadeSalesMissionSubmodules already uses. The old loop ran a select and
   * then an update-or-insert for each subsidiary in sequence: eight companies
   * meant sixteen serialised requests for one switch flip.
   *
   * More importantly it discarded every result. Neither the update nor the
   * insert destructured `error`, and the `rp_manage` policy requires membership
   * of the *target* company — so a holding admin who is not a member of each
   * subsidiary got a zero-row update (PostgREST reports no error for that) or a
   * swallowed 42501, and the caller still announced success. The admin walked
   * away believing a policy was live in eight companies when it was live in one.
   *
   * Only the columns being changed are written to a subsidiary that had no row.
   * The previous version spread the whole holding row first, so flipping Delete
   * alone handed a subsidiary create, read and update as well.
   */
  const propagateToSubsidiaries = async (
    moduleId: string,
    updates: Record<string, unknown>
  ): Promise<boolean> => {
    if (!selectedRole) return true
    const subsidiaries = companies.filter((c) => c.id !== companyId && !c.isHolding)
    if (subsidiaries.length === 0) return true

    const subsidiaryIds = subsidiaries.map((c) => c.id)

    const { data: existing, error: lookupError } = await supabase
      .from("role_permissions")
      .select("id, company_id")
      .eq("role_id", selectedRole.id)
      .eq("module_id", moduleId)
      .in("company_id", subsidiaryIds)

    if (lookupError) {
      toast.error("Gagal membaca izin anak perusahaan")
      return false
    }

    const covered = new Set((existing ?? []).map((row) => row.company_id as string))
    const existingIds = (existing ?? []).map((row) => row.id as string)
    const missing = subsidiaryIds
      .filter((id) => !covered.has(id))
      .map((id) => ({
        company_id: id,
        role_id: selectedRole.id,
        module_id: moduleId,
        can_create: false,
        can_read: "none",
        can_update: false,
        can_delete: false,
        record_scope: "own",
        ...updates,
      }))

    const [updateResult, insertResult] = await Promise.all([
      existingIds.length > 0
        ? supabase.from("role_permissions").update(updates).in("id", existingIds).select("id")
        : Promise.resolve({ data: [], error: null }),
      missing.length > 0
        ? supabase.from("role_permissions").insert(missing).select("id")
        : Promise.resolve({ data: [], error: null }),
    ])

    const written = (updateResult.data?.length ?? 0) + (insertResult.data?.length ?? 0)
    if (updateResult.error || insertResult.error || written < subsidiaryIds.length) {
      const names = subsidiaries.map((c) => c.name).join(", ")
      setError(
        updateResult.error?.message ??
          insertResult.error?.message ??
          `Hanya ${written} dari ${subsidiaryIds.length} anak perusahaan yang tersimpan.`
      )
      toast.error(`Perubahan tidak sampai ke semua anak perusahaan (${names}). Periksa lagi per perusahaan.`)
      return false
    }

    return true
  }

  /**
   * Set a whole row at once.
   *
   * Fifteen modules times four columns is sixty switches, and almost every real
   * decision is one of three shapes: shut, read-only, or everything. Salesforce,
   * Strapi and Directus all offer the equivalent; without it the admin clicks
   * four times per module and the matrix punishes them for having many modules.
   */
  const applyRowPreset = async (moduleId: string, preset: "none" | "read" | "full") => {
    if (!companyId || !selectedRole || isSuperAdmin || !canManagePermissions) return
    const key = `${moduleId}:${selectedRole.id}:preset`
    setToggling(key)

    // Penuh reaches everything; the other two presets grant no writes, so
    // the scope they leave behind changes nothing and is left as it is.
    const payload = {
      can_create: preset === "full",
      can_read: preset === "none" ? "none" : "company",
      can_update: preset === "full",
      can_delete: preset === "full",
      ...(preset === "full" ? { record_scope: "all" as const } : {}),
    } satisfies Partial<RolePermission>

    const perm = findPerm(moduleId)
    const previous = permissions
    // Move first, reconcile after: a matrix that waits for the server before
    // anything visibly happens reads as a control that ignored the click.
    setPermissions((prev) =>
      perm
        ? prev.map((p) => (p.id === perm.id ? { ...p, ...payload } : p))
        : prev
    )

    const { error } = perm
      ? await supabase.from("role_permissions").update(payload).eq("id", perm.id)
      : await supabase.from("role_permissions").insert({
          company_id: companyId,
          role_id: selectedRole.id,
          module_id: moduleId,
          ...payload,
        })

    if (error) {
      setPermissions(previous)
      setError(error.message)
      toast.error("Gagal menerapkan preset")
      setToggling(null)
      return
    }

    const propagated = isHoldingView && companies.length > 1
      ? await propagateToSubsidiaries(moduleId, payload)
      : true

    if (moduleId === SALES_MISSION_PARENT) {
      await cascadeSalesMissionSubmodules(payload)
    } else if (!perm) {
      await fetchPermissions(false)
    }

    if (propagated) {
      toast.success(
        preset === "none" ? "Modul dimatikan" : preset === "read" ? "Diatur ke lihat saja" : "Akses penuh diberikan"
      )
    }
    setToggling(null)
  }

  /* ─── Helpers ──────────────────────────────────────────────────────────── */
  const getRoleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? "Unknown"
  const getRoleIcon = (roleName: string): React.ElementType => ROLE_ICON_MAP[roleName] ?? Shield

  const openRoleModal = (role: Role | null = null) => {
    setEditingRole(role)
    setRoleModalOpen(true)
  }

  /**
   * Companies a new role's matrix rows are written into.
   *
   * Permission rows are per company, so a role created from the holding view
   * needs a row set in each subsidiary or it would be configurable in one place
   * and blank in the rest.
   */
  const seedCompanyIds = isHoldingView
    ? companies.filter((c) => !c.isHolding).map((c) => c.id)
    : companyId
      ? [companyId]
      : []

  // A new role arrives with a full set of rows, so the matrix has to re-read as
  // well as the sidebar. Silent: the table is already on screen.
  const handleRoleSaved = async () => {
    await fetchRoles()
    await fetchPermissions(false)
  }

  /**
   * Delete a role, and only claim it when a row actually went.
   *
   * The RLS policy on `roles` allows deletion by a global super admin only,
   * while the button is offered to anyone holding permissions.update — a grant
   * handed out from this very matrix. PostgREST reports a policy-filtered
   * delete as 204 with no error, so the old code took `error === null` as proof,
   * dropped the role from the sidebar, and announced success. The role was still
   * there on the next reload, and nothing had told the admin otherwise.
   *
   * Asking for the deleted ids back turns "no error" into "no rows", which is
   * the difference between refused and done.
   */
  const handleDeleteRole = async () => {
    if (!roleToDelete) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from("roles")
      .delete()
      .eq("id", roleToDelete.id)
      .select("id")

    if (error) {
      toast.error(`Gagal menghapus role: ${error.message}`)
    } else if (!data?.length) {
      toast.error("Hanya super admin yang bisa menghapus role. Tidak ada yang dihapus.")
    } else {
      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id))
      if (selectedRole?.id === roleToDelete.id) setSelectedRole(null)
      toast.success(`Role "${roleToDelete.name}" dihapus`)
    }
    setRoleToDelete(null)
  }

  const ungroupedModules = modules.filter(
    (mod) => !GROUPED_MODULE_IDS.has(mod.id) && !RETIRED_MODULE_IDS.has(mod.id)
  )

  const companyName = isHoldingView
    ? companies.find((c) => c.id === companyId)?.name ?? "Semua perusahaan"
    : activeCompany?.name ?? ""

  const renderPermissionRow = (mod: AppModule) => {
    if (!selectedRole) return null
    const display = MODULE_DISPLAY[mod.id]
    const level = display?.level ?? 0
    const perm = findPerm(mod.id)
    // Read is off, which is now a description of the row rather than a lock on
    // it: the write switches stay live and turn Lihat on with them.
    const readOff = !isSuperAdmin && (perm?.can_read ?? 'none') === 'none'
    const label = display?.name ?? mod.name
    const description = display?.description ?? mod.description
    const details = display?.details

    return (
      <tr key={mod.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3">
          <div className={cn("flex items-start gap-2", level > 0 && "pl-6")}>
            {level > 0 && <span className="mt-2.5 h-px w-3 shrink-0 bg-border" />}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium text-foreground">{label}</span>
                {details && (
                  <Tooltip content={details} position="right">
                    <button type="button" aria-label={`Penjelasan ${label}`} className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </Tooltip>
                )}
              </div>
              {description && (
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{description}</div>
              )}
            </div>
          </div>
        </td>
        {/*
          Lihat leads the switches because it is the prerequisite the other
          three depend on. It used to sit second, so an admin scanning left to
          right met Buat first and had no reason to look further right for the
          column that governs it.
        */}
        <td className="text-center px-2 py-3">
          <div className="flex justify-center">
            <Switch
              checked={isSuperAdmin ? true : !readOff}
              disabled={!canManagePermissions || isSuperAdmin || toggling === `${mod.id}:${selectedRole.id}:can_read`}
              // Any non-"none" value behaves the same, so "on" writes the one
              // that already describes the behaviour: what this person's own
              // business units contain.
              onCheckedChange={(next) => handleChangeRead(mod.id, next ? "company" : "none")}
              aria-label={`Lihat ${label}`}
            />
          </div>
        </td>
        <td className="text-center px-2 py-3">
          <div className="flex justify-center">
            <Switch
              checked={isSuperAdmin ? true : (perm?.can_create ?? false)}
              disabled={!canManagePermissions || isSuperAdmin || toggling === `${mod.id}:${selectedRole.id}:can_create`}
              onCheckedChange={() => handleToggleBool(mod.id, "can_create")}
              aria-label={`Buat ${label}`}
            />
          </div>
        </td>
        <td className="text-center px-2 py-3">
          <div className="flex justify-center">
            <Switch
              checked={isSuperAdmin ? true : (perm?.can_update ?? false)}
              disabled={!canManagePermissions || isSuperAdmin || toggling === `${mod.id}:${selectedRole.id}:can_update`}
              onCheckedChange={() => handleToggleBool(mod.id, "can_update")}
              aria-label={`Ubah ${label}`}
            />
          </div>
        </td>
        <td className="text-center px-2 py-3">
          <div className="flex justify-center">
            <Switch
              checked={isSuperAdmin ? true : (perm?.can_delete ?? false)}
              disabled={!canManagePermissions || isSuperAdmin || toggling === `${mod.id}:${selectedRole.id}:can_delete`}
              onCheckedChange={() => handleToggleBool(mod.id, "can_delete")}
              aria-label={`Hapus ${label}`}
            />
          </div>
        </td>
        <td className="px-2 py-3">
          {(() => {
            if (mod.id !== SALES_MISSION_PARENT && !SCOPED_MODULE_IDS.has(mod.id)) {
              return <span className="block text-center text-xs text-muted-foreground" aria-label="Tanpa cakupan">—</span>
            }
            if (isSuperAdmin) {
              return (
                <div className="flex justify-center">
                  <ScopeSegments value="all" disabled label={label} onChange={() => undefined} />
                </div>
              )
            }
            // The parent shows what its scoped children agree on, or nothing.
            let shown: RecordScope | null = (perm?.record_scope as RecordScope | undefined) ?? "own"
            if (mod.id === SALES_MISSION_PARENT) {
              const values = [...SCOPED_MODULE_IDS].map((id) => (findPerm(id)?.record_scope as RecordScope | undefined) ?? "own")
              shown = values.every((v) => v === values[0]) ? values[0] : null
            }
            return (
              <div className="flex flex-col items-center gap-1">
                <ScopeSegments
                  value={shown}
                  disabled={!canManagePermissions || toggling === `${mod.id}:${selectedRole.id}:record_scope`}
                  label={label}
                  onChange={(next) => handleChangeScope(mod.id, next)}
                />
                {shown === null && <span className="text-[11px] text-muted-foreground">Campur di modul bawah</span>}
              </div>
            )
          })()}
        </td>
        <td className="px-2 py-3">
          {/* Row presets live in an overflow menu: secondary actions on a
              list row (M3 list item trailing icon), not three more buttons
              widening every row. */}
          {!isSuperAdmin && canManagePermissions && (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Set cepat ${label}`}
                    disabled={toggling === `${mod.id}:${selectedRole.id}:preset`}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Set cepat</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => applyRowPreset(mod.id, "none")}>Mati: tidak ada akses</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => applyRowPreset(mod.id, "read")}>Lihat saja</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => applyRowPreset(mod.id, "full")}>Penuh: semua kolom, Cakupan Semua</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </td>
      </tr>
    )
  }

  /* ─── Render ───────────────────────────────────────────────────────────── */
  return (
    <PermissionGate resource="permissions" action="read" fallback={
      <div className="p-8 text-center text-muted-foreground">Anda tidak punya izin mengelola izin.</div>
    }>
      <div className="space-y-6 w-full">
        {/* Header */}
        <SettingsPageHeader
          title="Role & Izin"
          subtitle={`Atur matriks kontrol akses per role${companyName ? `: ${companyName}` : ""}`}
          breadcrumbs={[{ label: "Permissions" }]}
          actions={
            isHoldingView ? (
              <Select value={companyId ?? ""} onValueChange={(val) => setSelectedCompanyId(val)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Pilih perusahaan" />
                </SelectTrigger>
                <SelectContent>
                  {companies.filter((c) => c.isHolding).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} · seluruh grup</SelectItem>
                  ))}
                  {companies.filter((c) => !c.isHolding).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : undefined
          }
        />

        <div className="px-6 lg:px-8 pb-6 space-y-6">

        {error && (
          <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {rolesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          // One pane. Two panes (a role list beside the matrix) only fit on a
          // wide screen; on a laptop at a readable zoom the list took a
          // quarter of the width and the matrix fell below its minimum and
          // scrolled sideways. Material's list-detail collapses to a single
          // pane below the expanded width, with the selector on top; HubSpot's
          // Roles and Salesforce's profiles are one role per page the same
          // way. Roles are choice chips: one selected, all visible, wrapping.
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Pilih role">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Role</span>
              {roles.map((role) => {
                const Icon = getRoleIcon(role.name)
                const isActive = selectedRole?.id === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    aria-pressed={isActive}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
                      isActive
                        ? "border-transparent bg-primary/12 text-primary"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    )}
                  >
                    {isActive ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                    {role.name}
                  </button>
                )
              })}
              <Button
                size="sm"
                variant="ghost"
                className="h-9 rounded-full px-3"
                onClick={() => openRoleModal()}
                disabled={!canManagePermissions}
              >
                <Plus className="h-4 w-4" /> Role baru
              </Button>
            </div>

            <div className="min-w-0">
              {selectedRole ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {(() => { const Icon = getRoleIcon(selectedRole.name); return <Icon className="h-5 w-5" /> })()}
                          {selectedRole.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {selectedRole.description || "Tanpa deskripsi"}
                          {selectedRole.parent_id && (
                            <span className="mt-0.5 flex items-center gap-1 text-xs">
                              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" /> Di bawah {getRoleName(selectedRole.parent_id)} dalam hierarki role
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      {isSuperAdmin ? (
                        <div className="flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1.5 text-accent-foreground border border-accent/40 shrink-0">
                          <Lock className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold">Tidak bisa diubah, akses penuh</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => openRoleModal(selectedRole)}
                            disabled={!canManagePermissions}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Ubah
                          </Button>
                          {!selectedRole.is_system && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/40"
                              onClick={() => setRoleToDelete(selectedRole)}
                              disabled={!canManagePermissions}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : modules.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        Belum ada modul. Isi tabel <code>app_modules</code> lebih dulu.
                      </div>
                    ) : (
                      <>
                      {/*
                        This used to offer four read scopes: No access, Own
                        records, Company-wide, Cross-company. Only the first was
                        ever real. `can_read` is read in exactly one place for
                        permission decisions —

                          require-permission.ts: perm.can_read !== 'none'

                        — so the other three behaved identically, and the client
                        helper that returned the scope value had no callers at
                        all. An admin choosing between "Company-wide" and
                        "Cross-company" was making a decision that changed
                        nothing, in a control that looked like a security
                        boundary. One switch, matching what the code does.

                        Which business units a person can see comes from their
                        own assignment, which is why that is what this panel now
                        points at.
                      */}
                      <div className="mb-5 rounded-lg border border-border bg-muted/40">
                        <button
                          type="button"
                          onClick={() => setHelpOpen((open) => !open)}
                          aria-expanded={helpOpen}
                          aria-controls="permissions-guide"
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            Bagaimana akses dibaca
                          </span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            {helpOpen ? "Sembunyikan" : "Lihat panduan"}
                            <ChevronDown className={cn("h-4 w-4 transition-transform", helpOpen && "rotate-180")} aria-hidden="true" />
                          </span>
                        </button>
                        {helpOpen && (
                        <div id="permissions-guide" className="flex flex-col gap-2 px-4 pb-4">
                        <ul className="text-[13px] text-muted-foreground space-y-1.5 ml-6 list-disc">
                          <li><strong className="text-foreground">Lihat menyala:</strong> modul terbuka, sebatas unit bisnis yang menjadi milik orangnya.</li>
                          <li><strong className="text-foreground">Lihat mati:</strong> modul hilang dari sidebar, dan Buat / Ubah / Hapus ikut dimatikan.</li>
                          <li><strong className="text-foreground">Menyalakan Buat, Ubah, atau Hapus</strong> otomatis menyalakan Lihat. Tidak ada peran yang boleh mengubah sesuatu yang tidak bisa dilihatnya.</li>
                          <li>
                            <strong className="text-foreground">Unit bisnis mana</strong> ditentukan dari penugasan tiap orang di{" "}
                            <Link href="/settings/users" className="font-medium text-primary hover:underline">Settings → Users</Link>
                            , bukan dari peran. Dua orang berperan sama di unit berbeda hanya melihat unitnya masing-masing.
                          </li>
                        </ul>
                        <div className="mt-2 flex items-center gap-2 text-foreground font-semibold text-sm">
                          <Info className="w-4 h-4 text-primary shrink-0" />
                          <span>Khusus Sales Mission: Cakupan</span>
                        </div>
                        <ul className="text-[13px] text-muted-foreground space-y-1.5 ml-6 list-disc">
                          <li><strong className="text-foreground">Lihat selalu seluruh unit bisnis.</strong> Mission adalah kalender bersama dan papan tim; Cakupan tidak mempersempit Lihat.</li>
                          <li><strong className="text-foreground">Cakupan membatasi</strong> Ubah, Hapus, dan tindakan pada record: mengisi laporan, mengirim lead, mengelola tim mission, membatalkan, meminta klarifikasi laporan, menugaskan prospek. Buat record baru tidak dibatasi.</li>
                          <li><strong className="text-foreground">Pemilik record:</strong> mission = sales utama dan yang menjadwalkan; laporan kunjungan = sales utama; prospek = pemegangnya (tanpa pemegang = milik semua orang yang punya Ubah).</li>
                          <li>
                            <strong className="text-foreground">Tim</strong> = milik sendiri ditambah milik orang yang kolom <em>Atasan</em>-nya adalah dia, berantai ke bawah. Atasan diatur per orang di{" "}
                            <Link href="/settings/users" className="font-medium text-primary hover:underline">Settings → Users</Link>. Tanpa bawahan, Tim sama dengan Sendiri.
                          </li>
                          <li><strong className="text-foreground">Sales pendukung</strong> bukan pemilik mission, tetapi tetap boleh gabung, keluar, menjawab penugasan, mengusulkan jadwal, dan menulis catatan.</li>
                          <li><strong className="text-foreground">Yang menjadwalkan</strong> tanpa menjadi sales utama boleh mengubah mission-nya, tetapi tidak mengisi laporannya, kecuali Cakupan Laporan kunjungan Tim atau Semua.</li>
                          <li><strong className="text-foreground">Bawaan:</strong> Super Admin, Admin, Executive = Semua; Leader = Tim; Staff dan peran lain = Sendiri.</li>
                        </ul>
                        </div>
                        )}
                      </div>

                      {/*
                        The page is the only scroller. The table used to sit in
                        its own bounded box, which gave the admin a scrollbar
                        inside a scrollbar and a matrix squeezed into a window
                        a third of the screen high. Fixed layout: the module
                        column takes whatever the switches and the Cakupan
                        control leave, so names and their one supporting line
                        sit on a wide column instead of wrapping word by word.
                        Below the table's minimum width it scrolls sideways,
                        never up and down.
                      */}
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full min-w-[760px] table-fixed text-sm">
                          <colgroup>
                            <col />
                            <col className="w-[64px]" />
                            <col className="w-[64px]" />
                            <col className="w-[64px]" />
                            <col className="w-[64px]" />
                            <col className="w-[224px]" />
                            <col className="w-[48px]" />
                          </colgroup>
                          <thead>
                            <tr className="border-b bg-muted">
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modul</th>
                              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lihat</th>
                              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buat</th>
                              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ubah</th>
                              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hapus</th>
                              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cakupan</th>
                              <th className="px-2 py-3" aria-label="Set cepat" />
                            </tr>
                          </thead>
                          <>
                            {MODULE_GROUPS.map((group) => {
                              const groupModules = group.modules
                                .map((id) => modules.find((mod) => mod.id === id))
                                .filter((mod): mod is AppModule => Boolean(mod))

                              if (groupModules.length === 0) return null
                              const expanded = isGroupExpanded(group.title)
                              const isSettings = group.title === "Pengaturan"
                              // Settings keeps its hub row visible when folded,
                              // because that row is what unfolds the rest.
                              const visibleModules = expanded
                                ? groupModules
                                : isSettings
                                  ? groupModules.filter((mod) => mod.id === "settings")
                                  : []
                              const bodyId = `group-${group.title.replace(/\s+/g, "-").toLowerCase()}`

                              return (
                                <tbody key={group.title} id={bodyId}>
                                  <tr className="bg-muted/30 border-b">
                                    <td colSpan={7} className="px-4 py-3">
                                      {/* Every group folds now, so this is always a
                                          real control. Two of the three used to be
                                          focusable buttons that did nothing. */}
                                      <button
                                        type="button"
                                        onClick={() => toggleGroup(group.title)}
                                        aria-expanded={expanded}
                                        aria-controls={bodyId}
                                        className="flex w-full cursor-pointer items-start justify-between gap-3 text-left"
                                      >
                                        <div>
                                          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                            {group.title}
                                          </div>
                                          {/* No opacity modifier: this text is already
                                              at the AA floor, and /80 pushed it under. */}
                                          <div className="mt-0.5 text-xs text-muted-foreground normal-case tracking-normal">
                                            {group.description}
                                            {isSettings && (
                                              <span className="ml-1">
                                                Bagian di dalamnya baru muncul untuk pengguna setelah akses Lihat pada halaman Settings menyala.
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <ChevronRight
                                          className={cn(
                                            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                            expanded && "rotate-90"
                                          )}
                                          aria-hidden="true"
                                        />
                                      </button>
                                    </td>
                                  </tr>
                                  {visibleModules.map((mod) => renderPermissionRow(mod))}
                                </tbody>
                              )
                            })}

                            {/* A module that is neither grouped nor retired is one
                                somebody added to app_modules without giving it a
                                home here. It gets a heading rather than appearing
                                anonymously under the last group, so the gap is
                                visible instead of looking like part of Pengaturan. */}
                            {ungroupedModules.length > 0 && (
                              <tbody>
                                <tr className="bg-muted/30 border-b">
                                  <td colSpan={7} className="px-4 py-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                      Belum dikelompokkan
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground normal-case tracking-normal">
                                      Modul ini terdaftar di <code>app_modules</code> tetapi belum ditempatkan di grup mana pun.
                                    </div>
                                  </td>
                                </tr>
                                {ungroupedModules.map((mod) => renderPermissionRow(mod))}
                              </tbody>
                            )}
                          </>
                        </table>
                      </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                  {roles.length === 0
                    ? "Belum ada role. Buat satu untuk memulai."
                    : "Pilih role untuk mengatur izinnya."}
                </div>
              )}


            </div>
          </div>
        )}
        </div>
      </div>

      {/* Role Upsert Modal */}
      <RoleModal
        open={roleModalOpen}
        onOpenChange={setRoleModalOpen}
        existingRoles={roles}
        editingRole={editingRole}
        companyIds={seedCompanyIds}
        onSaved={handleRoleSaved}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          {/*
            The old copy said the system would reject the delete while users were
            attached. It does not: profiles.role_id is ON DELETE SET NULL and
            role_permissions.role_id is ON DELETE CASCADE, so the delete goes
            through and takes their access with it. "Force Delete" named an
            override that was never in the code. Both now describe what happens.
          */}
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus role {roleToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {roleUserCount === null
                ? "Menghitung pengguna yang memakai role ini…"
                : roleUserCount > 0
                  ? `${roleUserCount} pengguna sedang memakai role ini. Menghapusnya mencabut peran mereka, dan akses mereka jatuh ke pengaturan lama berbasis user_type sampai Anda memberi role baru.`
                  : "Tidak ada pengguna yang memakai role ini."}
              {" "}Seluruh baris izin role ini di semua perusahaan ikut terhapus permanen, dan role turunannya kehilangan induk. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoleToDelete(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={handleDeleteRole}
              disabled={roleUserCount === null}
            >
              Hapus role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGate>
  )
}
