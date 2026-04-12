import { TaskBoard } from "@/features/tasks/components/task-board"

export const dynamic = "force-dynamic"

export default function TasksPage() {
    return (
        <div className="w-full max-w-[1400px] mx-auto px-6 py-8 md:px-10 md:py-10 bg-slate-50 min-h-screen">
            <TaskBoard />
        </div>
    )
}
