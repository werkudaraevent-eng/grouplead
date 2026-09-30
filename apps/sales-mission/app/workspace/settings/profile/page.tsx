import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { getMyProfile } from "@/lib/profile/profile-queries"
import { ProfileForm } from "./profile-form"

export const dynamic = "force-dynamic"

/**
 * Profil: the person's own name, photo, phone and job title, and their
 * password. One profile for both apps: this is the same row, the same
 * rules and the same photo file as LeadEngine's Settings › Account ›
 * Profile, so a change here shows there too.
 *
 * In Pengaturan › Akun, which every signed-in person sees: it needs no
 * grant, only a session.
 */
export default async function ProfilePage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  const profile = await getMyProfile(access)

  return (
    <WorkspacePage
      introKey={pageIntroKey("profile")}
      title="Profil"
      description="Namamu, fotomu, dan cara menghubungimu, dipakai di Sales Activity dan Group Lead."
    >
      <ProfileForm userId={access.userId} profile={profile} />
    </WorkspacePage>
  )
}
