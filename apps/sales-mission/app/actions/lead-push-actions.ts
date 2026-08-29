"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMission, getMissionRole, getVisitReport } from "@/lib/missions/mission-queries"
import { canPushLead } from "@/lib/missions/visit-report-schema"
import {
  LeadEngineError,
  createLead,
  fetchCompanyContext,
  fetchPipelines,
  type ClientCompanyContext,
  type LeadEnginePipeline,
} from "@/lib/leadengine/client"
import type { ActionResult } from "@/types/action-result"

/**
 * Sending a mission's opportunity to LeadEngine as a lead.
 *
 * The gate is deliberately narrow. A pipeline filled with every conversation
 * that happened is worse than one that misses a few: conversion rates collapse
 * artificially and the forecast stops being usable. So a push requires a
 * submitted report that explicitly claims an opportunity, plus a project name
 * and a next action typed by a human.
 */

const pushLeadSchema = z.object({
  projectName: z.string().trim().min(1, "Nama proyek wajib diisi").max(300),
  pipelineId: z.string().uuid("Pilih pipeline tujuan"),
  pipelineStageId: z.string().uuid().nullish(),
  ownerUserId: z.string().uuid("Pilih pemilik lead"),
  estimatedValue: z.number().nonnegative().nullish(),
  remark: z.string().trim().max(4000).optional().or(z.literal("")),
  clientCompanyId: z.string().uuid().nullish(),
})

export interface PushPrecheck {
  eligible: boolean
  reason?: string
  alreadyPushed: { leadId: string } | null
  pipelines: LeadEnginePipeline[]
  companyContext: ClientCompanyContext | null
  /** Owner the modal preselects — the CRM's current holder when there is one. */
  suggestedOwnerId: string | null
  suggestedOwnerName: string | null
  integrationError: string | null
}

/**
 * Everything the modal needs before it opens.
 *
 * Loaded server-side in one call so a rep on a weak connection sees a complete
 * form or a clear reason, never a form that fills in halfway.
 */
export async function getPushPrecheck(missionId: string): Promise<PushPrecheck> {
  const empty: PushPrecheck = {
    eligible: false,
    alreadyPushed: null,
    pipelines: [],
    companyContext: null,
    suggestedOwnerId: null,
    suggestedOwnerName: null,
    integrationError: null,
  }

  const access = await getSalesMissionAccess()
  if (!access) return { ...empty, reason: "Anda tidak punya akses Sales Mission." }

  const [mission, report] = await Promise.all([
    getMission(access, missionId),
    getVisitReport(access, missionId),
  ])

  if (!mission) return { ...empty, reason: "Mission tidak ditemukan." }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .schema("sales_mission")
    .from("lead_pushes")
    .select("lead_engine_lead_id")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()

  if (existing) {
    return { ...empty, alreadyPushed: { leadId: existing.lead_engine_lead_id as string } }
  }

  if (!report || !canPushLead(report)) {
    return {
      ...empty,
      reason: report
        ? "Laporan harus dikirim dan menandai adanya peluang sebelum bisa dikirim ke LeadEngine."
        : "Isi dan kirim laporan kunjungan lebih dulu.",
    }
  }

  // A network failure here must not look like ineligibility — the rep would
  // think the mission is the problem.
  try {
    const pipelines = await fetchPipelines()
    const companyContext = mission.clientCompanyId
      ? await fetchCompanyContext(mission.clientCompanyId)
      : null

    return {
      eligible: true,
      alreadyPushed: null,
      pipelines,
      companyContext,
      suggestedOwnerId: companyContext?.currentOwner?.userId ?? access.userId,
      suggestedOwnerName: companyContext?.currentOwner?.name ?? access.displayName,
      integrationError: null,
    }
  } catch (error) {
    const message = error instanceof LeadEngineError ? error.message : "LeadEngine tidak dapat dihubungi."
    return { ...empty, eligible: false, integrationError: message }
  }
}

/** Create the lead and record that this mission has been pushed. */
export async function pushMissionToLeadEngine(
  missionId: string,
  input: unknown
): Promise<ActionResult<{ leadId: string }>> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }

  const role = await getMissionRole(access, missionId)
  if (role !== "PRIMARY" && !access.isSuperAdmin) {
    return { success: false, error: "Hanya sales utama yang bisa mengirim lead dari mission ini." }
  }

  if (!(await canPerform(access, "sales_mission_result", "create"))) {
    return { success: false, error: "Anda tidak punya izin mengirim lead." }
  }

  const parsed = pushLeadSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Data lead tidak valid." }
  }

  const [mission, report] = await Promise.all([
    getMission(access, missionId),
    getVisitReport(access, missionId),
  ])

  if (!mission) return { success: false, error: "Mission tidak ditemukan." }
  if (!report || !canPushLead(report)) {
    return { success: false, error: "Laporan belum memenuhi syarat untuk dikirim ke LeadEngine." }
  }

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  // Re-checked server-side. The button hides after a push, but a stale tab or a
  // double tap on a slow connection would still get here.
  const { data: existing } = await schema
    .from("lead_pushes")
    .select("lead_engine_lead_id")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()

  if (existing) {
    return { success: false, error: "Mission ini sudah pernah dikirim ke LeadEngine." }
  }

  let leadId: string
  try {
    const created = await createLead({
      clientCompanyId: parsed.data.clientCompanyId ?? mission.clientCompanyId ?? null,
      clientCompanyName: mission.clientCompanyName,
      projectName: parsed.data.projectName,
      pipelineId: parsed.data.pipelineId,
      pipelineStageId: parsed.data.pipelineStageId ?? null,
      ownerUserId: parsed.data.ownerUserId,
      estimatedValue: parsed.data.estimatedValue ?? report.estimatedValue ?? null,
      remark: parsed.data.remark?.trim() || report.meetingSummary || null,
      source: `Sales Mission · ${missionId}`,
    })
    leadId = created.id
  } catch (error) {
    return {
      success: false,
      error: error instanceof LeadEngineError ? error.message : "Lead gagal dibuat di LeadEngine.",
    }
  }

  const { error: recordError } = await schema.from("lead_pushes").insert({
    mission_id: missionId,
    company_id: access.companyId,
    lead_engine_lead_id: leadId,
    pipeline_id: parsed.data.pipelineId,
    pipeline_stage_id: parsed.data.pipelineStageId ?? null,
    owner_user_id: parsed.data.ownerUserId,
    pushed_by: access.userId,
    idempotency_key: missionId,
  })

  if (recordError) {
    // The lead exists in LeadEngine but the local record failed. Say so plainly
    // rather than reporting a failure that would invite a duplicate push.
    return {
      success: false,
      error: `Lead ${leadId} sudah dibuat di LeadEngine, tetapi pencatatannya di Sales Mission gagal. Jangan kirim ulang — laporkan ke admin.`,
    }
  }

  revalidatePath(`/workspace/missions/${missionId}`)
  return { success: true, data: { leadId } }
}
