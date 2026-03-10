'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
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

  // Auto-generate slug from name (only in create mode)
  const nameValue = form.watch('name')
  useEffect(() => {
    if (!isEdit) {
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

    let error
    if (isEdit && company) {
      const result = await supabase
        .from('companies')
        .update(payload)
        .eq('id', company.id)
      error = result.error
    } else {
      const result = await supabase
        .from('companies')
        .insert(payload)
      error = result.error
    }

    if (error) {
      form.setError('root', { message: error.message })
      return
    }

    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Company' : 'Add Company'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Update details for ${company?.name}.` : 'Create a new company in the system.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Werkudara Nusantara" {...field} />
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
                    <Input placeholder="werkudara-nusantara" {...field} />
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
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_holding"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border p-3">
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

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Create Company'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
