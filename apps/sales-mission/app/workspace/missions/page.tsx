import { Filter, Search } from "lucide-react"
import { MissionTable, NewMissionAction, WorkspacePage } from "@/app/workspace/workspace-page"

export default function MissionsPage() {
  return <WorkspacePage eyebrow="Sales Mission / Missions" title="Missions" description="Track planned visits, assignment responses, and mission outcomes." action={<NewMissionAction />}>
    <section className="workspace-panel workspace-list-panel">
      <div className="workspace-list-toolbar"><label className="workspace-search"><Search size={15} /><span className="sr-only">Search missions</span><input type="search" placeholder="Search client or mission" /></label><button className="workspace-secondary-button" type="button"><Filter size={14} /> Filters</button></div>
      <MissionTable />
    </section>
  </WorkspacePage>
}
