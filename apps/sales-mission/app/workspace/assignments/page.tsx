import { Check, Clock3, UsersRound } from "lucide-react"
import { StatusBadge, WorkspacePage } from "@/app/workspace/workspace-page"

const assignments = [
  { name: "Wg, Hanung", role: "Primary", client: "PT Arunika Kreasi", date: "Today, 09:30", response: "ACCEPTED" },
  { name: "Nadia Prameswari", role: "Primary", client: "Bina Ruang Nusantara", date: "Today, 13:00", response: "PENDING" },
  { name: "Raka Adinata", role: "Supporting", client: "Langit Panggung Indonesia", date: "Tomorrow, 10:00", response: "ACCEPTED" },
]

export default function AssignmentsPage() {
  return <WorkspacePage eyebrow="Sales Mission / Assignments" title="Assignments" description="Review responses and keep every primary and supporting sales assignment clear.">
    <section className="workspace-assignment-grid">{assignments.map((assignment) => <article className="workspace-assignment-card" key={`${assignment.name}-${assignment.client}`}><div className="workspace-assignment-avatar"><UsersRound size={17} /></div><div className="workspace-assignment-copy"><strong>{assignment.name}</strong><small>{assignment.role} sales</small><p>{assignment.client}<br />{assignment.date}</p></div><StatusBadge status={assignment.response} /></article>)}</section>
    <section className="workspace-panel workspace-note-panel"><Check size={17} /><div><strong>Assignment rule</strong><p>Primary sales must accept before mission can move into field execution. Supporting sales can respond independently.</p></div></section>
  </WorkspacePage>
}
