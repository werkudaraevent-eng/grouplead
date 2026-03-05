import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { MainLayout } from "@/components/layout/main-layout";
import { getActiveCompany, getUserCompanies } from "@/utils/company";
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
  // Check if we're on the login page — skip MainLayout wrapper
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isLoginPage = pathname.startsWith("/login");

  // Only fetch company data if not on login page
  let initialCompany = null;
  let companies: Awaited<ReturnType<typeof getUserCompanies>> = [];

  if (!isLoginPage) {
    [initialCompany, companies] = await Promise.all([
      getActiveCompany(),
      getUserCompanies(),
    ]);
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {isLoginPage ? (
          children
        ) : (
          <MainLayout initialCompany={initialCompany} companies={companies}>
            {children}
          </MainLayout>
        )}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
