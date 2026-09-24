import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LeadEngine - Corporate Lead Management",
  description: "Workflow-driven lead and SLA management system",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
};

// The other app's origin, warmed up at load: DNS and TLS are done before
// the switcher is ever clicked, so the navigation starts from a hot socket.
const salesMissionOrigin = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SALES_MISSION_URL?.trim();
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
})();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The page colour is on the element itself, not only in the stylesheet:
    // the first paint must already be the background, or a switch between
    // apps flashes white before the CSS arrives.
    <html lang="en" suppressHydrationWarning className={`${jakartaSans.variable} ${geistMono.variable} bg-background`} style={{ backgroundColor: "#F6F8FB", colorScheme: "light" }}>
      <head>
        {salesMissionOrigin && (
          <>
            <link rel="dns-prefetch" href={salesMissionOrigin} />
            <link rel="preconnect" href={salesMissionOrigin} />
          </>
        )}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('sidebar-panel-theme') === 'dark') {
              document.documentElement.classList.add('sidebar-dark-mode');
            }
          } catch(e) {}
        ` }} />
        {/* Service Worker kill-switch — defensively unregister any SW that may
            have been installed by a previous deploy, a preview environment, or
            a legacy host (e.g. Netlify PWA preset). Prevents stale UI from
            being served out of SW cache after the site moved hosts. */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations()
              .then(function(regs) { for (var r of regs) { r.unregister(); } })
              .catch(function(){});
            if (window.caches && caches.keys) {
              caches.keys().then(function(keys) {
                for (var k of keys) { caches.delete(k); }
              }).catch(function(){});
            }
          }
        ` }} />
      </head>
      <body className="bg-background font-sans antialiased" suppressHydrationWarning>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg">
          Skip to content
        </a>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
