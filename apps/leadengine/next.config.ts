import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* TypeScript errors are now enforced at build time.
     CI also runs `npm run typecheck` as a separate step. */

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
