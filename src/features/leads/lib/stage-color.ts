const STAGE_COLOR_HEX_MAP: Record<string, string> = {
    blue: "#6366f1",
    violet: "#8b5cf6",
    sky: "#0ea5e9",
    emerald: "#10b981",
    amber: "#f59e0b",
    red: "#ef4444",
    pink: "#ec4899",
    orange: "#f97316",
    teal: "#14b8a6",
    slate: "#64748b",
}

function normalizeHex(color: string) {
    const trimmed = color.trim()
    if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
        const [, r, g, b] = trimmed
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
    }

    if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
        return trimmed.toLowerCase()
    }

    return null
}

export function resolveStageColor(color?: string | null, fallback = "#94a3b8") {
    if (!color) return fallback

    const token = color.trim().toLowerCase()
    const mapped = STAGE_COLOR_HEX_MAP[token]
    if (mapped) return mapped

    const normalizedHex = normalizeHex(color)
    if (normalizedHex) return normalizedHex

    return fallback
}

export function toRgba(color: string, alpha: number) {
    const resolved = resolveStageColor(color)
    const hex = resolved.slice(1)
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)

    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

