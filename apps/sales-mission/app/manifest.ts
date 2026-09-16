import type { MetadataRoute } from "next"
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand"

/**
 * The installable app: what the home screen shows and how the window opens.
 * Standalone display hides the browser chrome; the theme colour tints the
 * status bar; start_url lands on Hari ini.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: PRODUCT_TAGLINE,
    start_url: "/workspace",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F8FB",
    theme_color: "#F6F8FB",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
