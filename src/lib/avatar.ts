/**
 * Shared avatar helpers so a given person/name always maps to the SAME
 * initials and color everywhere in the app (sidebar, pickers, kanban, lead
 * header, user management, etc.). Previously each surface had its own palette
 * and hash, so the same user could appear in different colors per page.
 */

// Canonical user-avatar palette (soft tint + readable text).
const AVATAR_COLORS = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-violet-100 text-violet-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
    "bg-orange-100 text-orange-700",
    "bg-pink-100 text-pink-700",
    "bg-indigo-100 text-indigo-700",
    "bg-teal-100 text-teal-700",
]

/** Initials from a full name, e.g. "Kensrie Diah Ayuningtyas" → "KD". */
export function getInitials(name: string | null | undefined): string {
    if (!name) return "?"
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("") || "?"
}

/**
 * Deterministic Tailwind color classes for a name. Same name → same color,
 * stable across renders and across pages (uses a fixed string hash).
 */
export function getAvatarColor(name: string | null | undefined): string {
    const key = name ?? ""
    let hash = 0
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
