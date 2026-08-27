import { Bell, Building2, ShieldCheck } from "lucide-react"
import { WorkspacePage } from "@/app/workspace/workspace-page"

const SETTING_CARDS = [
  {
    icon: Building2,
    tone: "bg-primary/10 text-primary",
    title: "Mission defaults",
    description: "Mission types, default travel buffer, business hours, and conflict rules.",
  },
  {
    icon: Bell,
    tone: "bg-[var(--warning)] text-[var(--warning-foreground)]",
    title: "Notifications",
    description: "Assignment reminders and reschedule request alerts.",
  },
  {
    icon: ShieldCheck,
    tone: "bg-[var(--success)] text-[var(--success-foreground)]",
    title: "Access",
    description: "Sales Mission access is managed through LeadEngine permissions.",
  },
]

export default function SettingsPage() {
  return (
    <WorkspacePage
      eyebrow="Sales Mission / Administration"
      title="Settings"
      description="Configure how missions are planned, assigned, and communicated across your team."
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SETTING_CARDS.map((card) => (
          <article key={card.title} className="rounded-xl border bg-card p-5">
            <span className={`grid h-9 w-9 place-items-center rounded-lg ${card.tone}`}>
              <card.icon className="h-[17px] w-[17px]" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-foreground">{card.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
            {/* No control yet — an enabled button that does nothing reads as a
                broken feature rather than an unbuilt one. */}
            <p className="mt-4 inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Belum tersedia
            </p>
          </article>
        ))}
      </section>
    </WorkspacePage>
  )
}
