'use client'

import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Company } from '@/types/company'

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  is_holding: z.boolean(),
  logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

type CompanyFormValues = z.infer<typeof companySchema>

interface CompanyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company?: Company
  onSuccess: () => void
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function CompanyForm({ open, onOpenChange, company, onSuccess }: CompanyFormProps) {
  const isEdit = !!company

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name ?? '',
      slug: company?.slug ?? '',
      is_holding: company?.is_holding ?? false,
      logo_url: company?.logo_url ?? '',
    },
  })

  // Reset form when company prop changes
  useEffect(() => {
    form.reset({
      name: company?.name ?? '',
      slug: company?.slug ?? '',
      is_holding: company?.is_holding ?? false,
      logo_url: company?.logo_url ?? '',
    })
  }, [company, form])

  // Auto-generate slug from name (only in create mode, only if user hasn't manually edited slug)
  const nameValue = form.watch('name')
  const slugTouched = useRef(false)
  const slugValue = form.watch('slug')

  // Detect manual slug edits
  useEffect(() => {
    if (!isEdit && slugValue !== slugify(nameValue)) {
      slugTouched.current = true
    }
  }, [slugValue]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isEdit && !slugTouched.current) {
      form.setValue('slug', slugify(nameValue), { shouldValidate: false })
    }
  }, [nameValue, isEdit, form])

  const onSubmit = async (values: CompanyFormValues) => {
    const supabase = createClient()
    const payload = {
      name: values.name,
      slug: values.slug,
      is_holding: values.is_holding,
      logo_url: values.logo_url || null,
    }

    if (isEdit && company) {
      const { error } = await supabase
        .from('companies')
        .update(payload)
        .eq('id', company.id)

      if (error) {
        console.error('Company update error:', error.message)
        toast.error(error.message || 'Failed to update company')
        form.setError('root', { message: error.message })
        return
      }

      toast.success('Company updated successfully')
    } else {
      // Step 1: Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be logged in to create a company')
        return
      }

      // Step 2: Generate ID client-side to avoid SELECT RLS after insert
      const companyId = crypto.randomUUID()

      const { error: insertError } = await supabase
        .from('companies')
        .insert({ id: companyId, ...payload })

      if (insertError) {
        console.error('Company insert error:', insertError.message)
        toast.error(insertError.message || 'Failed to create company')
        form.setError('root', { message: insertError.message })
        return
      }

      // Step 3: Add creator as admin member (uses known companyId)
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          company_id: companyId,
          user_id: user.id,
          user_type: 'admin',
        })

      if (memberError) {
        console.error('CRITICAL: Company created but member insert failed:', memberError.message)
        toast.error('Company created but failed to add you as admin. Contact support.')
      }

      toast.success('Company created successfully')
    }

    onOpenChange(false)
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-lg p-0 flex flex-col bg-slate-50 border-l border-slate-200"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* ── HEADER ──────────────────────── */}
        <SheetHeader className="px-6 py-4 bg-white border-b border-slate-200">
          <SheetTitle>{isEdit ? 'Edit Company' : 'Add Company'}</SheetTitle>
          <SheetDescription className="text-xs mt-0.5">
            {isEdit ? `Update details for ${company?.name}.` : 'Create a new company in the system.'}
          </SheetDescription>
        </SheetHeader>

        {/* ── FORM BODY ────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">
          <Form {...form}>
            <form id="company-bu-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">

              {/* Section: Identity */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Identity</h4>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Werkudara Nusantara" className="placeholder:text-slate-400" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input placeholder="werkudara-nusantara" className="placeholder:text-slate-400 font-mono text-sm" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Used in URLs. Auto-generated from name.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="logo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." className="placeholder:text-slate-400" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Section: Configuration */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Configuration</h4>
                <FormField
                  control={form.control}
                  name="is_holding"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="cursor-pointer">Holding Company</FormLabel>
                        <FormDescription className="text-xs">
                          Holding companies have access to all subsidiary data.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {form.formState.errors.root && (
                <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
              )}
            </form>
          </Form>
        </div>

        {/* ── FOOTER ──────────────────────── */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="company-bu-form"
            disabled={form.formState.isSubmitting}
            className="bg-slate-900 hover:bg-slate-800 text-white"
          >
            {form.formState.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Company'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
