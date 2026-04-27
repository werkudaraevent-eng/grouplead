"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import type { ActionResult } from "@/types"
import type { CurrencyFormat, CurrencyPrefix } from "@/types/currency"

export async function updateCurrencySettingsAction(
  companyId: string,
  data: { currency_format: CurrencyFormat; currency_prefix: CurrencyPrefix }
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { error } = await supabase
      .from("company_settings")
      .upsert(
        {
          company_id: companyId,
          currency_format: data.currency_format,
          currency_prefix: data.currency_prefix,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      )

    if (error) return { success: false, error: error.message }

    revalidatePath("/", "layout")
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}
