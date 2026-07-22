type BuildStageTransitionAuditEntriesInput = {
    leadId: number
    newStageId: string
    newStageName: string
    previousStageName: string | null
    userId: string | null
    userName: string
    amount: number | null
}

export function buildStageTransitionAuditEntries(input: BuildStageTransitionAuditEntriesInput) {
    const description = input.previousStageName
        ? `${input.userName} moved lead from "${input.previousStageName}" to "${input.newStageName}"`
        : `${input.userName} moved lead to "${input.newStageName}"`

    return {
        stageHistoryEntry: {
            lead_id: input.leadId,
            stage_id: input.newStageId,
            stage_name: input.newStageName,
            user_id: input.userId,
            user_name: input.userName,
            amount: input.amount,
        },
        activityEntry: {
            lead_id: input.leadId,
            user_id: input.userId,
            action_type: "Stage Change",
            description,
        },
    }
}
