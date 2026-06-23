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
        date: "2026-06-22",
        title: "Sign-in polish and accurate sales numbers",
        items: [
            {
                type: "fix",
                text: "Fixed the sign-in page accidentally showing the app sidebar behind the login form. Login, forgot-password, and reset-password pages now display cleanly on their own.",
            },
            {
                type: "fix",
                text: "Fixed the Sales Performance widget splitting a person into two rows after their name was changed — their target and their closed revenue now always stay on a single row. Renaming a user no longer affects their dashboard numbers.",
            },
        ],
    },
    {
        date: "2026-06-19",
        title: "Avatars, tidier cards, and file uploads",
        items: [
            {
                type: "feature",
                text: "Admins can now set a profile photo for any user from the Edit User panel in Settings → Users — hover the photo and upload, no need to ask each person to do it themselves.",
            },
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
    {
        date: "2026-05-31",
        title: "May 2026 — dashboards, smart import, and files",
        items: [
            {
                type: "feature",
                text: "The dashboard was rebuilt with a cleaner, management-friendly look: redesigned KPI cards, a funnel-style pipeline view, and refreshed Sales Performance, Top Revenue, Revenue Chart, and lead breakdown widgets.",
            },
            {
                type: "feature",
                text: "You can now save multiple named dashboard views, each with its own custom widgets — switch between layouts for different reporting needs.",
            },
            {
                type: "feature",
                text: "Introduced Smart Import for bulk-loading leads from spreadsheets: it matches sales rep names automatically, splits multi-city destinations, validates dates, and clearly separates warnings from real errors.",
            },
            {
                type: "feature",
                text: "Leads now have a Files tab — upload, list, download, and delete documents directly on a lead. You can also export a lead as a clean, form-filled PDF.",
            },
            {
                type: "feature",
                text: "Added richer lead filtering: by event start/end date, any day of the event, and Revenue Recognition Month.",
            },
            {
                type: "feature",
                text: "Company detail pages gained logo upload and an Edit button, and user profiles now have a photo, bio, and an activity history page.",
            },
            {
                type: "improvement",
                text: "User management was upgraded with role/status/business-unit filters, deactivate and delete actions, and a smarter holding-company toggle for assigning business units.",
            },
            {
                type: "improvement",
                text: "Applied Werkudara Group brand colors across the whole platform and added a page-loading bar for smoother navigation.",
            },
            {
                type: "fix",
                text: "Sales users no longer see the Settings menu, and access permissions were tightened so each role sees only what it should.",
            },
        ],
    },
    {
        date: "2026-04-30",
        title: "April 2026 — goals, targets, and currency",
        items: [
            {
                type: "feature",
                text: "Redesigned the goal system: you can now set sales targets and a Lead Conversion target, see them on goal cards, and track them on the KPI dashboard.",
            },
            {
                type: "feature",
                text: "Added configurable currency formatting per company, so amounts display the way each business unit expects.",
            },
            {
                type: "feature",
                text: "The dashboard layout is now editable, and won/lost closing dates are tracked on every lead for more accurate reporting.",
            },
            {
                type: "improvement",
                text: "A major dashboard overhaul improved layout, data connections, and overall readability — including consistent widget styling and chart labels that no longer get cut off.",
            },
            {
                type: "fix",
                text: "Fixed fields that showed 'Unspecified' by pulling values from the related company record when the lead itself was blank.",
            },
        ],
    },
    {
        date: "2026-03-31",
        title: "March 2026 — the first LeadEngine release",
        items: [
            {
                type: "feature",
                text: "Launched LeadEngine: a multi-company CRM with secure sign-in, a drag-and-drop Kanban pipeline, analytics, and configurable pipeline stages.",
            },
            {
                type: "feature",
                text: "Built the sales hierarchy and team structure: a users page, edit-user panel, target management, and lead assignment by sales rep.",
            },
            {
                type: "feature",
                text: "Added relational client companies and contacts with cascading dropdowns, so leads link cleanly to the right company and person.",
            },
            {
                type: "feature",
                text: "Admins can now create user accounts directly from within the app.",
            },
        ],
    },
]
