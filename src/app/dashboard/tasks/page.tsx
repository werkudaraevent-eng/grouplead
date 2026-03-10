import { TaskBoard } from "@/features/tasks/components/task-board"

export const dynamic = 'force-dynamic'

export default function TasksPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <TaskBoard />
        </div>
    )
}
