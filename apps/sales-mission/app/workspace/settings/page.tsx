import { Bell, Building2, ShieldCheck } from "lucide-react"
import { WorkspacePage } from "@/app/workspace/workspace-page"

export default function SettingsPage() {
  return <WorkspacePage eyebrow="Sales Mission / Administration" title="Settings" description="Configure how missions are planned, assigned, and communicated across your team.">
    <section className="workspace-settings-grid"><article className="workspace-panel workspace-setting-card"><span className="workspace-setting-icon workspace-setting-icon-blue"><Building2 size={17} /></span><h2>Mission defaults</h2><p>Set mission types, default travel buffer, business hours, and conflict rules.</p><button className="workspace-secondary-button" type="button">Configure defaults</button></article><article className="workspace-panel workspace-setting-card"><span className="workspace-setting-icon workspace-setting-icon-amber"><Bell size={17} /></span><h2>Notifications</h2><p>Control assignment reminders and reschedule request alerts.</p><button className="workspace-secondary-button" type="button">Manage notifications</button></article><article className="workspace-panel workspace-setting-card"><span className="workspace-setting-icon workspace-setting-icon-green"><ShieldCheck size={17} /></span><h2>Access</h2><p>Sales Mission access is managed through LeadEngine permissions.</p><button className="workspace-secondary-button" type="button">View access rules</button></article></section>
  </WorkspacePage>
}
