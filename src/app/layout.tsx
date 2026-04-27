import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { MainLayout } from "@/components/layout/main-layout";
import { getActiveCompany, getUserCompanies } from "@/utils/company";
import { createClient } from "@/utils/supabase/server";
import type { CurrencySettings } from "@/types/currency";
import { DEFAULT_CURRENCY_SETTINGS } from "@/types/currency";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LeadEngine - Corporate Lead Management",
  description: "Workflow-driven lead and SLA management system",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isLoginPage = pathname.startsWith("/login");

  let initialCompany = null;
  let companies: Awaited<ReturnType<typeof getUserCompanies>> = [];
  let currencySettings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS;

  if (!isLoginPage) {
    try {
      [initialCompany, companies] = await Promise.all([
        getActiveCompany(),
        getUserCompanies(),
      ]);

      // Load currency settings for the active company
      if (initialCompany?.id) {
        const supabase = await createClient();
        const { data } = await supabase
          .from("company_settings")
          .select("currency_format, currency_prefix")
          .eq("company_id", initialCompany.id)
          .maybeSingle();
        if (data) {
          currencySettings = {
            currency_format: data.currency_format as CurrencySettings["currency_format"],
            currency_prefix: data.currency_prefix as CurrencySettings["currency_prefix"],
          };
        }
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
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        {isLoginPage ? children : (
          <MainLayout initialCompany={initialCompany} companies={companies} currencySettings={currencySettings}>
            {children}
          </MainLayout>
        )}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
