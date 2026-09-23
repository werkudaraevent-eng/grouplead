import { cookies } from "next/headers"
import type { ListKey } from "./list-plan"
import { resolveRememberedView, VIEW_COOKIES } from "./view-cookies"

/**
 * Server side of the remembered view: where a bare open of the list should
 * go, read from the list's cookie (see view-cookies.ts).
 */
export async function rememberedView(
    list: ListKey,
    params: Record<string, string | string[] | undefined>,
): Promise<{ redirectTo: string | null; fresh: boolean }> {
    const store = await cookies()
    return resolveRememberedView(list, params, store.get(VIEW_COOKIES[list])?.value)
}
