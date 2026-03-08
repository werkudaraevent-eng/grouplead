"use client"

import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel,
} from "@/components/ui/form"
import { WorkflowActions } from "./workflow-actions"
import { PermissionGate } from "@/components/permission-gate"
import { Lead } from "@/types"
import { CompanyCombobox, ContactCombobox } from "@/components/entity-combobox"
import {
    Save, Trash2, Loader2, CheckCircle2, Circle, AlertTriangle, Clock
} from "lucide-react"

// ============================================================
// ZOD SCHEMA
// ============================================================

const leadFormSchema = z.object({
    project_name: z.string().nullable().optional(),
    client_company_id: z.string().nullable().optional(),
    contact_id: z.string().nullable().optional(),
    bu_revenue: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
