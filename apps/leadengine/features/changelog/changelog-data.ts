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

/**
 * A release worth a dialog. Written with the feature, like the entry; an
 * admin decides in Settings → Announcements whether it shows. The dialog
 * ("What's new in LeadEngine") appears once per person on the dashboard.
 */
export interface Announcement {
    /**
     * Stable slug (`^[a-z0-9][a-z0-9_-]{0,59}$`, 40 characters at most so the
     * person's seen mark `announce-<key>-<stamp>` still fits): the settings
     * row and the seen marks hang off it, so never rename it.
     */
    key: string
    title: string
    /** One sentence, for the people who use the feature. */
    body: string
    /** Where "Try it now" goes. */
    href?: string
    hrefLabel?: string
    /** Off until an admin switches it on; for a change that is not everyone's business. Defaults to on. */
    defaultOn?: boolean
}

export interface ChangelogEntry {
    date: string
    title: string
    items: ChangelogItem[]
    /** Makes the release announceable (Settings → Announcements). */
    announcement?: Announcement
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
        date: "2026-09-23",
        title: "Calmer tables on Contacts and Companies",
        items: [
            { type: "improvement", text: "Table headers are written normally (\"Contact name\") in the same size as the rows, instead of small spaced-out capitals that looked like a different font." },
            { type: "improvement", text: "The No. column is gone: the number changed with every sort and filter, and the footer already says which rows you are looking at (1–20 of 1196)." },
            { type: "improvement", text: "Sort arrows show only on the column you sorted by, and on another when you point at it, so the header is no longer a row of arrows." },
            { type: "improvement", text: "Needs details is a small warning icon next to the name (point at it for the explanation) instead of a label that cut long names short. The Needs details filter still lists them all." },
            { type: "improvement", text: "Rows per page is a simple dropdown." },
            { type: "improvement", text: "Clicking a column header now goes A to Z, then Z to A, then back to the normal order (by name), so a sort can be undone without reloading the page. Point at a header to see what the next click does." },
        ],
    },
    {
        date: "2026-09-23",
        title: "Contacts and Companies: selection, sorting and filter fixes",
        items: [
            { type: "fix", text: "Ticking the header checkbox on page 2 no longer reads page 1's picks as its own. A selection now belongs to the page it was made on and clears when you change page, so a bulk delete never reaches rows you cannot see; the header box shows a dash when only part of the page is ticked." },
            { type: "fix", text: "Contacts: sorting by Owner now sorts by the owner's name. It did nothing before." },
            { type: "fix", text: "The Has email, Has phone and Has website filters open on a choice that is in their list (is true / is false) instead of a blank one. Saved views that used them keep working." },
            { type: "fix", text: "Companies: when a search or filter finds nothing, the empty list offers Clear filters, as Contacts already did." },
            { type: "improvement", text: "Text fields, dropdowns and the search box across LeadEngine now have a visible grey outline and a light fill, the same as in Sales Activity. Before, their border was white on a white card, so a form read as plain text." },
            { type: "improvement", text: "The Columns button on Contacts and Companies no longer carries a \"5/13\" badge. Open it to see how many columns are shown; each column is now a checkbox you tick to show it, with a handle to drag it into place." },
            { type: "improvement", text: "Contacts and Companies look like the lists in Sales Activity: filters, saved views and the search box have square-ish corners instead of round pills, an applied filter shows a check and a light tint, and Export (with how many rows it will write) and Import are labelled buttons next to Add contact / Add company instead of icons in the toolbar. The role chips in Roles & permissions got the same corners." },
            { type: "improvement", text: "Contacts and Companies: when there are more filters than fit on one line, they now continue on a second line instead of scrolling sideways out of sight, so every applied filter stays visible and none is cut off at the edge. Same as the filter bar in Sales Activity." },
        ],
    },
    {
        date: "2026-09-23",
        title: "History moves to Settings; the sidebar keeps one width",
        items: [
            { type: "improvement", text: "History left the sidebar and is now Settings → Monitoring → Change history, next to Usage, the way Sales Activity keeps Riwayat perubahan in Pengaturan. It is for people with access to Settings; everyone else follows a lead through its Timeline tab. Old links to /history open the new page." },
            { type: "improvement", text: "The sidebar no longer resizes by dragging its edge. It is either expanded or folded to icons with the panel toggle, at the same widths as Sales Activity, so switching between the two apps no longer makes it jump. The Pipeline's filter panel can still be dragged wider." },
        ],
    },
    {
        date: "2026-09-23",
        title: "Usage, Announcements, and a tidier Settings page",
        items: [
            { type: "feature", text: "Settings → Usage shows who actually opens LeadEngine: how many people were active today, in the last 7 and in the last 30 days out of everyone with access; a bar per day of active users, with weekends in grey; a line per person with when they were last here, days active, pages opened and an eight-week trend; and the pages opened most. Only admins can see it. All that is recorded is which page someone opened and when, one row per person per day. Nothing typed, nothing shown on a page and no location is recorded. The numbers start from the day this update arrives." },
            { type: "feature", text: "Settings → Announcements: choose which new features LeadEngine announces. When one is switched on, everyone sees a short \"What's new in LeadEngine\" window once, on the dashboard, with up to three highlights, each with a link straight to the feature, and Later or Got it to close it; on a phone it slides up from the bottom. Closing it counts on every device that person uses. Switching an announcement off hides it from everyone; switching it back on does not show it again to people who already closed it. Announce again, after a confirmation, shows it once more to every account, for example after a training. The first two, communication style on the contact page and leads from visits arriving classified, start switched off." },
            { type: "fix", text: "Settings → Roles & permissions, in the holding view: switching on Create, Edit or Delete for a module could fail with \"Perubahan tidak sampai ke semua anak perusahaan\" for every subsidiary. It happened when a subsidiary still had View off for that module, because a permission to change something you cannot see is refused. Each subsidiary now gets View switched on together with the write, the same way the holding does, so the change reaches every unit. Switch the one you tried again and it will go through." },
            { type: "improvement", text: "Settings is easier to scan: a new Adoption group holds Announcements and Usage, each row's description now shows two lines instead of being cut after a few words on a phone, and the Settings page now fits a phone's width instead of scrolling sideways. The subtitle under a Settings page title is no longer clipped at the bottom." },
        ],
    },
    {
        date: "2026-09-21",
        title: "AI usage on its own page",
        items: [
            { type: "improvement", text: "AI usage moved from a card under the connection form to its own page, Settings → AI → Usage, reached from a button in the AI page header." },
        ],
    },
    {
        date: "2026-09-21",
        title: "AI usage on the settings page",
        items: [
            { type: "feature", text: "Settings → AI shows a Usage card: tokens both apps sent through the proxy in the last 7 and 30 days, a projected week and month at the current pace, and the split per feature (Ask AI, Analyze, Sales Activity's insight and Tanya AI) and per model. Ask AI and Analyze now log their token counts." },
        ],
    },
    {
        date: "2026-09-20",
        title: "Readable AI proxy outage messages",
        items: [
            { type: "fix", text: "When the AI proxy server cannot be reached, Settings → AI and Ask AI now report it in one sentence (proxy or tunnel down, or the proxy having trouble) instead of showing Cloudflare's raw HTML error page." },
        ],
    },
    {
        date: "2026-09-20",
        title: "AI settings test the chosen models",
        items: [
            { type: "improvement", text: "Settings → AI: Save now also asks the chosen fast and reasoning models one short question, so a model the endpoint lists but that does not answer is caught on the settings page. An empty answer is reported as a plain sentence with the model's stop reason instead of a code." },
        ],
    },
    {
        date: "2026-09-20",
        title: "AI connection settings",
        items: [
            { type: "feature", text: "Settings → AI: enter the AI proxy endpoint and API key, press Test connection to see which models that endpoint serves, and pick the fast and reasoning models from the list. The key is stored encrypted in Supabase Vault and never shown again. Ask AI and Analyze on the dashboard now use this connection instead of deployment variables; the same connection is shared with Sales Activity." },
        ],
    },
    {
        date: "2026-09-19",
        title: "Communication style from the field on the contact page",
        announcement: {
            key: "contact-disc",
            title: "Communication style on the contact page",
            body: "When a Sales Activity rep records how someone communicates (their DISC style) at a visit, it now shows on that contact's page, with who assessed it and when.",
            href: "/contacts",
            hrefLabel: "Open contacts",
            defaultOn: false,
        },
        items: [
            { type: "feature", text: "When a Sales Activity rep records a DISC reading for someone they met (which letter dominates, an optional secondary letter, and how to approach them), it now appears on that contact's page under Contact Information as a Communication style (DISC) badge, with who assessed it and when. A newer reading from a later visit replaces the earlier one." },
        ],
    },
    {
        date: "2026-09-18",
        title: "Arranging the dashboard is smooth again",
        items: [
            { type: "fix", text: "Dragging or resizing a dashboard widget no longer stutters. The board took the layout into state on every frame of a drag and re-rendered everything each time; it now takes it when you let go. Chart entrance animations are off, so a re-render never replays one." },
        ],
    },
    {
        date: "2026-09-17",
        title: "The drawer keeps destinations",
        items: [
            { type: "improvement", text: "Administration in the sidebar is Settings only. Your profile, the changelog, the light or dark panel and Sign out live behind your name at the foot of the drawer, the same pattern as Sales Activity." },
            { type: "fix", text: "That account menu now takes the panel's own colours: dark when the panel is dark, and closing it leaves no focus ring on your name." },
            { type: "fix", text: "Table headers no longer turn dark with the sidebar panel; they sit on the content's own light surface." },
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
        announcement: {
            key: "visit-leads-classified",
            title: "Leads from visits arrive classified",
            body: "A lead sent from a Sales Activity visit report now carries its Category and Grade lead, and a company registered from a visit carries its industry.",
            href: "/leads",
            hrefLabel: "Open leads",
            defaultOn: false,
        },
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
