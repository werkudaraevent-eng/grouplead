import type { createClient } from "@/utils/supabase/server"
import { activityPeopleIds, isAdminRole, type ActivityRow, type RecordViewer } from "@/lib/record-activity"
import type { PeopleById } from "@/lib/record-page"

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Who is looking at a contact's or a company's page, read with the page:
 * their id and name, and whether they are an admin by the same test as
 * `fn_user_is_admin()` (what row security lets them edit, delete and tick),
 * so the ⋮ and the checkboxes are right on the first paint.
 */
export async function readRecordViewer(supabase: ServerClient): Promise<RecordViewer> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { id: null, name: null, isAdmin: false }
    const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle()
    return {
        id: user.id,
        name: (profile?.full_name as string | null | undefined) ?? null,
        isAdmin: isAdminRole(profile?.role as string | null | undefined),
    }
}

/**
 * The names and photos of the people a record's timeline names beyond its
 * authors (who a follow-up is for, who ticked it done), by id. The two
 * columns reference `auth.users`, which PostgREST cannot embed from
 * `profiles`, so they are one read after the timeline's; nothing to read,
 * no request.
 */
export async function readRecordPeople(supabase: ServerClient, activities: readonly ActivityRow[]): Promise<PeopleById> {
    const ids = activityPeopleIds(activities)
    if (ids.length === 0) return {}
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids)
    const people: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
    for (const person of data ?? []) {
        people[person.id as string] = { full_name: (person.full_name as string | null) ?? null, avatar_url: (person.avatar_url as string | null) ?? null }
    }
    return people
}
