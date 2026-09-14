"use server"

import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { ACTIVE_COMPANY_COOKIE, sharedCookieDomain } from "@/lib/active-company"

/**
 * Switch the business unit this person is working in. The cookie is the same
 * one LeadEngine's switcher writes, set on the shared parent domain, so the
 * CRM follows along on its next load.
 */
export async function switchActiveCompany(slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getSalesMissionAccess()
  if (!access) return { ok: false, error: "Sesi tidak ditemukan." }
  const target = access.companies.find((company) => company.slug === slug)
  if (!target) return { ok: false, error: "Kamu bukan anggota unit bisnis itu." }

  const host = (await headers()).get("host")
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_COMPANY_COOKIE, target.slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    domain: sharedCookieDomain(host, process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN),
  })
  revalidatePath("/", "layout")
  return { ok: true }
}
