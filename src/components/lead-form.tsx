"use client"

import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { useCompany } from "@/contexts/company-context"

interface LeadFormProps {
    onSuccess?: () => void
}

export function LeadForm({ onSuccess }: LeadFormProps) {
    const form = useForm()
    const { activeCompany } = useCompany()

    // Form logic temporarily disabled pending full refactor for new 60-column schema.
    // company_id will be set from activeCompany.id on submit.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onSubmit(_values: any) {
        if (!activeCompany) {
            alert("No active company selected.")
            return
        }
        // TODO: include company_id: activeCompany.id in the insert payload
        alert("Form is under maintenance for the new schema update.")
        onSuccess?.()
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="p-4 border rounded bg-muted text-center">
                    The Lead Form is being updated to support the new 60-column schema.
                    <br />
                    Please use the data grid and bulk import for now.
                </div>
                <Button type="submit" disabled>Submit Lead (Coming Soon)</Button>
            </form>
        </Form>
    )
}
