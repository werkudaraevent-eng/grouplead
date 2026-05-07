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
        <div className="space-y-0">
            <SettingsPageHeader
                title={company.name}
                subtitle={company.is_holding ? "Holding Company" : "Subsidiary"}
                breadcrumbs={[{ label: "Companies", href: "/settings/companies" }, { label: company.name }]}
            />

            <div className="px-6 lg:px-8 pb-8">
                {/* ─── Logo + Name row ─── */}
                <div className="flex items-center gap-5 py-6 border-b border-slate-100">
                    <div className="relative group shrink-0">
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt={company.name}
                                className="w-16 h-16 rounded-lg object-contain border border-slate-200 bg-white p-1"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                                <Building2 className="h-6 w-6 text-slate-300" />
                            </div>
                        )}
                        <label className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            {uploadingLogo ? (
                                <Loader2 className="h-4 w-4 text-white animate-spin" />
                            ) : (
                                <Camera className="h-4 w-4 text-white" />
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
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="text-[15px] font-semibold border-transparent hover:border-slate-200 focus:border-slate-300 h-9 px-2 max-w-xs bg-transparent"
                            />
                            {name.trim() !== company.name && (
                                <Button onClick={handleSave} disabled={saving} size="sm" className="h-7 text-[11px] bg-[#02378D] hover:bg-[#02378D]/90">
                                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                            <span>{company.is_holding ? "Holding" : "Subsidiary"}</span>
                            <span className="text-slate-200">·</span>
                            <span className="font-mono">{company.slug}</span>
                            <span className="text-slate-200">·</span>
                            <span>Created {new Date(company.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                    </div>
                </div>

                {/* ─── Actions ─── */}
                <div className="py-5">
                    <Link href={`/settings/users?bu=${encodeURIComponent(company.name)}`}>
                        <Button variant="outline" size="sm" className="text-[12px] h-8">
                            <Users className="h-3.5 w-3.5 mr-1.5" /> View Members
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
