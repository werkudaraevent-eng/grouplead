"use client"

import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { ActiveDevices } from "@/features/settings/components/active-devices"
import { pageIntroKey } from "@/lib/hints/hint-key"

/**
 * Settings › Account › Active devices: where this account is signed in, in
 * LeadEngine and Sales Activity alike. It was a card at the foot of
 * Profile; it is a page of its own now, beside Profile, as Sales Activity's
 * Perangkat aktif is (DESIGN.md "Settings layout and page width").
 *
 * Every user's own: open without the Settings grant (`isOpenSettingsPath`).
 * Checked at 360px, so it takes the phone's real width (`data-fluid-page`).
 */
export default function ActiveDevicesPage() {
    return (
        <div data-fluid-page className="min-h-[100dvh] bg-background">
            <ActiveDevices
                header={(action) => (
                    <SettingsPageHeader
                        title="Active devices"
                        subtitle="Where your account is signed in. One sign-in covers Group Lead and Sales Activity."
                        intro={pageIntroKey("settings-devices")}
                        breadcrumbs={[{ label: "Active devices" }]}
                        actions={action ?? undefined}
                        phoneActions={false}
                    />
                )}
            />
        </div>
    )
}
