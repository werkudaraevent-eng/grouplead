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
        date: "2026-09-17",
        title: "The drawer keeps destinations",
        items: [
            { type: "improvement", text: "Administration in the sidebar is Settings only. Your profile, the changelog, the light or dark panel and Sign out live behind your name at the foot of the drawer, the same pattern as Sales Activity." },
            { type: "fix", text: "That account menu now takes the panel's own colours: dark when the panel is dark, and closing it leaves no focus ring on your name." },
        ],
    },
    {
        date: "2026-09-16",
        title: "Contacts and Companies, tidied",
        items: [
            { type: "improvement", text: "The Contacts and Companies pages have one toolbar row: a search bar, the filter chips in a row that scrolls sideways instead of wrapping, and Columns, Export and Import as icon buttons. The table no longer moves when filters are added." },
            { type: "fix", text: "'Add filter' now opens the filter's editor instead of applying an empty filter that emptied the table, and it only offers fields that are not already on the row." },
            { type: "improvement", text: "Tables across the app share one look: a lighter header row, taller rows, a clear hover and selection, and the row menu as a small round button at the end of each row. Saved views appear as chips only once you have saved one; the first is saved from the toolbar." },
        ],
    },
    {
        date: "2026-09-16",
        title: "Leads from Sales Activity arrive classified",
        items: [
            { type: "feature", text: "A lead sent from a Sales Activity visit report now carries a Category (HQL, Hot, Warm, Cold) and a Grade lead, chosen from this app's Master Options at the moment of sending. Leads from visits used to arrive with no category." },
            { type: "feature", text: "A company registered from a visit carries its industry (the Sector list). An existing company with no sector is filled in; one that already has a sector is never overwritten." },
            { type: "improvement", text: "Sales Mission is now called Sales Activity. Switching between the two apps shows a short transition screen and keeps the sidebar at the width you left it." },
        ],
    },
    {
        date: "2026-09-15",
        title: "Who may see and change what",
        items: [
            { type: "feature", text: "Role & Permissions gains two reaches per module: what a role can see (View scope) and what it can change (Edit scope), each set to Own, Team, or All. Team follows the Direct manager set on each user." },
            { type: "improvement", text: "The permissions page shows roles as chips above one full-width matrix, so nothing scrolls sideways. The Users dialogs and the business-unit picker follow the same rules." },
        ],
    },
    {
        date: "2026-09-14",
        title: "One design system across both apps",
        items: [
            { type: "improvement", text: "Both apps now draw Material Symbols icons and share one tonal surface ramp for pages, navigation, and cards." },
            { type: "feature", text: "A lead pushed from a visit shows that visit on its timeline; the lead's source is a label again and the visit link has its own column." },
            { type: "fix", text: "Sales Activity follows the business unit chosen in this app's switcher." },
        ],
    },
    {
        date: "2026-09-13",
        title: "Every visited company is one row",
        items: [
            { type: "feature", text: "Every company a rep visits is registered here automatically, matched on its normalised name so 'PT X' and 'X Tbk' are one company, and flagged 'Needs details' until someone completes it. Two companies can be merged from the Companies page." },
        ],
    },
    {
        date: "2026-09-12",
        title: "Editable choices and a security pass",
        items: [
            { type: "feature", text: "Admins can edit the choices on select and multi-select fields in Settings." },
            { type: "fix", text: "The roles matrix works for roles created in the app, not only seeded ones; a goals report counted a segment overlap once per mapping entry." },
        ],
    },
    {
        date: "2026-07-06",
        title: "Interactive dashboard exploration",
        items: [
            {
                type: "feature",
                text: "Dashboard widgets can now be clicked to explore the data behind them. Click a revenue month, pipeline stage, lead source, classification slice, stream slice, or top revenue company to temporarily filter the rest of the dashboard.",
            },
            {
                type: "improvement",
                text: "Temporary chart filters now appear as clear 'Exploring' chips at the top of the dashboard, with quick remove controls so it is always obvious when the dashboard is being narrowed by a widget click.",
            },
            {
                type: "fix",
                text: "Fixed a dashboard filtering conflict where selecting a month from the revenue chart could combine with an unrelated date range and make every widget look empty.",
            },
        ],
    },
    {
        date: "2026-06-26",
        title: "Safer imports and a tidier Recycle Bin",
        items: [
            {
                type: "fix",
                text: "Fixed 'Delete forever' in the Recycle Bin failing with an error when permanently removing a company or contact. Trashed items can now be deleted permanently as expected.",
            },
            {
                type: "feature",
                text: "The Excel import templates (Leads, Companies, Contacts) now include a second 'Dropdown Options' sheet that lists every valid value for each dropdown column — categories, stream types, business purpose, sectors, and more. Copy the values straight from this sheet so nothing gets rejected on upload.",
            },
            {
                type: "feature",
                text: "The Lead import template's options sheet now also lists the valid Business Unit names and PIC Sales names, so leads land in the right unit and get assigned to the right salesperson instead of coming in Unassigned.",
            },
            {
                type: "improvement",
                text: "Re-importing Contacts no longer creates duplicates — if a contact with the same name already exists (matched within the same company when provided), the import updates that record instead of adding a second copy. Company imports already worked this way.",
            },
            {
                type: "improvement",
                text: "The Status column in the lead import template now only offers 'Open' and 'Closed'. A lead's pipeline position is set separately by the Pipeline Stage column, which pulls the real stages from your pipeline.",
            },
            {
                type: "fix",
                text: "Cleaned up the Status options list that was mistakenly showing pipeline stage names (Lead Masuk, Closed Won, etc.). Status is now simply Open or Closed everywhere.",
            },
        ],
    },
    {
        date: "2026-06-25",
        title: "A cleaner Recycle Bin",
        items: [
            {
                type: "improvement",
                text: "The Recycle Bin was redesigned into a cleaner list — switch between Leads, Companies, and Contacts with one click, see a small label on each item showing what it is, and use the Restore or Delete buttons that appear when you point at a row.",
            },
            {
                type: "fix",
                text: "Deleting companies and contacts now always respects your role's permissions and the business unit you have access to.",
            },
        ],
    },
    {
        date: "2026-06-24",
        title: "Recycle Bin, permissions, and maintenance mode",
        items: [
            {
                type: "feature",
                text: "New Recycle Bin: deleted leads, companies, and contacts are no longer gone for good — they move to a Recycle Bin where admins can restore them or let them auto-delete after a set retention period. A scheduled daily cleanup removes anything past that period automatically.",
            },
            {
                type: "improvement",
                text: "Items in the Recycle Bin no longer show up in dropdowns, navigation, or goal configuration. Re-importing a deleted record brings it back automatically.",
            },
            {
                type: "feature",
                text: "Permissions are now fully enforced across Leads, Companies, and Contacts — create, edit, and delete actions respect each role's granted permissions, and buttons or menus are clearly disabled when you don't have access.",
            },
            {
                type: "feature",
                text: "Pipeline stage management and dashboard editing are now controlled by their own permission settings, so only the right people can change them.",
            },
            {
                type: "feature",
                text: "Added a Maintenance Mode: a super admin can put the whole app into a locked maintenance state when needed.",
            },
            {
                type: "improvement",
                text: "The Kanban board is faster and smoother — moving a card feels instant, with less flickering and re-loading.",
            },
            {
                type: "fix",
                text: "Fixed the dashboard KPI cards briefly flashing before your saved layout finished loading.",
            },
        ],
    },
    {
        date: "2026-06-23",
        title: "Company logos and dashboard polish",
        items: [
            {
                type: "feature",
                text: "Uploaded company logos now appear in the Companies list and the company switcher in the sidebar, making it easier to tell business units apart at a glance.",
            },
            {
                type: "improvement",
                text: "The holding view is now labeled 'Werkudara Group', and the dashboard KPI cards got accent and spacing tweaks for a cleaner look.",
            },
            {
                type: "improvement",
                text: "Renamed 'What's New' to 'Changelog' and centered its content so it no longer hugs the left edge.",
            },
            {
                type: "fix",
                text: "The AI assistant panel now stays anchored to the bottom-right corner like a chat widget instead of drifting.",
            },
        ],
    },
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
