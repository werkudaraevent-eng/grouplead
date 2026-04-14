type DashboardStage = {
    id: string
    name: string
    color: string
    sort_order: number
}

type DashboardLead = {
    pipeline_stage_id?: string | null
    pipeline_stage?: {
        name?: string | null
        color?: string | null
    } | null
}

export function buildDashboardStageSeries(
    stages: DashboardStage[],
    leads: DashboardLead[],
    previousLeads: DashboardLead[] = []
) {
    const countByStageId = new Map<string, number>()
    const previousCountByStageId = new Map<string, number>()
    const fallbackStages: Array<{ id: string; name: string; color: string; sortOrder: number }> = []
    const seenFallbackIds = new Set<string>()
    const totalCurrent = leads.length
    const totalPrevious = previousLeads.length

    for (const lead of leads) {
        if (lead.pipeline_stage_id) {
            countByStageId.set(lead.pipeline_stage_id, (countByStageId.get(lead.pipeline_stage_id) ?? 0) + 1)
        }

        if (!stages.length && lead.pipeline_stage_id && !seenFallbackIds.has(lead.pipeline_stage_id)) {
            fallbackStages.push({
                id: lead.pipeline_stage_id,
                name: lead.pipeline_stage?.name || "Unknown",
                color: lead.pipeline_stage?.color || "#94a3b8",
                sortOrder: fallbackStages.length,
            })
            seenFallbackIds.add(lead.pipeline_stage_id)
        }
    }

    for (const lead of previousLeads) {
        if (lead.pipeline_stage_id) {
            previousCountByStageId.set(lead.pipeline_stage_id, (previousCountByStageId.get(lead.pipeline_stage_id) ?? 0) + 1)
        }
    }

    const withMetrics = (stage: { id: string; name: string; color: string; sortOrder: number }) => {
        const count = countByStageId.get(stage.id) ?? 0
        const previousCount = previousCountByStageId.get(stage.id) ?? 0
        const share = totalCurrent > 0 ? (count / totalCurrent) * 100 : 0
        const previousShare = totalPrevious > 0 ? (previousCount / totalPrevious) * 100 : 0

        return {
            ...stage,
            count,
            previousCount,
            share,
            previousShare,
            shareDelta: share - previousShare,
        }
    }

    if (stages.length > 0) {
        return [...stages]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(stage => withMetrics({
                id: stage.id,
                name: stage.name,
                color: stage.color || "#94a3b8",
                sortOrder: stage.sort_order,
            }))
    }

    return fallbackStages.map(withMetrics)
}
