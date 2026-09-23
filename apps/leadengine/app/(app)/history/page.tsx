import { redirect } from "next/navigation"

/** The audit trail moved to Settings → Change history; old links and bookmarks land there. */
export default function HistoryRedirect() {
    redirect("/settings/history")
}
