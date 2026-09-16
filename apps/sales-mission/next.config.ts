import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Stamped into the service worker's URL, so each deploy installs a fresh
  // worker that discards the previous build's asset cache.
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
