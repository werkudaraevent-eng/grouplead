import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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
