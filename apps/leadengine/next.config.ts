import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* TypeScript errors are now enforced at build time.
     CI also runs `npm run typecheck` as a separate step. */

  // Since 16.3, `next dev` writes AGENTS.md and CLAUDE.md into the app
  // directory whenever it detects a coding agent. The repo's rules live in
  // the root AGENTS.md only; generated copies here would be committed by the
  // usual `git add -A`.
  agentRules: false,

  // A build id, the same in the bundle and on the server, served by
  // /api/version so an open tab can tell it is older than the server
  // (DeployWatch; DESIGN.md, "Surviving a deploy"). Sales Activity stamps
  // the same variable.
  //
  // `deploymentId` is deliberately not set. Next.js 16.3.6 supports it
  // (`deploymentId` in the config, or NEXT_DEPLOYMENT_ID), but it adds no
  // protection here: without it the RSC payload carries the build id and the
  // router already does a full page load when a navigation answer comes from
  // another build, or is not RSC at all (`fetch-server-response.js`,
  // `doMpaNavigation`). With it, the id only moves to a header, and the one
  // extra thing it does, sending `x-deployment-id` with every request and
  // `?dpl=` on every asset so the platform can route an old tab to its old
  // deployment, is Vercel Skew Protection, which the Hobby plan does not
  // have. A server action from an old tab fails the same way either way;
  // that is what DeployWatch and the form drafts are for.
  env: { NEXT_PUBLIC_BUILD_ID: String(Date.now()) },

  // Defensive cache headers — ensures HTML documents are never stale across
  // hosts (Vercel, self-hosted, proxy, etc). Hashed static bundles under
  // /_next/static/* keep Next.js' default long-cache behavior automatically.
  async headers() {
    return [
      {
        // Match all routes EXCEPT Next.js internals and static assets.
        // The negative lookahead ensures hashed JS/CSS bundles stay cacheable.
        source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
