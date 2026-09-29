import type { MetadataRoute } from "next";
import { PRODUCT_NAME } from "@/lib/navigation/app-nav";

/**
 * The installable app: what the home screen shows and how the window opens.
 * Twin of Sales Activity's app/manifest.ts, with the same icon family (the
 * tile and grid are shared; LeadEngine's glyph is the funnel). Standalone
 * display hides the browser chrome; the theme colour is the page colour
 * (`--background`), so the status bar reads as part of the page; start_url
 * lands on the dashboard. No orientation lock: the desk-first pages (the
 * Pipeline board, the tables) are better turned sideways on a phone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: "Workflow-driven lead and SLA management system",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F6F8FB",
    theme_color: "#F6F8FB",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
