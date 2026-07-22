import Link from "next/link"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <FileQuestion className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
                <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Page not found</h1>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
                    The page you're looking for doesn't exist or has been moved.
                </p>
            </div>
            <Button asChild className="mt-2">
                <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
        </div>
    )
}
