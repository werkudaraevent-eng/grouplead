/**
 * Changelog entries — curated, plain-language release notes for the app.
 *
 * This is the SINGLE source of truth for the /changelog page. Add a new
 * entry at the TOP of the array for each release. Keep the language simple
 * and non-technical so any team member (sales, ops, management) understands
 * what changed and why it matters to them.
 *
 * Guidelines for writing entries:
 *   • date     — ISO date string (YYYY-MM-DD)
 *   • title    — short headline for the release
 *   • items[]  — each change, tagged by type and written in plain language
 *       - type "feature"     → ✨ something new you can now do
 *       - type "improvement" → 💅 something that got nicer / easier
 *       - type "fix"         → 🛠 something broken that now works
 */

export type ChangeType = "feature" | "improvement" | "fix"

export interface ChangelogItem {
    type: ChangeType
    text: string
}

export interface ChangelogEntry {
    date: string
    title: string
    items: ChangelogItem[]
}

export const CHANGE_TYPE_META: Record<
    ChangeType,
    { label: string; emoji: string; className: string }
> = {
    feature: {
        label: "New",
        emoji: "✨",
        className: "bg-blue-50 text-blue-700 border-blue-100",
    },
    improvement: {
        label: "Improved",
        emoji: "💅",
        className: "bg-violet-50 text-violet-700 border-violet-100",
    },
    fix: {
        label: "Fixed",
        emoji: "🛠",
        className: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
}

export const CHANGELOG: ChangelogEntry[] = [
    {
        date: "2026-06-19",
        title: "Avatars, tidier cards, and file uploads",
        items: [
            {
                type: "fix",
                text: "Fixed the city search dropdown that was sometimes returning errors. City lookups are now powered by Google Places for faster, more reliable results, with the previous provider kept as a backup.",
            },
            {
                type: "feature",
                text: "For security, each account can now only be signed in on one device at a time. Signing in somewhere new automatically signs you out of the previous session.",
            },
            {
                type: "feature",
                text: "You can now show or hide your password with the eye icon on the sign-in, password reset, and Change Password screens — handy for double-checking what you typed.",
            },
            {
                type: "feature",
                text: "Company and Contact detail pages now have a fully working Files tab — you can upload contracts, proposals, business cards, or any other documents directly via drag & drop or the upload button, then download or delete them anytime.",
            },
            {
                type: "improvement",
                text: "Owners are now shown with their profile photo on the Company & Contact detail pages, in dropdown menus, and in tables. If there's no photo yet, a colored initials avatar is shown instead.",
            },
            {
                type: "improvement",
                text: "The Sales Performance widget now shows each rep's avatar, making it easier to recognise who's on the leaderboard.",
            },
            {
                type: "improvement",
                text: "The Top Revenue Generators widget was polished: ranks 1–3 get medal badges (gold/silver/bronze) and the bar colors were simplified for easier reading.",
            },
            {
                type: "improvement",
                text: "Summary cards on the Company & Contact detail pages were tidied up and now include a 'Won Value' metric (total value of won deals).",
            },
            {
                type: "fix",
                text: "Fixed the 'Sector' grouping in the Lead Classification widget that always showed 'Unspecified' — the sector is now correctly pulled from the client company's data.",
            },
            {
                type: "improvement",
                text: "Loosened the spacing of the text at the top of the dashboard so it feels less cramped and is more comfortable to read.",
            },
        ],
    },
    {
        date: "2026-06-18",
        title: "Clearer pipeline stages on the lead page",
        items: [
            {
                type: "improvement",
                text: "The stage tracker on the lead detail page is now clearly labeled: every stage shows its name, and it's obvious which stages are completed, in progress, or upcoming. Moving a lead between stages is much easier.",
            },
            {
                type: "fix",
                text: "Fixed the stage tracker flickering (showing and hiding rapidly) while scrolling on the lead detail page.",
            },
        ],
    },
]
