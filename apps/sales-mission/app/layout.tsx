import type { Metadata } from "next"
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const jakartaSans = Plus_Jakarta_Sans({ variable: "--font-jakarta-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sales Mission | Werkudara Group",
  description: "Plan, assign, and complete sales missions.",
}

// The other app's origin, warmed up at load: DNS and TLS are done before
// the switcher is ever clicked, so the navigation starts from a hot socket.
const leadEngineOrigin = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_LEADENGINE_URL?.trim()
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
})()

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The page colour is on the element itself, not only in the stylesheet:
    // the first paint must already be the background, or a switch between
    // apps flashes white before the CSS arrives.
    <html lang="en" suppressHydrationWarning className="bg-background" style={{ backgroundColor: "#F6F8FB", colorScheme: "light" }}>
      <head>
        {leadEngineOrigin && (
          <>
            <link rel="dns-prefetch" href={leadEngineOrigin} />
            <link rel="preconnect" href={leadEngineOrigin} />
          </>
        )}
        {/* Apply the dark sidebar panel before React hydrates, so switching
            apps does not flash a light panel at someone who chose dark. Uses
            the same storage key as LeadEngine, so the choice carries across. */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('sidebar-panel-theme') === 'dark') {
              document.documentElement.classList.add('sidebar-dark-mode');
            }
          } catch(e) {}
        ` }} />
      </head>
      <body className={`${jakartaSans.variable} ${geistMono.variable} bg-background antialiased`} suppressHydrationWarning>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg">
          Skip to content
        </a>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
