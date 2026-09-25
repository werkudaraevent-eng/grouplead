/**
 * Which pipeline a lead started from somewhere else than the Pipeline page
 * (a contact's or a company's New lead) goes into: the one the person last
 * had open on the Pipeline page, which that page remembers per browser,
 * or else the first active pipeline, the same one the Pipeline page opens
 * on a first visit.
 */

/** The Pipeline page's own memory of the open pipeline (`lead-dashboard.tsx`), per scope. */
export const PIPELINE_STORAGE_PREFIX = "leadengine.activePipeline."

export function readStoredPipelineId(scope = "global"): string | null {
    if (typeof window === "undefined") return null
    try {
        return window.localStorage.getItem(PIPELINE_STORAGE_PREFIX + scope)
    } catch {
        return null
    }
}

/** The remembered pipeline while it is still active, else the first. */
export function pickPipelineId(pipelines: readonly { id: string }[], storedId: string | null): string | null {
    if (storedId && pipelines.some((pipeline) => pipeline.id === storedId)) return storedId
    return pipelines[0]?.id ?? null
}
