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
        const path = `company-logos/${company.id}.${ext}`

        const { error: uploadErr } = await supabase.storage
            .from("avatars")
            .upload(path, file, { upsert: true })

        if (uploadErr) {
            toast.error("Upload failed: " + uploadErr.message)
            setUploadingLogo(false)
            return
        }

        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path)
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
        <div className="space-y-0">
            <SettingsPageHeader
                title={company.name}
                subtitle={company.is_holding ? "Holding Company" : "Subsidiary"}
                breadcrumbs={[{ label: "Companies", href: "/settings/companies" }, { label: company.name }]}
            />

            <div className="px-6 lg:px-8 pb-8 max-w-3xl">
                {/* ─── Company Identity ─── */}
                <div className="py-6 border-b border-slate-200">
                    <h3 className="text-[13px] font-semibold text-[#292D30] mb-4">Company Identity</h3>
                    <div className="flex items-start gap-6">
                        {/* Logo */}
                        <div className="relative group shrink-0">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={company.name}
                                    className="w-20 h-20 rounded-xl object-contain border border-slate-200 bg-white p-1.5"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                                    <Building2 className="h-8 w-8 text-slate-300" />
                                </div>
                            )}
                            <label className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
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

                        {/* Info */}
                        <div className="flex-1 space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-slate-400">Company Name</Label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="max-w-sm"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-slate-400">Slug</Label>
                                    <Input value={company.slug} disabled className="bg-muted/50 text-muted-foreground cursor-not-allowed" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-slate-400">Type</Label>
                                    <Input value={company.is_holding ? "Holding" : "Subsidiary"} disabled className="bg-muted/50 text-muted-foreground cursor-not-allowed" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <Button onClick={handleSave} disabled={saving || name.trim() === company.name} size="sm">
                                    {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                                    Save Changes
                                </Button>
                                <Link href={`/settings/users?bu=${encodeURIComponent(company.name)}`}>
                                    <Button variant="outline" size="sm">
                                        <Users className="h-3.5 w-3.5 mr-1.5" /> View Members
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Quick Info ─── */}
                <div className="py-6">
                    <h3 className="text-[13px] font-semibold text-[#292D30] mb-3">Details</h3>
                    <div className="grid grid-cols-2 gap-y-3 text-[12px]">
                        <div>
                            <span className="text-slate-400">Created</span>
                            <p className="font-medium text-[#292D30] mt-0.5">
                                {new Date(company.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                        </div>
                        <div>
                            <span className="text-slate-400">Company ID</span>
                            <p className="font-mono font-medium text-slate-500 mt-0.5 text-[11px]">{company.id}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
