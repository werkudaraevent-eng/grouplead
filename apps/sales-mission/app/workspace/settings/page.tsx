import Link from "next/link"
import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { ChevronRight, ExternalLink } from "@/components/icons"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { visibleSettingsGroups, type SettingsItem } from "@/lib/settings/settings-nav"
import { SETTINGS_ICONS } from "./settings-icons"

/**
 * The settings index is a list of destinations, so it is an M3 list: grouped
 * under subheaders, one two-line item per page (leading icon, headline,
 * supporting text, trailing chevron), read top to bottom. Only pages that
 * exist are listed; what is not built yet is not advertised here.
 *
 * On a phone it is the list Pengaturan opens on. On a desk it is the
 * overview beside the settings menu (the detail pane's "nothing chosen yet"
 * in M3's list-detail, as Google Account's Home is), with each page's
 * supporting line, which the compact menu leaves out. Akun is everyone's; a
 * rep sees only that group, here and in the menu.
 */

const leadEngineUrl = process.env.NEXT_PUBLIC_LEADENGINE_URL?.trim() || null

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  const canOpenSettings = await canPerform(access, "sales_mission_settings", "read")
  const groups = visibleSettingsGroups(canOpenSettings)

  return (
    <WorkspacePage
      introKey={pageIntroKey("settings")}
      title="Pengaturan"
      description={
        canOpenSettings
          ? "Atur akunmu, dan bagaimana aktivitas direncanakan, ditugaskan, dan dikomunikasikan ke tim."
          : "Profilmu dan perangkat tempat akunmu sedang masuk."
      }
    >
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`settings-${group.id}`} className="mt-8 first:mt-2">
          <div className="px-1">
            <h2 id={`settings-${group.id}`} className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {group.label}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
          </div>
          <ul className="mt-3 divide-y overflow-clip rounded-xl border bg-card">
            {group.items.map((item) => (
              <li key={item.href}>
                <SettingRow item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Who may open Sales Activity is not a setting here: the role
          matrix lives in LeadEngine, and the link leaves this app, so it
          carries the external-link mark the rows above do not. */}
      {canOpenSettings && (
        <p className="mt-8 px-1 text-sm text-muted-foreground">
          Siapa boleh membuka Sales Activity dan apa yang boleh dilakukannya diatur di Group Lead, pada Settings → Roles &amp; permissions.
          {leadEngineUrl && (
            <>
              {" "}
              <a
                href={`${leadEngineUrl.replace(/\/$/, "")}/settings/permissions`}
                className="inline-flex min-h-8 items-center gap-1 font-semibold text-primary hover:underline"
              >
                Buka di Group Lead <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </>
          )}
        </p>
      )}
    </WorkspacePage>
  )
}

function SettingRow({ item }: { item: SettingsItem }) {
  const Icon = SETTINGS_ICONS[item.icon]
  return (
    <Link
      href={item.href}
      className="group flex min-h-[72px] items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/60 sm:px-5"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{item.title}</span>
        <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">{item.description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}
