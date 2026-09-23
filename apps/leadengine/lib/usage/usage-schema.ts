import { z } from "zod"
import { USAGE_MAX_PENDING } from "./usage-beacon"
import { isUsagePath, USAGE_PATH_MAX } from "./usage-path"

/**
 * What `recordUsage` accepts from the browser: at most one batch of opens
 * (or one heartbeat, views 0), each a path inside the app. The server
 * normalises the path again, so a raw id sent by hand still never lands in
 * a table.
 */
export const usagePathSchema = z.string().max(USAGE_PATH_MAX).refine(isUsagePath, "Path outside the app.")

export const usageVisitsSchema = z
  .array(
    z.object({
      path: usagePathSchema,
      views: z.number().int().min(0).max(USAGE_MAX_PENDING),
    })
  )
  .min(1)
  .max(USAGE_MAX_PENDING)

export type UsageVisitsInput = z.infer<typeof usageVisitsSchema>
