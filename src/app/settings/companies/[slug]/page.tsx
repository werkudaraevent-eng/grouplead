"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import {
    Building2, Globe, Camera, Loader2, Save, Users, ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import type { Company } from "@/types/company"

export default function CompanyDetailPage() {
    const params = useParams()
    const router = useRouter()
    const slug = params.slug as string
    const supabase = createClient()

    const [company, setCompany] = useState<Company | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploadingLogo, setUploadingLogo] = useState(false)

    // Editable fields
    const [name, setName] = useState("")
    const [editSlug, setEditSlug] = useState("")
    const [isHolding, setIsHolding] = useState(false)
    const [logoUrl, setLogoUrl] = useState<string | null>(null)

    const fetchCompany = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("companies")
            .select("*")
            .eq("slug", slug)
            .single()

        if (error || !data) {
            toast.error("Company not found")
            router.push("/settings/companies")
            return
        }
        setCompany(data as Company)
        setName(data.name)
        setEditSlug(data.slug)
        setIsHolding(data.is_holding ?? false)
        setLogoUrl(data.logo_url)
        setLoading(false)
    }, [slug, supabase, router])

    useEffect(() => { fetchCompany() }, [fetchCompany])

    const handleSave = async () => {
        if (!company) return
        setSaving(true)
        const updates: Record<string, unknown> = {}
        if (name.trim() !== company.name) updates.name = name.trim()
        if (editSlug.trim() !== company.slug) updates.slug = editSlug.trim().toLowerCase()
        if (isHolding !== (company.is_holding ?? false)) updates.is_holding = isHolding

        if (Object.keys(updates).length === 0) {
            setSaving(false)
            return
        }

        const { error } = await supabase
            .from("companies")
            .update(updates)
            .eq("id", company.id)

        if (error) {
            toast.error(error.message)
        } else {
            toast.success("Company updated")
            // If slug changed, redirect to new slug
            if (updates.slug && updates.slug !== slug) {
                router.replace(`/settings/companies/${updates.slug}`)
            } else {
                fetchCompany()
            }
        }
        setSaving(false)
    }

    const hasChanges = name.trim() !== (company?.name ?? "") ||
        editSlug.trim().toLowerCase() !== (company?.slug ?? "") ||
        isHolding !== (company?.is_holding ?? false)

    const handleLogoUpload = async (file: File) => {
        if (!company) return
        setUploadingLogo(true)
        const ext = file.name.split(".").pop()
        const path = `${company.id}.${ext}`

        const { error: uploadErr } = await supabase.storage
            .from("company logo")
            .upload(path, file, { upsert: true })

        if (uploadErr) {
            toast.error("Upload failed: " + uploadErr.message)
            setUploadingLogo(false)
            return
        }

        const { data: urlData } = supabase.storage.from("company logo").getPublicUrl(path)
        const publicUrl = urlData.publicUrl + "?t=" + Date.now()

        const { error: updateErr } = await supabase
            .from("companies")
            .update({ logo_url: publicUrl })
            .eq("id", company.id)

        if (updateErr) {
            toast.error("Failed to save logo URL")
        } else {
            setLogoUrl(publicUrl)
            toast.success("Logo updated")
        }
        setUploadingLogo(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!company) return null

    const memberCount = 0 // Could fetch from company_members if needed

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ─── Sticky Header (same as other settings pages) ─── */}
            <SettingsPageHeader
                title={company.name}
                subtitle={`Manage settings for ${company.is_holding ? "holding company" : "subsidiary"} ${company.name}.`}
                breadcrumbs={[{ label: "Companies", href: "/settings/companies" }, { label: company.name }]}
                actions={
                    <Link href={`/settings/users?bu=${encodeURIComponent(company.name)}`}>
                        <Button variant="outline" size="sm" className="h-8 text-[12px]">
                            <Users className="h-3.5 w-3.5 mr-1.5" /> Members
                        </Button>
                    </Link>
                }
            />

            {/* ─── Scrollable content ─── */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[960px] mx-auto px-8 py-6">

                    {/* ─── Hero Card ─── */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-5">
                        {/* Banner gradient */}
                        <div className="h-20 bg-gradient-to-r from-[#02378D] via-[#2069B4] to-[#00A1E9] relative rounded-t-xl">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,.15)_0%,transparent_50%)]" />
                        </div>
                        {/* Hero body — below banner, white background */}
                        <div className="px-6 pb-5 pt-5 flex items-center gap-5 relative">
                            {/* Logo — overlaps banner */}
                            <div className="relative group shrink-0 -mt-14">
                                {logoUrl ? (
                                    <img
                                        src={logoUrl}
                                        alt={company.name}
                                        className="w-[72px] h-[72px] rounded-2xl object-contain border-[3px] border-white bg-white shadow-md"
                                    />
                                ) : (
                                    <div className="w-[72px] h-[72px] rounded-2xl bg-white border-[3px] border-white shadow-md flex items-center justify-center">
                                        <Building2 className="h-7 w-7 text-[#02378D]" />
                                    </div>
                                )}
                                <label className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    {uploadingLogo ? (
                                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                                    ) : (
                                        <Camera className="h-5 w-5 text-white" />
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) handleLogoUpload(file)
                                        }}
                                    />
                                </label>
                            </div>
                            {/* Meta */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2.5 mb-1">
                                    <h1 className="text-[20px] font-bold text-[#292D30] tracking-tight">{company.name}</h1>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#02378D]/10 text-[#02378D]">
                                        {company.is_holding ? "Holding" : "Subsidiary"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-[12px] text-slate-500">
                                    <span className="flex items-center gap-1.5">
                                        <Globe className="h-3 w-3 text-slate-400" />
                                        <code className="bg-slate-100 px-1.5 py-px rounded text-[11px] font-mono font-medium text-[#292D30]">{company.slug}</code>
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <ArrowLeft className="h-3 w-3 text-slate-400 rotate-180" />
                                        Created {new Date(company.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── Settings Card ─── */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            <h3 className="text-[13px] font-semibold text-[#292D30]">Company Settings</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {/* Company Name */}
                            <div className="grid grid-cols-[200px_1fr] gap-8 px-5 py-4 items-center">
                                <div>
                                    <p className="text-[13px] font-semibold text-[#292D30]">Company Name</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Display name across the platform</p>
                                </div>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="h-9 text-[13px] max-w-xs"
                                />
                            </div>

                            {/* Slug */}
                            <div className="grid grid-cols-[200px_1fr] gap-8 px-5 py-4 items-center">
                                <div>
                                    <p className="text-[13px] font-semibold text-[#292D30]">Slug</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">URL-safe identifier for links and exports</p>
                                </div>
                                <Input
                                    value={editSlug}
                                    onChange={(e) => setEditSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))}
                                    className="h-9 text-[13px] max-w-xs font-mono"
                                />
                            </div>

                            {/* Type */}
                            <div className="grid grid-cols-[200px_1fr] gap-8 px-5 py-4 items-center">
                                <div>
                                    <p className="text-[13px] font-semibold text-[#292D30]">Holding Company</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Holding companies have access to all subsidiary data</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Switch
                                        checked={isHolding}
                                        onCheckedChange={setIsHolding}
                                    />
                                    <span className="text-[13px] text-slate-600 font-medium">
                                        {isHolding ? "Holding" : "Subsidiary"}
                                    </span>
                                </div>
                            </div>

                            {/* Created */}
                            <div className="grid grid-cols-[200px_1fr] gap-8 px-5 py-4 items-center">
                                <div>
                                    <p className="text-[13px] font-semibold text-[#292D30]">Created</p>
                                </div>
                                <span className="text-[13px] text-slate-600">
                                    {new Date(company.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                                </span>
                            </div>

                            {/* Save button */}
                            {hasChanges && (
                                <div className="px-5 py-4 flex justify-end">
                                    <Button onClick={handleSave} disabled={saving} size="sm" className="h-9 bg-[#02378D] hover:bg-[#02378D]/90 text-[12px] px-5">
                                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1.5" />Save Changes</>}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

        </div>
    )
}
