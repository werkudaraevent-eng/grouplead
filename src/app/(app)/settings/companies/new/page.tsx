"use client"

import { useRouter } from "next/navigation"
import { CompanyForm } from "@/features/companies/components/company-form"

export default function NewCompanyPage() {
    const router = useRouter()

    return (
        <CompanyForm
            open={true}
            onOpenChange={(open) => {
                if (!open) router.push("/settings/companies")
            }}
            onSuccess={() => {
                router.push("/settings/companies")
                router.refresh()
            }}
        />
    )
}
