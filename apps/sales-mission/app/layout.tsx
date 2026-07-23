import type { Metadata } from "next"
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google"
import "./globals.css"

const jakartaSans = Plus_Jakarta_Sans({ variable: "--font-jakarta-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sales Mission | Werkudara Group",
  description: "Plan, assign, and complete sales missions.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${jakartaSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  )
}
