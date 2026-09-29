import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Since 16.3, `next dev` writes AGENTS.md and CLAUDE.md into the app
  // directory whenever it detects a coding agent. The repo's rules live in
  // the root AGENTS.md only; generated copies here would be committed by the
  // usual `git add -A`.
  agentRules: false,
  // Stamped into the service worker's URL, so each deploy installs a fresh
  // worker that discards the previous build's asset cache, and served by
  // /api/version, so an open tab can tell it is older than the server
  // (DeployWatch; DESIGN.md, "Surviving a deploy").
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
  // The product's URLs say "activities"; the code and the database still say
  // "missions". Old links (bookmarks, notifications, the CRM's deep links)
  // land on the new address with their query intact.
  async redirects() {
    return [
      { source: "/workspace/missions", destination: "/workspace/activities", permanent: true },
      { source: "/workspace/missions/:path*", destination: "/workspace/activities/:path*", permanent: true },
      { source: "/workspace/settings/missions", destination: "/workspace/settings/activities", permanent: true },
      { source: "/workspace/settings/activity", destination: "/workspace/settings/history", permanent: true },
      // Perangkat aktif moved into Pengaturan › Akun beside Profil (DESIGN.md
      // "Settings layout and page width"); the guide and old tabs said this.
      { source: "/workspace/perangkat", destination: "/workspace/settings/devices", permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ]
  },
}

export default nextConfig
