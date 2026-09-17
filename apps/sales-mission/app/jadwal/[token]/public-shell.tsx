import { PRODUCT_NAME } from "@/lib/brand"

/**
 * The frame around a page nobody signed in to reach.
 *
 * Deliberately not the workspace shell: there is no navigation, no account, and
 * nothing to do here, so a sidebar and an avatar would promise a product the
 * visitor cannot use. What is left is what a shared page needs — whose schedule
 * this is, and which link they are holding.
 */
export function PublicShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="shrink-0 border-b bg-card px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-screen-2xl items-baseline gap-2">
          <p className="text-sm font-semibold text-foreground">{PRODUCT_NAME}</p>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <h1 className="text-sm text-muted-foreground">Jadwal tim</h1>
          <p className="ml-auto truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col p-4 sm:p-6 lg:min-h-0">{children}</main>
    </div>
  )
}

export function PublicRefusal({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div>
        <p className="text-sm text-muted-foreground">{PRODUCT_NAME}</p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">{body}</p>
      </div>
    </main>
  )
}
