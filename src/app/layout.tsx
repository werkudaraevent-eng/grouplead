import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { MainLayout } from "@/components/layout/main-layout";
import { getActiveCompany, getUserCompanies } from "@/utils/company";
import { createClient } from "@/utils/supabase/server";
import type { CurrencySettings } from "@/types/currency";
import { DEFAULT_CURRENCY_SETTINGS } from "@/types/currency";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  // Public auth pages render standalone (no sidebar/app shell) and skip the
  // authenticated data fetch below.
  const isAuthPage = ["/login", "/forgot-password", "/reset-password"].some(
    (p) => pathname.startsWith(p)
  );
  // Print routes render a standalone printable document — skip the app shell
  const isPrintPage = /^\/leads\/[^/]+\/print/.test(pathname);
  const standalone = isAuthPage || isPrintPage;

  let initialCompany = null;
  let companies: Awaited<ReturnType<typeof getUserCompanies>> = [];
  let currencySettings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS;
  let userProfile: { full_name: string | null; role: string | null; avatar_url: string | null } | null = null;

  if (!isAuthPage) {
    try {
      const supabase = await createClient();
      const [activeResult, companiesResult, authResult] = await Promise.all([
        getActiveCompany(),
        getUserCompanies(),
        supabase.auth.getUser(),
      ]);
      initialCompany = activeResult;
      companies = companiesResult;

      // Fetch profile + currency settings in parallel (both depend on prior results)
      const userId = authResult.data?.user?.id;
      const [profileResult, settingsResult] = await Promise.all([
        userId
          ? supabase.from("profiles").select("full_name, role, avatar_url").eq("id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
        initialCompany?.id
          ? supabase.from("company_settings").select("currency_format, currency_prefix").eq("company_id", initialCompany.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (profileResult.data) {
        userProfile = profileResult.data as NonNullable<typeof userProfile>;
      }
      if (settingsResult.data) {
        const data = settingsResult.data;
        currencySettings = {
          currency_format: data.currency_format as CurrencySettings["currency_format"],
          currency_prefix: data.currency_prefix as CurrencySettings["currency_prefix"],
        };
      }
    } catch (err) {
      console.warn("[RootLayout] Failed to load company context:", err);
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
      <body className={`${jakartaSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg">
          Skip to content
        </a>
        {standalone ? children : (
          <MainLayout initialCompany={initialCompany} companies={companies} currencySettings={currencySettings} userProfile={userProfile}>
            {children}
          </MainLayout>
        )}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
