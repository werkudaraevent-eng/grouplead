"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
        setLogoUrl(data.logo_url)
        setLoading(false)
    }, [slug, supabase, router])

    useEffect(() => { fetchCompany() }, [fetchCompany])

    const handleSave = async () => {
        if (!company) return
        setSaving(true)
        const { error } = await supabase
            .from("companies")
            .update({ name: name.trim() })
            .eq("id", company.id)

        if (error) toast.error(error.message)
        else toast.success("Company updated")
        setSaving(false)
    }

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
                        <div className="h-20 bg-gradient-to-r from-[#02378D] via-[#2069B4] to-[#00A1E9] relative">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,.15)_0%,transparent_50%)]" />
                        </div>
                        {/* Hero body */}
                        <div className="px-6 pb-5 flex items-end gap-5 -mt-8 relative z-10">
                            {/* Logo */}
                            <div className="relative group shrink-0">
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
                            <div className="flex-1 min-w-0 pb-1">
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
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-9 text-[13px] max-w-xs"
                                    />
                                    {name.trim() !== company.name && (
                                        <Button onClick={handleSave} disabled={saving} size="sm" className="h-9 bg-[#02378D] hover:bg-[#02378D]/90 text-[12px] px-4">
                                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1.5" />Save</>}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Slug */}
                            <div className="grid grid-cols-[200px_1fr] gap-8 px-5 py-4 items-center">
                                <div>
                                    <p className="text-[13px] font-semibold text-[#292D30]">Slug</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">URL-safe identifier for links and exports</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <code className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-[12px] font-mono text-slate-600">
                                        {company.slug}
                                    </code>
                                </div>
                            </div>

                            {/* Type */}
                            <div className="grid grid-cols-[200px_1fr] gap-8 px-5 py-4 items-center">
                                <div>
                                    <p className="text-[13px] font-semibold text-[#292D30]">Type</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Company classification in the hierarchy</p>
                                </div>
                                <span className="text-[13px] text-slate-600 font-medium">
                                    {company.is_holding ? "Holding Company" : "Subsidiary"}
                                </span>
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
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
