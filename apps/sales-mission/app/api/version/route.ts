import { NextResponse } from "next/server"

/**
 * Which build this deployment runs, for `DeployWatch` in every open tab.
 *
 * The id is the one `next.config.ts` stamps into the bundle, so a tab
 * compares like with like: the code it loaded against the code the server
 * runs now. Rendered per request and never stored anywhere on the way
 * (`no-store`), because a cached answer from the previous deployment is the
 * one thing this route must not give. Outside the session proxy (see the
 * matcher in `proxy.ts`): it says nothing private, and a check every few
 * minutes should not cost a sign-in check each time.
 */
export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  )
}
