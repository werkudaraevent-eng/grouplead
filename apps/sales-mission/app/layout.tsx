import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Sales Mission | Werkudara Group",
  description: "Plan, assign, and complete sales missions.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
