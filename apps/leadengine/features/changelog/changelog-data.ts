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
        date: "2026-09-25",
        title: "Log calls, meetings, emails and follow-ups on a contact or company",
        items: [
            { type: "fix", text: "On contact pages, a long communication style no longer drops onto its own line under the badge; the lines in About this contact are evenly spaced." },
            { type: "improvement", text: "A contact's page and a company's page now open on one Activity tab instead of Overview and Activity, which showed the same things twice. At the top is the box to log something, under it Upcoming (the follow-ups still to do) and History (everything that happened), and beside them, as before, the details, the company or contacts and the leads. Old links to Overview or Activity open this tab." },
            { type: "feature", text: "Pick what you are logging above the box: Note, Call, Meeting, Email or Follow-up, and the box asks for what that kind needs. A call: how it went (Connected, No answer, Busy or Call back requested), when it happened (now unless you change it; it can't be in the future) and notes. A meeting: in person (with the location) or online (with the meeting link), when, and the outcome. An email: its subject, when, and a summary. The button says what it will do (Log call, Log meeting…) and stays grey until the fields marked * are filled. Ctrl + Enter saves." },
            { type: "feature", text: "Follow-ups replace tasks: give it a title, a due date (tomorrow unless you change it) and who should do it (you, unless you pick someone who can see this business unit). Open follow-ups are listed under Upcoming, the most urgent first, with an overdue one marked Overdue in red. Tick the box when it is done: it moves into History as \"Follow-up done\" with who did it and when, and Undo brings it back. The person it is assigned to can tick it too." },
            { type: "improvement", text: "History lists what happened by the time it happened, not the time it was typed in, so a call you log in the evening sits at the time of the call. Each row says what it was (for example \"Call · Connected\" or \"Meeting · Online\" with the meeting link to open), and the chips above it show only notes, calls, meetings, emails, follow-ups, files or changes." },
            { type: "feature", text: "Change or delete something you logged with the ⋮ on its row: Edit opens the same fields right there, and Delete asks you first. An admin can do this for anyone's notes and activity; changes the system records, files and Sales Activity visits can't be edited." },
            { type: "improvement", text: "\"Last activity\" counts notes, calls, meetings and emails only. A follow-up you set is a plan, not contact with the customer, so it no longer counts." },
            { type: "improvement", text: "Meetings you plan are still scheduled in Sales Activity; the Meeting box here is for a meeting that already happened, and says so." },
            { type: "fix", text: "Notes and activity on a contact or a company can now only be seen, and added, by people who can see that contact or company, the same as the record itself. Before, anyone signed in could read them." },
            { type: "improvement", text: "On a phone, Activity starts with the key facts and \"Add a note…\", which opens the same box from the bottom of the screen with all five kinds; Upcoming and History follow, then the company and the details." },
        ],
    },
    {
        date: "2026-09-25",
        title: "New pages for contacts and companies",
        items: [
            { type: "improvement", text: "A contact's page and a company's page have a new, cleaner layout. At the top: the ← arrow to go back to the list (it opens the way you left it), the name, the job title and company (for a company, its sector, line industry and city), and buttons for Call, Email, Edit and New lead, with ‹ › to go to the previous or next record and ⋮ for Delete. Under the name you see at a glance who owns the record, the phone number, the email (or a company's website) and the last activity. The top of the page lines up with the cards below it, edge to edge." },
            { type: "feature", text: "\"Last activity\" shows the most recent note, call, email, meeting or task, for example \"Call · 2 days ago\", so you can see straight away when someone last talked to this person or company." },
            { type: "feature", text: "Write a note or log a call, an email, a meeting or a task right on the Overview tab: pick the kind above the box, type, and press Save (or Ctrl + Enter). It appears at once under Recent activity. The box is only on Overview; on the Activity tab, Log activity takes you straight to it." },
            { type: "improvement", text: "The page has tabs: Overview, Activity, Leads and Files (a company also has Contacts). Activity lists everything that happened, newest first, and you can show only notes, calls, emails, meetings, tasks, files or changes. You can still edit or delete your own notes there. Activity, Leads, Contacts and Files use the full width of the page." },
            { type: "improvement", text: "Buttons you can't use yet are now plainly grey, the same way everywhere in LeadEngine, instead of a paler shade of their colour: for example Save note before you have typed anything, or Call and Email when a contact has no phone number or email address. Point at a grey Call or Email to see why." },
            { type: "improvement", text: "On the right, \"About this contact\" (or company) lists every field. Click a value to change it; fields with nothing in them are tucked under \"Show N empty fields\". Field names are written normally (\"Segment tier\") instead of in small capital letters. A contact's page also shows its company and its open leads; a company's page shows its contacts, its open leads and its parent company or subsidiaries." },
            { type: "feature", text: "New lead on a contact's or a company's page opens the lead form with the company (and the contact) already filled in, in the pipeline you last used." },
            { type: "feature", text: "A contact or a company can be deleted from its own page (⋮, then Delete). It goes to the Recycle Bin, the same as deleting it from the list." },
            { type: "improvement", text: "On a phone, both pages fit the screen. Under the name are Call, WhatsApp, Email and Note buttons (a company: Call, Website and Note); the tabs stay under the top bar as you scroll; \"Add a note…\" opens the note box from the bottom of the screen. The ⋮ at the top right has Edit, Email, the previous and next record, and Delete." },
            { type: "fix", text: "Owner shows the person who owns the record, with their photo or initials. A contact that was imported belongs to whoever imported it, so one imported from a shared account shows that account (for example \"Werkudara Group\"); pick the right person in the Owner field." },
            { type: "fix", text: "Leads and contacts that are in the Recycle Bin no longer show on a contact's or a company's page." },
        ],
    },
    {
        date: "2026-09-24",
        title: "LeadEngine on a phone now works like Sales Activity",
        items: [
            { type: "improvement", text: "On a phone or a small tablet, the side menu no longer slides over the page. Dashboard, Pipeline, Companies and Contacts are in a bar along the bottom of the screen, the same as in Sales Activity, and you only see the ones your role can open." },
            { type: "feature", text: "More, at the right end of that bar, holds everything else: Settings and the Changelog (if your role can open Settings), My profile, the business unit you are viewing (tap it to switch to another unit or to the whole Werkudara Group), a shortcut to Sales Activity, and Sign out." },
            { type: "improvement", text: "The top of the screen shows the page's name. On a record or a page inside Settings, the arrow at its left takes you back to the page above; on Contacts, Companies and Pipeline, the ⋮ at its right holds Export and Import (and on Pipeline, renaming, cloning or deleting the pipeline and managing its stages)." },
            { type: "improvement", text: "Add contact, Add company and New lead are a large button at the bottom right of the screen, just above the bar, so they are always in reach while you scroll. The last rows and the Load more button are never hidden behind it." },
            { type: "improvement", text: "The search and filters on Contacts and Companies still slide away as you scroll down and come back just under the top bar when you scroll up. On a computer nothing changes." },
            { type: "improvement", text: "On a phone the Dashboard now fits the screen instead of sliding sideways. The number cards sit two to a row with their whole names, and every chart and list takes the full width, one under the other, in the order you arranged them on a computer. A long list scrolls inside its own card." },
            { type: "improvement", text: "On a phone the Dashboard's filters work like the ones on Pipeline: tap Filter under the dashboard's name and a panel comes up from the bottom with three lines, Pipeline, Business unit and Date range, each showing what it is set to. Tap one to change it: pick a pipeline or a business unit from its list (with a search when there are more than eight units), or tap a quick range such as This Year; Custom range… opens a calendar where you tap a start day and then an end day. The dashboard changes at once and you are back at the three lines. The number on the button says how many filters differ from how the dashboard first opens, and what you chose is listed under the button: tap ✕ to remove one, or Clear all (also at the bottom of the panel) to go back to the start." },
            { type: "improvement", text: "On a phone the ⋮ at the top right of the Dashboard holds your saved views (switch between them, or save the filters you changed), Print / Save PDF, AI Analyze, Ask AI, and How the numbers are counted, which explains each number card. Arranging and resizing widgets, and renaming or deleting views, is done on a computer." },
            { type: "improvement", text: "The Monthly Revenue chart shows its amounts with your currency (for example Rp 2.2B) on every screen, and on a phone it labels every other month so the names do not run together." },
            { type: "feature", text: "On a phone, Pipeline now shows its stages as tabs across the top, each with how many leads it holds and what they are worth. Tap a stage (swipe the row to see the rest) and its leads are listed under it as cards: the project, the client, the badges you chose in Card Settings (such as business unit, grade and Hot / Warm / Cold), the value and the closing date, marked Overdue once it has passed, and the PIC sales. The stage you picked stays when you come back from a lead or reload the page. On a computer or a tablet the board is unchanged." },
            { type: "feature", text: "To move a lead on a phone, tap ⋮ on its card, choose Move to stage…, then pick the stage. The same rules apply as when you drag a card on the board: a stage that asks for details or a note still asks, and moving back to an earlier stage still asks you to confirm. Edit and Delete are in the same ⋮." },
            { type: "improvement", text: "On a phone, the ⋮ at the top right of Pipeline now has Switch pipeline, to open another pipeline (and New pipeline, if your role can create one), because the list of pipelines at the left side is not shown there." },
            { type: "improvement", text: "On a phone, Filter on Pipeline now opens a panel from the bottom that lists every field you can filter by, such as PIC Sales, Grade, Stage, Estimated Value and Target Close Date. Tap a field to tick the values you want (or to leave them out), or to type an amount, pick a date or type a word; the stage tabs and cards update as you go. What you chose shows under the search with an ✕ to remove each one, or Clear all. Filters set on a computer show up here too, and the other way round." },
            { type: "improvement", text: "On a phone, rows you swipe sideways (the Pipeline's stage tabs, the chips under a search, the saved views) now fade at each edge where there is more to see, on the left as well as the right, so a stage or chip cut off at the edge no longer looks broken. The stage you are on always sits clear of the fade." },
            { type: "improvement", text: "On a phone, the cards on Contacts and Companies now look like the cards in Sales Activity: the name gets the full width, the details sit under it, and the bottom of each card shows who owns the record (or \"No owner\") with the ⋮ menu beside it." },
            { type: "improvement", text: "On a phone, Add company, Add contact and their Edit forms now fill the whole screen, like creating an activity in Sales Activity: ✕ at the top left closes the form, the fields run in one column, and Cancel and Create stay at the bottom of the screen while you scroll. On a computer the form still opens at the right side of the page." },
            { type: "fix", text: "On a phone, the title at the top of a panel that comes up from the bottom (Filter, More, Views and the others) now stays clear while you scroll the panel: the list slides under it instead of showing through the line under the title. A panel that starts with a search box no longer opens the keyboard until you tap the box." },
            { type: "fix", text: "In the Add company form on a phone, the Phone field no longer runs into the Website field: the fields are now one under the other and the phone number fits its box." },
            { type: "fix", text: "Fields your admin added to the company, contact and lead forms (such as Segment tier) now have labels in the same style as every other field, instead of small capital letters." },
        ],
    },
    {
        date: "2026-09-24",
        title: "One compact header on every page",
        items: [
            { type: "improvement", text: "On a phone, Contacts and Companies give the screen to the list as you scroll down: the saved views, the search and the filter chips slide out of the way, and come back under the top bar as soon as you scroll up a little. They stay put while you are typing a search or have the Filter panel open, and the gaps between the search, the chips and the first card are now even." },
            { type: "improvement", text: "Every page now has the same compact header as Contacts and Companies: the title and its buttons on one slim row at the top. The title keeps its size as you scroll and no longer jumps when you move between pages." },
            { type: "improvement", text: "The sentence under a page's title that explains what the page is for can be closed with ✕. Once closed, it stays closed on every device you use. Lines that tell you something current, such as when the dashboard was last updated, always show." },
            { type: "improvement", text: "Pages under Settings show \"Settings\" (and, where there is one, the page above, such as \"Settings / AI\") just above the title. Click it to go back." },
            { type: "improvement", text: "Change history shows how many events match your filters at the bottom of the list, even when they fit on one page." },
            { type: "fix", text: "The top of the side menu is now exactly as tall as the page's title row, so the logo, the title and the buttons at the top sit on one line." },
            { type: "fix", text: "The ✕ that closes a page's description now sits right after its last word, even when the sentence runs onto a second line, instead of far off to the right." },
            { type: "improvement", text: "On Contacts and Companies, saved views now live in one Views button at the right of the search and filters, beside the Columns button. It shows the name of the view you are looking at; open it to switch to another view or back to the Default view (the list as it first opens), or to save, rename, set as default or delete a view. The row of view buttons above the search is gone on a computer, so the table no longer moves down when you save a view. On a phone, saved views stay above the search." },
            { type: "improvement", text: "Deleting a view from the Views button no longer asks you to confirm: the message that follows has an Undo button that brings the view back. A view can now also stop being your default (Remove default)." },
            { type: "improvement", text: "While a search or filter is on, the bottom left of the Contacts and Companies tables says how many of the list match (\"170 of 1,196 contacts\"). Without a filter it stays empty: the bottom right already says how many there are." },
        ],
    },
    {
        date: "2026-09-24",
        title: "Contacts and Companies: a slimmer header",
        items: [
            { type: "improvement", text: "The title of Contacts and Companies now sits on one slim row with its buttons, so the table starts higher and shows more rows." },
            { type: "improvement", text: "The sentence under the title can be dismissed with ✕. Once dismissed, it stays hidden on that list on every device you use." },
            { type: "fix", text: "The ⋮ column at the right edge of the table now has a thin line and shadow on its left, so columns scrolling under it no longer look cut off." },
        ],
    },
    {
        date: "2026-09-24",
        title: "The app's typeface now actually loads",
        items: [
            { type: "fix", text: "LeadEngine now really uses Plus Jakarta Sans. Until now the setting never reached the page, so text showed in the device's default font." },
            { type: "improvement", text: "Scrollbars in tables and lists are the slim kind without arrow buttons on Windows." },
            { type: "fix", text: "The Columns menu on Contacts and Companies no longer runs off the bottom of a short window: it fits the space available and its list scrolls." },
        ],
    },
    {
        date: "2026-09-23",
        title: "Contacts and Companies: faster, remembered, linkable, and made for a phone",
        items: [
            { type: "improvement", text: "Contacts and Companies load one page at a time instead of every record at once, so they open quickly however many records there are. Search, filters and sorting still cover the whole list, and the footer says how many match (1–25 of 1,196 contacts)." },
            { type: "improvement", text: "Paging is Previous and Next, with 25, 50 or 100 rows per page, the same as the lists in Sales Activity." },
            { type: "feature", text: "Your search, filters, sort and page are in the address bar, so you can send a colleague the exact list you are looking at, and refreshing the page keeps it." },
            { type: "feature", text: "Each list reopens the way you left it: open a contact, go elsewhere, come back to Contacts, and your search, filters and sort are still there. Clear all starts again from the full list (it now clears the search as well)." },
            { type: "improvement", text: "Saved views work the same way: choosing one sets its search, filters, sort and columns, and Save view saves what you see. The list you left always comes back first; a default view is used when you open the list for the first time in a browser." },
            { type: "improvement", text: "Every column can be sorted, including a contact's company and owner and a company's owner and parent company. Empty values go to the end. Social links cannot be sorted." },
            { type: "improvement", text: "Export writes every contact or company that matches your search and filters (up to 5,000), not only the page on screen, and the button shows how many it will write. Exporting ticked rows works as before." },
            { type: "improvement", text: "The name in each row is a real link: Ctrl-click or Cmd-click opens the record in a new tab, and clicking anywhere else on the row still opens it." },
            { type: "feature", text: "On a phone, Contacts and Companies fit the screen: one card per record with its name, company or sector, and email or phone; filters behind a Filter button, with the ones you applied shown under the search; Load more at the bottom. Add stays at the top, Export and Import are in the ⋮ menu. Ticking several records to delete, export or merge them is done on a computer." },
            { type: "improvement", text: "When you work in one business unit, the lists show that unit's contacts and companies plus the ones not assigned to any unit. The holding view shows everything, as before." },
            { type: "fix", text: "A filter set to \"is not\" now says so on its chip (Sector: not Hotel), and the Created date filter's \"before\" and \"after\" options now find records; they found none before." },
        ],
    },
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
